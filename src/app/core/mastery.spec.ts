import { describe, expect, it } from 'vitest';
import {
  BADGES,
  ChallengeRecord,
  EMPTY_RECORD,
  badgesFor,
  newBadges,
  recordRound,
} from './mastery';

const PERFECT = { correct: 10, total: 10 };
const NEARLY = { correct: 9, total: 10 };

function play(rounds: { correct: number; total: number }[]): ChallengeRecord {
  return rounds.reduce(recordRound, EMPTY_RECORD);
}

describe('mastery', () => {
  it('starts with nothing', () => {
    expect(badgesFor(EMPTY_RECORD)).toEqual([]);
  });

  it('gives the gold star for one perfect round', () => {
    expect(badgesFor(play([PERFECT]))).toEqual(['cleared']);
  });

  it('does not give the gold star for a nearly-perfect round', () => {
    expect(badgesFor(play([NEARLY, NEARLY, NEARLY]))).toEqual([]);
  });

  it('gives the crown for two perfect rounds in a row', () => {
    expect(badgesFor(play([PERFECT, PERFECT]))).toEqual(['cleared', 'mastered']);
  });

  /**
   * The distinction the crown exists for. Two perfect rounds with a bad one in
   * between is not the same as knowing it well enough to do it twice.
   */
  it('does not give the crown for two perfect rounds that are not consecutive', () => {
    expect(badgesFor(play([PERFECT, NEARLY, PERFECT]))).toEqual(['cleared']);
  });

  it('gives the crown once the run is rebuilt', () => {
    const record = play([PERFECT, NEARLY, PERFECT, PERFECT]);
    expect(badgesFor(record)).toEqual(['cleared', 'mastered']);
  });

  /** Losing a badge for having a bad day would be a cruel thing to do. */
  it('never takes a badge away', () => {
    const won = play([PERFECT, PERFECT]);
    const afterABadDay = play([PERFECT, PERFECT, { correct: 2, total: 10 }]);
    expect(badgesFor(afterABadDay)).toEqual(badgesFor(won));
    expect(afterABadDay.currentPerfectStreak).toBe(0);
    expect(afterABadDay.bestPerfectStreak).toBe(2);
  });

  it('counts attempts and remembers the best score', () => {
    const record = play([{ correct: 4, total: 10 }, { correct: 7, total: 10 }, { correct: 5, total: 10 }]);
    expect(record.attempts).toBe(3);
    expect(record.bestCorrect).toBe(7);
    expect(record.total).toBe(10);
    expect(record.perfectRuns).toBe(0);
  });

  it('compares the best score as a fraction, so a resized set stays beatable', () => {
    // A challenge that shrinks from ten questions to five must not leave a best
    // of 8/10 that 5/5 can never beat.
    const record = recordRound(
      { ...EMPTY_RECORD, attempts: 1, bestCorrect: 8, total: 10 },
      { correct: 5, total: 5 },
    );
    expect(record.bestCorrect).toBe(5);
    expect(record.total).toBe(5);
  });

  it('handles a set of five as readily as a set of ten', () => {
    const record = play([{ correct: 5, total: 5 }, { correct: 5, total: 5 }]);
    expect(badgesFor(record)).toEqual(['cleared', 'mastered']);
  });

  it('reports only the badges a round actually just won', () => {
    const first = play([PERFECT]);
    expect(newBadges(EMPTY_RECORD, first).map((b) => b.id)).toEqual(['cleared']);

    const second = recordRound(first, PERFECT);
    expect(newBadges(first, second).map((b) => b.id)).toEqual(['mastered']);

    const third = recordRound(second, PERFECT);
    expect(newBadges(second, third)).toEqual([]);
  });

  it('reports both badges when the second perfect round is the first one recorded', () => {
    // Both at once cannot happen through play, but the helper must not report a
    // badge twice if the rules are ever retuned.
    const jumped: ChallengeRecord = {
      ...EMPTY_RECORD,
      perfectRuns: 2,
      bestPerfectStreak: 2,
    };
    expect(newBadges(EMPTY_RECORD, jumped).map((b) => b.id)).toEqual([
      'cleared',
      'mastered',
    ]);
  });

  it('describes both badges for the map', () => {
    expect(BADGES.map((badge) => badge.id)).toEqual(['cleared', 'mastered']);
    for (const badge of BADGES) {
      expect(badge.emoji.length).toBeGreaterThan(0);
      expect(badge.name.length).toBeGreaterThan(0);
      expect(badge.how.length).toBeGreaterThan(0);
    }
  });

  it('ignores an empty round rather than calling it perfect', () => {
    const record = recordRound(EMPTY_RECORD, { correct: 0, total: 0 });
    expect(record.perfectRuns).toBe(0);
    expect(badgesFor(record)).toEqual([]);
  });
});
