/**
 * Sprite-sheet analysis.
 *
 * Image generators are asked for a grid of poses on a flat background, but they
 * never place them on an exact pixel grid: cells drift, sprites are different
 * sizes, and the margins are uneven. Animating such a sheet by naive
 * `background-position` stepping produces a character that jitters and drifts.
 *
 * So we analyse first and normalise second:
 *
 *   1. `buildOccupancyMask`  — classify every pixel as sprite or background.
 *   2. `findGutters`         — locate the empty rows/columns between poses.
 *   3. `boxesFromGutters`    — one tight bounding box per pose.
 *   4. `planUniformGrid`     — choose ONE cell size that fits every pose, and
 *                              the offset that centres each pose within it.
 *
 * Everything here is pure and works on plain `ImageDataLike` values, so it is
 * unit-testable without a DOM. `normaliseSheet` in `sprite-sheet.ts` does the
 * canvas redraw using this plan.
 */

export interface ImageDataLike {
  readonly width: number;
  readonly height: number;
  /** RGBA, 4 bytes per pixel, row-major. */
  readonly data: Uint8ClampedArray | number[];
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Run {
  start: number;
  /** Exclusive. */
  end: number;
}

export interface OccupancyMask {
  width: number;
  height: number;
  /** True where the pixel belongs to a sprite. */
  bits: Uint8Array;
  /** Column sums of `bits`, length `width`. */
  colCounts: Uint32Array;
  /** Row sums of `bits`, length `height`. */
  rowCounts: Uint32Array;
}

export interface GridPlan {
  cols: number;
  rows: number;
  /** Tight bounding box of each pose, in source-image pixels, row-major order. */
  boxes: Box[];
  /** The single cell size every pose is redrawn into. */
  cellWidth: number;
  cellHeight: number;
  /**
   * Where to draw each box inside its cell so the pose is centred
   * horizontally and sits on a common baseline vertically.
   */
  placements: { box: Box; dx: number; dy: number }[];
}

export interface AnalyseOptions {
  /**
   * Colour distance (0-255 per channel, summed over RGB) within which a pixel
   * counts as background. Generated art has soft JPEG-ish noise in flat areas,
   * so this needs to be well above zero.
   */
  backgroundTolerance?: number;
  /** Alpha at or below this is always background. */
  alphaThreshold?: number;
  /**
   * A row/column counts as empty if fewer than this fraction of its pixels are
   * sprite. Tolerates stray compression speckle in the gutters.
   */
  emptyRatio?: number;
  /** Ignore content runs thinner than this many pixels (noise, not a pose). */
  minRunPx?: number;
  /** Transparent padding added around every pose in the normalised sheet. */
  padding?: number;
}

const DEFAULTS: Required<AnalyseOptions> = {
  backgroundTolerance: 60,
  alphaThreshold: 16,
  emptyRatio: 0.005,
  minRunPx: 6,
  padding: 4,
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Decides the background colour from the median of the image's 1px border.
 *
 * The median (rather than the mean, or a corner sample) is what makes this
 * survive a pose that runs off the edge of the sheet: such a pose is a
 * minority of the perimeter, so it cannot drag the estimate away from the true
 * background. Averaging four corners fails outright when a sprite touches one.
 *
 * If the border is mostly transparent we rely on alpha instead and the colour
 * is unused.
 */
export function detectBackgroundColour(img: ImageDataLike): {
  r: number;
  g: number;
  b: number;
  hasAlpha: boolean;
} {
  const { width, height, data } = img;
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  let transparent = 0;
  let total = 0;

  const sample = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    rs.push(data[i]);
    gs.push(data[i + 1]);
    bs.push(data[i + 2]);
    if (data[i + 3] <= DEFAULTS.alphaThreshold) transparent++;
    total++;
  };

  for (let x = 0; x < width; x++) {
    sample(x, 0);
    if (height > 1) sample(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    sample(0, y);
    if (width > 1) sample(width - 1, y);
  }

  return {
    r: median(rs),
    g: median(gs),
    b: median(bs),
    hasAlpha: total > 0 && transparent / total > 0.5,
  };
}

export function buildOccupancyMask(
  img: ImageDataLike,
  options: AnalyseOptions = {},
): OccupancyMask {
  const opts = { ...DEFAULTS, ...options };
  const { width, height, data } = img;
  const bg = detectBackgroundColour(img);

  const bits = new Uint8Array(width * height);
  const colCounts = new Uint32Array(width);
  const rowCounts = new Uint32Array(height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3];

      let isSprite: boolean;
      if (alpha <= opts.alphaThreshold) {
        isSprite = false;
      } else if (bg.hasAlpha) {
        // Alpha alone is a reliable signal, so don't second-guess it with
        // colour — a sprite may legitimately contain the corner colour.
        isSprite = true;
      } else {
        const distance =
          Math.abs(data[i] - bg.r) +
          Math.abs(data[i + 1] - bg.g) +
          Math.abs(data[i + 2] - bg.b);
        isSprite = distance > opts.backgroundTolerance;
      }

      if (isSprite) bits[y * width + x] = 1;
    }
  }

