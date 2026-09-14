import { MapLayout, MapRegion, MapSpot } from './map-layout';
import { DrawnPropKind, PROPS, PropKind, isDrawnProp } from './props';
import { TerrainId, terrainDef } from './terrains';

/**
 * The landscape, built from tiles and sprites rather than one big picture.
 *
 * Each region is a patch of ground filled with a **seamless tile**, with
 * **props** — trees, boulders, cottages — scattered over it at positions
 * derived from the layout. Three reasons that beats a single painting:
 *
 *  - Every piece can be replaced on its own by a generated image, and a 256px
 *    tile plus a handful of sprites is a fraction of the bytes of a
 *    1700×1800 painting, which matters when the media pack lives in
 *    `localStorage`.
 *  - A tile repeats to fill any area, so adding a region or moving one does not
 *    need the art regenerating.
 *  - An image model asked for one tree gets one tree right. Asked for a whole
 *    map with thirty-seven clearings in exact positions, it does not.
 *
 * Everything here is built from soft gradients rather than flat fills. Flat SVG
 * shapes read as a diagram; the same shapes with one light source and a contact
 * shadow read as a place. The labelled sketch is the deliberate exception — it
 * stays flat, because a model reading it needs regions and circles, not art.
 *
 * What each terrain looks like is declared in `terrains.ts` and the pictures
 * in `props.ts`; this file only draws them.
 *
 * Angular-free, and free of `enum`s and parameter properties, like the rest of
 * `explore/`.
 */

/** Tiles are square and repeat; props are drawn in a box this size. */
export const TILE_SIZE = 256;
export const PROP_SIZE = 128;

/** Deterministic jitter, so scenery looks scattered but never moves. */
export function noise(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

/** Lightens towards white; a negative amount darkens towards black. */
export function shade(colour: string, amount: number): string {
  const value = parseInt(colour.slice(1), 16);
  const towards = amount >= 0 ? 255 : 0;
  const strength = Math.abs(amount);
  const channel = (shift: number) => {
    const base = (value >> shift) & 0xff;
    return Math.round(base + (towards - base) * strength);
  };
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(channel(16))}${hex(channel(8))}${hex(channel(0))}`;
}

function svgDocument(width: number, height: number, body: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">${body}</svg>`
  );
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * A `url()` for a CSS background.
 *
 * The quotes are not optional. `encodeURIComponent` leaves parentheses alone,
 * and every `rotate(...)` and `translate(...)` in the SVG then closes the
 * `url(` early — so the declaration is dropped and the ground silently renders
 * blank.
 */
export function cssUrl(src: string): string {
  return `url("${src}")`;
}

// ── Ground tiles ─────────────────────────────────────────────────────────────

/**
 * Repeats a shape at every wrap offset so it crosses the tile edge and comes
 * back on the other side.
 *
 * This is the whole trick to a seamless tile: draw nine copies, clip to the
 * tile, and anything that runs off an edge is already drawn arriving at the
 * opposite one. Without it every tile boundary shows as a hard line, which on a
 * repeating background is the first thing the eye finds.
 */
function wrapped(draw: (x: number, y: number) => string, x: number, y: number): string {
  const out: string[] = [];
  for (const dx of [-TILE_SIZE, 0, TILE_SIZE]) {
    for (const dy of [-TILE_SIZE, 0, TILE_SIZE]) {
      out.push(draw(x + dx, y + dy));
    }
  }
  return out.join('');
}

