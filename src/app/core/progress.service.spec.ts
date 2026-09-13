import { TestBed } from '@angular/core/testing';
import {
  ProgressService,
  ProgressState,
  backfillPrizePlaces,
  localDayKey,
} from './progress.service';
import { PRIZES } from './prizes';

function makeService(): ProgressService {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [ProgressService] });
  return TestBed.inject(ProgressService);
}

/** Answers correctly `count` times, continuing the streak. */
function scoreCorrect(service: ProgressService, count: number, now?: Date): void {
  for (let i = 1; i <= count; i++) {
    service.recordAnswer({
      packId: 'maths',
      wasCorrect: true,
      streak: i,
      level: 1,
      now,
    });
  }
}

describe('ProgressService', () => {
  afterEach(() => localStorage.clear());

  it('starts empty', () => {
    const service = makeService();
    expect(service.stars()).toBe(0);
    expect(service.answered()).toBe(0);
    expect(service.unlockedPrizes()).toEqual([]);
    expect(service.nextPrize()?.id).toBe(PRIZES[0].id);
  });

  it('awards a star for a correct answer', () => {
    const service = makeService();
    const outcome = service.recordAnswer({
      packId: 'maths',
      wasCorrect: true,
      streak: 1,
      level: 1,
    });
    expect(outcome.starsAwarded).toBe(1);
    expect(service.stars()).toBe(1);
    expect(service.correct()).toBe(1);
    expect(service.answered()).toBe(1);
  });

  it('awards nothing for a wrong answer but still counts it', () => {
    const service = makeService();
    const outcome = service.recordAnswer({
      packId: 'maths',
      wasCorrect: false,
      streak: 0,
      level: 1,
    });
    expect(outcome.starsAwarded).toBe(0);
    expect(service.stars()).toBe(0);
    expect(service.correct()).toBe(0);
    expect(service.answered()).toBe(1);
  });

  it('pays a streak bonus', () => {
    const service = makeService();
    const outcome = service.recordAnswer({
      packId: 'maths',
      wasCorrect: true,
      streak: 5,
      level: 1,
    });
    expect(outcome.starsAwarded).toBe(3);
  });

  it('reports newly unlocked prizes exactly once', () => {
    const service = makeService();
    const threshold = PRIZES[0].starsRequired;

    // One short of the threshold: nothing yet.
    scoreCorrect(service, threshold - 1);
    expect(service.unlockedPrizes()).toEqual([]);

    const crossing = service.recordAnswer({
      packId: 'maths',
      wasCorrect: true,
      streak: 1,
      level: 1,
    });
    expect(crossing.newPrizes.map((p) => p.id)).toEqual([PRIZES[0].id]);

    // The next answer must not re-report the same prize.
    const after = service.recordAnswer({
      packId: 'maths',
      wasCorrect: true,
      streak: 1,
      level: 1,
    });
    expect(after.newPrizes).toEqual([]);
    expect(service.unlockedPrizes().map((p) => p.id)).toEqual([PRIZES[0].id]);
  });

  it('tracks the best streak', () => {
    const service = makeService();
    scoreCorrect(service, 4);
    service.recordAnswer({ packId: 'maths', wasCorrect: false, streak: 0, level: 1 });
    expect(service.bestStreak()).toBe(4);
  });

  it('tracks per-pack stats including the best level', () => {
    const service = makeService();
    service.recordAnswer({ packId: 'maths', wasCorrect: true, streak: 1, level: 3 });
    service.recordAnswer({ packId: 'maths', wasCorrect: false, streak: 0, level: 2 });
    service.recordAnswer({ packId: 'french', wasCorrect: true, streak: 1, level: 1 });

    expect(service.statsFor('maths')).toEqual({
      answered: 2,
      correct: 1,
      // Dropping back a level must not lower the best reached.
      bestLevel: 3,
    });
    expect(service.statsFor('french')).toEqual({
      answered: 1,
      correct: 1,
      bestLevel: 1,
    });
    expect(service.statsFor('science')).toEqual({
      answered: 0,
      correct: 0,
      bestLevel: 1,
    });
  });

  it('computes accuracy', () => {
    const service = makeService();
    service.recordAnswer({ packId: 'maths', wasCorrect: true, streak: 1, level: 1 });
    service.recordAnswer({ packId: 'maths', wasCorrect: false, streak: 0, level: 1 });
    service.recordAnswer({ packId: 'maths', wasCorrect: true, streak: 1, level: 1 });
    service.recordAnswer({ packId: 'maths', wasCorrect: true, streak: 2, level: 1 });
    expect(service.accuracy()).toBeCloseTo(0.75);
  });

  describe('day streak', () => {
    it('starts at one on the first day played', () => {
      const service = makeService();
      service.recordAnswer({
        packId: 'maths',
        wasCorrect: true,
        streak: 1,
        level: 1,
        now: new Date('2026-03-10T09:00:00'),
      });
      expect(service.dayStreak()).toBe(1);
    });

    it('does not increase twice in the same day', () => {
      const service = makeService();
      const day = new Date('2026-03-10T09:00:00');
      scoreCorrect(service, 3, day);
      expect(service.dayStreak()).toBe(1);
    });

    it('increases on a consecutive day', () => {
      const service = makeService();
      scoreCorrect(service, 1, new Date('2026-03-10T09:00:00'));
      scoreCorrect(service, 1, new Date('2026-03-11T18:00:00'));
      expect(service.dayStreak()).toBe(2);
    });

    it('resets after a missed day', () => {
      const service = makeService();
      scoreCorrect(service, 1, new Date('2026-03-10T09:00:00'));
      scoreCorrect(service, 1, new Date('2026-03-11T09:00:00'));
      scoreCorrect(service, 1, new Date('2026-03-14T09:00:00'));
      expect(service.dayStreak()).toBe(1);
    });
  });

  it('persists across service instances', () => {
    const service = makeService();
    scoreCorrect(service, 5);
    const stars = service.stars();

    // A fresh instance reads back what was stored, as after a page reload.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [ProgressService] });
    const reloaded = TestBed.inject(ProgressService);
    expect(reloaded.stars()).toBe(stars);
    expect(reloaded.answered()).toBe(5);
  });

  describe('where a prize was won', () => {
    /** Answers until a prize lands, and returns the ones it won. */
    function playUntilAPrize(service: ProgressService, place?: string) {
      for (let streak = 1; streak <= 10; streak++) {
        const outcome = service.recordAnswer({
          packId: place ? 'maths' : 'english',
          wasCorrect: true,
          streak,
          level: 1,
          place,
        });
        if (outcome.newPrizes.length > 0) return outcome.newPrizes;
      }
      throw new Error('no prize was won');
    }

    it('remembers the challenge it landed in', () => {
      const service = makeService();
      for (const prize of playUntilAPrize(service, 'maths.times.7')) {
        expect(service.prizePlaces()[prize.id]).toBe('maths.times.7');
      }
    });

    /** An ordinary round has no challenge, so the pack is as precise as it gets. */
    it('falls back to the pack for a round that is not a challenge', () => {
      const service = makeService();
      for (const prize of playUntilAPrize(service)) {
        expect(service.prizePlaces()[prize.id]).toBe('pack:english');
      }
    });

    it('does not move a prize that was already won', () => {
      const service = makeService();
      const first = playUntilAPrize(service, 'maths.times.7');
      // A long run somewhere else must not relabel what is already placed.
      for (let i = 0; i < 40; i++) {
        service.recordAnswer({
          packId: 'french',
          wasCorrect: true,
          streak: 10,
          level: 1,
          place: 'french.numbers',
        });
      }
      for (const prize of first) {
        expect(service.prizePlaces()[prize.id]).toBe('maths.times.7');
      }
    });

    it('records nothing for an answer that wins nothing', () => {
      const service = makeService();
      service.recordAnswer({
        packId: 'maths',
        wasCorrect: false,
        streak: 0,
        level: 1,
        place: 'maths.times.7',
      });
      expect(service.prizePlaces()).toEqual({});
    });
  });

  it('clears everything on reset', () => {
    const service = makeService();
    scoreCorrect(service, 10);
    service.reset();
    expect(service.stars()).toBe(0);
    expect(service.answered()).toBe(0);
    expect(service.unlockedPrizes()).toEqual([]);
    expect(service.statsFor('maths').answered).toBe(0);
  });
});

