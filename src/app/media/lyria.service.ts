import { Injectable, inject } from '@angular/core';
import type { GoogleGenAI, LiveMusicServerMessage } from '@google/genai';
import { ApiKeysService } from './api-keys.service';
import {
  bytesToDataUrl,
  concatInt16,
  crossfadeEdges,
  encodeWav,
  pcm16FromBase64,
} from './wav';

export const MUSIC_MODEL = 'models/lyria-realtime-exp';

/** Lyria RealTime streams raw 16-bit PCM at 48kHz, stereo. */
const SAMPLE_RATE = 48000;
const CHANNELS = 2;

export interface MusicOptions {
  /** How many seconds of audio to capture into the loop. */
  seconds?: number;
  bpm?: number;
  /** 0-1; how busy the arrangement is. */
  density?: number;
  /** 0-1; tonal brightness. */
  brightness?: number;
  /** Drop the drum track — usually right for quiet background music. */
  muteDrums?: boolean;
}

/**
 * Captures a fixed-length music loop from Lyria RealTime.
 *
 * Lyria is a live, open-ended stream rather than a render-a-file API, so the
 * only way to get a reusable asset is to connect, record N seconds, and close.
 * The captured audio is fade-topped-and-tailed so it loops without a click.
 */
@Injectable({ providedIn: 'root' })
export class LyriaService {
  private readonly keys = inject(ApiKeysService);

  async generateMusicLoop(
    prompt: string,
    options: MusicOptions = {},
  ): Promise<string> {
    const apiKey = this.keys.geminiKey().trim();
    if (!apiKey) {
      throw new Error(
        'No Gemini API key saved. Add one on the Keys tab to generate music.',
      );
    }

    const seconds = Math.min(Math.max(options.seconds ?? 20, 4), 60);
    const wanted = seconds * SAMPLE_RATE * CHANNELS;
    // Loaded on demand — see the note in GeminiImageService.
    const { GoogleGenAI } = await import('@google/genai');
    const ai: GoogleGenAI = new GoogleGenAI({ apiKey });

    const chunks: Int16Array[] = [];
    let captured = 0;

    return new Promise<string>((resolve, reject) => {
      let session: Awaited<ReturnType<typeof ai.live.music.connect>> | undefined;
      let settled = false;

      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        try {
          session?.stop();
          session?.close();
        } catch {
          /* already closed */
        }
        if (error) {
          reject(error);
          return;
        }
        if (chunks.length === 0) {
          reject(new Error('Lyria returned no audio. Try a different prompt.'));
          return;
        }
        const pcm = crossfadeEdges(
          concatInt16(chunks).slice(0, wanted),
          CHANNELS,
          Math.floor(SAMPLE_RATE * 0.25),
        );
        resolve(
          bytesToDataUrl(encodeWav(pcm, SAMPLE_RATE, CHANNELS), 'audio/wav'),
        );
      };

      // Generation runs slower than realtime, so allow generous headroom
      // before giving up on a stream that has stalled.
      const timeout = setTimeout(
        () => finish(new Error('Timed out waiting for music from Lyria.')),
        (seconds + 45) * 1000,
      );

      ai.live.music
        .connect({
          model: MUSIC_MODEL,
          callbacks: {
            onmessage: (message: LiveMusicServerMessage) => {
              if (message.filteredPrompt) {
                finish(
                  new Error(
                    `Lyria filtered that prompt: ${
                      message.filteredPrompt.filteredReason ?? 'no reason given'
                    }`,
                  ),
                );
                return;
              }
              const data = message.serverContent?.audioChunks?.[0]?.data;
              if (!data) return;
              const samples = pcm16FromBase64(data);
              chunks.push(samples);
              captured += samples.length;
              if (captured >= wanted) finish();
            },
            onerror: () => finish(new Error('Lyria connection error.')),
            onclose: () => finish(),
          },
        })
        .then(async (connected) => {
          session = connected;
          await connected.setWeightedPrompts({
            weightedPrompts: [{ text: prompt, weight: 1.0 }],
          });
          await connected.setMusicGenerationConfig({
            musicGenerationConfig: {
              bpm: options.bpm ?? 100,
              density: options.density ?? 0.5,
              brightness: options.brightness ?? 0.6,
              muteDrums: options.muteDrums ?? false,
            },
          });
          connected.play();
        })
        .catch((error: unknown) =>
          finish(error instanceof Error ? error : new Error(String(error))),
        );
    });
  }
}
