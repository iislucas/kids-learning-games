import { describe, expect, it } from 'vitest';
import { ALL_CHALLENGES, findChallenge } from '../quiz/challenges';
import { mapSvg } from './map-art';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  SPOT_RADIUS,
  buildMapLayout,
  spotAt,
  spotFor,
} from './map-layout';

const layout = buildMapLayout();

describe('the map layout', () => {
  it('gives every challenge exactly one place to stand', () => {
    expect(layout.spots.length).toBe(ALL_CHALLENGES.length);
    for (const ref of ALL_CHALLENGES) {
      expect(
        layout.spots.filter((spot) => spot.challengeId === ref.challenge.id).length,
        `${ref.challenge.id} should have one spot`,
      ).toBe(1);
    }
  });

  it('puts every spot inside the map', () => {
    for (const spot of layout.spots) {
      expect(spot.x).toBeGreaterThan(SPOT_RADIUS);
      expect(spot.x).toBeLessThan(MAP_WIDTH - SPOT_RADIUS);
      expect(spot.y).toBeGreaterThan(SPOT_RADIUS);
      expect(spot.y).toBeLessThan(MAP_HEIGHT - SPOT_RADIUS);
    }
  });

  it('puts every spot inside the region it belongs to', () => {
    for (const spot of layout.spots) {
      const region = layout.regions.find((r) => r.id === spot.regionId);
      expect(region, `${spot.challengeId} has no region`).toBeDefined();
      // Inside the ellipse: the normalised radius must be under 1.
      const nx = (spot.x - region!.cx) / region!.rx;
      const ny = (spot.y - region!.cy) / region!.ry;
      expect(Math.hypot(nx, ny)).toBeLessThan(1);
    }
  });

  /**
   * Two signposts on top of each other would be untappable, and worse, `spotAt`
   * would open whichever it found first.
   */
  it('keeps the spots far enough apart to tap separately', () => {
    for (let i = 0; i < layout.spots.length; i++) {
      for (let j = i + 1; j < layout.spots.length; j++) {
        const a = layout.spots[i];
        const b = layout.spots[j];
        expect(
          Math.hypot(a.x - b.x, a.y - b.y),
          `${a.challengeId} and ${b.challengeId} overlap`,
        ).toBeGreaterThan(SPOT_RADIUS * 2);
      }
    }
  });

  it('groups every region with a pack that exists', () => {
    for (const region of layout.regions) {
      const spots = layout.spots.filter((spot) => spot.regionId === region.id);
      expect(spots.length).toBeGreaterThan(0);
      for (const spot of spots) {
        expect(findChallenge(spot.challengeId)?.pack.id).toBe(region.packId);
      }
    }
  });

  it('starts her on open ground rather than on top of a signpost', () => {
    expect(spotAt(layout, layout.start.x, layout.start.y)).toBeUndefined();
  });

  it('finds the spot she is standing on, and nothing when she is not', () => {
    const spot = layout.spots[0];
    expect(spotAt(layout, spot.x, spot.y)?.challengeId).toBe(spot.challengeId);
    expect(spotAt(layout, spot.x + SPOT_RADIUS - 2, spot.y)?.challengeId).toBe(
      spot.challengeId,
    );
    expect(spotAt(layout, spot.x + SPOT_RADIUS + 20, spot.y)).toBeUndefined();
  });

  it('looks a spot up by challenge id', () => {
    expect(spotFor(layout, layout.spots[3].challengeId)).toBe(layout.spots[3]);
    expect(spotFor(layout, 'not.a.challenge')).toBeUndefined();
  });
});

describe('the map art', () => {
  it('draws a clearing at every spot, in both the art and the sketch', () => {
    for (const labelled of [false, true]) {
      const svg = mapSvg(layout, { labelled });
      for (const spot of layout.spots) {
        expect(
          svg.includes(`cx="${spot.x}" cy="${spot.y}"`),
          `${spot.challengeId} has no clearing (labelled: ${labelled})`,
        ).toBe(true);
      }
    }
  });

  it('numbers and names things only on the sketch', () => {
    const art = mapSvg(layout);
    const sketch = mapSvg(layout, { labelled: true });
    expect(art).not.toContain('<text');
    expect(sketch).toContain('<text');
    for (const region of layout.regions) {
      expect(sketch).toContain(region.name);
      expect(art).not.toContain(region.name);
    }
  });

  it('is the size the layout says it is', () => {
    expect(mapSvg(layout)).toContain(
      `viewBox="0 0 ${layout.width} ${layout.height}"`,
    );
  });
});
