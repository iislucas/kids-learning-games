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

export const MAP_WIDTH = 1600;
export const MAP_HEIGHT = 1100;

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
  terrain: 'meadow' | 'water' | 'forest' | 'village' | 'hills';
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
 * The four lands, arranged so the two biggest — the times tables and the adding
 * families — sit either side of the start, and nothing needs a scroll of more
 * than one screen to reach from its neighbour.
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
    cx: 400,
    cy: 260,
    rx: 370,
    ry: 220,
    terrain: 'hills',
    perRow: 4,
  },
  {
    id: 'adding',
    packId: 'maths',
    prefix: 'maths.add.',
    name: 'Adding Ponds',
    emoji: '➕',
    colour: '#3fb6d8',
    cx: 1180,
    cy: 260,
    rx: 350,
    ry: 220,
    terrain: 'water',
    perRow: 4,
  },
  {
    id: 'words',
    packId: 'english',
    prefix: 'english.',
    name: 'Word Wood',
    emoji: '📚',
    colour: '#e8484f',
    cx: 320,
    cy: 830,
    rx: 290,
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
    cx: 830,
    cy: 850,
    rx: 250,
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
    cx: 1330,
    cy: 830,
    rx: 220,
    ry: 190,
    terrain: 'meadow',
    perRow: 2,
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
      y: Math.round(plan.cy + spread(row, rows) * plan.ry * 0.5),
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
    start: { x: Math.round(MAP_WIDTH / 2), y: 560 },
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
