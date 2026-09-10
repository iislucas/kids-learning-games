/**
 * Generates the default media that ships in the repo, so the game is fun on a
 * fresh clone with no API keys at all.
 *
 * Outputs:
 *   public/media/sounds/*.wav          UI and reward sounds
 *   public/media/music/happy-loop.wav  short looping background bed
 *
 * Run with:  pnpm run gen:media
 * (Node 24 strips the types natively, so this needs no build step.)
 *
 * These outputs are committed. Regenerate them by editing this file and
 * re-running; the media studio can then override any of them at runtime.
 *
 * **The pictures are not here.** The character sheets and the map's tiles and
 * scenery are generated with an image model in the media studio and committed
 * from there (see `src/app/media/default-pack.ts`) — a synthesised WAV is a
 * perfectly good sound effect, but programmatically drawn art only ever looked
 * programmatically drawn. `src/app/explore/map-art.ts` still draws tiles and
 * props at runtime, as the fallback for a pack whose art has been cleared.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ─────────────────────────────────────────────────────────────────────────────
// Sounds
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE_RATE = 22050;

function encodeWav(samples: Float32Array, sampleRate: number): Buffer {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  return buffer;
}

/** Semitone offset from A4 (440Hz) to frequency. */
function note(semitonesFromA4: number): number {
  return 440 * Math.pow(2, semitonesFromA4 / 12);
}

interface ToneSpec {
  freq: number;
  start: number;
  duration: number;
  gain?: number;
  /** Soft bell-ish timbre by default; 'square' is punchier for UI clicks. */
  timbre?: 'bell' | 'soft' | 'square';
  /** Linear pitch glide to this frequency over the note. */
  glideTo?: number;
}

function renderTones(tones: ToneSpec[], totalSeconds: number): Float32Array {
  const out = new Float32Array(Math.ceil(totalSeconds * SAMPLE_RATE));

  for (const tone of tones) {
    const startSample = Math.floor(tone.start * SAMPLE_RATE);
    const lengthSamples = Math.floor(tone.duration * SAMPLE_RATE);
    const gain = tone.gain ?? 0.3;
    const timbre = tone.timbre ?? 'bell';

    let phase = 0;
    for (let i = 0; i < lengthSamples; i++) {
      const index = startSample + i;
      if (index >= out.length) break;
      const t = i / lengthSamples;

      // Percussive decay, with a short attack so nothing clicks on onset.
      const attack = Math.min(1, i / (SAMPLE_RATE * 0.006));
      const envelope = attack * Math.pow(1 - t, timbre === 'square' ? 1.6 : 2.4);

      const freq = tone.glideTo
        ? tone.freq + (tone.glideTo - tone.freq) * t
        : tone.freq;
      phase += (2 * Math.PI * freq) / SAMPLE_RATE;

      let sample: number;
      if (timbre === 'square') {
        sample = Math.sign(Math.sin(phase)) * 0.6 + Math.sin(phase) * 0.4;
      } else if (timbre === 'soft') {
        sample = Math.sin(phase);
      } else {
        // A couple of quiet inharmonic partials give it a music-box ring.
        sample =
          Math.sin(phase) +
          0.34 * Math.sin(phase * 2) +
          0.14 * Math.sin(phase * 3.01) +
          0.05 * Math.sin(phase * 4.7);
        sample /= 1.53;
      }

      out[index] += sample * envelope * gain;
    }
  }

  // Gentle soft-clip; layered notes can otherwise sum past full scale.
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] * 1.1);
  return out;
}

const C5 = note(3);
const D5 = note(5);
const E5 = note(7);
const G5 = note(10);
const A5 = note(12);
const C6 = note(15);
const E6 = note(19);
const G6 = note(22);
const G4 = note(-2);
const E4 = note(-5);
const C4 = note(-9);

