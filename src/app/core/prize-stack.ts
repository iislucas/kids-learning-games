/**
 * Where the prizes behind a game go: stacked up from the bottom of the screen,
 * in the gaps between the things she is actually using.
 *
 * A prize hidden behind the question card is no reward at all, so the screen
 * is cut into square cells and only the cells clear of every card are used.
 * They fill from the bottom row upwards, and odd rows sit half a cell over,
 * so the collection piles up like a heap of stickers rather than a grid.
 */

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface StackSlot {
  /** Centre of the cell, in the same coordinates as the area. */
  x: number;
  y: number;
}

export interface StackOptions {
  /** Side of one square cell. */
  cell: number;
  /** Space kept clear around every obstacle. */
  clearance: number;
}

const DEFAULTS: StackOptions = { cell: 48, clearance: 4 };

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.left < b.left + b.width &&
    b.left < a.left + a.width &&
    a.top < b.top + b.height &&
    b.top < a.top + a.height
  );
}

/** Every free cell, bottom row first and left to right within a row. */
export function freeCells(
  area: { width: number; height: number },
  obstacles: readonly Rect[],
  options: Partial<StackOptions> = {},
): StackSlot[] {
  const { cell, clearance } = { ...DEFAULTS, ...options };
  const padded = obstacles.map((rect) => ({
    left: rect.left - clearance,
    top: rect.top - clearance,
    width: rect.width + clearance * 2,
    height: rect.height + clearance * 2,
  }));

  const cells: StackSlot[] = [];
  for (let row = 0; (row + 1) * cell <= area.height; row++) {
    const stagger = row % 2 === 1 ? cell / 2 : 0;
    const columns = Math.floor((area.width - stagger) / cell);
    if (columns <= 0) continue;
    const inset = (area.width - stagger - columns * cell) / 2 + stagger;
    const top = area.height - (row + 1) * cell;
    for (let column = 0; column < columns; column++) {
      const box = { left: inset + column * cell, top, width: cell, height: cell };
      if (padded.some((rect) => overlaps(box, rect))) continue;
      cells.push({ x: box.left + cell / 2, y: top + cell / 2 });
    }
  }
  return cells;
}

/**
 * A slot for each of `count` prizes, in order.
 *
 * Once every free cell is taken the next prizes go round again, nudged off
 * centre, so a big collection overlaps a little rather than disappearing.
 * With no free space at all there is nowhere to put them, and nothing is
 * returned.
 */
export function stackSlots(
  count: number,
  area: { width: number; height: number },
  obstacles: readonly Rect[],
  options: Partial<StackOptions> = {},
): StackSlot[] {
  const cells = freeCells(area, obstacles, options);
  if (cells.length === 0) return [];
  const { cell } = { ...DEFAULTS, ...options };
  return Array.from({ length: count }, (_, index) => {
    const base = cells[index % cells.length];
    const layer = Math.floor(index / cells.length);
    const nudge = layer === 0 ? 0 : ((layer % 2 === 1 ? 1 : -1) * cell) / 4;
    return { x: base.x + nudge, y: base.y - Math.abs(nudge) };
  });
}
