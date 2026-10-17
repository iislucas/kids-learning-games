import { TestBed } from '@angular/core/testing';
import {
  CROSSROADS,
  ProgressService,
  ProgressState,
  backfillPrizePlaces,
  localDayKey,
  moveIntoAreas,
} from './progress.service';
import { PRIZES } from './prizes';

function makeService(): ProgressService {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [ProgressService] });
  return TestBed.inject(ProgressService);
}

/** Answers correctly `count` times, continuing the streak. */
function scoreCorrect(
  service: ProgressService,
  count: number,
  now?: Date,
  area = 'tables',
): void {
  for (let i = 1; i <= count; i++) {
    service.recordAnswer({
      packId: 'maths',
      wasCorrect: true,
      streak: i,
      level: 1,
      area,
      now,
    });
  }
}

/** Ids of the stickers one area holds. */
function heldIn(service: ProgressService, area: string): string[] {
  return service.prizesIn(area).map((won) => won.prize.id);
}

describe('ProgressService', () => {
  afterEach(() => localStorage.clear());

  it('starts empty', () => {
    const service = makeService();
    expect(service.stars()).toBe(0);
    expect(service.answered()).toBe(0);
    expect(service.prizeTotal()).toBe(0);
    expect(service.nearestNextPrize()).toEqual({
      area: null,
      prize: PRIZES[0],
      starsToGo: PRIZES[0].starsRequired,
      progress: 0,
    });
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
    expect(heldIn(service, 'tables')).toEqual([]);

    const crossing = service.recordAnswer({
      packId: 'maths',
      wasCorrect: true,
      streak: 1,
      level: 1,
      area: 'tables',
    });
    expect(crossing.area).toBe('tables');
    expect(crossing.newPrizes.map((p) => p.id)).toEqual([PRIZES[0].id]);

    // The next answer must not re-report the same prize.
    const after = service.recordAnswer({
      packId: 'maths',
      wasCorrect: true,
      streak: 1,
      level: 1,
      area: 'tables',
    });
    expect(after.newPrizes).toEqual([]);
    expect(heldIn(service, 'tables')).toEqual([PRIZES[0].id]);
  });

  describe('each area has its own collection', () => {
    it('counts stars separately in each area', () => {
      const service = makeService();
      scoreCorrect(service, 4, undefined, 'tables');
      scoreCorrect(service, 2, undefined, 'french');
      expect(service.areaStars('tables')).toBe(1 + 1 + 2 + 2);
      expect(service.areaStars('french')).toBe(2);
      expect(service.stars()).toBe(8);
    });

    it('pays the first sticker again in a new area', () => {
      const service = makeService();
      scoreCorrect(service, 40, undefined, 'tables');
      expect(heldIn(service, 'tables').length).toBeGreaterThan(3);
      expect(heldIn(service, 'french')).toEqual([]);

      // A fresh area starts from its own zero, so it is quick to earn in.
      scoreCorrect(service, PRIZES[0].starsRequired, undefined, 'french');
      expect(heldIn(service, 'french')).toContain(PRIZES[0].id);
    });

    it('counts how many areas hold each sticker', () => {
      const service = makeService();
      for (const area of ['tables', 'french', 'words']) {
        scoreCorrect(service, PRIZES[0].starsRequired, undefined, area);
      }
      expect(service.prizeCounts().get(PRIZES[0].id)).toBe(3);
      expect(service.prizeTotal()).toBe(3);
    });

    it('works towards the next sticker in each area on its own', () => {
      const service = makeService();
      scoreCorrect(service, PRIZES[0].starsRequired, undefined, 'tables');
      expect(service.nextPrizeIn('tables')?.id).toBe(PRIZES[1].id);
      expect(service.nextPrizeIn('french')?.id).toBe(PRIZES[0].id);
    });

    it('points the games list at the area nearest its next sticker', () => {
      const service = makeService();
      scoreCorrect(service, 3, undefined, 'tables');
      scoreCorrect(service, 1, undefined, 'french');
      const near = service.nearestNextPrize();
      expect(near?.area).toBe('french');
      expect(near?.starsToGo).toBe(PRIZES[0].starsRequired - 1);
    });

    it('does not open an area for a wrong answer', () => {
      const service = makeService();
      service.recordAnswer({
        packId: 'maths',
        wasCorrect: false,
        streak: 0,
        level: 1,
        area: 'tables',
      });
      expect(service.areas()).toEqual({});
    });

    it('defaults to the crossroads when no area is given', () => {
      const service = makeService();
      const outcome = service.recordAnswer({
        packId: 'maths',
        wasCorrect: true,
        streak: 1,
        level: 1,
      });
      expect(outcome.area).toBe(CROSSROADS);
      expect(service.areaStars(CROSSROADS)).toBe(1);
    });
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
    function playUntilAPrize(service: ProgressService, area: string, place?: string) {
      for (let streak = 1; streak <= 10; streak++) {
        const outcome = service.recordAnswer({
          packId: 'maths',
          wasCorrect: true,
          streak,
          level: 1,
          area,
          place,
        });
        if (outcome.newPrizes.length > 0) return outcome.newPrizes;
      }
      throw new Error('no prize was won');
    }

    function placeOf(service: ProgressService, area: string, prizeId: string) {
      return service.prizesIn(area).find((won) => won.prize.id === prizeId)?.place;
    }

    it('remembers the challenge it landed in', () => {
      const service = makeService();
      for (const prize of playUntilAPrize(service, 'tables', 'maths.times.7')) {
        expect(placeOf(service, 'tables', prize.id)).toBe('maths.times.7');
      }
    });

    it('falls back to the area for a round that is not a challenge', () => {
      const service = makeService();
      for (const prize of playUntilAPrize(service, 'words')) {
        expect(placeOf(service, 'words', prize.id)).toBe('region:words');
      }
    });

    it('does not move a prize that was already won', () => {
      const service = makeService();
      const first = playUntilAPrize(service, 'tables', 'maths.times.7');
      // A long run elsewhere in the area must not relabel what is placed.
      for (let i = 0; i < 40; i++) {
        service.recordAnswer({
          packId: 'maths',
          wasCorrect: true,
          streak: 10,
          level: 1,
          area: 'tables',
          place: 'maths.times.8',
        });
      }
      for (const prize of first) {
        expect(placeOf(service, 'tables', prize.id)).toBe('maths.times.7');
      }
    });
  });

  it('clears everything on reset', () => {
    const service = makeService();
    scoreCorrect(service, 10);
    service.reset();
    expect(service.stars()).toBe(0);
    expect(service.answered()).toBe(0);
    expect(service.prizeTotal()).toBe(0);
    expect(service.areas()).toEqual({});
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
    areas: {},
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
    const places = ids.map((id) => filled.prizePlaces?.[id]);
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
    expect(filled.prizePlaces?.[ids[0]]).toBe('french.colours');
    expect(filled.prizePlaces?.[ids[1]]).toBe('pack:maths');
  });

  it('changes nothing when there is nothing to fill or nothing to go on', () => {
    const empty = { ...base, unlockedPrizeIds: ids };
    expect(backfillPrizePlaces(empty)).toBe(empty);
    expect(backfillPrizePlaces(base)).toBe(base);
  });

});