const SOUNDS: Record<string, { tones: ToneSpec[]; length: number }> = {
  // Bright rising arpeggio — unmistakably "yes!".
  correct: {
    length: 0.75,
    tones: [
      { freq: C5, start: 0, duration: 0.22 },
      { freq: E5, start: 0.07, duration: 0.24 },
      { freq: G5, start: 0.14, duration: 0.3 },
      { freq: C6, start: 0.21, duration: 0.5, gain: 0.34 },
      { freq: E6, start: 0.28, duration: 0.42, gain: 0.16 },
    ],
  },
  // Deliberately warm and soft: a gentle "not quite", never a buzzer.
  wrong: {
    length: 0.5,
    tones: [
      { freq: G4, start: 0, duration: 0.18, timbre: 'soft', gain: 0.28 },
      { freq: E4, start: 0.12, duration: 0.3, timbre: 'soft', gain: 0.26 },
    ],
  },
  prize: {
    length: 1.3,
    tones: [
      { freq: C5, start: 0.0, duration: 0.18 },
      { freq: E5, start: 0.1, duration: 0.18 },
      { freq: G5, start: 0.2, duration: 0.18 },
      { freq: C6, start: 0.3, duration: 0.22 },
      { freq: E6, start: 0.4, duration: 0.22 },
      { freq: G6, start: 0.5, duration: 0.7, gain: 0.32 },
      { freq: C6, start: 0.5, duration: 0.75, gain: 0.2 },
      { freq: G5, start: 0.5, duration: 0.8, gain: 0.14 },
    ],
  },
  levelUp: {
    length: 0.95,
    tones: [
      { freq: C5, start: 0, duration: 0.5, glideTo: C6, timbre: 'soft', gain: 0.22 },
      { freq: G5, start: 0.34, duration: 0.28 },
      { freq: C6, start: 0.44, duration: 0.45, gain: 0.32 },
      { freq: E6, start: 0.52, duration: 0.4, gain: 0.18 },
    ],
  },
  tap: {
    length: 0.13,
    tones: [{ freq: A5, start: 0, duration: 0.09, timbre: 'square', gain: 0.16 }],
  },
  finish: {
    length: 1.5,
    tones: [
      { freq: C5, start: 0.0, duration: 0.26 },
      { freq: C5, start: 0.18, duration: 0.22 },
      { freq: G5, start: 0.36, duration: 0.26 },
      { freq: E5, start: 0.56, duration: 0.26 },
      { freq: A5, start: 0.76, duration: 0.3 },
      { freq: G5, start: 0.98, duration: 0.5, gain: 0.32 },
      { freq: C6, start: 0.98, duration: 0.5, gain: 0.2 },
    ],
  },
};

/**
 * A calm 8-bar loop. Kept mono at 22kHz because it is committed to the repo and
 * plays under everything else, where fidelity matters far less than file size.
 */
function buildMusicLoop(): Float32Array {
  const beat = 0.5; // 120bpm
  const bars = 4;
  const length = bars * 4 * beat;
  const tones: ToneSpec[] = [];

  // I - vi - IV - V, the friendliest progression there is.
  const chords = [
    [C4, E4, G4],
    [note(-12), C4, E4],
    [note(-7), C4, note(5)],
    [note(-2), note(2), note(5)],
  ];

  chords.forEach((chord, bar) => {
    const barStart = bar * 4 * beat;
    chord.forEach((freq, voice) => {
      tones.push({
        freq,
        start: barStart,
        duration: beat * 3.6,
        gain: 0.1 - voice * 0.015,
        timbre: 'soft',
      });
    });
    // A simple arpeggio over the top to keep it moving.
    for (let step = 0; step < 4; step++) {
      tones.push({
        freq: chord[step % chord.length] * 4,
        start: barStart + step * beat,
        duration: beat * 0.8,
        gain: 0.055,
      });
    }
  });

  const samples = renderTones(tones, length);
  // Fade the seam so the loop point is inaudible.
  const fade = Math.floor(SAMPLE_RATE * 0.12);
  for (let i = 0; i < fade; i++) {
    const gain = i / fade;
    samples[i] *= gain;
    samples[samples.length - 1 - i] *= gain;
  }
  return samples;
}

// ─────────────────────────────────────────────────────────────────────────────

function write(relativePath: string, contents: Buffer | string): void {
  const target = join(ROOT, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
  const size = typeof contents === 'string' ? Buffer.byteLength(contents) : contents.length;
  console.log(`  ${relativePath}  (${(size / 1024).toFixed(1)} kB)`);
}

function main(): void {
  console.log('Generating default sounds...');

  for (const [id, spec] of Object.entries(SOUNDS)) {
    write(
      `public/media/sounds/${id}.wav`,
      encodeWav(renderTones(spec.tones, spec.length), SAMPLE_RATE),
    );
  }

  write('public/media/music/happy-loop.wav', encodeWav(buildMusicLoop(), SAMPLE_RATE));
  console.log('Done.');
}

main();
