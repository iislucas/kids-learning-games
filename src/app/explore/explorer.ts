/**
 * Walking about the map: which way the character faces, and where one frame of
 * movement puts them.
 *
 * Pure and Angular-free so the fiddly parts — the boundaries between the eight
 * compass directions, and not overshooting the target on a long frame — are
 * testable without a browser.
 */

/** The eight facings, in the order the walk sheet's rows read. */
export const DIRECTIONS = ['s', 'sw', 'w', 'nw', 'n', 'ne', 'e', 'se'] as const;

export type Direction = (typeof DIRECTIONS)[number];

export interface Point {
  x: number;
  y: number;
}

/**
 * Map pixels per second. Watching the walk is part of the point, but the map is
 * 1600 across and crossing it should not take six seconds.
 */
export const WALK_SPEED = 430;

/** Within this many pixels of the target, she has arrived. */
const ARRIVAL_EPSILON = 1.5;

/**
 * Which way a move points.
 *
 * Screen coordinates, so **y grows downwards** — north is negative y. Each
 * direction owns a 45° wedge centred on it, so a move that is mostly east but
 * drifting south reads as east until it passes 22.5°, at which point it becomes
 * south-east. Standing still keeps the previous facing rather than snapping
 * back to south.
 */
export function directionFor(
  dx: number,
  dy: number,
  fallback: Direction = 's',
): Direction {
  if (dx === 0 && dy === 0) return fallback;
  // Angle measured from south, turning towards south-west, which is the order
  // DIRECTIONS is written in.
  const angle = Math.atan2(dx, dy);
  const wedge = Math.round((-angle / (Math.PI / 4)) % 8);
  return DIRECTIONS[(wedge + 8) % 8];
}

export interface Step {
  position: Point;
  direction: Direction;
  arrived: boolean;
}

/**
 * Moves `from` towards `target` for one frame.
 *
 * Never overshoots: a long frame (a backgrounded tab, a slow phone) lands
 * exactly on the target instead of sailing past it and jittering back.
 */
export function stepToward(
  from: Point,
  target: Point,
  dtMs: number,
  options: { speed?: number; facing?: Direction } = {},
): Step {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const distance = Math.hypot(dx, dy);
  const direction = directionFor(dx, dy, options.facing ?? 's');

  if (distance <= ARRIVAL_EPSILON) {
    return { position: { ...target }, direction, arrived: true };
  }

  const travel = ((options.speed ?? WALK_SPEED) * Math.max(dtMs, 0)) / 1000;
  if (travel >= distance) {
    return { position: { ...target }, direction, arrived: true };
  }

  return {
    position: {
      x: from.x + (dx / distance) * travel,
      y: from.y + (dy / distance) * travel,
    },
    direction,
    arrived: false,
  };
}

/** Keeps a point inside the map, so she cannot be sent off the edge. */
export function clampToMap(
  point: Point,
  bounds: { width: number; height: number },
  margin = 24,
): Point {
  return {
    x: Math.min(Math.max(point.x, margin), bounds.width - margin),
    y: Math.min(Math.max(point.y, margin), bounds.height - margin),
  };
}

const DIAGONAL = Math.round((Math.SQRT1_2 * 1000)) / 1000;

/**
 * The unit vector for a direction, for the on-screen pad and the arrow keys.
 * Diagonals are shortened so holding two keys does not walk faster than one.
 */
const VECTORS: Record<Direction, Point> = {
  s: { x: 0, y: 1 },
  sw: { x: -DIAGONAL, y: DIAGONAL },
  w: { x: -1, y: 0 },
  nw: { x: -DIAGONAL, y: -DIAGONAL },
  n: { x: 0, y: -1 },
  ne: { x: DIAGONAL, y: -DIAGONAL },
  e: { x: 1, y: 0 },
  se: { x: DIAGONAL, y: DIAGONAL },
};

export function vectorFor(direction: Direction): Point {
  return { ...VECTORS[direction] };
}
