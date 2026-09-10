/**
 * Generates the default media that ships in the repo, so the game is fun on a
 * fresh clone with no API keys at all.
 *
 * Outputs:
 *   public/media/characters/sparkle-fox.svg       8-pose sprite sheet (4x2, 200px cells)
 *   public/media/characters/sparkle-fox-walk.svg  walk cycle (4 frames x 8 directions)
 *   public/media/sounds/*.wav                     UI and reward sounds
 *   public/media/music/happy-loop.wav             short looping background bed
 *
 * Run with:  pnpm run gen:media
 * (Node 24 strips the types natively, so this needs no build step.)
 *
 * These outputs are committed. Regenerate them by editing this file and
 * re-running; the media studio can then override any of them at runtime.
 *
 * The map background is deliberately NOT here: it is drawn at runtime from the
 * same layout the signposts are placed from (`src/app/explore/map-art.ts`), so
 * that art and tappable spots cannot drift apart, and adding a challenge needs
 * no regenerated asset.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ─────────────────────────────────────────────────────────────────────────────
// Character sprite sheet
// ─────────────────────────────────────────────────────────────────────────────

export const CELL = 200;
export const COLS = 4;
export const ROWS = 2;

const FUR = '#f4863b';
const FUR_DARK = '#d96a22';
const CREAM = '#fff2e0';
const SCARF = '#e8484f';
const DARK = '#3d2b1f';
const PINK = '#ffb3b8';

type Eyes = 'open' | 'happy' | 'wide' | 'blink' | 'puzzled';
type Mouth = 'smile' | 'bigOpen' | 'small' | 'oh' | 'grin';
type Legs = 'stand' | 'jump' | 'kick';

interface Pose {
  name: string;
  /**
   * Arm rotation in degrees; 0 hangs straight down. SVG rotation is clockwise
   * with y pointing down, so a POSITIVE angle swings an arm towards the left of
   * the image. Outward-and-up is therefore positive on the left arm and
   * negative on the right — getting this backwards makes the character hug
   * itself instead of cheering.
   */
  armL: number;
  armR: number;
  eyes: Eyes;
  mouth: Mouth;
  legs: Legs;
  /** Vertical offset of the whole body (negative = airborne). */
  dy: number;
  /** Whole-body tilt in degrees. */
  tilt: number;
  sparkles: boolean;
  /** Renders a raised thumb on the right paw. */
  thumbsUp: boolean;
}

/**
 * Must stay in the same order as POSE_PLAN in src/app/media/sprite-prompt.ts:
 * two idle, two correct, two wrong, two celebrate.
 */
const POSES: Pose[] = [
  { name: 'idle-1', armL: 10, armR: -10, eyes: 'open', mouth: 'smile', legs: 'stand', dy: 0, tilt: 0, sparkles: false, thumbsUp: false },
  { name: 'idle-2', armL: 16, armR: -16, eyes: 'blink', mouth: 'small', legs: 'stand', dy: 3, tilt: 0, sparkles: false, thumbsUp: false },
  { name: 'correct-1', armL: 62, armR: -62, eyes: 'wide', mouth: 'oh', legs: 'stand', dy: -4, tilt: 0, sparkles: true, thumbsUp: false },
  { name: 'correct-2', armL: 152, armR: -152, eyes: 'happy', mouth: 'bigOpen', legs: 'stand', dy: -8, tilt: 0, sparkles: true, thumbsUp: false },
  { name: 'wrong-1', armL: 42, armR: -42, eyes: 'puzzled', mouth: 'small', legs: 'stand', dy: 2, tilt: -7, sparkles: false, thumbsUp: false },
  { name: 'wrong-2', armL: 14, armR: -128, eyes: 'happy', mouth: 'smile', legs: 'stand', dy: 0, tilt: 0, sparkles: false, thumbsUp: true },
  { name: 'celebrate-1', armL: 165, armR: -165, eyes: 'happy', mouth: 'bigOpen', legs: 'jump', dy: -18, tilt: 0, sparkles: true, thumbsUp: false },
  { name: 'celebrate-2', armL: 128, armR: -150, eyes: 'happy', mouth: 'grin', legs: 'kick', dy: -6, tilt: 9, sparkles: true, thumbsUp: false },
];

