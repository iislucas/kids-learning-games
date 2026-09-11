/**
 * Generates each character's voiced clips with Gemini text-to-speech.
 *
 * Outputs:
 *   public/media/voices/<character>/<event>-<n>.m4a
 *
 * Run with:  pnpm run gen:voices          (only makes clips that are missing)
 *            pnpm run gen:voices --force  (remakes all of them)
 *
 * The lines, voices and moods live in `src/app/media/voice-lines.ts`, which the
 * app reads too, so the two cannot disagree about what exists. The outputs are
 * committed, so a fresh clone plays them with no API key.
 *
 * Needs a Gemini key in `public/local-keys.json`, and macOS `afconvert` to
 * encode AAC: a second of 24 kHz WAV is ~50 kB, the same as AAC is ~10 kB,
 * and there are a couple of dozen of these.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHARACTER_VOICES,
  MOODS,
  VOICED_EVENTS,
  voiceClipPath,
} from '../src/app/media/voice-lines.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = 'gemini-3.1-flash-tts-preview';
const FORCE = process.argv.includes('--force');

function geminiKey(): string {
  const file = join(ROOT, 'public', 'local-keys.json');
  if (!existsSync(file)) {
    throw new Error('No public/local-keys.json — copy local-keys.example.json and add a Gemini key.');
  }
  const key = (JSON.parse(readFileSync(file, 'utf8')) as { gemini?: string }).gemini?.trim();
  if (!key) throw new Error('public/local-keys.json has no Gemini key.');
  return key;
}

async function speak(key: string, text: string, voiceName: string): Promise<{ pcm: Int16Array; rate: number }> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
        },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Gemini TTS returned ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  const body = (await response.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data: string; mimeType: string } }[] } }[];
  };
  const audio = body.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData;
  if (!audio) throw new Error(`No audio came back for "${text}".`);

  // Signed 16-bit little-endian PCM, e.g. `audio/l16; rate=24000; channels=1`.
  const rate = Number(/rate=(\d+)/.exec(audio.mimeType)?.[1] ?? 24000);
  const bytes = Buffer.from(audio.data, 'base64');
  const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.length / 2));
  return { pcm: Int16Array.from(pcm), rate };
}

/**
 * Trims the silence the model pads each clip with, fades the ends so the cut
 * does not click, and evens out the loudness between lines — otherwise one
 * "Yay!" is a whisper and the next is a shout.
 */
export function tidy(pcm: Int16Array, rate: number): Int16Array {
  const threshold = 600;
  let start = 0;
  while (start < pcm.length && Math.abs(pcm[start]) < threshold) start++;
  let end = pcm.length - 1;
  while (end > start && Math.abs(pcm[end]) < threshold) end--;
  if (end <= start) return pcm;

  const pad = Math.round(rate * 0.04);
  const out = pcm.slice(Math.max(0, start - pad), Math.min(pcm.length, end + pad));

  let peak = 1;
  for (const sample of out) peak = Math.max(peak, Math.abs(sample));
  const gain = (0.85 * 32767) / peak;

  const fade = Math.min(Math.round(rate * 0.012), Math.floor(out.length / 2));
  for (let i = 0; i < out.length; i++) {
    const edge = Math.min(i, out.length - 1 - i);
    const envelope = edge < fade ? edge / fade : 1;
    out[i] = Math.max(-32768, Math.min(32767, Math.round(out[i] * gain * envelope)));
  }
  return out;
}

function wav(pcm: Int16Array, rate: number): Buffer {
  const data = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

async function main(): Promise<void> {
  try {
    execFileSync('afconvert', ['-h'], { stdio: 'ignore' });
  } catch (error) {
    // `afconvert -h` exits non-zero but exists; only a missing binary throws ENOENT.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('This needs macOS `afconvert` to encode the clips as AAC.');
    }
  }

  const key = geminiKey();
  const scratch = mkdtempSync(join(tmpdir(), 'voices-'));
  let made = 0;
  let skipped = 0;

  try {
    for (const [characterId, voice] of Object.entries(CHARACTER_VOICES)) {
      for (const event of VOICED_EVENTS) {
        for (const [index, line] of voice.lines[event].entries()) {
          const relative = join('public', voiceClipPath(characterId, event, index));
          const target = join(ROOT, relative);
          if (!FORCE && existsSync(target)) {
            skipped++;
            continue;
          }

          const direction =
            `Say this in ${voice.style}, sounding ${MOODS[event]}. ` +
            `Keep it short and just say the words: "${line}"`;
          const { pcm, rate } = await speak(key, direction, voice.voiceName);

          const temp = join(scratch, 'clip.wav');
          writeFileSync(temp, wav(tidy(pcm, rate), rate));
          mkdirSync(dirname(target), { recursive: true });
          execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '48000', temp, target]);

          console.log(`  ${relative}  "${line}"  (${(statSync(target).size / 1024).toFixed(1)} kB)`);
          made++;
        }
      }
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  console.log(`Done: ${made} made, ${skipped} already there.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
