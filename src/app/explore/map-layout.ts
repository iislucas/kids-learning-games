import { ALL_CHALLENGES, ChallengeRef } from '../quiz/challenges';

/**
 * Where everything sits in the landscape.
 *
 * This is the single source of truth for positions: the page puts its signposts
 * here, and the background art draws its clearings here. Deriving both from one
 * layout is what stops the art and the tappable spots drifting apart — a
 * hand-placed picture would go stale the moment a challenge is added.
 *
 * **This module must stay free of Angular imports, `enum`s and parameter
 * properties**, because `scripts/generate-default-media.mts` imports it
 * directly and Node only strips types rather than compiling them.
 */

export const MAP_WIDTH = 1700;
export const MAP_HEIGHT = 1800;

/** How far from a spot counts as standing on it. */
export const SPOT_RADIUS = 54;

export interface MapRegion {
  id: string;
  packId: string;
  name: string;
  emoji: string;
  colour: string;
  /** The ground this region covers, as an ellipse. */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Terrain the art should draw here. */
  terrain: 'meadow' | 'water' | 'forest' | 'village' | 'hills' | 'caves';
  /**
   * Which levels of an ordinary round belong here, for a pack split across
   * several regions. Maths is: adding happens at the ponds and times tables in
   * the hills, so a round of level-5 times tables should feel like the hills.
   * Omit it on a pack's only region.
   */
  levels?: number[];
}

export interface MapSpot {
  challengeId: string;
  regionId: string;
  /** Order along the region's path, so the art can join them up. */
  index: number;
  x: number;
  y: number;
}

export interface MapLayout {
  width: number;
  height: number;
  regions: MapRegion[];
  spots: MapSpot[];
  /** Where the fox stands on a fresh start — the middle of the crossroads. */
  start: { x: number; y: number };
}

/**
 * Six lands in two columns around a crossroads, plus the Counting Garden along
 * the bottom for the youngest players. The columns keep the three maths regions
 * together, each a short walk from where she starts.
 */
interface RegionPlan extends Omit<MapRegion, 'packId'> {
  packId: string;
  /** Which challenges belong here, matched on the start of the id. */
  prefix: string;
  /** Spots per row before the path doubles back. */
  perRow: number;
}

const REGION_PLANS: RegionPlan[] = [
  {
    id: 'tables',
    packId: 'maths',
    prefix: 'maths.times.',
    name: 'Times Table Hills',
    emoji: '✖️',
    colour: '#4f8ff7',
    cx: 440,
    cy: 250,
    rx: 390,
    ry: 210,
    terrain: 'hills',
    levels: [5],
    perRow: 4,
  },
  {
    id: 'adding',
    packId: 'maths',
    prefix: 'maths.add.',
    name: 'Adding Ponds',
    emoji: '➕',
    colour: '#3fb6d8',
    cx: 1270,
    cy: 250,
    rx: 380,
    ry: 210,
    terrain: 'water',
    levels: [1, 2, 4],
    perRow: 4,
  },
  {
    id: 'subtracting',
    packId: 'maths',
    prefix: 'maths.sub.',
    name: 'Take-Away Caves',
    emoji: '➖',
    colour: '#9a7bd8',
    cx: 440,
    cy: 720,
    rx: 380,
    ry: 200,
    terrain: 'caves',
    levels: [3],
    perRow: 4,
  },
  {
    id: 'words',
    packId: 'english',
    prefix: 'english.',
    name: 'Word Wood',
    emoji: '📚',
    colour: '#e8484f',
    cx: 1270,
    cy: 720,
    rx: 330,
    ry: 200,
    terrain: 'forest',
    perRow: 3,
  },
  {
    id: 'french',
    packId: 'french',
    prefix: 'french.',
    name: 'Petit Village',
    emoji: '🇫🇷',
    colour: '#7a5cf0',
    cx: 470,
    cy: 1160,
    rx: 300,
    ry: 190,
    terrain: 'village',
    perRow: 3,
  },
  {
    id: 'wonder',
    packId: 'science',
    prefix: 'science.',
    name: 'Wonder Meadow',
    emoji: '🔬',
    colour: '#1fa97a',
    cx: 1270,
    cy: 1160,
    rx: 280,
    ry: 185,
    terrain: 'meadow',
    perRow: 2,
  },
  {
    // Along the bottom, below both columns: counting is for the youngest
    // players, and one row of four spots fits a wide, shallow strip.
    id: 'counting',
    packId: 'counting',
    prefix: 'counting.',
    name: 'Counting Garden',
    emoji: '🌼',
    colour: '#f29a2e',
    cx: 870,
    cy: 1590,
    rx: 420,
    ry: 170,
    terrain: 'meadow',
    perRow: 4,
  },
];