function eyesSvg(kind: Eyes): string {
  const left = 86;
  const right = 114;
  const y = 70;
  switch (kind) {
    case 'happy':
      // Upturned "^^" crescents.
      return [left, right]
        .map(
          (x) =>
            `<path d="M ${x - 7} ${y + 2} Q ${x} ${y - 7} ${x + 7} ${y + 2}" fill="none" stroke="${DARK}" stroke-width="3.5" stroke-linecap="round"/>`,
        )
        .join('');
    case 'blink':
      return [left, right]
        .map(
          (x) =>
            `<path d="M ${x - 6} ${y} L ${x + 6} ${y}" stroke="${DARK}" stroke-width="3.5" stroke-linecap="round"/>`,
        )
        .join('');
    case 'wide':
      return [left, right]
        .map(
          (x) =>
            `<circle cx="${x}" cy="${y}" r="8" fill="#fff" stroke="${DARK}" stroke-width="2"/>` +
            `<circle cx="${x + 1}" cy="${y}" r="4.5" fill="${DARK}"/>`,
        )
        .join('');
    case 'puzzled':
      return (
        `<circle cx="${left}" cy="${y}" r="5" fill="${DARK}"/>` +
        `<circle cx="${right}" cy="${y + 1}" r="5" fill="${DARK}"/>` +
        // One raised brow does all the work of reading as "hmm?".
        `<path d="M ${right - 8} ${y - 12} Q ${right} ${y - 18} ${right + 8} ${y - 11}" fill="none" stroke="${DARK}" stroke-width="3" stroke-linecap="round"/>`
      );
    default:
      return [left, right]
        .map(
          (x) =>
            `<circle cx="${x}" cy="${y}" r="5.5" fill="${DARK}"/>` +
            `<circle cx="${x + 2}" cy="${y - 2}" r="1.8" fill="#fff"/>`,
        )
        .join('');
  }
}

function mouthSvg(kind: Mouth): string {
  const cx = 100;
  const y = 90;
  switch (kind) {
    case 'bigOpen':
      return `<path d="M ${cx - 13} ${y} Q ${cx} ${y + 22} ${cx + 13} ${y} Z" fill="${DARK}"/><path d="M ${cx - 6} ${y + 11} Q ${cx} ${y + 17} ${cx + 6} ${y + 11} Z" fill="${PINK}"/>`;
    case 'oh':
      return `<ellipse cx="${cx}" cy="${y + 6}" rx="7" ry="9" fill="${DARK}"/>`;
    case 'small':
      return `<path d="M ${cx - 6} ${y + 3} Q ${cx} ${y + 8} ${cx + 6} ${y + 3}" fill="none" stroke="${DARK}" stroke-width="3" stroke-linecap="round"/>`;
    case 'grin':
      return `<path d="M ${cx - 15} ${y} Q ${cx} ${y + 18} ${cx + 15} ${y}" fill="${DARK}" stroke="${DARK}" stroke-width="3" stroke-linejoin="round"/>`;
    default:
      return `<path d="M ${cx - 11} ${y + 1} Q ${cx} ${y + 12} ${cx + 11} ${y + 1}" fill="none" stroke="${DARK}" stroke-width="3.5" stroke-linecap="round"/>`;
  }
}

function armSvg(side: 'l' | 'r', angle: number, thumbsUp: boolean): string {
  const shoulderX = side === 'l' ? 72 : 128;
  const shoulderY = 118;
  const length = 38;
  const paw = thumbsUp && side === 'r';
  return (
    `<g transform="rotate(${angle} ${shoulderX} ${shoulderY})">` +
    `<rect x="${shoulderX - 7}" y="${shoulderY}" width="14" height="${length}" rx="7" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2"/>` +
    `<circle cx="${shoulderX}" cy="${shoulderY + length}" r="8" fill="${CREAM}" stroke="${FUR_DARK}" stroke-width="2"/>` +
    (paw
      ? `<rect x="${shoulderX - 3}" y="${shoulderY + length + 4}" width="6" height="12" rx="3" fill="${CREAM}" stroke="${FUR_DARK}" stroke-width="2"/>`
      : '') +
    `</g>`
  );
}

