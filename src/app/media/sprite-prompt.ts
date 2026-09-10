import { AnimationName } from './media.types';

/**
 * Prompt construction for sprite-sheet generation.
 *
 * Getting a usable sheet out of an image model is almost entirely a prompting
 * problem. Three constraints do the heavy lifting, and all three are here for a
 * reason learned the hard way:
 *
 *  - **A flat, uniform, high-contrast background.** The grid analyser
 *    classifies pixels as sprite-or-background; a gradient or a scene makes
 *    that impossible.
 *  - **Generous empty gaps between poses.** The analyser finds cells by looking
 *    for empty rows and columns. Poses that touch merge into one blob.
 *  - **Identical character, consistent scale, feet on a common baseline.** The
 *    poses become frames of one animation, so drift between them reads as the
 *    character changing size or floating.
 */

/** The eight poses we ask for, in the order the sheet should read. */
export const POSE_PLAN: { animation: AnimationName; description: string }[] = [
  { animation: 'idle', description: 'standing calmly, relaxed, small friendly smile, arms down' },
  { animation: 'idle', description: 'standing, blinking, weight shifted slightly, gentle breathing pose' },
  { animation: 'correct', description: 'happy surprise, eyes wide, both arms starting to lift up' },
  { animation: 'correct', description: 'big joyful cheer, both arms thrown straight up, huge open smile' },
  { animation: 'wrong', description: 'gentle puzzled shrug, head tilted, one eyebrow raised, kind and not sad' },
  { animation: 'wrong', description: 'encouraging thumbs up while smiling warmly, as if saying try again' },
  { animation: 'celebrate', description: 'jumping in the air with knees bent, arms up in triumph' },
  { animation: 'celebrate', description: 'spinning happy dance pose, one leg kicked out, arms wide' },
];

export interface SpritePromptOptions {
  /** What the character is, e.g. "a fluffy orange fox cub in a red scarf". */
  character: string;
  /** Extra art direction, e.g. "watercolour storybook style". */
  style?: string;
  cols?: number;
  rows?: number;
}

/**
 * The house style.
 *
 * Anime and manga rather than flat vector art: soft colour gradients and a
 * painted light source. Asking for "flat colours" and "bold outlines" gets
 * pictures that look like clip art, which sit badly next to a landscape drawn
 * with gradients — and children's picture books have not looked like clip art
 * for a very long time.
 */
export const DEFAULT_STYLE =
  'soft anime and manga illustration for young children, gentle colour ' +
  'gradients and painted light, delicate line work, rounded friendly shapes, ' +
  'warm and cheerful, no harsh flat vector fills, no text';

/** The grid the pose sheet is asked for, and read back as. */
export const SHEET_COLS = 4;
export const SHEET_ROWS = 2;

/**
 * Why an analysed sheet does not match the one that was asked for, or null when
 * it does.
 *
 * Poses that touch are the usual cause, and they merge in whichever direction
 * they touch — so naming the direction turns "it went wrong" into something
 * fixable by rewording the prompt or nudging the art apart.
 */
export function describeGridMismatch(cols: number, rows: number): string | null {
  if (cols === SHEET_COLS && rows === SHEET_ROWS) return null;

  const asked = `${SHEET_COLS}×${SHEET_ROWS}`;
  const got = `${cols}×${rows}`;
  const why =
    rows < SHEET_ROWS
      ? 'The rows have run together — there is no clear empty band between them.'
      : cols < SHEET_COLS
        ? 'The columns have run together — the poses are touching sideways.'
        : 'There is more separating the poses than expected — a border or stray marks, perhaps.';

  return (
    `This came back as a ${got} grid, not the ${asked} that was asked for. ${why} ` +
    'Using it would map every animation onto the wrong drawings, so generate it ' +
    'again, or ask for wider gaps between the poses.'
  );
}

export function buildSpriteSheetPrompt(options: SpritePromptOptions): string {
  const cols = options.cols ?? SHEET_COLS;
  const rows = options.rows ?? SHEET_ROWS;
  const count = cols * rows;
  const poses = POSE_PLAN.slice(0, count);

  const poseList = poses
    .map((pose, i) => `${i + 1}. ${pose.description}`)
    .join('\n');

  return [
    `A sprite sheet: exactly ${count} drawings of the SAME character arranged in a strict ${cols}-column by ${rows}-row grid, reading left to right, top to bottom.`,
    '',
    `CHARACTER (identical in every cell): ${options.character}.`,
    `STYLE: ${options.style?.trim() || DEFAULT_STYLE}.`,
    '',
    'THE POSES, in this exact order:',
    poseList,
    '',
    'CRITICAL LAYOUT RULES:',
    `- Plain, completely flat, uniform pure white background everywhere. No gradient, no shadow, no scenery, no ground line, no border, no frame lines, no grid lines.`,
    `- Leave a wide empty margin around the whole image and a wide empty gap between every row and every column, so each pose is clearly separated by empty background.`,
    '- No pose may touch or overlap another pose.',
    '- Draw the character at the SAME size in every cell, facing the viewer, full body visible, feet at the same height in every cell.',
    '- Absolutely no text, no numbers, no labels, no captions, no speech bubbles, no watermark.',
    '- High contrast between the character and the background.',
  ].join('\n');
}

/**
 * Maps the frames of a generated sheet back onto animations, assuming the
 * model honoured POSE_PLAN's ordering.
 */
