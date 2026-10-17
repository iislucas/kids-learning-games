import { Injectable, computed } from '@angular/core';
import { storedSignal } from './stored-signal';
import {
  prizesHeldAt,
  completedSets,
  nextPrizeToEarn,
  Prize,
  PRIZES,
  PRIZES_BY_ID,
  progressTowardNextPrize,
} from './prizes';
import { buildMapLayout, regionIdForPlace, spotFor } from '../explore/map-layout';
import { CROSSROADS, levelBookKey } from '../explore/sticker-books';

export { CROSSROADS };

export interface PackStats {
  answered: number;
  correct: number;
  bestLevel: number;
}

/**
 * One sticker book: the collection of a single game in a single area (see
 * `sticker-books.ts` for how books are keyed).
 */
export interface StickerBook {
  /** The area (map region id) the book belongs to. */
  area: string;
  /** Stars earned in this book's game, which is what unlocks its stickers. */
  stars: number;
  /** Stickers held here, in unlock order. */
  prizeIds: string[];
}

export interface ProgressState {
  /** Every star ever earned, across all books. */
  stars: number;
  answered: number;
  correct: number;
  bestStreak: number;
  /** Every game's own sticker book, by book key. */
  books: Record<string, StickerBook>;
  packStats: Record<string, PackStats>;
  /** ISO yyyy-mm-dd of the last day a question was answered. */
  lastPlayedDay: string | null;
  dayStreak: number;
  /**
   * The single shared collection from before each game had its own. Only
   * present in old saves; moved into `books` on load (see `moveIntoBooks`).
   */
  unlockedPrizeIds?: string[];
  /** Where each of those old stickers was won. Old saves only. */
  prizePlaces?: Record<string, string>;
  /**
   * Briefly, each area had one collection, with where in it each sticker was
   * won. Saves from then only; moved into `books` on load.
   */
  areas?: Record<string, { prizeIds: string[]; places: Record<string, string> }>;
}

const EMPTY: ProgressState = {
  stars: 0,
  answered: 0,
  correct: 0,
  bestStreak: 0,
  books: {},
  packStats: {},
  lastPlayedDay: null,
  dayStreak: 0,
};

export interface AnswerOutcome {
  starsAwarded: number;
  /** Book the answer counted towards. */
  book: string;
  newPrizes: Prize[];
  /** Collections this answer completed in its book. */
  completedSetIds: string[];
}

/** A sticker as held in one book — the unit the map and play screen draw. */
export interface WonPrize {
  book: string;
  area: string;
  prize: Prize;
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
 * Moves an old save's single collection into per-game books.
 *
 * Each old sticker goes to the game it was won at when that is known (places
 * are filled in first by `backfillPrizePlaces`). One only known to an area
 * goes in that area's `region:` book, and one known to nothing at the
 * crossroads. Nothing she has is lost. A book's star count starts from zero;
 * the carried-over stickers are simply held on top of whatever its stars
 * unlock.
 *
 * Returns the state unchanged when it is already in the new shape.
 */
export function moveIntoBooks(
  state: ProgressState,
  where: {
    /** The area a place is in: a challenge id, `region:<id>` or `pack:<id>`. */
    areaForPlace: (place: string | undefined, prizeId: string) => string | undefined;
    /** Whether a place is a challenge with its own spot. */
    isSpot: (place: string) => boolean;
  },
): ProgressState {
  if (
    state.books &&
    state.unlockedPrizeIds === undefined &&
    state.prizePlaces === undefined &&
    state.areas === undefined
  ) {
    return state;
  }
  const filled = backfillPrizePlaces(state);
  const places = filled.prizePlaces ?? {};
  const unlocked = filled.unlockedPrizeIds ?? [];
  const books: Record<string, StickerBook> = { ...(state.books ?? {}) };
  for (const prize of PRIZES) {
    if (!unlocked.includes(prize.id)) continue;
    const place = places[prize.id];
    const area = where.areaForPlace(place, prize.id) ?? CROSSROADS;
    const key =
      place && where.isSpot(place) ? place : area === CROSSROADS ? CROSSROADS : `region:${area}`;
    const current = books[key] ?? { area, stars: 0, prizeIds: [] };
    if (current.prizeIds.includes(prize.id)) continue;
    books[key] = { ...current, prizeIds: [...current.prizeIds, prize.id] };
  }
  for (const [area, held] of Object.entries(state.areas ?? {})) {
    for (const id of held.prizeIds) {
      const place = held.places[id];
      const key = place && where.isSpot(place) ? place : `region:${area}`;
      const current = books[key] ?? { area, stars: 0, prizeIds: [] };
      if (current.prizeIds.includes(id)) continue;
      books[key] = { ...current, prizeIds: [...current.prizeIds, id] };
    }
  }
  const { unlockedPrizeIds: _ids, prizePlaces: _places, areas: _areas, ...rest } = filled;
  return { ...rest, books };
}

@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly state = storedSignal<ProgressState>('klg.progress', EMPTY);
  private readonly layout = buildMapLayout();

