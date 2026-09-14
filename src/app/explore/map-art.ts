import { MapLayout, MapRegion, MapSpot } from './map-layout';

/**
 * The landscape, built from tiles and sprites rather than one big picture.
 *
 * Each region is a patch of ground filled with a **seamless tile**, with
 * **props** — trees, boulders, cottages — scattered over it at positions
 * derived from the layout. Three reasons that beats a single painting:
 *
 *  - Every piece can be replaced on its own by a generated image, and a 256px
 *    tile plus a handful of sprites is a fraction of the bytes of a
 *    1700×1400 painting, which matters when the media pack lives in
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
 * Angular-free, and free of `enum`s and parameter properties, because
 * `scripts/generate-default-media.mts` imports it directly.
 */

export type TerrainId = MapRegion['terrain'];

export const TERRAIN_IDS: TerrainId[] = [
  'hills',
  'water',
  'caves',
  'forest',
  'village',
  'meadow',
  'beach',
];

/** The scattered scenery, each with a drawn fallback of its own. */
const SCENERY_KINDS = [
  'tree',
  'pine',
  'boulder',
  'cottage',
  'pond',
  'flower',
  'palm',
  'shells',
] as const;

type SceneryKind = (typeof SCENERY_KINDS)[number];

/**
 * What grows at a place as it is won, and the one extra piece each region is
 * given at random. See `TERRAIN_THEMES` in `spot-build.ts` for which is which.
 *
 * These are only ever meant to be generated pictures. Each borrows the drawing
 * of the nearest scenery piece as a fallback, which is good enough for a pack
 * whose art has been cleared and not worth a hand-drawn SVG apiece.
 */
const THEMED_FALLBACKS = {
  windmill: 'cottage',
  lilypad: 'pond',
  cave: 'boulder',
  oak: 'tree',
  townhouse: 'cottage',
  sunflower: 'flower',
  sandcastle: 'boulder',
  sheep: 'boulder',
  haybarn: 'cottage',
  rowboat: 'pond',
  duckhouse: 'cottage',
  crystals: 'boulder',
  minecart: 'boulder',
  mushrooms: 'flower',
  logcabin: 'cottage',
  well: 'boulder',
  fruitstall: 'cottage',
  beehive: 'boulder',
  scarecrow: 'tree',
  parasol: 'flower',
  lighthouse: 'pine',
} as const satisfies Record<string, SceneryKind>;

/** Every picture the map can use. One image each, when they are generated. */
export const PROP_KINDS = [
  ...SCENERY_KINDS,
  ...(Object.keys(THEMED_FALLBACKS) as (keyof typeof THEMED_FALLBACKS)[]),
];

export type PropKind = SceneryKind | keyof typeof THEMED_FALLBACKS;

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

interface TileRecipe {
  /** Base wash, lit from above. */
  top: string;
  bottom: string;
  /** Speckles strewn over it. */
  marks: (x: number, y: number, size: number, seed: number) => string;
  count: number;
}

const TILE_RECIPES: Record<TerrainId, TileRecipe> = {
  hills: {
    top: '#a9e08a',
    bottom: '#7fc46a',
    count: 26,
    marks: (x, y, size) =>
      `<path d="M ${x} ${y} q ${size * 0.4} ${-size} ${size * 0.9} ${-size * 0.2}" ` +
      `fill="none" stroke="#5fae57" stroke-width="${size * 0.22}" stroke-linecap="round" opacity="0.55"/>`,
  },
  meadow: {
    top: '#b6e893',
    bottom: '#8ed07a',
    count: 22,
    marks: (x, y, size, seed) =>
      seed > 0.55
        ? `<circle cx="${x}" cy="${y}" r="${size * 0.3}" fill="${['#ff8fb1', '#ffd45e', '#b98cff'][Math.floor(seed * 3) % 3]}" opacity="0.85"/>`
        : `<path d="M ${x} ${y} l ${size * 0.2} ${-size * 0.8}" stroke="#63b06a" stroke-width="${size * 0.18}" stroke-linecap="round" opacity="0.6"/>`,
  },
  water: {
    top: '#7fd4ee',
    bottom: '#3fa6cf',
    count: 18,
    marks: (x, y, size) =>
      `<path d="M ${x - size} ${y} q ${size * 0.5} ${-size * 0.5} ${size} 0 q ${size * 0.5} ${size * 0.5} ${size} 0" ` +
      `fill="none" stroke="#ffffff" stroke-width="${size * 0.2}" stroke-linecap="round" opacity="0.45"/>`,
  },
  caves: {
    top: '#b9b3a6',
    bottom: '#8f887b',
    count: 24,
    marks: (x, y, size, seed) =>
      `<ellipse cx="${x}" cy="${y}" rx="${size * 0.9}" ry="${size * 0.55}" ` +
      `fill="${seed > 0.5 ? '#6f6a60' : '#cfc8ba'}" opacity="0.5"/>`,
  },
  forest: {
    top: '#8fd08d',
    bottom: '#5da966',
    count: 28,
    marks: (x, y, size, seed) =>
      `<ellipse cx="${x}" cy="${y}" rx="${size * 0.7}" ry="${size * 0.32}" ` +
      `fill="${seed > 0.5 ? '#3f8f52' : '#a8dda0'}" opacity="0.5" ` +
      `transform="rotate(${Math.round(seed * 90 - 45)} ${x} ${y})"/>`,
  },
  village: {
    top: '#e3d9c2',
    bottom: '#c8bda3',
    count: 30,
    marks: (x, y, size, seed) =>
      `<rect x="${x}" y="${y}" width="${size * 1.6}" height="${size * 1.1}" rx="${size * 0.35}" ` +
      `fill="${seed > 0.5 ? '#d5c9ae' : '#efe6d2'}" opacity="0.75" ` +
      `transform="rotate(${Math.round(seed * 30 - 15)} ${x} ${y})"/>`,
  },
  beach: {
    top: '#f7e3b0',
    bottom: '#ecc987',
    count: 26,
    marks: (x, y, size, seed) =>
      seed > 0.8
        ? `<path d="M ${x - size * 0.5} ${y} q ${size * 0.5} ${-size * 0.9} ${size} 0 z" fill="#ffc9c2" opacity="0.8"/>`
        : `<circle cx="${x}" cy="${y}" r="${size * 0.14}" fill="${seed > 0.4 ? '#d9b26e' : '#fff4d6'}" opacity="0.8"/>`,
  },
};

