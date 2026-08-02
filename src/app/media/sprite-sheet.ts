import {
  AnalyseOptions,
  analyseSheet,
  boxesFromGutters,
  buildOccupancyMask,
  composeNormalisedSheet,
  GridPlan,
  ImageDataLike,
  planUniformGrid,
} from './sprite-grid';
import { AnimationName, Animation, SpriteSheet } from './media.types';

/**
 * Browser-side glue around the pure analysis in `sprite-grid.ts`: decode an
 * image, run the analysis, redraw a clean uniform sheet, encode it back to a
 * PNG data URI.
 */

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Generated sheets arrive as data: URIs, but defaults are same-origin
    // assets; this keeps the canvas untainted either way.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${src.slice(0, 64)}`));
    img.src = src;
  });
}

export function imageToImageData(img: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get a 2D canvas context');
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export interface NormalisedSheet {
  /** PNG data URI with a transparent background. */
  dataUrl: string;
  sheet: SpriteSheet;
  plan: GridPlan;
}

/**
 * Analyse a raw generated grid image and return a uniform, background-free
 * sprite sheet ready to animate.
 */
export function normaliseSheet(
  source: ImageData,
  options: AnalyseOptions = {},
): NormalisedSheet {
  const mask = buildOccupancyMask(source, options);
  const { boxes, cols, rows } = boxesFromGutters(mask, options);
  const plan = planUniformGrid(boxes, cols, rows, options);

  if (plan.placements.length === 0) {
    throw new Error(
      'No sprites found in that image. Try a plain, high-contrast background ' +
        'with clear gaps between the poses.',
    );
  }

  const composed = composeNormalisedSheet(source, mask, plan);
  const canvas = document.createElement('canvas');
  canvas.width = composed.width;
  canvas.height = composed.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get a 2D canvas context');
  ctx.putImageData(
    new ImageData(composed.data, composed.width, composed.height),
    0,
    0,
  );

  const frameCount = plan.placements.length;
  const sheetCols =
    plan.cols > 0 && plan.cols * plan.rows >= frameCount ? plan.cols : frameCount;

  return {
    dataUrl: canvas.toDataURL('image/png'),
    plan,
    sheet: {
      src: canvas.toDataURL('image/png'),
      cellWidth: plan.cellWidth,
      cellHeight: plan.cellHeight,
      cols: sheetCols,
      rows: Math.ceil(frameCount / sheetCols),
      frameCount,
    },
  };
}

/** Convenience for previewing an analysis without composing the new sheet. */
export function analyse(source: ImageData, options: AnalyseOptions = {}): GridPlan {
  return analyseSheet(source, options);
}

/**
 * Spreads however many frames we got across the four animations.
 *
 * The generator is asked for eight poses in a known order, but models
 * miscount, so this degrades sensibly for any frame count rather than
 * producing an animation that references frames which do not exist.
 */
export function defaultAnimationsFor(
  frameCount: number,
): Record<AnimationName, Animation> {
  const frame = (i: number) => Math.min(Math.max(i, 0), frameCount - 1);
  const range = (from: number, to: number) => {
    const out: number[] = [];
    for (let i = from; i <= to; i++) out.push(frame(i));
    return [...new Set(out)];
  };

  if (frameCount <= 1) {
    const only = [0];
    return {
      idle: { frames: only, fps: 1, loop: true },
      correct: { frames: only, fps: 1, loop: false },
      wrong: { frames: only, fps: 1, loop: false },
      celebrate: { frames: only, fps: 1, loop: true },
    };
  }

  const quarter = Math.max(1, Math.floor(frameCount / 4));
  return {
    idle: { frames: range(0, quarter - 1), fps: 3, loop: true },
    correct: { frames: range(quarter, quarter * 2 - 1), fps: 10, loop: false },
    wrong: { frames: range(quarter * 2, quarter * 3 - 1), fps: 8, loop: false },
    celebrate: { frames: range(quarter * 3, frameCount - 1), fps: 12, loop: true },
  };
}
