import {
  analyseSheet,
  boxesFromGutters,
  buildOccupancyMask,
  detectBackgroundColour,
  findContentRuns,
  ImageDataLike,
  fillEnclosedBackground,
  planUniformGrid,
  tightenBox,
  Box,
} from './sprite-grid';

/** Builds a test image with an opaque background, then paints boxes onto it. */
function makeImage(
  width: number,
  height: number,
  bg: [number, number, number, number],
  shapes: (Box & { colour?: [number, number, number, number] })[],
): ImageDataLike {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = bg[0];
    data[i * 4 + 1] = bg[1];
    data[i * 4 + 2] = bg[2];
    data[i * 4 + 3] = bg[3];
  }
  for (const shape of shapes) {
    const colour = shape.colour ?? [10, 20, 200, 255];
    for (let y = shape.y; y < shape.y + shape.h; y++) {
      for (let x = shape.x; x < shape.x + shape.w; x++) {
        const i = (y * width + x) * 4;
        data[i] = colour[0];
        data[i + 1] = colour[1];
        data[i + 2] = colour[2];
        data[i + 3] = colour[3];
      }
    }
  }
  return { width, height, data };
}

const WHITE_BG: [number, number, number, number] = [255, 255, 255, 255];
const TRANSPARENT_BG: [number, number, number, number] = [0, 0, 0, 0];

describe('detectBackgroundColour', () => {
  it('reads the flat background colour from the corners', () => {
    const img = makeImage(40, 40, [250, 240, 230, 255], [
      { x: 10, y: 10, w: 10, h: 10 },
    ]);
    const bg = detectBackgroundColour(img);
    expect(bg).toMatchObject({ r: 250, g: 240, b: 230, hasAlpha: false });
  });

  it('reports hasAlpha when the corners are transparent', () => {
    const img = makeImage(40, 40, TRANSPARENT_BG, [
      { x: 10, y: 10, w: 10, h: 10 },
    ]);
    expect(detectBackgroundColour(img).hasAlpha).toBe(true);
  });
});