/** One seamless ground tile. Repeat it to fill a region. */
export function terrainTileSvg(terrain: TerrainId): string {
  const recipe = TILE_RECIPES[terrain];
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

const PROP_BODIES: Record<SceneryKind, string> = {
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

/**
 * One scenery sprite, on a transparent background. A themed piece borrows the
 * drawing of the scenery it is closest to, since it is meant to be generated.
 */
export function propSvg(kind: PropKind): string {
  const body = kind in PROP_BODIES ? kind : THEMED_FALLBACKS[kind as keyof typeof THEMED_FALLBACKS];
  return svgDocument(PROP_SIZE, PROP_SIZE, PROP_BODIES[body as SceneryKind]);
}

// ── Placing them ─────────────────────────────────────────────────────────────

/** Which props each terrain scatters, in rough order of how often. */
const TERRAIN_PROPS: Record<TerrainId, PropKind[]> = {
  hills: ['tree', 'boulder', 'flower'],
  meadow: ['flower', 'tree', 'flower'],
  water: ['pond', 'pond', 'flower'],
  caves: ['boulder', 'boulder', 'pine'],
  forest: ['tree', 'pine', 'tree'],
  village: ['cottage', 'cottage', 'tree'],
  beach: ['palm', 'shells', 'shells'],
};

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
  const kinds = TERRAIN_PROPS[region.terrain];
  const count = region.terrain === 'village' ? 12 : 20;
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

    // Shells are pocket-sized; at tree size they tower over everything.
    const kind =
      kinds[Math.floor(noise(`${region.id}-k-${i}`) * kinds.length) % kinds.length];
    placed.push({
      id: `${region.id}-${i}`,
      kind,
      x,
      y,
      size: Math.round(
        (74 + noise(`${region.id}-s-${i}`) * 46) * (kind === 'shells' ? 0.5 : 1),
      ),
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

/** How a generation prompt should describe each kind of ground. */
export const TERRAIN_DESCRIPTIONS: Record<TerrainId, string> = {
  hills: 'sunlit rolling grass, short and springy, with a few tufts',
  water: 'clear shallow blue-green water with gentle ripples',
  caves: 'grey mossy rock and loose scree',
  forest: 'shady forest floor with fallen leaves and moss',
  village: 'worn cobblestones and pale flagstones',
  meadow: 'long meadow grass strewn with tiny wildflowers',
  beach: 'soft golden beach sand with a few tiny pebbles and flecks of shell',
};

/** How a generation prompt should describe each scenery sprite. */
export const PROP_DESCRIPTIONS: Record<PropKind, string> = {
  tree: 'a single round leafy broadleaf tree',
  pine: 'a single tall pointed pine tree',
  boulder: 'a single mossy grey boulder with a small dark cave mouth in it',
  cottage: 'a single small cottage with a red roof and a round window',
  pond: 'a small round pond with lily pads and a flower',
  flower: 'a single large pink flower with a yellow centre on a green stem',
  palm: 'a single small leaning palm tree with a few coconuts',
  shells: 'a little cluster of three pretty seashells, a scallop, a spiral and a pink one',

  // What grows at a place as it is won.
  windmill: 'a single cheerful wooden windmill with four white sails on a small grassy mound',
  lilypad: 'a single big round green lily pad floating on a little patch of water, with a pink water lily in bloom on it',
  cave: 'a single rocky hillock of grey stones with a dark arched cave entrance in the front',
  oak: 'a single big old oak tree with a thick trunk and a wide, full, round crown of leaves',
  townhouse: 'a single charming two-storey town house with a blue door, window boxes of flowers and a tiled roof',
  sunflower: 'a single tall sunflower with a big golden flower head and broad green leaves',
  sandcastle: 'a single sandcastle with three towers, crenellations and a little red flag on top',

  // The extra piece each region is given at random.
  sheep: 'a single fluffy white sheep standing on four little black legs',
  haybarn: 'a single small red wooden barn with a white-trimmed door and hay poking out',
  rowboat: 'a single small wooden rowing boat with two oars resting inside it',
  duckhouse: 'a single little wooden duck house on a floating raft, with a yellow duck beside it',
  crystals: 'a single cluster of glowing purple and blue crystals growing from a grey rock',
  minecart: 'a single old wooden mine cart full of shiny rocks, on a short piece of track',
  mushrooms: 'a single group of three red-capped toadstools with white spots',
  logcabin: 'a single small log cabin with a mossy roof and a stone chimney',
  well: 'a single round stone wishing well with a little wooden roof and a bucket',
  fruitstall: 'a single small market stall with a striped awning and crates of colourful fruit',
  beehive: 'a single old-fashioned straw beehive on a wooden stand, with two bees',
  scarecrow: 'a single friendly scarecrow in a straw hat and patched shirt on a pole',
  parasol: 'a single striped beach umbrella above a folded beach towel and a bucket and spade',
  lighthouse: 'a single small red and white striped lighthouse on a few rocks',
};