/**
 * Lays the spots out on a serpentine path inside each region, so a new
 * challenge places itself rather than needing a coordinate picked by hand.
 *
 * The rows are inset from the ellipse and the odd ones run backwards, which
 * keeps consecutive spots next to each other — walking the 2× 3× 4× hills in
 * order should be a stroll along a path, not a hunt.
 */
function placeSpots(plan: RegionPlan, refs: ChallengeRef[]): MapSpot[] {
  const rows = Math.max(1, Math.ceil(refs.length / plan.perRow));
  return refs.map((ref, index) => {
    const row = Math.floor(index / plan.perRow);
    const column = index % plan.perRow;
    // The last row is usually short; centre it rather than leaving a gap.
    const inRow = Math.min(plan.perRow, refs.length - row * plan.perRow);
    const forwards = row % 2 === 0;
    const position = forwards ? column : inRow - 1 - column;

    const spread = (n: number, count: number) =>
      count <= 1 ? 0 : (n / (count - 1)) * 2 - 1;

    return {
      challengeId: ref.challenge.id,
      regionId: plan.id,
      index,
      x: Math.round(plan.cx + spread(position, inRow) * plan.rx * 0.62),
      // The same inset vertically. Any tighter and three rows of spots come
      // closer together than two signposts can be tapped apart.
      y: Math.round(plan.cy + spread(row, rows) * plan.ry * 0.6),
    };
  });
}

export function buildMapLayout(): MapLayout {
  const regions: MapRegion[] = [];
  const spots: MapSpot[] = [];

  for (const plan of REGION_PLANS) {
    const refs = ALL_CHALLENGES.filter((ref) =>
      ref.challenge.id.startsWith(plan.prefix),
    );
    if (refs.length === 0) continue;
    const { prefix, perRow, ...region } = plan;
    regions.push(region);
    spots.push(...placeSpots(plan, refs));
  }

  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    regions,
    spots,
    // The crossroads: the gap between all four quarters, so every region is a
    // short walk from where she starts.
    start: { x: 870, y: 490 },
  };
}

export function spotFor(layout: MapLayout, challengeId: string): MapSpot | undefined {
  return layout.spots.find((spot) => spot.challengeId === challengeId);
}

/** The nearest spot to a point, if the walker is standing close enough to it. */
export function spotAt(
  layout: MapLayout,
  x: number,
  y: number,
  radius = SPOT_RADIUS,
): MapSpot | undefined {
  let best: MapSpot | undefined;
  let bestDistance = radius;
  for (const spot of layout.spots) {
    const distance = Math.hypot(spot.x - x, spot.y - y);
    if (distance <= bestDistance) {
      best = spot;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * The region a prize was won in, from the place recorded with it.
 *
 * A place is a challenge id, `region:<id>` for an ordinary round, or
 * `pack:<id>` for anything recorded before rounds knew their region. A pack
 * split across several regions has no way to say which one, so each prize is
 * dealt to one of them by its id — stably, so the map and the play screen
 * always agree on where it lives.
 */
export function regionIdForPlace(
  layout: MapLayout,
  place: string | undefined,
  prizeId: string,
): string | undefined {
  if (!place) return undefined;
  if (place.startsWith('region:')) {
    const id = place.slice('region:'.length);
    return layout.regions.some((region) => region.id === id) ? id : undefined;
  }
  if (place.startsWith('pack:')) {
    const packId = place.slice('pack:'.length);
    const regions = layout.regions.filter((region) => region.packId === packId);
    if (regions.length === 0) return undefined;
    let sum = 0;
    for (let i = 0; i < prizeId.length; i++) sum += prizeId.charCodeAt(i);
    return regions[sum % regions.length].id;
  }
  return spotFor(layout, place)?.regionId;
}

/**
 * The region a round is played in, so the game can look like the place it came
 * from.
 *
 * A challenge belongs to the region its spot is in. An ordinary round from the
 * games list has no spot, so it goes to the region of its pack — and for a pack
 * split across several regions, to the one that claims its level.
 */
export function regionForRound(
  layout: MapLayout,
  round: { packId: string; level: number; challengeId?: string | null },
): MapRegion | undefined {
  if (round.challengeId) {
    const spot = spotFor(layout, round.challengeId);
    if (spot) return layout.regions.find((region) => region.id === spot.regionId);
  }
  const regions = layout.regions.filter((region) => region.packId === round.packId);
  return (
    regions.find((region) => region.levels?.includes(round.level)) ?? regions[0]
  );
}
