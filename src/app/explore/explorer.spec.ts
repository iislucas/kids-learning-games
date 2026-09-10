import { describe, expect, it } from 'vitest';
import {
  DIRECTIONS,
  Direction,
  WALK_SPEED,
  clampToMap,
  directionFor,
  stepToward,
  vectorFor,
} from './explorer';

describe('directionFor', () => {
  /** Screen coordinates: y grows downwards, so north is negative y. */
  const CARDINALS: [dx: number, dy: number, expected: Direction][] = [
    [0, 1, 's'],
    [-1, 1, 'sw'],
    [-1, 0, 'w'],
    [-1, -1, 'nw'],
    [0, -1, 'n'],
    [1, -1, 'ne'],
    [1, 0, 'e'],
    [1, 1, 'se'],
  ];

  for (const [dx, dy, expected] of CARDINALS) {
    it(`points ${expected} for (${dx}, ${dy})`, () => {
      expect(directionFor(dx, dy)).toBe(expected);
    });
  }

  it('stays in a wedge until the move has clearly turned', () => {
    // Mostly east with a little south is still east; a proper diagonal is not.
    expect(directionFor(10, 2)).toBe('e');
    expect(directionFor(10, 8)).toBe('se');
    expect(directionFor(2, -10)).toBe('n');
    expect(directionFor(-8, -10)).toBe('nw');
  });

  it('keeps the previous facing when standing still', () => {
    expect(directionFor(0, 0, 'w')).toBe('w');
    expect(directionFor(0, 0)).toBe('s');
  });

  it('covers all eight directions and no others', () => {
    const seen = new Set<Direction>();
    for (let degrees = 0; degrees < 360; degrees++) {
      const radians = (degrees * Math.PI) / 180;
      seen.add(directionFor(Math.cos(radians), Math.sin(radians)));
    }
    expect([...seen].sort()).toEqual([...DIRECTIONS].sort());
  });

  it('agrees with the vector for each direction', () => {
    for (const direction of DIRECTIONS) {
      const vector = vectorFor(direction);
      expect(directionFor(vector.x, vector.y)).toBe(direction);
    }
  });

  it('does not let a diagonal walk faster than a straight line', () => {
    for (const direction of DIRECTIONS) {
      const { x, y } = vectorFor(direction);
      expect(Math.hypot(x, y)).toBeCloseTo(1, 3);
    }
  });
});

describe('stepToward', () => {
  it('moves at the walking speed', () => {
    const step = stepToward({ x: 0, y: 0 }, { x: 1000, y: 0 }, 1000);
    expect(step.position.x).toBeCloseTo(WALK_SPEED, 3);
    expect(step.position.y).toBeCloseTo(0, 3);
    expect(step.arrived).toBe(false);
    expect(step.direction).toBe('e');
  });

  /** A backgrounded tab hands back a huge frame; overshooting would jitter. */
  it('never overshoots the target on a long frame', () => {
    const step = stepToward({ x: 0, y: 0 }, { x: 10, y: 0 }, 10_000);
    expect(step.position).toEqual({ x: 10, y: 0 });
    expect(step.arrived).toBe(true);
  });

  it('arrives when already there', () => {
    const step = stepToward({ x: 5, y: 5 }, { x: 5, y: 5 }, 16, { facing: 'n' });
    expect(step.arrived).toBe(true);
    expect(step.direction).toBe('n');
  });

  it('walks diagonally at the same speed as straight', () => {
    const step = stepToward({ x: 0, y: 0 }, { x: 1000, y: 1000 }, 1000);
    expect(Math.hypot(step.position.x, step.position.y)).toBeCloseTo(WALK_SPEED, 3);
    expect(step.direction).toBe('se');
  });

  it('treats a negative frame time as no movement', () => {
    const step = stepToward({ x: 0, y: 0 }, { x: 100, y: 0 }, -50);
    expect(step.position).toEqual({ x: 0, y: 0 });
    expect(step.arrived).toBe(false);
  });
});

describe('clampToMap', () => {
  const bounds = { width: 1000, height: 500 };

  it('keeps her on the map', () => {
    expect(clampToMap({ x: -100, y: 900 }, bounds, 20)).toEqual({ x: 20, y: 480 });
    expect(clampToMap({ x: 5000, y: -5 }, bounds, 20)).toEqual({ x: 980, y: 20 });
  });

  it('leaves a point that is already inside alone', () => {
    expect(clampToMap({ x: 500, y: 250 }, bounds, 20)).toEqual({ x: 500, y: 250 });
  });
});