  constructor() {
    // Written back once, so an old sticker keeps the book it is given today
    // rather than drifting as the play history grows.
    const layout = this.layout;
    const moved = moveIntoBooks(this.state(), {
      areaForPlace: (place, prizeId) => regionIdForPlace(layout, place, prizeId),
      isSpot: (place) => spotFor(layout, place) !== undefined,
    });
    if (moved !== this.state()) this.state.set(moved);
  }

  readonly stars = computed(() => this.state().stars);
  readonly answered = computed(() => this.state().answered);
  readonly correct = computed(() => this.state().correct);
  readonly bestStreak = computed(() => this.state().bestStreak);
  readonly dayStreak = computed(() => this.state().dayStreak);

  /** Every game's own sticker book, by book key. */
  readonly books = computed(() => this.state().books ?? {});

  /** Every sticker held, one entry per book that holds it. */
  readonly wonPrizes = computed<WonPrize[]>(() =>
    Object.entries(this.books()).flatMap(([book, held]) =>
      held.prizeIds.flatMap((id) => {
        const prize = PRIZES_BY_ID.get(id);
        return prize ? [{ book, area: held.area, prize }] : [];
      }),
    ),
  );

  /** How many books hold each sticker. Missing means none yet. */
  readonly prizeCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const won of this.wonPrizes()) {
      counts.set(won.prize.id, (counts.get(won.prize.id) ?? 0) + 1);
    }
    return counts;
  });

  /** Stickers held across every book, counting repeats. */
  readonly prizeTotal = computed(() => this.wonPrizes().length);

  /**
   * The sticker closest to landing, for the games list: among the books she
   * has earned stars in, the one with fewest stars still to go. Before she
   * has earned anything, the first sticker, which any game will pay.
   */
  readonly nearestNextPrize = computed(() => {
    let best: {
      book: string | null;
      prize: Prize;
      starsToGo: number;
      progress: number;
    } | null = null;
    for (const [book, held] of Object.entries(this.books())) {
      // Carried-over books earn nothing new, so they are not worked towards.
      if (held.stars === 0) continue;
      const prize = this.nextPrizeIn(book);
      if (!prize) continue;
      const starsToGo = Math.max(0, prize.starsRequired - held.stars);
      if (!best || starsToGo < best.starsToGo) {
        best = { book, prize, starsToGo, progress: this.progressToNextPrizeIn(book) };
      }
    }
    return (
      best ?? {
        book: null,
        prize: PRIZES[0],
        starsToGo: PRIZES[0].starsRequired,
        progress: 0,
      }
    );
  });

  readonly accuracy = computed(() => {
    const { answered, correct } = this.state();
    return answered === 0 ? 0 : correct / answered;
  });

  starsIn(book: string): number {
    return this.books()[book]?.stars ?? 0;
  }

  /** One book's stickers, in unlock order. */
  prizesIn(book: string): Prize[] {
    return this.wonPrizes()
      .filter((won) => won.book === book)
      .map((won) => won.prize);
  }

  nextPrizeIn(book: string): Prize | null {
    return nextPrizeToEarn(new Set(this.books()[book]?.prizeIds ?? []));
  }

  /** 0..1 towards a book's next sticker, or 1 when it has them all. */
  progressToNextPrizeIn(book: string): number {
    const held = this.books()[book];
    return progressTowardNextPrize(held?.stars ?? 0, new Set(held?.prizeIds ?? []));
  }

  /** Collections finished in a book. */
  completedSetsIn(book: string) {
    return completedSets(new Set(this.books()[book]?.prizeIds ?? []));
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
     * The sticker book this round fills (see `bookForRound`). Its stars and
     * stickers are its own. Defaults to the game's level book.
     */
    book?: string;
    /** The area (map region id) the book belongs to. */
    area?: string;
    now?: Date;
  }): AnswerOutcome {
    const { packId, wasCorrect, streak, level } = options;
    const book = options.book ?? levelBookKey(packId, level);
    const today = localDayKey(options.now ?? new Date());
    const before = this.state();

    const starsAwarded = wasCorrect ? starsForAnswer(streak) : 0;
    const stars = before.stars + starsAwarded;

    // Unlocks are derived from the book's star total rather than tracked
    // incrementally, so the collection stays consistent even if thresholds are
    // retuned later.
    const bookBefore = before.books?.[book];
    const area = options.area ?? bookBefore?.area ?? CROSSROADS;
    const bookStars = (bookBefore?.stars ?? 0) + starsAwarded;
    const previouslyHeld = new Set(bookBefore?.prizeIds ?? []);
    const nowHeld = prizesHeldAt(bookStars, previouslyHeld);
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

    // A book appears once something is earned in it, not on a wrong answer.
    const books =
      starsAwarded > 0
        ? { ...before.books, [book]: { area, stars: bookStars, prizeIds: heldIds } }
        : before.books;

    this.state.set({
      stars,
      answered: before.answered + 1,
      correct: before.correct + (wasCorrect ? 1 : 0),
      bestStreak: Math.max(before.bestStreak, streak),
      books,
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

    return { starsAwarded, book, newPrizes, completedSetIds };
  }

  reset(): void {
    this.state.set(EMPTY);
  }
}
