import { describe, expect, it } from 'vitest';
import { BuildStage, buildDataUrl, buildSvg, stageFor } from './spot-build';
import { TERRAIN_IDS } from './map-art';
import { buildMapLayout } from './map-layout';

const STAGES: BuildStage[] = ['plot', 'started', 'finished'];

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

describe('buildSvg', () => {
  it('draws something different at every stage, for every terrain', () => {
    for (const terrain of TERRAIN_IDS) {
      const drawings = STAGES.map((stage) => buildSvg(terrain, stage, '#4f8ff7'));
      expect(new Set(drawings).size, `${terrain} repeats a stage`).toBe(3);
      for (const drawing of drawings) expect(drawing.length).toBeGreaterThan(50);
    }
  });

  /**
   * The point of the whole thing: a place further along has to look like more
   * has been done to it, not merely different.
   */
  it('adds to what is already there rather than replacing it', () => {
    for (const terrain of TERRAIN_IDS) {
      const started = buildSvg(terrain, 'started', '#4f8ff7');
      const finished = buildSvg(terrain, 'finished', '#4f8ff7');
      expect(finished.startsWith(started), `${terrain} restarts when finished`).toBe(
        true,
      );
      expect(finished.length).toBeGreaterThan(started.length);
    }
  });

  it('fits the box it says it does', () => {
    for (const terrain of TERRAIN_IDS) {
      for (const stage of STAGES) {
        const url = buildDataUrl(terrain, stage, '#4f8ff7');
        expect(url.startsWith('data:image/svg+xml')).toBe(true);
        expect(decodeURIComponent(url)).toContain('viewBox="0 0 64 60"');
      }
    }
  });

  it('has a drawing for every terrain the map actually uses', () => {
    for (const region of buildMapLayout().regions) {
      for (const stage of STAGES) {
        expect(buildSvg(region.terrain, stage, region.colour).length).toBeGreaterThan(
          50,
        );
      }
    }
  });
});