describe('moveIntoAreas', () => {
  const ids = PRIZES.slice(0, 6).map((prize) => prize.id);
  const old: ProgressState = {
    stars: 40,
    answered: 30,
    correct: 25,
    bestStreak: 6,
    unlockedPrizeIds: ids,
    prizePlaces: {
      [ids[0]]: 'maths.times.7',
      [ids[1]]: 'region:french',
      [ids[2]]: 'pack:science',
    },
    packStats: { maths: { answered: 30, correct: 25, bestLevel: 2 } },
    lastPlayedDay: null,
    dayStreak: 0,
  } as unknown as ProgressState;

  const areaFor = (place: string | undefined) => {
    if (!place) return undefined;
    if (place.startsWith('maths.times')) return 'tables';
    if (place === 'region:french') return 'french';
    if (place === 'pack:science') return 'wonder';
    if (place === 'pack:maths') return 'adding';
    return undefined;
  };

  it('puts every old sticker in the area it was won in', () => {
    const moved = moveIntoAreas(old, areaFor);
    expect(moved.areas['tables'].prizeIds).toEqual([ids[0]]);
    expect(moved.areas['tables'].places[ids[0]]).toBe('maths.times.7');
    expect(moved.areas['french'].prizeIds).toEqual([ids[1]]);
    expect(moved.areas['wonder'].places[ids[2]]).toBe('region:wonder');
    // The placeless ones are shared out by play history first.
    expect(moved.areas['adding'].prizeIds).toEqual(ids.slice(3));
    expect(moved.unlockedPrizeIds).toBeUndefined();
    expect(moved.prizePlaces).toBeUndefined();
    expect(moved.stars).toBe(40);
  });

  it('keeps a sticker with nowhere to go, at the crossroads', () => {
    const moved = moveIntoAreas(old, () => undefined);
    expect(moved.areas[CROSSROADS].prizeIds).toEqual(ids);
  });

  it('leaves a save that is already in the new shape alone', () => {
    const moved = moveIntoAreas(old, areaFor);
    expect(moveIntoAreas(moved, areaFor)).toBe(moved);
  });

  it('keeps carried-over stickers as the area earns more', () => {
    localStorage.clear();
    localStorage.setItem('klg.progress', JSON.stringify(old));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [ProgressService] });
    const service = TestBed.inject(ProgressService);
    expect(service.prizeTotal()).toBe(ids.length);
    expect(JSON.parse(localStorage.getItem('klg.progress')!).unlockedPrizeIds).toBeUndefined();

    const tables = heldIn(service, 'tables');
    expect(tables).toContain(ids[0]);
    scoreCorrect(service, 10, undefined, 'tables');
    expect(heldIn(service, 'tables')).toContain(ids[0]);
    expect(heldIn(service, 'tables').length).toBeGreaterThan(tables.length);
  });
});
