/**
 * Mastery of a single challenge, and the two badges it can earn.
 *
 * Kept as plain functions with no Angular so the awkward part — what "twice in
 * a row" means when a bad round happens in between — is testable directly.
 */

export interface Badge {
  id: 'cleared' | 'mastered';
  name: string;
  emoji: string;
  /** How it is won, shown on a spot that has not earned it yet. */
  how: string;
}

export const BADGES: Badge[] = [
  {
    id: 'cleared',
    name: 'Gold star',
    emoji: '⭐',
    how: 'Get every question right in one go',
  },
  {
    id: 'mastered',
    name: 'Crown',
    emoji: '👑',
    how: 'Do it twice in a row',
  },
];

export type BadgeId = Badge['id'];

export interface ChallengeRecord {
  /** Rounds played, including the ones that went wrong. */
  attempts: number;
  /** Most questions ever right first time, and out of how many. */
  bestCorrect: number;
  total: number;
  /** Perfect rounds in total, and the run of them in progress. */
  perfectRuns: number;
  currentPerfectStreak: number;
  bestPerfectStreak: number;
}

export const EMPTY_RECORD: ChallengeRecord = {
  attempts: 0,
  bestCorrect: 0,
  total: 0,
  perfectRuns: 0,
  currentPerfectStreak: 0,
  bestPerfectStreak: 0,
};

/**
 * Badges are derived from the record rather than stored alongside it — the same
 * discipline as prizes being derived from the star total. It means a badge can
 * never drift out of step with the play that earned it, and that the rules can
 * be retuned later without leaving anyone holding a badge the rules no longer
 * award.
 */
export function badgesFor(record: ChallengeRecord): BadgeId[] {
  const earned: BadgeId[] = [];
  if (record.perfectRuns >= 1) earned.push('cleared');
  if (record.bestPerfectStreak >= 2) earned.push('mastered');
  return earned;
}

export function hasBadge(record: ChallengeRecord, id: BadgeId): boolean {
  return badgesFor(record).includes(id);
}

/**
 * Folds one finished round into a record.
 *
 * A round that is not perfect breaks the run — that is what makes the crown
 * mean "twice in a row" rather than "twice ever" — but `bestPerfectStreak` only
 * ever grows, so a badge already won is never taken away. Losing a sticker for
 * having a bad day would be a cruel thing to do to a seven-year-old.
 */
export function recordRound(
  record: ChallengeRecord,
  round: { correct: number; total: number },
): ChallengeRecord {
  const perfect = round.total > 0 && round.correct === round.total;
  const currentPerfectStreak = perfect ? record.currentPerfectStreak + 1 : 0;
  return {
    attempts: record.attempts + 1,
    // Compared as a fraction, so a challenge that changes length later does not
    // leave an unbeatable best behind.
    ...(round.correct / round.total >= safeFraction(record)
      ? { bestCorrect: round.correct, total: round.total }
      : { bestCorrect: record.bestCorrect, total: record.total }),
    perfectRuns: record.perfectRuns + (perfect ? 1 : 0),
    currentPerfectStreak,
    bestPerfectStreak: Math.max(record.bestPerfectStreak, currentPerfectStreak),
  };
}

function safeFraction(record: ChallengeRecord): number {
  return record.total > 0 ? record.bestCorrect / record.total : 0;
}

/** The badges this round just won, for the celebration on the finish screen. */
export function newBadges(
  before: ChallengeRecord,
  after: ChallengeRecord,
): Badge[] {
  const had = new Set(badgesFor(before));
  return BADGES.filter((badge) => !had.has(badge.id) && hasBadge(after, badge.id));
}