  // Colour alone is not enough. A white eye highlight, a cream belly or the
  // white centre of a flower all match the background exactly, and knocking
  // every matching pixel out punches holes right through the sprite. What
  // actually distinguishes background is being *reachable from the edge*, so
  // the matching pixels are flooded inward from the border and only those the
  // flood reaches count as background.
  //
  // The trade-off is that background genuinely enclosed by the subject — the
  // middle of a ring — is filled in. For sprites that is almost always the
  // wanted answer, and it is far less damaging than the speckling it replaces.
  if (!bg.hasAlpha) fillEnclosedBackground(bits, width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (bits[y * width + x]) {
        colCounts[x]++;
        rowCounts[y]++;
      }
    }
  }

  return { width, height, bits, colCounts, rowCounts };
}

/**
 * Marks as sprite every background-coloured pixel the border cannot reach.
 *
 * A four-way flood over the background pixels, seeded from every edge pixel.
 * Anything left unvisited is enclosed, so it belongs to the subject however
 * much it looks like the background.
 */
export function fillEnclosedBackground(
  bits: Uint8Array,
  width: number,
  height: number,
): void {
  if (width === 0 || height === 0) return;

  const outside = new Uint8Array(width * height);
  // A typed stack: a plain array of a million entries is a lot of boxing.
  const stack = new Int32Array(width * height);
  let top = 0;

  const push = (index: number) => {
    if (bits[index] || outside[index]) return;
    outside[index] = 1;
    stack[top++] = index;
  };

  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }

  while (top > 0) {
    const index = stack[--top];
    const x = index % width;
    const y = (index - x) / width;
    if (x > 0) push(index - 1);
    if (x < width - 1) push(index + 1);
    if (y > 0) push(index - width);
    if (y < height - 1) push(index + width);
  }

  for (let i = 0; i < bits.length; i++) {
    if (!bits[i] && !outside[i]) bits[i] = 1;
  }
}

/**
 * Splits a projection profile into the runs that contain content. `counts[i]`
 * is how many sprite pixels lie in line `i`; `span` is the length of each line
 * (so the ratio test is scale-independent).
 */
export function findContentRuns(
  counts: ArrayLike<number>,
  span: number,
  options: AnalyseOptions = {},
): Run[] {
  const opts = { ...DEFAULTS, ...options };
  const threshold = Math.max(1, Math.floor(span * opts.emptyRatio));

  const runs: Run[] = [];
  let start = -1;
  for (let i = 0; i < counts.length; i++) {
    const occupied = counts[i] >= threshold;
    if (occupied && start === -1) {
      start = i;
    } else if (!occupied && start !== -1) {
      runs.push({ start, end: i });
      start = -1;
    }
  }
  if (start !== -1) runs.push({ start, end: counts.length });

  return runs.filter((run) => run.end - run.start >= opts.minRunPx);
}

/**
 * Tightens a box to the pixels actually set inside it. Column/row runs give a
 * rectangle that is correct in one axis but generous in the other (a pose that
 * is short still spans its whole row band), so we re-measure within the cell.
 */
