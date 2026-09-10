import { loadImage } from './sprite-sheet';
import { buildOccupancyMask, detectBackgroundColour, tightenBox } from './sprite-grid';

/**
 * Turning pictures into pictures of a manageable size.
 *
 * Two jobs, both for the landscape:
 *
 *  - The sketch is an SVG string, and the image model needs raster bytes.
 *  - What comes back is a full-size PNG, and a media pack lives in
 *    `localStorage` — a megabyte-and-a-half data URI will blow the quota and
 *    `MediaService.saveOverride` will (rightly) refuse it. A JPEG at the size
 *    the map is actually drawn at is a tenth of that and looks the same.
 */

export interface RasterOptions {
  width: number;
  height: number;
  /** JPEG unless the image needs transparency. */
  type?: 'image/jpeg' | 'image/png';
  quality?: number;
  /** Painted behind the image, since JPEG has no transparency. */
  background?: string;
}

export async function rasterise(
  src: string,
  options: RasterOptions,
): Promise<string> {
  const image = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = options.width;
  canvas.height = options.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get a 2D canvas context');

  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL(options.type ?? 'image/jpeg', options.quality ?? 0.85);
}

/** Roughly how big a data URI is once stored, for warning about the quota. */
export function approximateBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const payload = comma < 0 ? dataUrl : dataUrl.slice(comma + 1);
  return Math.round((payload.length * 3) / 4);
}

/**
 * Crops a generated image to its subject and knocks the flat background out to
 * transparency.
 *
 * A prop has to sit on whatever ground it lands on, so it cannot arrive in a
 * white box. This reuses the sprite pipeline's analysis — the background colour
 * is the median of the border, which survives a subject that runs to the edge —
 * but keeps the whole subject as one piece instead of splitting it into a grid.
 */
export function cutOutSubject(
  source: ImageData,
  options: { padding?: number } = {},
): string {
  const padding = options.padding ?? 6;
  const mask = buildOccupancyMask(source);
  const box = tightenBox(mask, { x: 0, y: 0, w: mask.width, h: mask.height });
  if (!box) throw new Error('That picture looks empty — try generating it again.');

  const canvas = document.createElement('canvas');
  canvas.width = box.w + padding * 2;
  canvas.height = box.h + padding * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get a 2D canvas context');

  const out = ctx.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      if (!mask.bits[(box.y + y) * mask.width + (box.x + x)]) continue;
      const from = ((box.y + y) * source.width + (box.x + x)) * 4;
      const to = ((y + padding) * canvas.width + (x + padding)) * 4;
      out.data[to] = source.data[from];
      out.data[to + 1] = source.data[from + 1];
      out.data[to + 2] = source.data[from + 2];
      out.data[to + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas.toDataURL('image/png');
}

/** Exposed for the studio, which reports what it thinks the background is. */
export function backgroundColourOf(source: ImageData): string {
  const { r, g, b } = detectBackgroundColour(source);
  return `rgb(${r}, ${g}, ${b})`;
}
