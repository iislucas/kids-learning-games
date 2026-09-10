import { loadImage } from './sprite-sheet';

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