describe('localDayKey', () => {
  it('formats a local date as yyyy-mm-dd', () => {
    expect(localDayKey(new Date('2026-03-05T23:30:00'))).toBe('2026-03-05');
  });

  it('pads single-digit months and days', () => {
    expect(localDayKey(new Date('2026-01-02T10:00:00'))).toBe('2026-01-02');
  });
});

describe('backfillPrizePlaces', () => {
  const base: ProgressState = {
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
  const ids = PRIZES.slice(0, 12).map((prize) => prize.id);

  it('shares placeless prizes out by how much each game was played', () => {
    const filled = backfillPrizePlaces({
      ...base,
      unlockedPrizeIds: ids,
      packStats: {
        maths: { answered: 90, correct: 60, bestLevel: 1 },
        english: { answered: 40, correct: 30, bestLevel: 1 },
      },
    });
    const places = ids.map((id) => filled.prizePlaces[id]);
    expect(places.filter((p) => p === 'pack:maths')).toHaveLength(8);
    expect(places.filter((p) => p === 'pack:english')).toHaveLength(4);
  });

  it('leaves a prize that already has a place where it is', () => {
    const filled = backfillPrizePlaces({
      ...base,
      unlockedPrizeIds: ids,
      prizePlaces: { [ids[0]]: 'french.colours' },
      packStats: { maths: { answered: 5, correct: 5, bestLevel: 1 } },
    });
    expect(filled.prizePlaces[ids[0]]).toBe('french.colours');
    expect(filled.prizePlaces[ids[1]]).toBe('pack:maths');
  });

  it('changes nothing when there is nothing to fill or nothing to go on', () => {
    const empty = { ...base, unlockedPrizeIds: ids };
    expect(backfillPrizePlaces(empty)).toBe(empty);
    expect(backfillPrizePlaces(base)).toBe(base);
  });

  it('writes the places back when the service loads', () => {
    localStorage.clear();
    localStorage.setItem(
      'klg.progress',
      JSON.stringify({
        ...base,
        unlockedPrizeIds: ids,
        packStats: { science: { answered: 3, correct: 3, bestLevel: 1 } },
      }),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [ProgressService] });
    const service = TestBed.inject(ProgressService);
    expect(service.prizePlaces()[ids[0]]).toBe('pack:science');
    expect(JSON.parse(localStorage.getItem('klg.progress')!).prizePlaces[ids[0]]).toBe(
      'pack:science',
    );
  });
});
