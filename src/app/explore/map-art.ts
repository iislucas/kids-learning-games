import { MapLayout, MapRegion, MapSpot } from './map-layout';

/**
 * The landscape, drawn from the layout.
 *
 * It has two jobs, and doing both from one function is the point:
 *
 *  - **The default background.** A fresh clone has no API keys, so the map has
 *    to look like somewhere without any image model involved — the same reason
 *    the fox is drawn in `generate-default-media.mts`.
 *  - **The sketch handed to the image model.** Labelled, flat and unambiguous,
 *    so a generated painting puts its meadows and ponds exactly where the
 *    signposts already are. Feeding the model the same geometry the app uses is
 *    what keeps the art and the tappable spots from drifting apart.
 *
 * Angular-free, and free of `enum`s and parameter properties, because
 * `scripts/generate-default-media.mts` imports it directly.
 */

export interface MapArtOptions {
  /**
   * Draw region names, spot numbers and a legend. On for the sketch the image
   * model reads; off for the background the child sees, which carries its
   * labels as live DOM instead.
   */
  labelled?: boolean;
}

/** Deterministic jitter, so scenery looks scattered but never moves. */
function noise(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

function mix(colour: string, amount: number): string {
  // Lightens towards white by `amount` (0..1) without needing a colour library.
  const value = parseInt(colour.slice(1), 16);
  const channel = (shift: number) => {
    const base = (value >> shift) & 0xff;
    return Math.round(base + (255 - base) * amount);
  };
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(channel(16))}${hex(channel(8))}${hex(channel(0))}`;
}

function tree(x: number, y: number, scale: number, colour: string): string {
  const h = 34 * scale;
  const w = 22 * scale;
  return [
    `<rect x="${x - 3 * scale}" y="${y - 6 * scale}" width="${6 * scale}" height="${12 * scale}" rx="${2 * scale}" fill="#8a5a33"/>`,
    `<ellipse cx="${x}" cy="${y - h * 0.55}" rx="${w}" ry="${h * 0.6}" fill="${colour}"/>`,
    `<ellipse cx="${x - w * 0.4}" cy="${y - h * 0.3}" rx="${w * 0.7}" ry="${h * 0.42}" fill="${mix(colour, 0.12)}"/>`,
  ].join('');
}

function hill(x: number, y: number, width: number, colour: string): string {
  return `<path d="M ${x - width} ${y} q ${width} ${-width * 0.85} ${width * 2} 0 z" fill="${colour}"/>`;
}

function house(x: number, y: number, colour: string): string {
  return [
    `<rect x="${x - 22}" y="${y - 30}" width="44" height="34" rx="4" fill="${mix(colour, 0.7)}"/>`,
    `<path d="M ${x - 30} ${y - 30} L ${x} ${y - 56} L ${x + 30} ${y - 30} z" fill="${colour}"/>`,
    `<rect x="${x - 7}" y="${y - 16}" width="14" height="20" rx="2" fill="${mix(colour, 0.25)}"/>`,
  ].join('');
}

function flower(x: number, y: number, colour: string): string {
  return `<circle cx="${x}" cy="${y}" r="5" fill="${colour}"/><circle cx="${x}" cy="${y}" r="2" fill="#fff3b0"/>`;
}

/**
 * Scenery scattered inside a region, kept clear of the spots themselves.
 *
 * Every piece is drawn several shades away from the ground it sits on. Tinting
 * scenery towards its region's own colour makes it disappear, which is exactly
 * what a landscape must not do — the terrain is how she tells the ponds from
 * the hills at a glance.
 */
function decorate(region: MapRegion, spots: MapSpot[]): string {
  const pieces: string[] = [];
  const count = region.terrain === 'village' ? 10 : 20;

  for (let i = 0; i < count; i++) {
    const a = noise(`${region.id}-a-${i}`);
    const b = noise(`${region.id}-b-${i}`);
    // Polar placement keeps scenery inside the ellipse rather than in a box
    // around it, and pushes it towards the rim where the spots are not.
    const angle = a * Math.PI * 2;
    const radius = 0.58 + b * 0.38;
    const x = region.cx + Math.cos(angle) * region.rx * radius;
    const y = region.cy + Math.sin(angle) * region.ry * radius;

    if (spots.some((spot) => Math.hypot(spot.x - x, spot.y - y) < 62)) continue;

    const scale = 0.75 + noise(`${region.id}-s-${i}`) * 0.6;
    switch (region.terrain) {
      case 'forest':
        pieces.push(tree(x, y, scale * 1.15, mix('#1f7a3e', b * 0.3)));
        break;
      case 'hills':
        pieces.push(hill(x, y, 62 * scale, mix(region.colour, 0.28 + b * 0.22)));
        break;
      case 'water':
        pieces.push(
          `<ellipse cx="${x}" cy="${y}" rx="${46 * scale}" ry="${21 * scale}" fill="${mix(region.colour, 0.06)}"/>` +
            `<path d="M ${x - 22 * scale} ${y} q ${11 * scale} ${-7 * scale} ${22 * scale} 0 q ${11 * scale} ${7 * scale} ${22 * scale} 0" ` +
            `fill="none" stroke="#ffffff" stroke-width="3" opacity="0.6"/>`,
        );
        break;
      case 'village':
        pieces.push(house(x, y, mix(region.colour, b * 0.2)));
        break;
      default:
        pieces.push(
          b > 0.55
            ? tree(x, y, scale, mix('#1f8a58', b * 0.25))
            : flower(x, y, ['#ff6f9c', '#ffc21f', '#a86bff'][i % 3]),
        );
    }
  }
  return pieces.join('');
}

/** The path linking a region's spots in order, so the route reads as a route. */
function pathThrough(spots: MapSpot[]): string {
  if (spots.length < 2) return '';
  const ordered = [...spots].sort((a, b) => a.index - b.index);
  const points = ordered.map((spot) => `${spot.x} ${spot.y}`).join(' L ');
  return `<path d="M ${points}" fill="none" stroke="#f2e2bd" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`;
}

export function mapSvg(layout: MapLayout, options: MapArtOptions = {}): string {
  const labelled = options.labelled ?? false;
  const parts: string[] = [];

  parts.push(
    `<defs><radialGradient id="glade" cx="50%" cy="50%" r="50%">` +
      `<stop offset="0%" stop-color="#fffdf3"/><stop offset="100%" stop-color="#f6edd4"/>` +
      `</radialGradient></defs>`,
  );

  // Ground.
  parts.push(
    `<rect width="${layout.width}" height="${layout.height}" fill="${labelled ? '#ffffff' : '#cdeccb'}"/>`,
  );

  // The crossroads the regions hang off, drawn before them so it reads as
  // ground rather than as a road on top of the scenery.
  if (!labelled) {
    parts.push(
      `<ellipse cx="${layout.start.x}" cy="${layout.start.y}" rx="${layout.width * 0.42}" ry="120" fill="#e5f3d8"/>`,
    );
  }

  for (const region of layout.regions) {
    const spots = layout.spots.filter((spot) => spot.regionId === region.id);
    const fill = labelled ? mix(region.colour, 0.55) : mix(region.colour, 0.78);

    parts.push(
      `<ellipse cx="${region.cx}" cy="${region.cy}" rx="${region.rx}" ry="${region.ry}" ` +
        `fill="${fill}" stroke="${labelled ? region.colour : mix(region.colour, 0.35)}" stroke-width="${labelled ? 6 : 10}"/>`,
    );

    if (!labelled) parts.push(decorate(region, spots));

    // A track joining the spots, then a clearing at each one. The clearing is
    // what the generated art must leave open for the signpost to stand in.
    parts.push(pathThrough(spots));
    for (const spot of spots) {
      parts.push(
        `<circle cx="${spot.x}" cy="${spot.y}" r="42" fill="${labelled ? '#ffffff' : 'url(#glade)'}" ` +
          `stroke="${labelled ? '#111111' : mix(region.colour, 0.3)}" stroke-width="${labelled ? 4 : 5}"/>`,
      );
      if (labelled) {
        parts.push(
          `<text x="${spot.x}" y="${spot.y + 9}" text-anchor="middle" font-family="sans-serif" ` +
            `font-size="26" font-weight="700" fill="#111111">${spot.index + 1}</text>`,
        );
      }
    }

    if (labelled) {
      parts.push(
        `<text x="${region.cx}" y="${region.cy - region.ry + 44}" text-anchor="middle" ` +
          `font-family="sans-serif" font-size="34" font-weight="700" fill="#111111">` +
          `${escapeText(region.name)}</text>`,
      );
    }
  }

  if (labelled) {
    parts.push(
      `<rect x="0" y="0" width="${layout.width}" height="${layout.height}" fill="none" stroke="#111111" stroke-width="6"/>`,
    );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" ` +
    `viewBox="0 0 ${layout.width} ${layout.height}">${parts.join('')}</svg>`
  );
}

function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** The sketch as a `data:` URI, ready for an `<img>` or the image model. */
export function mapSketchDataUrl(layout: MapLayout): string {
  const svg = mapSvg(layout, { labelled: true });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