describe('buildOccupancyMask', () => {
  it('marks only sprite pixels on a flat opaque background', () => {
    const img = makeImage(20, 20, WHITE_BG, [{ x: 5, y: 6, w: 4, h: 3 }]);
    const mask = buildOccupancyMask(img);

    expect(mask.bits[6 * 20 + 5]).toBe(1);
    expect(mask.bits[0]).toBe(0);
    // 4x3 block => 3 rows of 4, 4 columns of 3.
    expect(mask.rowCounts[6]).toBe(4);
    expect(mask.colCounts[5]).toBe(3);
    expect(Array.from(mask.bits).reduce((a, b) => a + b, 0)).toBe(12);
  });

  it('uses alpha when the sheet has a transparent background', () => {
    // A sprite that is exactly the corner colour must still register, because
    // with a transparent background alpha is the authoritative signal.
    const img = makeImage(20, 20, TRANSPARENT_BG, [
      { x: 4, y: 4, w: 5, h: 5, colour: [0, 0, 0, 255] },
    ]);
    const mask = buildOccupancyMask(img);
    expect(Array.from(mask.bits).reduce((a, b) => a + b, 0)).toBe(25);
  });

  it('treats near-background noise as background', () => {
    const img = makeImage(20, 20, WHITE_BG, [
      // Only 9 per channel away from white; well inside the tolerance.
      { x: 2, y: 2, w: 6, h: 6, colour: [250, 250, 250, 255] },
    ]);
    const mask = buildOccupancyMask(img);
    expect(Array.from(mask.bits).reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe('findContentRuns', () => {
  it('splits a profile into runs separated by gutters', () => {
    // span 100 => threshold is max(1, floor(100*0.005)) = 1
    const counts = [0, 0, 9, 9, 9, 9, 9, 9, 0, 0, 0, 8, 8, 8, 8, 8, 8, 0, 0];
    const runs = findContentRuns(counts, 100);
    expect(runs).toEqual([
      { start: 2, end: 8 },
      { start: 11, end: 17 },
    ]);
  });

  it('closes a run that reaches the end of the profile', () => {
    const counts = [0, 0, 5, 5, 5, 5, 5, 5, 5];
    expect(findContentRuns(counts, 100)).toEqual([{ start: 2, end: 9 }]);
  });

  it('discards runs thinner than minRunPx', () => {
    const counts = [0, 7, 0, 0, 9, 9, 9, 9, 9, 9, 9, 0];
    const runs = findContentRuns(counts, 100);
    expect(runs).toEqual([{ start: 4, end: 11 }]);
  });
});

describe('tightenBox', () => {
  it('shrinks a generous box down to the pixels inside it', () => {
    const img = makeImage(30, 30, WHITE_BG, [{ x: 10, y: 12, w: 5, h: 4 }]);
    const mask = buildOccupancyMask(img);
    const tight = tightenBox(mask, { x: 8, y: 0, w: 12, h: 30 });
    expect(tight).toEqual({ x: 10, y: 12, w: 5, h: 4 });
  });

  it('returns null for an empty region', () => {
    const img = makeImage(30, 30, WHITE_BG, [{ x: 0, y: 0, w: 4, h: 4 }]);
    const mask = buildOccupancyMask(img);
    expect(tightenBox(mask, { x: 20, y: 20, w: 8, h: 8 })).toBeNull();
  });
});

describe('boxesFromGutters', () => {
  it('finds one tight box per pose in a 3x2 grid', () => {
    const shapes: Box[] = [];
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        shapes.push({ x: 20 + col * 100, y: 20 + row * 100, w: 40, h: 40 });
      }
    }
    const img = makeImage(320, 220, WHITE_BG, shapes);
    const result = boxesFromGutters(img && buildOccupancyMask(img));

    expect(result.rows).toBe(2);
    expect(result.cols).toBe(3);
    expect(result.boxes).toHaveLength(6);
    expect(result.boxes[0]).toEqual({ x: 20, y: 20, w: 40, h: 40 });
    expect(result.boxes[5]).toEqual({ x: 220, y: 120, w: 40, h: 40 });
  });

  it('handles rows whose poses do not line up in columns', () => {
    // Top row has 3 poses, bottom row has 2, at different x positions. A global
    // column profile would merge these into a mess; per-band profiling must not.
    const img = makeImage(320, 220, WHITE_BG, [
      { x: 10, y: 20, w: 40, h: 40 },
      { x: 130, y: 20, w: 40, h: 40 },
      { x: 250, y: 20, w: 40, h: 40 },
      { x: 70, y: 130, w: 40, h: 40 },
      { x: 190, y: 130, w: 40, h: 40 },
    ]);
    const result = boxesFromGutters(buildOccupancyMask(img));

    expect(result.rows).toBe(2);
    expect(result.cols).toBe(3);
    expect(result.boxes).toHaveLength(5);
    expect(result.boxes.slice(3)).toEqual([
      { x: 70, y: 130, w: 40, h: 40 },
      { x: 190, y: 130, w: 40, h: 40 },
    ]);
  });

  it('returns nothing for a blank sheet', () => {
    const img = makeImage(100, 100, WHITE_BG, []);
    expect(boxesFromGutters(buildOccupancyMask(img))).toEqual({
      boxes: [],
      cols: 0,
      rows: 0,
    });
  });
});

describe('planUniformGrid', () => {
  it('sizes the cell to the largest pose plus padding', () => {
    const boxes: Box[] = [
      { x: 0, y: 0, w: 30, h: 40 },
      { x: 100, y: 0, w: 50, h: 20 },
    ];
    const plan = planUniformGrid(boxes, 2, 1, { padding: 5 });
    expect(plan.cellWidth).toBe(60); // 50 + 2*5
    expect(plan.cellHeight).toBe(50); // 40 + 2*5
  });

  it('centres poses horizontally and puts them on a common baseline', () => {
    const boxes: Box[] = [
      { x: 0, y: 0, w: 40, h: 40 }, // tallest
      { x: 100, y: 0, w: 20, h: 10 }, // short and narrow
    ];
    const plan = planUniformGrid(boxes, 2, 1, { padding: 5 });

    // cell is 50x50
    expect(plan.placements[0]).toMatchObject({ dx: 5, dy: 5 });
    // The short pose is centred across, but its feet land at the same y as the
    // tall one: 50 - 5 - 10 = 35.
    expect(plan.placements[1]).toMatchObject({ dx: 15, dy: 35 });

    const baseline0 = plan.placements[0].dy + boxes[0].h;
    const baseline1 = plan.placements[1].dy + boxes[1].h;
    expect(baseline0).toBe(baseline1);
  });

  it('degrades gracefully on an empty sheet', () => {
    const plan = planUniformGrid([], 0, 0);
    expect(plan).toMatchObject({ cols: 0, rows: 0, cellWidth: 0, cellHeight: 0 });
    expect(plan.placements).toEqual([]);
  });
});

describe('analyseSheet', () => {
  it('turns a ragged generated grid into a uniform plan', () => {
    // Poses of deliberately different sizes, loosely placed — the realistic
    // case coming back from an image model.
    const img = makeImage(400, 260, WHITE_BG, [
      { x: 18, y: 22, w: 60, h: 80 },
      { x: 150, y: 40, w: 45, h: 62 },
      { x: 290, y: 30, w: 70, h: 72 },
      { x: 25, y: 150, w: 52, h: 90 },
      { x: 155, y: 160, w: 66, h: 80 },
      { x: 295, y: 155, w: 48, h: 85 },
    ]);

    const plan = analyseSheet(img, { padding: 6 });

    expect(plan.rows).toBe(2);
    expect(plan.cols).toBe(3);
    expect(plan.boxes).toHaveLength(6);
    // Cell fits the widest (70) and tallest (90) pose, plus padding both sides.
    expect(plan.cellWidth).toBe(82);
    expect(plan.cellHeight).toBe(102);

    // Every pose fits inside the cell, and they all share one baseline.
    const baselines = new Set<number>();
    for (const p of plan.placements) {
      expect(p.dx).toBeGreaterThanOrEqual(0);
      expect(p.dy).toBeGreaterThanOrEqual(0);
      expect(p.dx + p.box.w).toBeLessThanOrEqual(plan.cellWidth);
      expect(p.dy + p.box.h).toBeLessThanOrEqual(plan.cellHeight);
      baselines.add(p.dy + p.box.h);
    }
    expect(baselines.size).toBe(1);
  });

  it('works on a transparent-background sheet', () => {
    const img = makeImage(220, 120, TRANSPARENT_BG, [
      { x: 10, y: 10, w: 40, h: 50, colour: [0, 0, 0, 255] },
      { x: 120, y: 15, w: 40, h: 45, colour: [0, 0, 0, 255] },
    ]);
    const plan = analyseSheet(img, { padding: 2 });
    expect(plan.rows).toBe(1);
    expect(plan.cols).toBe(2);
    expect(plan.cellWidth).toBe(44);
    expect(plan.cellHeight).toBe(54);
  });
});

/**
 * The failure this guards against is subtle and ugly: a sprite drawn with a
 * white eye highlight, a cream belly or a white flower centre matches the
 * background exactly, so classifying by colour alone punches holes clean
 * through it — speckles of transparency scattered over the character.
 */
describe('background that the border cannot reach', () => {
  it('keeps a white patch inside a sprite', () => {
    // A solid block with a background-coloured square in the middle of it.
    const img = makeImage(40, 40, WHITE_BG, [
      { x: 8, y: 8, w: 24, h: 24 },
      { x: 16, y: 16, w: 8, h: 8, colour: WHITE_BG },
    ]);
    const mask = buildOccupancyMask(img);

    // The enclosed patch counts as sprite...
    expect(mask.bits[20 * 40 + 20]).toBe(1);
    // ...while the background around the block is still background.
    expect(mask.bits[2 * 40 + 2]).toBe(0);
    // And the block itself is unaffected.
    expect(mask.bits[10 * 40 + 10]).toBe(1);
  });

  it('still removes background that reaches the edge', () => {
    const img = makeImage(40, 40, WHITE_BG, [{ x: 10, y: 10, w: 10, h: 10 }]);
    const mask = buildOccupancyMask(img);
    let background = 0;
    for (const bit of mask.bits) if (!bit) background++;
    expect(background).toBe(40 * 40 - 100);
  });

  /** A gap open to the edge is background, however narrow the opening. */
  it('reaches into a notch that is open to the outside', () => {
    const img = makeImage(40, 40, WHITE_BG, [
      { x: 8, y: 8, w: 24, h: 24 },
      // A channel cut from the right edge into the middle of the block.
      { x: 20, y: 18, w: 20, h: 4, colour: WHITE_BG },
    ]);
    const mask = buildOccupancyMask(img);
    expect(mask.bits[20 * 40 + 30]).toBe(0);
    expect(mask.bits[20 * 40 + 12]).toBe(1);
  });

  it('leaves an alpha background alone, holes and all', () => {
    // With real transparency there is nothing to guess at, and a sprite may
    // legitimately contain the background colour.
    const img = makeImage(40, 40, TRANSPARENT_BG, [
      { x: 8, y: 8, w: 24, h: 24 },
      { x: 16, y: 16, w: 8, h: 8, colour: TRANSPARENT_BG },
    ]);
    const mask = buildOccupancyMask(img);
    expect(mask.bits[20 * 40 + 20]).toBe(0);
  });

  it('counts rows and columns from the filled mask, not the raw colours', () => {
    const img = makeImage(20, 20, WHITE_BG, [
      { x: 5, y: 5, w: 10, h: 10 },
      { x: 8, y: 8, w: 4, h: 4, colour: WHITE_BG },
    ]);
    const mask = buildOccupancyMask(img);
    // Row 10 crosses the enclosed patch; every pixel of the block must count.
    expect(mask.rowCounts[10]).toBe(10);
    expect(mask.colCounts[10]).toBe(10);
  });

  describe('fillEnclosedBackground', () => {
    it('does nothing to an empty image', () => {
      expect(() => fillEnclosedBackground(new Uint8Array(0), 0, 0)).not.toThrow();
    });

    it('fills a ring, which is the known trade-off', () => {
      const bits = new Uint8Array(25);
      // A 3x3 ring in a 5x5 grid, hollow in the middle.
      for (const i of [6, 7, 8, 11, 13, 16, 17, 18]) bits[i] = 1;
      fillEnclosedBackground(bits, 5, 5);
      expect(bits[12]).toBe(1);
      expect(bits[0]).toBe(0);
    });
  });
});
