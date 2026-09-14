import { describe, expect, it } from 'vitest';
import {
  BUILD_WIDTHS,
  EXTRA_CLEARANCE,
  TERRAIN_THEMES,
  buildFor,
  isValidRoll,
  placeExtra,
  rollExtra,
  stageFor,
} from './spot-build';
import { PROP_DESCRIPTIONS, PROP_KINDS, TERRAIN_IDS, propSvg } from './map-art';
import { buildMapLayout } from './map-layout';

const layout = buildMapLayout();

describe('stageFor', () => {
  it('grows with the badges won there', () => {
    expect(stageFor([])).toBe('plot');
    expect(stageFor(['cleared'])).toBe('started');
    expect(stageFor(['cleared', 'mastered'])).toBe('finished');
  });

  it('treats a crown as finished however it arrived', () => {
    // The crown implies the star, but the record is the source of truth and a
    // retuned rule must not leave a place looking unstarted.
    expect(stageFor(['mastered'])).toBe('finished');
  });
});

describe('buildFor', () => {
  it('leaves an unstarted place empty', () => {
    for (const terrain of TERRAIN_IDS) expect(buildFor(terrain, 'plot')).toBeNull();
  });

  /** The point of the whole thing: the crown has to look like more than the star. */
  it('grows the same landmark bigger from star to crown', () => {
    for (const terrain of TERRAIN_IDS) {
      const started = buildFor(terrain, 'started')!;
      const finished = buildFor(terrain, 'finished')!;
      expect(started.kind).toBe(finished.kind);
      expect(finished.width).toBeGreaterThan(started.width * 1.5);
    }
    expect(BUILD_WIDTHS.finished).toBeGreaterThan(BUILD_WIDTHS.started);
  });

  it('gives every region a landmark of its own', () => {
    const landmarks = layout.regions.map((r) => TERRAIN_THEMES[r.terrain].landmark);
    const terrains = layout.regions.map((r) => r.terrain);
    expect(new Set(landmarks).size).toBe(new Set(terrains).size);
  });
});

describe('terrain themes', () => {
  it('names only pictures the map knows how to make and draw', () => {
    for (const terrain of TERRAIN_IDS) {
      const theme = TERRAIN_THEMES[terrain];
      expect(theme.extras.length).toBeGreaterThan(1);
      for (const kind of [theme.landmark, ...theme.extras]) {
        expect(PROP_KINDS).toContain(kind);
        expect(PROP_DESCRIPTIONS[kind].length).toBeGreaterThan(10);
        expect(propSvg(kind)).toContain('<svg');
      }
    }
  });

  it('does not reuse a landmark as an extra anywhere', () => {
    const landmarks = new Set(TERRAIN_IDS.map((t) => TERRAIN_THEMES[t].landmark));
    for (const terrain of TERRAIN_IDS) {
      for (const extra of TERRAIN_THEMES[terrain].extras) {
        expect(landmarks.has(extra), extra).toBe(false);
      }
    }
  });
});

describe('extras', () => {
  it('rolls every extra a terrain offers, given the chance', () => {
    for (const terrain of TERRAIN_IDS) {
      const seen = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const values = [i / 20, 0.5];
        seen.add(rollExtra(terrain, () => values.shift() ?? 0).kind);
      }
      expect([...seen].sort()).toEqual([...TERRAIN_THEMES[terrain].extras].sort());
    }
  });

  it('accepts its own rolls and rejects anything else', () => {
    const roll = rollExtra('forest', () => 0.3);
    expect(isValidRoll('forest', roll)).toBe(true);
    expect(isValidRoll('beach', roll)).toBe(false);
    expect(isValidRoll('forest', undefined)).toBe(false);
    expect(isValidRoll('forest', { kind: 'oak', seed: 1 })).toBe(false);
    expect(isValidRoll('forest', { kind: roll.kind, seed: 'x' })).toBe(false);
  });

  it('stands inside its region and clear of the places to play', () => {
    for (const region of layout.regions) {
      const spots = layout.spots.filter((spot) => spot.regionId === region.id);
      for (const seed of [0, 1, 42, 999, 123456]) {
        const at = placeExtra(region, spots, seed);
        expect(Math.hypot((at.x - region.cx) / region.rx, (at.y - region.cy) / region.ry))
          .toBeLessThan(1);
        for (const spot of spots) {
          expect(
            Math.hypot(spot.x - at.x, spot.y - at.y),
            `${region.id} seed ${seed}`,
          ).toBeGreaterThanOrEqual(EXTRA_CLEARANCE * 0.7);
        }
      }
    }
  });

  it('lands in the same place for the same roll', () => {
    const region = layout.regions[0];
    const spots = layout.spots.filter((spot) => spot.regionId === region.id);
    expect(placeExtra(region, spots, 7)).toEqual(placeExtra(region, spots, 7));
  });
});
