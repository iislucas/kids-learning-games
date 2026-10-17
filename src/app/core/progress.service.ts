import { Injectable, computed } from '@angular/core';
import { storedSignal } from './stored-signal';
import {
  areaPrizesAt,
  completedSets,
  nextAreaPrize,
  Prize,
  PRIZES,
  PRIZES_BY_ID,
  progressTowardNextPrize,
} from './prizes';
import { buildMapLayout, regionIdForPlace } from '../explore/map-layout';

export interface PackStats {
  answered: number;
  correct: number;
  bestLevel: number;
}

/** Area key for stickers that have no area at all; they sit at the crossroads. */
export const CROSSROADS = 'crossroads';

/**
 * One area's own sticker collection. An area is a region of the map, keyed by
 * its id.
 */
export interface AreaPrizes {
  /** Stars earned in this area, which is what unlocks its stickers. */
  stars: number;
  /** Stickers held here, in unlock order. */
  prizeIds: string[];
  /**
   * Where in the area each sticker was won: a challenge id, or `region:<id>`
   * for an ordinary round. It lets the map and the play screen show a sticker
   * at the very spot she earned it.
   */
  places: Record<string, string>;
}

export interface ProgressState {
  /** Every star ever earned, across all areas. */
  stars: number;
  answered: number;
  correct: number;
  bestStreak: number;
  /** Each area's own collection, by area (region) id. */
  areas: Record<string, AreaPrizes>;
  packStats: Record<string, PackStats>;
  /** ISO yyyy-mm-dd of the last day a question was answered. */
  lastPlayedDay: string | null;
  dayStreak: number;
  /**
   * The single shared collection from before each area had its own. Only
   * present in old saves; moved into `areas` on load (see `moveIntoAreas`).
   */
  unlockedPrizeIds?: string[];
  /** Where each of those old stickers was won. Old saves only. */
  prizePlaces?: Record<string, string>;
}

const EMPTY: ProgressState = {
  stars: 0,
  answered: 0,
  correct: 0,
  bestStreak: 0,
  areas: {},
  packStats: {},
  lastPlayedDay: null,
  dayStreak: 0,
};

const EMPTY_AREA: AreaPrizes = { stars: 0, prizeIds: [], places: {} };

export interface AnswerOutcome {
  starsAwarded: number;
  /** Area the answer counted towards. */
  area: string;
  newPrizes: Prize[];
  /** Collections this answer completed in its area. */
  completedSetIds: string[];
}

/** A sticker as held in one area — the unit the map and play screen draw. */
export interface WonPrize {
  area: string;
  prize: Prize;
  /** Where in the area it was won, if known. */
  place: string | undefined;
}