/** One seamless ground tile, from the terrain's recipe. Repeat it to fill a region. */
export function terrainTileSvg(terrain: TerrainId): string {
  const recipe = terrainDef(terrain).tile;
  const marks: string[] = [];

  for (let i = 0; i < recipe.count; i++) {
    const x = noise(`${terrain}-x-${i}`) * TILE_SIZE;
    const y = noise(`${terrain}-y-${i}`) * TILE_SIZE;
    const seed = noise(`${terrain}-k-${i}`);
    const size = 8 + noise(`${terrain}-s-${i}`) * 14;
    marks.push(wrapped((mx, my) => recipe.marks(mx, my, size, seed), x, y));
  }

  return svgDocument(
    TILE_SIZE,
    TILE_SIZE,
    `<defs>` +
      `<linearGradient id="t" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="${recipe.top}"/>` +
      `<stop offset="100%" stop-color="${recipe.bottom}"/>` +
      `</linearGradient>` +
      `<clipPath id="c"><rect width="${TILE_SIZE}" height="${TILE_SIZE}"/></clipPath>` +
      `</defs>` +
      `<rect width="${TILE_SIZE}" height="${TILE_SIZE}" fill="url(#t)"/>` +
      `<g clip-path="url(#c)">${marks.join('')}</g>`,
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

const FOLIAGE = '#2f9e63';
const TIMBER = '#8a5a33';

/** Shared contact shadow. Nothing sells "standing on the ground" more cheaply. */
function contactShadow(cx: number, cy: number, rx: number): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${rx * 0.34}" fill="#2c2440" opacity="0.2"/>`;
}

const PROP_BODIES: Record<DrawnPropKind, string> = {
  tree:
    contactShadow(64, 116, 34) +
    `<rect x="57" y="82" width="14" height="34" rx="6" fill="${TIMBER}"/>` +
    `<rect x="57" y="82" width="6" height="34" fill="${shade(TIMBER, 0.25)}" opacity="0.7"/>` +
    `<ellipse cx="64" cy="60" rx="46" ry="42" fill="${FOLIAGE}"/>` +
    `<ellipse cx="50" cy="46" rx="28" ry="24" fill="${shade(FOLIAGE, 0.3)}"/>` +
    `<ellipse cx="80" cy="76" rx="24" ry="18" fill="${shade(FOLIAGE, -0.22)}" opacity="0.5"/>`,

  pine:
    contactShadow(64, 118, 28) +
    `<rect x="59" y="92" width="10" height="26" rx="4" fill="${TIMBER}"/>` +
    `<path d="M 64 8 L 96 56 L 32 56 z" fill="${shade(FOLIAGE, -0.1)}"/>` +
    `<path d="M 64 34 L 102 92 L 26 92 z" fill="${FOLIAGE}"/>` +
    `<path d="M 64 8 L 64 56 L 32 56 z" fill="${shade(FOLIAGE, 0.22)}" opacity="0.8"/>` +
    `<path d="M 64 34 L 64 92 L 26 92 z" fill="${shade(FOLIAGE, 0.16)}" opacity="0.7"/>`,

  boulder:
    contactShadow(64, 116, 44) +
    `<path d="M 16 116 q 4 -66 48 -68 q 44 2 48 68 z" fill="#a49c8e"/>` +
    `<path d="M 30 84 q 18 -42 46 -36 q -24 6 -34 40 z" fill="#c9c2b3"/>` +
    `<path d="M 92 116 q 8 -40 -8 -60 q 26 18 24 60 z" fill="#7d766a" opacity="0.75"/>` +
    `<path d="M 48 116 q 0 -34 16 -34 q 16 0 16 34 z" fill="#3d382f"/>`,

  cottage:
    contactShadow(64, 118, 42) +
    `<rect x="26" y="66" width="76" height="52" rx="5" fill="#f2e6cd"/>` +
    `<rect x="26" y="66" width="26" height="52" fill="#d8c9a9" opacity="0.75"/>` +
    `<path d="M 14 66 L 64 20 L 114 66 z" fill="#d1584f"/>` +
    `<path d="M 14 66 L 64 20 L 64 66 z" fill="#e8776c"/>` +
    `<rect x="54" y="88" width="20" height="30" rx="3" fill="#8a5a33"/>` +
    `<circle cx="40" cy="86" r="9" fill="#9fd8ee" stroke="#f2e6cd" stroke-width="3"/>` +
    `<rect x="86" y="26" width="12" height="26" rx="3" fill="#b8b0a2"/>`,

  pond:
    `<ellipse cx="64" cy="72" rx="58" ry="34" fill="#8fdcf2"/>` +
    `<ellipse cx="64" cy="72" rx="50" ry="27" fill="#3fa6cf"/>` +
    `<ellipse cx="52" cy="62" rx="26" ry="12" fill="#8fdcf2" opacity="0.6"/>` +
    `<ellipse cx="88" cy="82" rx="14" ry="7" fill="#2f8fb8" opacity="0.6"/>` +
    `<circle cx="40" cy="84" r="9" fill="#4fae62"/>` +
    `<circle cx="86" cy="60" r="7" fill="#4fae62"/>` +
    `<circle cx="86" cy="60" r="3" fill="#ff8fb1"/>`,

  flower:
    contactShadow(64, 112, 16) +
    `<path d="M 64 112 q -6 -30 0 -46" stroke="#4fae62" stroke-width="7" fill="none" stroke-linecap="round"/>` +
    `<path d="M 64 88 q -18 -6 -22 -18 q 16 -2 22 10 z" fill="#4fae62"/>` +
    `<circle cx="64" cy="52" r="24" fill="#ff8fb1"/>` +
    `<circle cx="56" cy="44" r="13" fill="#ffb7cf"/>` +
    `<circle cx="64" cy="52" r="10" fill="#ffd45e"/>`,

  palm:
    contactShadow(64, 118, 26) +
    `<path d="M 64 118 q -10 -40 6 -78" stroke="${TIMBER}" stroke-width="9" fill="none" stroke-linecap="round"/>` +
    `<path d="M 70 40 q -30 -16 -54 6 q 26 -6 54 -6 z" fill="${FOLIAGE}"/>` +
    `<path d="M 70 40 q 30 -16 50 8 q -24 -8 -50 -8 z" fill="${FOLIAGE}"/>` +
    `<path d="M 70 40 q -8 -30 -32 -32 q 20 12 32 32 z" fill="${shade(FOLIAGE, 0.25)}"/>` +
    `<path d="M 70 40 q 12 -28 36 -26 q -22 8 -36 26 z" fill="${shade(FOLIAGE, 0.25)}"/>`,

  shells:
    contactShadow(64, 104, 30) +
    `<path d="M 34 102 q 14 -34 30 0 z" fill="#ffc9c2"/>` +
    `<path d="M 42 102 l 7 -22 l 7 22" stroke="#e79a8f" stroke-width="2" fill="none"/>` +
    `<circle cx="84" cy="94" r="12" fill="#fff0d6"/>` +
    `<circle cx="84" cy="94" r="6" fill="none" stroke="#d9b26e" stroke-width="2.5"/>`,
};

/** The drawing a prop falls back on: its own, or the one it `looksLike`. */
export function drawingFor(kind: PropKind): DrawnPropKind | undefined {
  return isDrawnProp(kind) ? kind : PROPS[kind].looksLike;
}

/**
 * One scenery sprite, on a transparent background. A prop without a drawing of
 * its own borrows the one it looks like, since it is meant to be generated.
 */
export function propSvg(kind: PropKind): string {
  const drawing = drawingFor(kind);
  return svgDocument(PROP_SIZE, PROP_SIZE, drawing ? PROP_BODIES[drawing] : '');
}

// ── Placing them ─────────────────────────────────────────────────────────────

export interface PlacedProp {
  id: string;
  kind: PropKind;
  x: number;
  y: number;
  /** Rendered width in map pixels; height follows. */
  size: number;
  flipped: boolean;
}

/**
 * Scatters scenery inside a region, keeping clear of the clearings.
 *
 * Polar placement keeps props inside the ellipse rather than in a box around
 * it, and biases them towards the rim, which is where the spots are not.
 */
export function placeProps(region: MapRegion, spots: MapSpot[]): PlacedProp[] {
  const terrain = terrainDef(region.terrain);
  const kinds = terrain.scenery;
  const count = terrain.sceneryCount;
  const placed: PlacedProp[] = [];

  for (let i = 0; i < count; i++) {
    const a = noise(`${region.id}-a-${i}`);
    const b = noise(`${region.id}-b-${i}`);
    const angle = a * Math.PI * 2;
    const radius = 0.56 + b * 0.4;
    const x = Math.round(region.cx + Math.cos(angle) * region.rx * radius);
    const y = Math.round(region.cy + Math.sin(angle) * region.ry * radius);

    if (spots.some((spot) => Math.hypot(spot.x - x, spot.y - y) < 78)) continue;
    if (placed.some((prop) => Math.hypot(prop.x - x, prop.y - y) < 56)) continue;

    const kind =
      kinds[Math.floor(noise(`${region.id}-k-${i}`) * kinds.length) % kinds.length];
    // Some scenery is small by nature; at tree size shells tower over everything.
    const scale = PROPS[kind].scale ?? 1;
    placed.push({
      id: `${region.id}-${i}`,
      kind,
      x,
      y,
      size: Math.round((74 + noise(`${region.id}-s-${i}`) * 46) * scale),
      flipped: noise(`${region.id}-f-${i}`) > 0.5,
    });
  }

  // Painter's order: things lower down are nearer, so they overlap what is
  // behind them rather than being sliced by it.
  return placed.sort((first, second) => first.y - second.y);
}

/** The track joining a region's spots, as an SVG path `d`. */
export function pathThrough(spots: MapSpot[]): string {
  if (spots.length < 2) return '';
  const ordered = [...spots].sort((a, b) => a.index - b.index);
  return `M ${ordered.map((spot) => `${spot.x} ${spot.y}`).join(' L ')}`;
}

// ── The labelled sketch ──────────────────────────────────────────────────────

/**
 * The map plan: flat regions, a numbered circle per spot, names.
 *
 * Deliberately not pretty. It is what the studio shows so you can see the whole
 * layout at once, and what an image model is given when generating a single
 * whole-map painting instead of tiles.
 */
export function mapSketchSvg(layout: MapLayout): string {
  const parts: string[] = [
    `<rect width="${layout.width}" height="${layout.height}" fill="#ffffff"/>`,
  ];

  for (const region of layout.regions) {
    const spots = layout.spots.filter((spot) => spot.regionId === region.id);
    parts.push(
      `<ellipse cx="${region.cx}" cy="${region.cy}" rx="${region.rx}" ry="${region.ry}" ` +
        `fill="${shade(region.colour, 0.55)}" stroke="${region.colour}" stroke-width="6"/>`,
    );
    const track = pathThrough(spots);
    if (track) {
      parts.push(
        `<path d="${track}" fill="none" stroke="#e0d3ae" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>`,
      );
    }
    for (const spot of spots) {
      parts.push(
        `<circle cx="${spot.x}" cy="${spot.y}" r="42" fill="#ffffff" stroke="#111111" stroke-width="4"/>`,
        `<text x="${spot.x}" y="${spot.y + 9}" text-anchor="middle" font-family="sans-serif" ` +
          `font-size="26" font-weight="700" fill="#111111">${spot.index + 1}</text>`,
      );
    }
    parts.push(
      `<text x="${region.cx}" y="${region.cy - region.ry + 44}" text-anchor="middle" ` +
        `font-family="sans-serif" font-size="34" font-weight="700" fill="#111111">` +
        `${escapeText(region.name)}</text>`,
    );
  }

  parts.push(
    `<rect x="0" y="0" width="${layout.width}" height="${layout.height}" fill="none" stroke="#111111" stroke-width="6"/>`,
  );
  return svgDocument(layout.width, layout.height, parts.join(''));
}

function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