function legsSvg(kind: Legs): string {
  const leg = (x: number, angle: number, len: number) =>
    `<g transform="rotate(${angle} ${x} 164)">` +
    `<rect x="${x - 8}" y="164" width="16" height="${len}" rx="8" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2"/>` +
    `<ellipse cx="${x}" cy="${164 + len}" rx="11" ry="7" fill="${CREAM}" stroke="${FUR_DARK}" stroke-width="2"/>` +
    `</g>`;

  switch (kind) {
    case 'jump':
      // Tucked up, angled outward — reads as airborne.
      return leg(86, 26, 16) + leg(114, -26, 16);
    case 'kick':
      return leg(86, 6, 22) + leg(114, -46, 24);
    default:
      return leg(86, 0, 22) + leg(114, 0, 22);
  }
}

function sparklesSvg(): string {
  const star = (x: number, y: number, r: number, colour: string) =>
    `<path d="M ${x} ${y - r} L ${x + r * 0.3} ${y - r * 0.3} L ${x + r} ${y} L ${x + r * 0.3} ${y + r * 0.3} L ${x} ${y + r} L ${x - r * 0.3} ${y + r * 0.3} L ${x - r} ${y} L ${x - r * 0.3} ${y - r * 0.3} Z" fill="${colour}"/>`;
  return (
    star(38, 46, 11, '#ffd23f') +
    star(164, 38, 9, '#ffd23f') +
    star(170, 104, 7, '#7ad7f0') +
    star(30, 110, 6, '#7ad7f0')
  );
}

function characterSvg(pose: Pose): string {
  return (
    `<g transform="translate(0 ${pose.dy}) rotate(${pose.tilt} 100 140)">` +
    // Tail behind the body.
    `<path d="M 132 148 Q 176 150 172 108 Q 168 132 140 130 Z" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M 170 118 Q 176 108 172 100 Q 164 110 164 122 Z" fill="${CREAM}"/>` +
    legsSvg(pose.legs) +
    // Body.
    `<ellipse cx="100" cy="134" rx="38" ry="42" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2.5"/>` +
    `<ellipse cx="100" cy="142" rx="23" ry="30" fill="${CREAM}"/>` +
    // Arms sit in front of the body, otherwise the torso hides them entirely
    // and every pose reads as "standing still".
    armSvg('l', pose.armL, pose.thumbsUp) +
    armSvg('r', pose.armR, pose.thumbsUp) +
    // Scarf.
    `<path d="M 70 110 Q 100 122 130 110 L 130 120 Q 100 132 70 120 Z" fill="${SCARF}"/>` +
    `<path d="M 118 118 L 130 146 L 118 142 Z" fill="${SCARF}"/>` +
    // Ears.
    `<path d="M 72 46 L 60 8 L 92 30 Z" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<path d="M 73 40 L 67 20 L 84 32 Z" fill="${PINK}"/>` +
    `<path d="M 128 46 L 140 8 L 108 30 Z" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<path d="M 127 40 L 133 20 L 116 32 Z" fill="${PINK}"/>` +
    // Head.
    `<circle cx="100" cy="72" r="40" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2.5"/>` +
    `<ellipse cx="100" cy="86" rx="27" ry="19" fill="${CREAM}"/>` +
    `<circle cx="72" cy="86" r="8" fill="${PINK}" opacity="0.55"/>` +
    `<circle cx="128" cy="86" r="8" fill="${PINK}" opacity="0.55"/>` +
    eyesSvg(pose.eyes) +
    `<path d="M 94 80 L 106 80 L 100 87 Z" fill="${DARK}"/>` +
    mouthSvg(pose.mouth) +
    (pose.sparkles ? sparklesSvg() : '') +
    `</g>`
  );
}