export function localDayKey(date: Date): string {
  // Local rather than UTC: "played today" should mean the child's today.
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function daysBetween(fromKey: string, toKey: string): number {
  const from = new Date(`${fromKey}T00:00:00`);
  const to = new Date(`${toKey}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Stars for one correct answer. Streaks pay more, which is what turns a
 * sequence of right answers into a run worth protecting.
 */
export function starsForAnswer(streak: number): number {
  if (streak >= 10) return 4;
  if (streak >= 5) return 3;
  if (streak >= 3) return 2;
  return 1;
}

/**
 * Gives a place to every prize won before places were recorded.
 *
 * Which game actually paid for an old prize is gone, but how much she played
 * each game is not — and stars follow correct answers. So the placeless prizes
 * are shared out across the packs in proportion to their correct answers,
 * each going to whichever pack is furthest behind its share. That lands them
 * in the places she really spent her time, instead of all at the crossroads.
 *
 * Returns the state unchanged when there is nothing to fill in, or no play
 * history to go on.
 */
export function backfillPrizePlaces(state: ProgressState): ProgressState {
  const places = { ...(state.prizePlaces ?? {}) };
  const unlocked = state.unlockedPrizeIds ?? [];
  const missing = PRIZES.filter(
    (prize) => unlocked.includes(prize.id) && !places[prize.id],
  );
  const weights = Object.entries(state.packStats ?? {})
    .map(([packId, stats]) => ({ packId, weight: stats.correct || stats.answered }))
    .filter((entry) => entry.weight > 0);
  if (missing.length === 0 || weights.length === 0) return state;

  const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
  const given = new Map(weights.map((entry) => [entry.packId, 0]));
  missing.forEach((prize, index) => {
    const handedOut = index + 1;
    let best = weights[0];
    let bestShortfall = -Infinity;
    for (const entry of weights) {
      const shortfall =
        (entry.weight / total) * handedOut - (given.get(entry.packId) ?? 0);
      if (shortfall > bestShortfall) {
        best = entry;
        bestShortfall = shortfall;
      }
    }
    given.set(best.packId, (given.get(best.packId) ?? 0) + 1);
    places[prize.id] = `pack:${best.packId}`;
  });
  return { ...state, prizePlaces: places };
}

/**
 * Moves an old save's single collection into per-area collections.
 *
 * Each old sticker goes to the area it was won in (places are filled in first
 * by `backfillPrizePlaces`), so nothing she has is lost and everything stays
 * where the map already showed it. A sticker with no place at all goes to the
 * crossroads. The area's star count starts from zero; the carried-over
 * stickers are simply held on top of whatever its stars unlock.
 *
 * Returns the state unchanged when it is already in the new shape.
 */
export function moveIntoAreas(
  state: ProgressState,
  areaForPlace: (place: string | undefined, prizeId: string) => string | undefined,
): ProgressState {
  if (state.areas && state.unlockedPrizeIds === undefined && state.prizePlaces === undefined) {
    return state;
  }
  const filled = backfillPrizePlaces(state);
  const places = filled.prizePlaces ?? {};
  const areas: Record<string, AreaPrizes> = { ...(state.areas ?? {}) };
  for (const prize of PRIZES) {
    if (!(filled.unlockedPrizeIds ?? []).includes(prize.id)) continue;
    const place = places[prize.id];
    const area = areaForPlace(place, prize.id) ?? CROSSROADS;
    const current = areas[area] ?? EMPTY_AREA;
    if (current.prizeIds.includes(prize.id)) continue;
    // A pack is no more precise than its area, so only a spot is worth keeping.
    const where = place && !place.startsWith('pack:') ? place : `region:${area}`;
    areas[area] = {
      ...current,
      prizeIds: [...current.prizeIds, prize.id],
      places: { ...current.places, [prize.id]: where },
    };
  }
  const { unlockedPrizeIds: _ids, prizePlaces: _places, ...rest } = filled;
  return { ...rest, areas };
}

@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly state = storedSignal<ProgressState>('klg.progress', EMPTY);

  private readonly layout = buildMapLayout();

  constructor() {
    // Written back once, so an old sticker keeps the area it is given today
    // rather than drifting as the play history grows.
    const layout = this.layout;
    const moved = moveIntoAreas(this.state(), (place, prizeId) =>
      regionIdForPlace(layout, place, prizeId),
    );
    if (moved !== this.state()) this.state.set(moved);
  }

  readonly stars = computed(() => this.state().stars);
  readonly answered = computed(() => this.state().answered);
  readonly correct = computed(() => this.state().correct);
  readonly bestStreak = computed(() => this.state().bestStreak);
  readonly dayStreak = computed(() => this.state().dayStreak);

  /** Every area's own collection, by area id. */
  readonly areas = computed(() => this.state().areas ?? {});

  /** Every sticker held, one entry per area that holds it. */
  readonly wonPrizes = computed<WonPrize[]>(() =>
    Object.entries(this.areas()).flatMap(([area, held]) =>
      held.prizeIds.flatMap((id) => {
        const prize = PRIZES_BY_ID.get(id);
        return prize ? [{ area, prize, place: held.places[id] }] : [];
      }),
    ),
  );

  /** How many areas hold each sticker. Missing means none yet. */
  readonly prizeCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const won of this.wonPrizes()) {
      counts.set(won.prize.id, (counts.get(won.prize.id) ?? 0) + 1);
    }
    return counts;
  });

  /** Stickers held across every area, counting repeats. */
  readonly prizeTotal = computed(() => this.wonPrizes().length);

  /**
   * The sticker closest to landing anywhere, for the games list: among the
   * areas she has earned stars in, the one with fewest stars still to go.
   * When none of those has anything left but a fresh area does, it is that
   * area's first sticker, which any new place will pay.
   */
  readonly nearestNextPrize = computed(() => {
    let best: { area: string | null; prize: Prize; starsToGo: number; progress: number } | null =
      null;
    for (const area of Object.keys(this.areas())) {
      const prize = this.nextPrizeIn(area);
      if (!prize) continue;
      const starsToGo = Math.max(0, prize.starsRequired - this.areaStars(area));
      if (!best || starsToGo < best.starsToGo) {
        best = { area, prize, starsToGo, progress: this.progressToNextPrizeIn(area) };
      }
    }
    if (best) return best;
    const played = this.areas();
    if (this.layout.regions.every((region) => played[region.id])) return null;
    return { area: null, prize: PRIZES[0], starsToGo: PRIZES[0].starsRequired, progress: 0 };
  });

  readonly accuracy = computed(() => {
    const { answered, correct } = this.state();
    return answered === 0 ? 0 : correct / answered;
  });

  areaStars(area: string): number {
    return this.areas()[area]?.stars ?? 0;
  }

  /** One area's stickers, in unlock order. */
  prizesIn(area: string): WonPrize[] {
    return this.wonPrizes().filter((won) => won.area === area);
  }

  nextPrizeIn(area: string): Prize | null {
    return nextAreaPrize(new Set(this.areas()[area]?.prizeIds ?? []));
  }

  /** 0..1 towards an area's next sticker, or 1 when it has them all. */
  progressToNextPrizeIn(area: string): number {
    const held = this.areas()[area];
    return progressTowardNextPrize(held?.stars ?? 0, new Set(held?.prizeIds ?? []));
  }

  /** Collections finished in an area. */
  completedSetsIn(area: string) {
    return completedSets(new Set(this.areas()[area]?.prizeIds ?? []));
  }

  statsFor(packId: string): PackStats {
    return this.state().packStats[packId] ?? { answered: 0, correct: 0, bestLevel: 1 };
  }

  /**
   * Records one answer and returns what it earned, so the play screen can
   * celebrate the exact prizes that just landed.
   */
  recordAnswer(options: {
    packId: string;
    wasCorrect: boolean;
    /** Streak *including* this answer. */
    streak: number;
    level: number;
    /**
     * The area (map region id) the round is played in; its stars and stickers
     * are its own. Defaults to the crossroads.
     */
    area?: string;
    /**
     * Challenge id, or `region:<id>` for an ordinary round. Defaults to the
     * area as a whole.
     */
    place?: string;
    now?: Date;
  }): AnswerOutcome {
    const { packId, wasCorrect, streak, level } = options;
    const area = options.area ?? CROSSROADS;
    const place = options.place ?? `region:${area}`;
    const today = localDayKey(options.now ?? new Date());
    const before = this.state();

    const starsAwarded = wasCorrect ? starsForAnswer(streak) : 0;
    const stars = before.stars + starsAwarded;

    // Unlocks are derived from the area's star total rather than tracked
    // incrementally, so the collection stays consistent even if thresholds are
    // retuned later.
    const areaBefore = before.areas?.[area] ?? EMPTY_AREA;
    const areaStars = areaBefore.stars + starsAwarded;
    const previouslyHeld = new Set(areaBefore.prizeIds);
    const nowHeld = areaPrizesAt(areaStars, previouslyHeld);
    const newPrizes = nowHeld.filter((p) => !previouslyHeld.has(p.id));

    const setsBefore = new Set(completedSets(previouslyHeld).map((s) => s.id));
    const heldIds = nowHeld.map((p) => p.id);
    const completedSetIds = completedSets(new Set(heldIds))
      .map((s) => s.id)
      .filter((id) => !setsBefore.has(id));

    const packStat = before.packStats[packId] ?? {
      answered: 0,
      correct: 0,
      bestLevel: 1,
    };

    const gap =
      before.lastPlayedDay === null ? null : daysBetween(before.lastPlayedDay, today);
    let dayStreak = before.dayStreak;
    if (gap === null) dayStreak = 1;
    else if (gap === 1) dayStreak = before.dayStreak + 1;
    else if (gap > 1) dayStreak = 1;
    else if (before.dayStreak === 0) dayStreak = 1;

    // An area appears once something is earned there, not on a wrong answer.
    const areas =
      starsAwarded > 0
        ? {
            ...before.areas,
            [area]: {
              stars: areaStars,
              prizeIds: heldIds,
              places: {
                ...areaBefore.places,
                ...Object.fromEntries(newPrizes.map((prize) => [prize.id, place])),
              },
            },
          }
        : before.areas;

    this.state.set({
      stars,
      answered: before.answered + 1,
      correct: before.correct + (wasCorrect ? 1 : 0),
      bestStreak: Math.max(before.bestStreak, streak),
      areas,
      packStats: {
        ...before.packStats,
        [packId]: {
          answered: packStat.answered + 1,
          correct: packStat.correct + (wasCorrect ? 1 : 0),
          bestLevel: Math.max(packStat.bestLevel, level),
        },
      },
      lastPlayedDay: today,
      dayStreak,
    });

    return { starsAwarded, area, newPrizes, completedSetIds };
  }

  reset(): void {
    this.state.set(EMPTY);
  }
}
