import { Injectable, computed } from '@angular/core';
import { storedSignal } from './stored-signal';
import {
  Badge,
  BadgeId,
  ChallengeRecord,
  EMPTY_RECORD,
  badgesFor,
  newBadges,
  recordRound,
} from './mastery';

type MasteryState = Record<string, ChallengeRecord>;

/**
 * Which challenges have been mastered.
 *
 * Stored under its own key rather than inside `klg.progress`, so nobody's stars
 * are put at risk by a shape change here, and an old install simply starts with
 * no badges instead of needing a migration.
 */
@Injectable({ providedIn: 'root' })
export class MasteryService {
  private readonly state = storedSignal<MasteryState>('klg.mastery', {});

  readonly all = computed(() => this.state());

  /** Every badge earned across every challenge, for the collection screen. */
  readonly badgeCount = computed(() =>
    Object.values(this.state()).reduce(
      (total, record) => total + badgesFor(record).length,
      0,
    ),
  );

  readonly masteredCount = computed(
    () =>
      Object.values(this.state()).filter((record) =>
        badgesFor(record).includes('mastered'),
      ).length,
  );

  recordFor(challengeId: string): ChallengeRecord {
    return this.state()[challengeId] ?? EMPTY_RECORD;
  }

  badgesForChallenge(challengeId: string): BadgeId[] {
    return badgesFor(this.recordFor(challengeId));
  }

  /**
   * Folds a finished round in and returns the badges it just won, so the finish
   * screen can celebrate the exact ones that landed.
   */
  recordChallengeRound(options: {
    challengeId: string;
    correct: number;
    total: number;
  }): Badge[] {
    const before = this.recordFor(options.challengeId);
    const after = recordRound(before, options);
    this.state.update((state) => ({ ...state, [options.challengeId]: after }));
    return newBadges(before, after);
  }

  reset(): void {
    this.state.set({});
  }
}