/** Lays cells out row-major on a grid of `cols` by `rows` cells of `CELL` px. */
function sheetSvg(cells: { name: string; body: string }[], cols: number, rows: number): string {
  const placed = cells
    .map((cell, index) => {
      const x = (index % cols) * CELL;
      const y = Math.floor(index / cols) * CELL;
      return `<g transform="translate(${x} ${y})" data-pose="${cell.name}">${cell.body}</g>`;
    })
    .join('\n  ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by scripts/generate-default-media.ts - do not edit by hand. -->
<svg xmlns="http://www.w3.org/2000/svg" width="${cols * CELL}" height="${rows * CELL}" viewBox="0 0 ${cols * CELL} ${rows * CELL}">
  ${placed}
</svg>
`;
}

export function buildSpriteSheetSvg(): string {
  return sheetSvg(
    POSES.map((pose) => ({ name: pose.name, body: characterSvg(pose) })),
    COLS,
    ROWS,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Walk sheet: eight directions, four frames each
// ─────────────────────────────────────────────────────────────────────────────

export const WALK_COLS = 4;
export const WALK_ROWS = 8;

/**
 * The eight facings, **in the same order as `DIRECTIONS` in
 * `src/app/explore/explorer.ts`** — the row index is the direction index, so
 * these two lists getting out of step would send the fox walking sideways.
 */
const WALK_FACINGS: { dir: string; turn: number; back: boolean }[] = [
  { dir: 's', turn: 0, back: false },
  { dir: 'sw', turn: -0.6, back: false },
  { dir: 'w', turn: -1, back: false },
  { dir: 'nw', turn: -0.6, back: true },
  { dir: 'n', turn: 0, back: true },
  { dir: 'ne', turn: 0.6, back: true },
  { dir: 'e', turn: 1, back: false },
  { dir: 'se', turn: 0.6, back: false },
];

/**
 * A four-frame cycle: contact, pass, the opposite contact, pass again. Frame 0
 * is feet together, which is what a standing character shows.
 */
const WALK_FRAMES_COUNT = 4;
const SWING = [0, 1, 0, -1];
const BOB = [0, -3, 0, -3];

/**
 * One leg.
 *
 * Two things sell a walk, and which one does the work depends on the facing:
 * from the side it is the stride, and from the front or the back the stride is
 * invisible so the lifted foot has to carry it. `sideOn` blends between them so
 * the diagonals get a bit of each.
 */
function walkLegSvg(x: number, phase: number, sideOn: number): string {
  const stride = phase * 13 * sideOn;
  const lift = Math.max(0, phase) * (1 - sideOn) * 8;
  const length = 22 - lift * 0.6;
  return (
    `<g transform="translate(${stride} ${-lift})">` +
    `<rect x="${x - 8}" y="164" width="16" height="${length}" rx="8" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2"/>` +
    `<ellipse cx="${x}" cy="${164 + length}" rx="11" ry="7" fill="${CREAM}" stroke="${FUR_DARK}" stroke-width="2"/>` +
    `</g>`
  );
}

/**
 * The tail, swung out behind whichever way she is heading.
 *
 * Facing away it points at the viewer, which foreshortens to nothing — so the
 * back views get a fat blob to one side rather than the swept shape, which
 * would collapse into a sliver behind the body.
 */
function walkTailSvg(turn: number, phase: number, back: boolean): string {
  // Away from the direction of travel, so it trails rather than leads.
  const side = turn === 0 ? 0.7 : -turn;
  const x = 100 + side * 44 + phase * 7;

  if (back) {
    return (
      `<g transform="rotate(${side * 16} ${x} 150)">` +
      `<ellipse cx="${x}" cy="146" rx="21" ry="36" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2.5"/>` +
      `<ellipse cx="${x}" cy="172" rx="14" ry="15" fill="${CREAM}"/>` +
      `</g>`
    );
  }

  const tip = x + side * 26;
  return (
    `<path d="M ${x} 150 Q ${tip - side * 6} 152 ${tip} 106 Q ${tip - side * 10} 132 ${x + side * 8} 132 Z" ` +
    `fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M ${tip} 116 Q ${tip - side * 5} 106 ${tip + side * 2} 100 Q ${tip + side * 8} 110 ${tip + side * 6} 120 Z" fill="${CREAM}"/>`
  );
}

/**
 * The head. Turning moves the muzzle, eyes and cheeks across the face rather
 * than redrawing the skull, which is what keeps the same fox recognisable from
 * every angle; facing away drops the face entirely and shows the back of the
 * head instead.
 */
