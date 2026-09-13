import { Injectable, computed } from '@angular/core';
import { storedSignal } from './stored-signal';
import {
  completedSets,
  nextPrizeAfter,
  Prize,
  prizesUnlockedAt,
  PRIZES,
} from './prizes';

export interface PackStats {
  answered: number;
  correct: number;
  bestLevel: number;
}

export interface ProgressState {
  stars: number;
  answered: number;
  correct: number;
  bestStreak: number;
  unlockedPrizeIds: string[];
  /**
   * Where each prize was won: a challenge id, `region:<id>` for an ordinary
   * round, or `pack:<id>` when only the game is known.
   *
   * Prizes unlock on a cumulative star total, which knows nothing about place —
   * so the place has to be recorded as it happens. It is what lets the map show
   * a prize where she earned it rather than in a list, which is a much better
   * souvenir: the landscape fills up with the things she did there.
   */
  prizePlaces: Record<string, string>;
  packStats: Record<string, PackStats>;
  /** ISO yyyy-mm-dd of the last day a question was answered. */
  lastPlayedDay: string | null;
  dayStreak: number;
}

const EMPTY: ProgressState = {
  stars: 0,
  answered: 0,
  correct: 0,
  bestStreak: 0,
  unlockedPrizeIds: [],
  prizePlaces: {},
  packStats: {},
  lastPlayedDay: null,
  dayStreak: 0,
};

export interface AnswerOutcome {
  starsAwarded: number;
  newPrizes: Prize[];
  /** True when this answer completed a whole collection. */
  completedSetIds: string[];
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
  const missing = PRIZES.filter(
    (prize) => state.unlockedPrizeIds.includes(prize.id) && !places[prize.id],
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

@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly state = storedSignal<ProgressState>('klg.progress', EMPTY);

  constructor() {
    // Written back once, so an old prize keeps the home it is given today
    // rather than drifting as the play history grows.
    const filled = backfillPrizePlaces(this.state());
    if (filled !== this.state()) this.state.set(filled);
  }

  readonly stars = computed(() => this.state().stars);
  readonly answered = computed(() => this.state().answered);
  readonly correct = computed(() => this.state().correct);
  readonly bestStreak = computed(() => this.state().bestStreak);
  readonly dayStreak = computed(() => this.state().dayStreak);

  readonly unlockedPrizeIds = computed(
    () => new Set(this.state().unlockedPrizeIds),
  );

  /**
   * Where each prize was won. Old prizes are given a place on load (see
   * `backfillPrizePlaces`); one can still be absent with no play history to
   * go on, which the map treats as "somewhere in the middle".
   */
  readonly prizePlaces = computed(() => this.state().prizePlaces ?? {});
  readonly unlockedPrizes = computed(() =>
    PRIZES.filter((prize) => this.unlockedPrizeIds().has(prize.id)),
  );
  readonly nextPrize = computed(() => nextPrizeAfter(this.stars()));
  readonly completedSets = computed(() => completedSets(this.unlockedPrizeIds()));

  /** 0..1 towards the next prize, or 1 when everything is collected. */
  readonly progressToNextPrize = computed(() => {
    const next = this.nextPrize();
    if (!next) return 1;
    const previous = PRIZES.filter((p) => p.starsRequired <= this.stars());
    const floor = previous.length
      ? previous[previous.length - 1].starsRequired
      : 0;
    const span = next.starsRequired - floor;
    if (span <= 0) return 1;
    return Math.min(1, Math.max(0, (this.stars() - floor) / span));
  });

  readonly accuracy = computed(() => {
    const { answered, correct } = this.state();
    return answered === 0 ? 0 : correct / answered;
  });

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
     * Challenge id, or `region:<id>` for an ordinary round. Defaults to
     * `pack:<id>`.
     */
    place?: string;
    now?: Date;
  }): AnswerOutcome {
    const { packId, wasCorrect, streak, level } = options;
    const place = options.place ?? `pack:${packId}`;
    const today = localDayKey(options.now ?? new Date());
    const before = this.state();

    const starsAwarded = wasCorrect ? starsForAnswer(streak) : 0;
    const stars = before.stars + starsAwarded;

    // Unlocks are derived from the star total rather than tracked incrementally,
    // so the collection stays consistent even if thresholds are retuned later.
    const previouslyUnlocked = new Set(before.unlockedPrizeIds);
    const nowUnlocked = prizesUnlockedAt(stars);
    const newPrizes = nowUnlocked.filter((p) => !previouslyUnlocked.has(p.id));

    const setsBefore = new Set(completedSets(previouslyUnlocked).map((s) => s.id));
    const unlockedIds = nowUnlocked.map((p) => p.id);
    const completedSetIds = completedSets(new Set(unlockedIds))
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

    this.state.set({
      stars,
      answered: before.answered + 1,
      correct: before.correct + (wasCorrect ? 1 : 0),
      bestStreak: Math.max(before.bestStreak, streak),
      unlockedPrizeIds: unlockedIds,
      prizePlaces: {
        ...(before.prizePlaces ?? {}),
        ...Object.fromEntries(newPrizes.map((prize) => [prize.id, place])),
      },
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

    return { starsAwarded, newPrizes, completedSetIds };
  }

  reset(): void {
    this.state.set(EMPTY);
  }
}