export function animationsFromPosePlan(
  frameCount: number,
): Record<AnimationName, number[]> {
  const result: Record<AnimationName, number[]> = {
    idle: [],
    correct: [],
    wrong: [],
    celebrate: [],
  };
  POSE_PLAN.slice(0, frameCount).forEach((pose, index) => {
    result[pose.animation].push(index);
  });
  // A model that returned fewer poses than planned can leave a bucket empty;
  // fall back to frame 0 so playback never references a missing frame.
  for (const name of Object.keys(result) as AnimationName[]) {
    if (result[name].length === 0) result[name] = [0];
  }
  return result;
}

/** Prompt for a single still image (used for prize stickers and backdrops). */
export function buildSingleImagePrompt(subject: string, style?: string): string {
  return [
    `${subject}.`,
    `STYLE: ${style?.trim() || DEFAULT_STYLE}.`,
    'Centred on a plain flat pure white background, generous empty margin, no text, no watermark, no border.',
  ].join('\n');
}

/**
 * A seamless ground tile.
 *
 * Every rule here is about the edges. A tile is repeated across a whole region,
 * so any border, vignette, single large feature or lighting that falls off
 * towards one side turns into an obvious grid the moment it is tiled — which
 * matters far more than how pretty the texture is on its own.
 */
export function buildTilePrompt(subject: string, style?: string): string {
  return [
    `A seamless repeating texture of ${subject}, seen from directly above.`,
    `STYLE: ${style?.trim() || DEFAULT_STYLE}.`,
    '',
    'CRITICAL RULES:',
    '- The texture must TILE SEAMLESSLY: what runs off the left edge continues on the right, and the same top to bottom.',
    '- Completely even lighting across the whole square. No vignette, no shadow at one side, no highlight in the middle.',
    '- Small, evenly spread detail only. No single large object, no focal point, nothing that would obviously repeat.',
    '- Fill the entire square, edge to edge. No border, no frame, no margin.',
    '- No text, no watermark, no signature.',
  ].join('\n');
}

/**
 * One scenery sprite.
 *
 * The background has to be flat and plain because it is cut away afterwards by
 * the same analysis the sprite sheet uses — a scene behind the object makes
 * that impossible, and the prop arrives sitting in a box.
 */
export function buildPropPrompt(subject: string, style?: string): string {
  return [
    `${subject}, seen from slightly above, standing upright, complete and whole.`,
    `STYLE: ${style?.trim() || DEFAULT_STYLE}.`,
    '',
    'CRITICAL RULES:',
    '- Exactly ONE object, centred, with a generous empty margin all around it.',
    '- Plain, completely flat, uniform pure white background. No scenery, no ground, no horizon, no shadow on the ground, no gradient behind it.',
    '- High contrast between the object and the background.',
    '- No text, no labels, no watermark, no border, no frame.',
  ].join('\n');
}

/** The walk sheet's grid: one column per frame, one row per direction. */
export const WALK_COLS = 4;
export const WALK_ROWS = 8;

/** Row order, and it must match `DIRECTIONS` in `explore/explorer.ts`. */
export const WALK_DIRECTIONS = [
  { id: 's', facing: 'towards the viewer' },
  { id: 'sw', facing: 'towards the viewer and to their left' },
  { id: 'w', facing: 'to their left in profile' },
  { id: 'nw', facing: 'away from the viewer and to their left' },
  { id: 'n', facing: 'directly away from the viewer, showing their back' },
  { id: 'ne', facing: 'away from the viewer and to their right' },
  { id: 'e', facing: 'to their right in profile' },
  { id: 'se', facing: 'towards the viewer and to their right' },
];

/**
 * Prompt for the eight-direction walk cycle.
 *
 * The row order is not decoration: the map indexes straight into it, so a sheet
 * whose rows come back in a different order sends the character walking
 * sideways. `describeWalkGridMismatch` catches the case where the grid itself
 * is wrong; nothing can catch rows in the wrong order, which is why the order
 * is spelled out one row at a time rather than left to "the eight directions".
 */
export function buildWalkSheetPrompt(options: SpritePromptOptions): string {
  return [
    `A walk-cycle sprite sheet: exactly ${WALK_COLS * WALK_ROWS} drawings of the SAME character in a strict ${WALK_COLS}-column by ${WALK_ROWS}-row grid.`,
    '',
    `CHARACTER (identical in every cell): ${options.character}.`,
    `STYLE: ${options.style?.trim() || DEFAULT_STYLE}.`,
    '',
    `Each ROW is one walking direction, and each row shows ${WALK_COLS} frames of that walk in order: feet together, left foot forward, feet together, right foot forward.`,
    '',
    'THE ROWS, top to bottom, in this exact order:',
    ...WALK_DIRECTIONS.map(
      (row, index) => `${index + 1}. Walking ${row.facing}.`,
    ),
    '',
    'CRITICAL LAYOUT RULES:',
    '- Plain, completely flat, uniform pure white background everywhere. No gradient, no shadow, no ground line, no border, no grid lines.',
    '- A wide empty gap between every row and every column. No drawing may touch another.',
    '- The character is the SAME size in every cell, with feet at the same height in every cell.',
    '- Nothing detached floating beside the character — no sparkles, no motion lines, no dust.',
    '- Absolutely no text, no numbers, no labels, no watermark.',
  ].join('\n');
}

/** As `describeGridMismatch`, for the walk sheet's larger grid. */
export function describeWalkGridMismatch(cols: number, rows: number): string | null {
  if (cols === WALK_COLS && rows === WALK_ROWS) return null;
  return (
    `This came back as a ${cols}×${rows} grid, not the ${WALK_COLS}×${WALK_ROWS} that was asked for. ` +
    'Each row has to be one direction and each column one frame, so using it ' +
    'would send the character walking the wrong way. Generate it again, asking ' +
    'for wider gaps between the drawings.'
  );
}