export function tightenBox(mask: OccupancyMask, box: Box): Box | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const endX = Math.min(box.x + box.w, mask.width);
  const endY = Math.min(box.y + box.h, mask.height);

  for (let y = Math.max(0, box.y); y < endY; y++) {
    for (let x = Math.max(0, box.x); x < endX; x++) {
      if (mask.bits[y * mask.width + x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (minX > maxX || minY > maxY) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * Finds one tight box per pose by intersecting the row bands with the column
 * bands measured *within that band* — measuring columns per-row rather than
 * globally is what makes uneven grids work, since a 3-across row and a
 * 4-across row no longer have to agree on column positions.
 */
export function boxesFromGutters(
  mask: OccupancyMask,
  options: AnalyseOptions = {},
): { boxes: Box[]; cols: number; rows: number } {
  const rowRuns = findContentRuns(mask.rowCounts, mask.width, options);
  if (rowRuns.length === 0) return { boxes: [], cols: 0, rows: 0 };

  const boxes: Box[] = [];
  let maxCols = 0;

  for (const rowRun of rowRuns) {
    // Column profile restricted to this band of rows.
    const bandCols = new Uint32Array(mask.width);
    for (let y = rowRun.start; y < rowRun.end; y++) {
      for (let x = 0; x < mask.width; x++) {
        if (mask.bits[y * mask.width + x]) bandCols[x]++;
      }
    }

    const bandHeight = rowRun.end - rowRun.start;
    const colRuns = findContentRuns(bandCols, bandHeight, options);
    maxCols = Math.max(maxCols, colRuns.length);

    for (const colRun of colRuns) {
      const tight = tightenBox(mask, {
        x: colRun.start,
        y: rowRun.start,
        w: colRun.end - colRun.start,
        h: bandHeight,
      });
      if (tight) boxes.push(tight);
    }
  }

  return { boxes, cols: maxCols, rows: rowRuns.length };
}

/**
 * Chooses the common cell every pose is redrawn into.
 *
 * The cell is the widest and tallest pose plus padding, so nothing is ever
 * clipped. Poses are centred horizontally but bottom-aligned vertically: a
 * jumping pose is taller than a standing one, and aligning their *feet* is what
 * stops the character bobbing between frames. Anchoring to the top or the
 * centre instead is the usual cause of "why does my sprite float".
 */
export function planUniformGrid(
  boxes: Box[],
  cols: number,
  rows: number,
  options: AnalyseOptions = {},
): GridPlan {
  const opts = { ...DEFAULTS, ...options };

  if (boxes.length === 0) {
    return {
      cols: 0,
      rows: 0,
      boxes: [],
      cellWidth: 0,
      cellHeight: 0,
      placements: [],
    };
  }

  const maxW = Math.max(...boxes.map((b) => b.w));
  const maxH = Math.max(...boxes.map((b) => b.h));
  const cellWidth = maxW + opts.padding * 2;
  const cellHeight = maxH + opts.padding * 2;

  const placements = boxes.map((box) => ({
    box,
    dx: Math.round((cellWidth - box.w) / 2),
    dy: cellHeight - opts.padding - box.h,
  }));

  return { cols, rows, boxes, cellWidth, cellHeight, placements };
}

/** Full pipeline: raw generated image in, normalisation plan out. */
export function analyseSheet(
  img: ImageDataLike,
  options: AnalyseOptions = {},
): GridPlan {
  const mask = buildOccupancyMask(img, options);
  const { boxes, cols, rows } = boxesFromGutters(mask, options);
  return planUniformGrid(boxes, cols, rows, options);
}

export interface RgbaImage {
  width: number;
  height: number;
  /**
   * Pinned to a plain ArrayBuffer (not the default ArrayBufferLike) so this can
   * be handed straight to the `ImageData` constructor.
   */
  data: Uint8ClampedArray<ArrayBuffer>;
}

/**
 * Redraws every pose into a uniform grid, dropping the background to
 * transparency as it goes (the mask already says which pixels are sprite).
 *
 * The result is a sheet where frame `n` is exactly
 * `(n % cols) * cellWidth, floor(n / cols) * cellHeight` — which is what lets
 * the runtime animate with nothing but a stepped `background-position`.
 */
export function composeNormalisedSheet(
  img: ImageDataLike,
  mask: OccupancyMask,
  plan: GridPlan,
): RgbaImage {
  const frameCount = plan.placements.length;
  if (frameCount === 0 || plan.cellWidth === 0 || plan.cellHeight === 0) {
    return { width: 0, height: 0, data: new Uint8ClampedArray(0) };
  }

  // Keep the original row/column shape when it accounts for every frame;
  // otherwise fall back to a single strip so no frame is silently dropped.
  const cols = plan.cols > 0 && plan.cols * plan.rows >= frameCount ? plan.cols : frameCount;
  const rows = Math.ceil(frameCount / cols);

  const width = cols * plan.cellWidth;
  const height = rows * plan.cellHeight;
  const out = new Uint8ClampedArray(width * height * 4); // zero => transparent

  plan.placements.forEach((placement, index) => {
    const originX = (index % cols) * plan.cellWidth + placement.dx;
    const originY = Math.floor(index / cols) * plan.cellHeight + placement.dy;
    const { box } = placement;

    for (let y = 0; y < box.h; y++) {
      const srcY = box.y + y;
      if (srcY < 0 || srcY >= img.height) continue;
      for (let x = 0; x < box.w; x++) {
        const srcX = box.x + x;
        if (srcX < 0 || srcX >= img.width) continue;
        if (!mask.bits[srcY * mask.width + srcX]) continue;

        const src = (srcY * img.width + srcX) * 4;
        const dst = ((originY + y) * width + (originX + x)) * 4;
        out[dst] = img.data[src];
        out[dst + 1] = img.data[src + 1];
        out[dst + 2] = img.data[src + 2];
        out[dst + 3] = 255;
      }
    }
  });

  return { width, height, data: out };
}
