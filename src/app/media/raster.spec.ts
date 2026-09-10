import { describe, expect, it } from 'vitest';
import { approximateBytes } from './raster';

/**
 * `rasterise` itself needs a canvas, so the shape maths it depends on is what
 * is checked here — the rule being that a cut-out keeps its own proportions.
 * Squaring off a tall flower or a wide cottage stretches it, which is the sort
 * of wrongness that is hard to name and impossible to unsee.
 */
function fitted(width: number, height: number, maxSize: number) {
  const scale = Math.min(1, maxSize / (Math.max(width, height) || 1));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

describe('fitting an image to a longest side', () => {
  it('keeps the proportions of a wide subject', () => {
    const out = fitted(800, 400, 256);
    expect(out).toEqual({ width: 256, height: 128 });
  });

  it('keeps the proportions of a tall subject', () => {
    const out = fitted(300, 900, 256);
    expect(out).toEqual({ width: 85, height: 256 });
  });

  it('leaves a square subject square', () => {
    expect(fitted(500, 500, 256)).toEqual({ width: 256, height: 256 });
  });

  it('never enlarges something already smaller', () => {
    expect(fitted(100, 60, 256)).toEqual({ width: 100, height: 60 });
  });

  it('never collapses a sliver to nothing', () => {
    expect(fitted(1000, 1, 256).height).toBe(1);
  });
});

describe('approximateBytes', () => {
  it('measures the payload rather than the whole URI', () => {
    // 8 base64 characters carry 6 bytes.
    expect(approximateBytes('data:image/png;base64,AAAAAAAA')).toBe(6);
  });

  it('copes with a bare payload', () => {
    expect(approximateBytes('AAAAAAAA')).toBe(6);
  });
});