function walkHeadSvg(turn: number, back: boolean): string {
  const cx = 100 + turn * 6;
  const ear = (side: -1 | 1) => {
    const base = cx + side * 28 - turn * 6;
    return (
      `<path d="M ${base} 46 L ${base + side * 12} 8 L ${base - side * 20} 30 Z" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2.5" stroke-linejoin="round"/>` +
      (back
        ? ''
        : `<path d="M ${base - side * 1} 40 L ${base + side * 7} 20 L ${base - side * 10} 32 Z" fill="${PINK}"/>`)
    );
  };

  const skull =
    `<circle cx="${cx}" cy="72" r="40" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2.5"/>`;

  if (back) {
    return (
      ear(-1) +
      ear(1) +
      skull +
      // A lick of paler fur, so the back of the head is not a plain disc.
      `<path d="M ${cx - 16} 44 Q ${cx} 34 ${cx + 16} 44 Q ${cx} 54 ${cx - 16} 44 Z" fill="${CREAM}" opacity="0.7"/>`
    );
  }

  const turned = Math.abs(turn);
  const muzzleX = cx + turn * 20;
  const eyeGap = 15 - turned * 5;
  const eyeY = 70;
  // The far eye and the far cheek shrink away as she turns, so a full profile
  // reads as a profile rather than as a face slid sideways.
  const far = turn >= 0 ? -1 : 1;
  const eye = (side: -1 | 1) =>
    `<circle cx="${muzzleX + side * eyeGap}" cy="${eyeY}" r="${side === far ? 6 - turned * 3 : 6}" fill="${DARK}"/>` +
    `<circle cx="${muzzleX + side * eyeGap + 2}" cy="${eyeY - 2}" r="${side === far ? 2 - turned : 2}" fill="#fff"/>`;

  return (
    ear(-1) +
    ear(1) +
    skull +
    // A snout poking out past the cheek is what makes the side views read.
    (turned > 0.5
      ? `<ellipse cx="${cx + turn * 40}" cy="84" rx="${turned * 12}" ry="11" fill="${CREAM}" stroke="${FUR_DARK}" stroke-width="1.5"/>`
      : '') +
    `<ellipse cx="${muzzleX}" cy="86" rx="${27 - turned * 6}" ry="19" fill="${CREAM}"/>` +
    (turned < 0.9
      ? `<circle cx="${muzzleX - 26}" cy="86" r="7" fill="${PINK}" opacity="0.5"/>` +
        `<circle cx="${muzzleX + 26}" cy="86" r="7" fill="${PINK}" opacity="0.5"/>`
      : `<circle cx="${muzzleX - turn * 26}" cy="86" r="7" fill="${PINK}" opacity="0.5"/>`) +
    eye(-1) +
    eye(1) +
    `<path d="M ${muzzleX - 6} 80 L ${muzzleX + 6} 80 L ${muzzleX} 87 Z" fill="${DARK}"/>` +
    `<path d="M ${muzzleX - 7} 92 Q ${muzzleX} 98 ${muzzleX + 7} 92" stroke="${DARK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
  );
}

function walkCharacterSvg(
  facing: { turn: number; back: boolean },
  frame: number,
): string {
  const phase = SWING[frame % WALK_FRAMES_COUNT];
  const sideOn = Math.abs(facing.turn);
  const tail = walkTailSvg(facing.turn, phase, facing.back);

  return (
    `<g transform="translate(0 ${BOB[frame % WALK_FRAMES_COUNT]})">` +
    // Facing away, the tail comes towards the viewer and belongs in front of
    // the body; facing towards, it is behind her.
    (facing.back ? '' : tail) +
    walkLegSvg(86, phase, sideOn) +
    walkLegSvg(114, -phase, sideOn) +
    `<ellipse cx="100" cy="134" rx="${38 - sideOn * 5}" ry="42" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2.5"/>` +
    (facing.back
      ? ''
      : `<ellipse cx="${100 + facing.turn * 6}" cy="142" rx="23" ry="30" fill="${CREAM}"/>`) +
    // Arms swing opposite the legs.
    armSvg('l', 10 + phase * 26, false) +
    armSvg('r', -10 + phase * 26, false) +
    `<path d="M 70 110 Q 100 122 130 110 L 130 120 Q 100 132 70 120 Z" fill="${SCARF}"/>` +
    `<path d="M ${118 - facing.turn * 30} 118 L ${118 - facing.turn * 30} 146 L ${106 - facing.turn * 30} 142 Z" fill="${SCARF}"/>` +
    (facing.back ? tail : '') +
    walkHeadSvg(facing.turn, facing.back) +
    `</g>`
  );
}

export function buildWalkSheetSvg(): string {
  const cells = WALK_FACINGS.flatMap((facing) =>
    Array.from({ length: WALK_FRAMES_COUNT }, (_, frame) => ({
      name: `walk-${facing.dir}-${frame}`,
      body: walkCharacterSvg(facing, frame),
    })),
  );
  return sheetSvg(cells, WALK_COLS, WALK_ROWS);
}

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
  console.log('Generating default media...');
  write('public/media/characters/sparkle-fox.svg', buildSpriteSheetSvg());
  write('public/media/characters/sparkle-fox-walk.svg', buildWalkSheetSvg());

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
