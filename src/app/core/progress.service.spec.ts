import { TestBed } from '@angular/core/testing';
import { ProgressService, localDayKey } from './progress.service';
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
