import { describe, expect, it } from 'vitest';
import { ALL_CHALLENGES, findChallenge } from '../quiz/challenges';
import {
  PROP_KINDS,
  TERRAIN_IDS,
  TILE_SIZE,
  mapSketchSvg,
  pathThrough,
  placeProps,
  propSvg,
  terrainTileSvg,
} from './map-art';
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
  it('numbers every spot on the sketch', () => {
    const sketch = mapSketchSvg(layout);
    for (const spot of layout.spots) {
      expect(
        sketch.includes(`cx="${spot.x}" cy="${spot.y}"`),
        `${spot.challengeId} has no clearing on the sketch`,
      ).toBe(true);
    }
    for (const region of layout.regions) {
      expect(sketch).toContain(region.name);
    }
  });

  it('is the size the layout says it is', () => {
    expect(mapSketchSvg(layout)).toContain(
      `viewBox="0 0 ${layout.width} ${layout.height}"`,
    );
  });

  it('draws a tile for every terrain the map uses', () => {
    for (const region of layout.regions) {
      expect(TERRAIN_IDS).toContain(region.terrain);
    }
    for (const terrain of TERRAIN_IDS) {
      const tile = terrainTileSvg(terrain);
      expect(tile).toContain(`width="${TILE_SIZE}" height="${TILE_SIZE}"`);
      expect(tile.length).toBeGreaterThan(200);
    }
  });

  /**
   * The one thing that actually matters about a tile. Marks that stop at the
   * edge make a visible grid the moment it repeats, so each one is drawn at
   * every wrap offset — which shows up as coordinates outside the tile.
   */
  it('draws tile marks across the edges so they repeat seamlessly', () => {
    for (const terrain of TERRAIN_IDS) {
      expect(
        /-\d/.test(terrainTileSvg(terrain)),
        `${terrain} has no marks crossing its edges`,
      ).toBe(true);
    }
  });

  it('draws every prop on a transparent square', () => {
    for (const kind of PROP_KINDS) {
      const svg = propSvg(kind);
      expect(svg).toContain('<svg');
      expect(svg).not.toContain('<rect width="128" height="128"');
    }
  });

  it('scatters props inside their region and clear of the clearings', () => {
    for (const region of layout.regions) {
      const spots = layout.spots.filter((spot) => spot.regionId === region.id);
      const props = placeProps(region, spots);
      expect(props.length).toBeGreaterThan(0);
      for (const prop of props) {
        const nx = (prop.x - region.cx) / region.rx;
        const ny = (prop.y - region.cy) / region.ry;
        expect(Math.hypot(nx, ny)).toBeLessThanOrEqual(1);
        expect(PROP_KINDS).toContain(prop.kind);
        for (const spot of spots) {
          expect(Math.hypot(spot.x - prop.x, spot.y - prop.y)).toBeGreaterThanOrEqual(
            78,
          );
        }
      }
    }
  });

  it('places props identically every time, so scenery never wanders', () => {
    const region = layout.regions[0];
    const spots = layout.spots.filter((spot) => spot.regionId === region.id);
    expect(placeProps(region, spots)).toEqual(placeProps(region, spots));
  });

  it('joins each region\'s spots in order', () => {
    for (const region of layout.regions) {
      const spots = layout.spots.filter((spot) => spot.regionId === region.id);
      const track = pathThrough(spots);
      if (spots.length < 2) {
        expect(track).toBe('');
        continue;
      }
      const first = spots.find((spot) => spot.index === 0)!;
      expect(track.startsWith(`M ${first.x} ${first.y}`)).toBe(true);
    }
  });
});
