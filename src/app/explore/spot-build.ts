import { noise } from './map-art';
import { MapRegion, MapSpot } from './map-layout';
import { PropKind } from './props';
import { TerrainId, terrainDef } from './terrains';

/**
 * What grows at each place as it is won.
 *
 * The badges are the reward, but a row of identical signposts makes a map where
 * the only way to see progress is to read every label. Something that visibly
 * grows turns the whole landscape into the progress bar, readable at a glance
 * and from across the map.
 *
 * So a place starts out empty — just its name on bare ground — and each region
 * grows its own landmark there: a small one for the gold star, a big one for
 * the crown. A sapling becomes an oak in Word Wood, a lily pad spreads on the
 * Adding Ponds. The landmarks are pictures from the media pack, the same as the
 * scenery, so a finished place looks like it belongs to the land around it.
 *
 * Each region is also given one extra piece at random — a barn, a well, a
 * lighthouse — which is rolled again after a fresh start, so no two playthroughs
 * dress the map quite the same.
 *
 * Which landmark and which extras belong to a terrain is declared with the rest
 * of its look in `terrains.ts`; this file decides when and how big.
 *
 * Pure and Angular-free, so it can be unit-tested.
 */

export type BuildStage = 'plot' | 'started' | 'finished';

/** Rendered widths in map pixels; heights follow each picture's own shape. */
export const BUILD_WIDTHS: Record<Exclude<BuildStage, 'plot'>, number> = {
  started: 62,
  finished: 118,
};

/** Smaller than a finished landmark, so the places stay the main event. */
export const EXTRA_WIDTH = 92;

/** Which stage a place is at, from the badges won there. */
export function stageFor(badges: readonly string[]): BuildStage {
  if (badges.includes('mastered')) return 'finished';
  if (badges.includes('cleared')) return 'started';
  return 'plot';
}

/** What stands at a place, or nothing yet. */
export function buildFor(
  terrain: TerrainId,
  stage: BuildStage,
): { kind: PropKind; width: number } | null {
  if (stage === 'plot') return null;
  return { kind: terrainDef(terrain).landmark, width: BUILD_WIDTHS[stage] };
}

/** A region's extra piece, as rolled and stored. */
export interface ExtraRoll {
  kind: PropKind;
  /** Where it goes, as a seed for `placeExtra`. */
  seed: number;
}

/**
 * Picks a region's extra piece. `random` is `Math.random` in the game and a
 * fixed sequence in the tests.
 */
export function rollExtra(terrain: TerrainId, random: () => number): ExtraRoll {
  const extras = terrainDef(terrain).extras;
  return {
    kind: extras[Math.floor(random() * extras.length) % extras.length],
    seed: Math.floor(random() * 1_000_000),
  };
}

/** Whether a stored roll still fits the region, or needs rolling again. */
export function isValidRoll(terrain: TerrainId, roll: unknown): roll is ExtraRoll {
  if (typeof roll !== 'object' || roll === null) return false;
  const { kind, seed } = roll as Partial<ExtraRoll>;
  return (
    typeof seed === 'number' &&
    Number.isFinite(seed) &&
    terrainDef(terrain).extras.includes(kind as PropKind)
  );
}

/** How far the extra keeps from a place, so it never hides what grows there. */
export const EXTRA_CLEARANCE = 110;

/**
 * Where a region's extra piece stands: inside the region, clear of its places.
 * The same roll always lands in the same spot.
 */
export function placeExtra(
  region: MapRegion,
  spots: readonly MapSpot[],
  seed: number,
): { x: number; y: number } {
  let best = { x: region.cx, y: region.cy + region.ry * 0.7 };
  let bestGap = -1;
  for (let i = 0; i < 40; i++) {
    const angle = noise(`${seed}-a-${i}`) * Math.PI * 2;
    const reach = 0.3 + noise(`${seed}-r-${i}`) * 0.5;
    const x = Math.round(region.cx + Math.cos(angle) * region.rx * reach);
    const y = Math.round(region.cy + Math.sin(angle) * region.ry * reach);
    const gap = Math.min(
      Infinity,
      ...spots.map((spot) => Math.hypot(spot.x - x, spot.y - y)),
    );
    if (gap >= EXTRA_CLEARANCE) return { x, y };
    // A crowded region may have nowhere fully clear; take the roomiest.
    if (gap > bestGap) {
      best = { x, y };
      bestGap = gap;
    }
  }
  return best;
}
