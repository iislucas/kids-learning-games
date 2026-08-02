import { Injectable, inject } from '@angular/core';
import { ApiKeysService } from './api-keys.service';
import { blobToDataUrl } from './wav';

const SOUND_ENDPOINT = 'https://api.elevenlabs.io/v1/sound-generation';

export interface SoundEffectOptions {
  /** 0.5 - 30 seconds. */
  durationSeconds?: number;
  /** 0 - 1; higher follows the prompt more literally, lower is more creative. */
  promptInfluence?: number;
  /** Ask for a seamless loop — used for music beds and ambience. */
  loop?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ElevenLabsService {
  private readonly keys = inject(ApiKeysService);

  /**
   * Text to sound effect. Returns an audio data URI ready to store in a media
   * pack and play through Howler.
   */
  async generateSound(
    prompt: string,
    options: SoundEffectOptions = {},
  ): Promise<string> {
    const apiKey = this.keys.elevenLabsKey().trim();
    if (!apiKey) {
      throw new Error(
        'No ElevenLabs API key saved. Add one on the Keys tab to generate sounds.',
      );
    }

    const response = await fetch(SOUND_ENDPOINT, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: prompt,
        duration_seconds: options.durationSeconds,
        prompt_influence: options.promptInfluence ?? 0.3,
        loop: options.loop ?? false,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `ElevenLabs returned ${response.status}: ${await readError(response)}`,
      );
    }

    return blobToDataUrl(await response.blob());
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    // Their errors are JSON with a nested detail message; fall back to raw text.
    try {
      const parsed = JSON.parse(text) as {
        detail?: { message?: string } | string;
      };
      if (typeof parsed.detail === 'string') return parsed.detail;
      if (parsed.detail?.message) return parsed.detail.message;
    } catch {
      /* not JSON */
    }
    return text.slice(0, 300) || response.statusText;
  } catch {
    return response.statusText;
  }
}
