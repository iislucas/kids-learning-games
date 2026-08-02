import {
  completedSets,
  nextPrizeAfter,
  PRIZE_SETS,
  PRIZES,
  prizesInSet,
  prizesUnlockedAt,
  starsForPrizeIndex,
} from './prizes';
import { starsForAnswer } from './progress.service';

describe('prize catalogue', () => {
  it('has unique ids', () => {
    const ids = PRIZES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('assigns every prize to a real set', () => {
    const setIds = new Set(PRIZE_SETS.map((s) => s.id));
    for (const prize of PRIZES) {
      expect(setIds.has(prize.setId)).toBe(true);
    }
  });

  it('gives every set the same number of prizes', () => {
    const counts = PRIZE_SETS.map((set) => prizesInSet(set.id).length);
    expect(new Set(counts).size).toBe(1);
    expect(counts[0]).toBeGreaterThan(0);
  });

  it('increases star cost strictly with each prize', () => {
    for (let i = 1; i < PRIZES.length; i++) {
      expect(PRIZES[i].starsRequired).toBeGreaterThan(PRIZES[i - 1].starsRequired);
    }
  });

  it('interleaves sets so several are in progress at once', () => {
    // The first six prizes should come from six different collections.
    const firstSix = PRIZES.slice(0, PRIZE_SETS.length).map((p) => p.setId);
    expect(new Set(firstSix).size).toBe(PRIZE_SETS.length);
  });

  it('keeps the whole collection reachable', () => {
    // Guards the curve against being retuned into something unwinnable: a
    // child earning ~40 stars a day should finish inside a few months.
    const total = PRIZES[PRIZES.length - 1].starsRequired;
    expect(total).toBeLessThan(1500);
    expect(starsForPrizeIndex(0)).toBeLessThanOrEqual(5);
  });

  it('rewards the first prize within a few correct answers', () => {
    // Three plain correct answers pay 3 stars.
    expect(starsForAnswer(1) * 3).toBeGreaterThanOrEqual(PRIZES[0].starsRequired);
  });
});

describe('prizesUnlockedAt', () => {
  it('unlocks nothing at zero stars', () => {
    expect(prizesUnlockedAt(0)).toEqual([]);
  });

  it('unlocks a prize exactly at its threshold', () => {
    const first = PRIZES[0];
    expect(prizesUnlockedAt(first.starsRequired - 1)).toEqual([]);
    expect(prizesUnlockedAt(first.starsRequired).map((p) => p.id)).toEqual([
      first.id,
    ]);
  });

  it('unlocks everything at a huge star count', () => {
    expect(prizesUnlockedAt(1_000_000)).toHaveLength(PRIZES.length);
  });
});

describe('nextPrizeAfter', () => {
  it('points at the first prize when starting out', () => {
    expect(nextPrizeAfter(0)?.id).toBe(PRIZES[0].id);
  });

  it('advances past prizes already earned', () => {
    expect(nextPrizeAfter(PRIZES[0].starsRequired)?.id).toBe(PRIZES[1].id);
  });

  it('returns null once everything is collected', () => {
    expect(nextPrizeAfter(1_000_000)).toBeNull();
  });
});

describe('completedSets', () => {
  it('reports nothing complete when empty', () => {
    expect(completedSets(new Set())).toEqual([]);
  });

  it('reports a set complete only when every prize in it is owned', () => {
    const set = PRIZE_SETS[0];
    const prizes = prizesInSet(set.id);
    const partial = new Set(prizes.slice(0, -1).map((p) => p.id));
    expect(completedSets(partial)).toEqual([]);

    const full = new Set(prizes.map((p) => p.id));
    expect(completedSets(full).map((s) => s.id)).toEqual([set.id]);
  });
});

describe('starsForAnswer', () => {
  it('pays more for longer streaks', () => {
    expect(starsForAnswer(1)).toBe(1);
    expect(starsForAnswer(2)).toBe(1);
    expect(starsForAnswer(3)).toBe(2);
    expect(starsForAnswer(5)).toBe(3);
    expect(starsForAnswer(10)).toBe(4);
    expect(starsForAnswer(50)).toBe(4);
  });

  it('never decreases as the streak grows', () => {
    for (let streak = 1; streak < 30; streak++) {
      expect(starsForAnswer(streak + 1)).toBeGreaterThanOrEqual(
        starsForAnswer(streak),
      );
    }
  });
});
