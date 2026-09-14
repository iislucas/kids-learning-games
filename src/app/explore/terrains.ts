// Type-only, so `scripts/extract-map-art.mts` can import this file straight
// into Node, which strips types but does not resolve extensionless imports.
import type { PropKind } from './props';

/**
 * How each kind of land looks — everything about an area's appearance, in one
 * entry per terrain:
 *
 *  - the **ground**: a seamless tile, generated from `description` and
 *    committed as `public/media/map/tile-<id>.webp`, with a drawn `tile`
 *    recipe as the fallback;
 *  - the **scenery** scattered over it;
 *  - the **landmark** that grows at each place as it is won — small for the
 *    gold star, big for the crown (see `spot-build.ts`);
 *  - the **extras**, one of which is picked at random for each region.
 *
 * Where a region sits, and which pack's challenges it holds, is `map-layout.ts`.
 * The pictures themselves are listed in `props.ts`.
 *
 * Angular-free, with no `enum`s, like the rest of `explore/`.
 */

/** A drawn fallback tile: a gradient wash with marks strewn over it. */
export interface TileRecipe {
  /** Base wash, lit from above. */
  top: string;
  bottom: string;
  /** One mark at (x, y). `seed` is 0..1, for varying it. */
  marks: (x: number, y: number, size: number, seed: number) => string;
  count: number;
}

export interface TerrainDef {
  /** What the ground looks like, for the image model making the tile. */
  description: string;
  tile: TileRecipe;
  /** The scenery scattered over it, repeated to weight how often each appears. */
  scenery: PropKind[];
  /** How many pieces of scenery to try placing. */
  sceneryCount: number;
  /** Grows at every place in the region: small when started, big when finished. */
  landmark: PropKind;
  /** One of these is picked at random for the region. */
  extras: PropKind[];
}

