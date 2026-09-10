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

export const DEFAULT_STYLE =
  'bright friendly modern cartoon style for young children, bold clean outlines, ' +
  'flat cheerful colours, simple shapes, no text';

export function buildSpriteSheetPrompt(options: SpritePromptOptions): string {
  const cols = options.cols ?? 4;
  const rows = options.rows ?? 2;
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
 * The prompt for the explorable landscape.
 *
 * It goes out with the sketch (see `map-art.ts`) as an image-to-image edit, so
 * most of its work is *restraint*: the numbered circles are where the signposts
 * will stand, and a beautiful painting that moves them by fifty pixels is
 * useless. Naming each numbered place lets the model put something thematically
 * right there instead of generic scenery.
 */
export function buildMapPrompt(
  places: { number: number; name: string; region: string }[],
  regions: { name: string; terrain: string }[],
  style?: string,
): string {
  return [
    'Repaint this sketch as a beautiful top-down storybook map for a childrens game.',
    '',
    'THE AREAS, which must stay exactly where the coloured shapes are:',
    ...regions.map((region) => `- ${region.name}: draw it as ${region.terrain}.`),
    '',
    'THE MARKED PLACES. Each numbered circle is a clearing where a signpost will stand:',
    ...places.map(
      (place) => `${place.number}. ${place.name} — in ${place.region}.`,
    ),
    '',
    'CRITICAL RULES:',
    '- Keep every numbered circle at EXACTLY the position and size it has in the sketch.',
    '- Leave each of those circles as an open, pale, empty clearing. Nothing may be drawn inside them; a signpost is placed on top of each one afterwards.',
    '- Keep the winding paths that join the circles.',
    '- Do not move, resize, add or remove any area or any circle.',
    '- Absolutely no text, no numbers, no labels, no legend, no watermark. The numbers in the sketch are instructions to you, not something to draw.',
    '- Fill the whole rectangle, edge to edge, with no border or frame.',
    `STYLE: ${style?.trim() || DEFAULT_STYLE}, seen from directly above, warm and inviting.`,
  ].join('\n');
}