const TERRAIN_TABLE = {
  hills: {
    description: 'sunlit rolling grass, short and springy, with a few tufts',
    tile: {
      top: '#a9e08a',
      bottom: '#7fc46a',
      count: 26,
      marks: (x, y, size) =>
        `<path d="M ${x} ${y} q ${size * 0.4} ${-size} ${size * 0.9} ${-size * 0.2}" ` +
        `fill="none" stroke="#5fae57" stroke-width="${size * 0.22}" stroke-linecap="round" opacity="0.55"/>`,
    },
    scenery: ['tree', 'boulder', 'flower'],
    sceneryCount: 20,
    landmark: 'windmill',
    extras: ['sheep', 'haybarn'],
  },

  water: {
    description: 'clear shallow blue-green water with gentle ripples',
    tile: {
      top: '#7fd4ee',
      bottom: '#3fa6cf',
      count: 18,
      marks: (x, y, size) =>
        `<path d="M ${x - size} ${y} q ${size * 0.5} ${-size * 0.5} ${size} 0 q ${size * 0.5} ${size * 0.5} ${size} 0" ` +
        `fill="none" stroke="#ffffff" stroke-width="${size * 0.2}" stroke-linecap="round" opacity="0.45"/>`,
    },
    scenery: ['pond', 'pond', 'flower'],
    sceneryCount: 20,
    landmark: 'lilypad',
    extras: ['rowboat', 'duckhouse'],
  },

  caves: {
    description: 'grey mossy rock and loose scree',
    tile: {
      top: '#b9b3a6',
      bottom: '#8f887b',
      count: 24,
      marks: (x, y, size, seed) =>
        `<ellipse cx="${x}" cy="${y}" rx="${size * 0.9}" ry="${size * 0.55}" ` +
        `fill="${seed > 0.5 ? '#6f6a60' : '#cfc8ba'}" opacity="0.5"/>`,
    },
    scenery: ['boulder', 'boulder', 'pine'],
    sceneryCount: 20,
    landmark: 'cave',
    extras: ['crystals', 'minecart'],
  },

  forest: {
    description: 'shady forest floor with fallen leaves and moss',
    tile: {
      top: '#8fd08d',
      bottom: '#5da966',
      count: 28,
      marks: (x, y, size, seed) =>
        `<ellipse cx="${x}" cy="${y}" rx="${size * 0.7}" ry="${size * 0.32}" ` +
        `fill="${seed > 0.5 ? '#3f8f52' : '#a8dda0'}" opacity="0.5" ` +
        `transform="rotate(${Math.round(seed * 90 - 45)} ${x} ${y})"/>`,
    },
    scenery: ['tree', 'pine', 'tree'],
    sceneryCount: 20,
    landmark: 'oak',
    extras: ['mushrooms', 'logcabin'],
  },

  village: {
    description: 'worn cobblestones and pale flagstones',
    tile: {
      top: '#e3d9c2',
      bottom: '#c8bda3',
      count: 30,
      marks: (x, y, size, seed) =>
        `<rect x="${x}" y="${y}" width="${size * 1.6}" height="${size * 1.1}" rx="${size * 0.35}" ` +
        `fill="${seed > 0.5 ? '#d5c9ae' : '#efe6d2'}" opacity="0.75" ` +
        `transform="rotate(${Math.round(seed * 30 - 15)} ${x} ${y})"/>`,
    },
    scenery: ['cottage', 'cottage', 'tree'],
    // Cottages are big; fewer of them keeps the cobbles visible.
    sceneryCount: 12,
    landmark: 'townhouse',
    extras: ['well', 'fruitstall'],
  },

  meadow: {
    description: 'long meadow grass strewn with tiny wildflowers',
    tile: {
      top: '#b6e893',
      bottom: '#8ed07a',
      count: 22,
      marks: (x, y, size, seed) =>
        seed > 0.55
          ? `<circle cx="${x}" cy="${y}" r="${size * 0.3}" fill="${['#ff8fb1', '#ffd45e', '#b98cff'][Math.floor(seed * 3) % 3]}" opacity="0.85"/>`
          : `<path d="M ${x} ${y} l ${size * 0.2} ${-size * 0.8}" stroke="#63b06a" stroke-width="${size * 0.18}" stroke-linecap="round" opacity="0.6"/>`,
    },
    scenery: ['flower', 'tree', 'flower'],
    sceneryCount: 20,
    landmark: 'sunflower',
    extras: ['beehive', 'scarecrow'],
  },

  beach: {
    description: 'soft golden beach sand with a few tiny pebbles and flecks of shell',
    tile: {
      top: '#f7e3b0',
      bottom: '#ecc987',
      count: 26,
      marks: (x, y, size, seed) =>
        seed > 0.8
          ? `<path d="M ${x - size * 0.5} ${y} q ${size * 0.5} ${-size * 0.9} ${size} 0 z" fill="#ffc9c2" opacity="0.8"/>`
          : `<circle cx="${x}" cy="${y}" r="${size * 0.14}" fill="${seed > 0.4 ? '#d9b26e' : '#fff4d6'}" opacity="0.8"/>`,
    },
    scenery: ['palm', 'shells', 'shells'],
    sceneryCount: 20,
    landmark: 'sandcastle',
    extras: ['parasol', 'lighthouse'],
  },
} satisfies Record<string, TerrainDef>;

export type TerrainId = keyof typeof TERRAIN_TABLE;

export const TERRAINS: Record<TerrainId, TerrainDef> = TERRAIN_TABLE;

/** Every terrain, in the order the media studio lists them. */
export const TERRAIN_IDS = Object.keys(TERRAINS) as TerrainId[];

export function terrainDef(terrain: TerrainId): TerrainDef {
  return TERRAINS[terrain];
}

/** Where the generated ground tile for a terrain is committed, under `public/`. */
export function tileFile(terrain: TerrainId): string {
  return `media/map/tile-${terrain}.webp`;
}
