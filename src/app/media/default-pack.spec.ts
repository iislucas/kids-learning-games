import { describe, expect, it } from 'vitest';
import { defaultMediaPack } from './default-pack';
import { ANIMATION_NAMES, SOUND_IDS } from './media.types';
import { DIRECTIONS } from '../explore/explorer';
import { existsSync } from 'node:fs';
import { PROP_KINDS, propFile } from '../explore/props';
import { TERRAIN_IDS, tileFile } from '../explore/terrains';
import { buildMapLayout } from '../explore/map-layout';
import { CHARACTER_VOICES, VOICED_EVENTS, voiceClipPath } from './voice-lines';

const pack = defaultMediaPack();

/**
 * The pack that ships in the repo. A fresh clone has no API keys and cannot
 * generate anything, so anything missing here is simply missing from the game.
 */
describe('the default media pack', () => {
  it('offers a choice of characters', () => {
    expect(pack.characters.length).toBeGreaterThan(1);
    const ids = pack.characters.map((character) => character.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(pack.activeCharacterId);
  });

  it('gives every character a name a child can read', () => {
    for (const character of pack.characters) {
      expect(character.name.length).toBeGreaterThan(0);
      expect(character.name.length).toBeLessThanOrEqual(12);
    }
  });

  for (const character of pack.characters) {
    describe(character.id, () => {
      it('has every animation, pointing at frames the sheet has', () => {
        for (const name of ANIMATION_NAMES) {
          const animation = character.animations[name];
          expect(animation, `${name} is missing`).toBeDefined();
          expect(animation.frames.length).toBeGreaterThan(0);
          for (const frame of animation.frames) {
            expect(frame).toBeGreaterThanOrEqual(0);
            expect(frame).toBeLessThan(character.sheet.frameCount);
          }
        }
      });

      it('has a sheet whose grid accounts for its frames', () => {
        const { cols, rows, frameCount, cellWidth, cellHeight } = character.sheet;
        expect(cols * rows).toBe(frameCount);
        expect(cellWidth).toBeGreaterThan(0);
        expect(cellHeight).toBeGreaterThan(0);
      });

      /**
       * Without a walk sheet the map falls back to the idle pose, so she gets
       * about but never turns — which is a quiet loss, easy to ship by mistake.
       */
      it('can walk in all eight directions', () => {
        const walk = character.walk;
        expect(walk, 'no walk sheet').toBeDefined();
        expect(walk!.sheet.cols * walk!.sheet.rows).toBe(walk!.sheet.frameCount);
        expect(walk!.sheet.rows).toBe(DIRECTIONS.length);
        // The row order is how the map indexes the sheet: get it wrong and she
        // walks east showing her back.
        expect(walk!.directions).toEqual([...DIRECTIONS]);
      });
    });
  }

  it('has every sound', () => {
    for (const id of SOUND_IDS) expect(pack.sounds[id]?.src).toBeTruthy();
    expect(pack.music?.src).toBeTruthy();
  });

  it('has a ground tile for every terrain the map uses, and every prop', () => {
    for (const region of buildMapLayout().regions) {
      expect(pack.map?.tiles?.[region.terrain]?.src, region.terrain).toBeTruthy();
    }
    for (const terrain of TERRAIN_IDS) {
      expect(pack.map?.tiles?.[terrain]?.src, terrain).toBeTruthy();
    }
    for (const kind of PROP_KINDS) {
      expect(pack.map?.props?.[kind]?.src, kind).toBeTruthy();
    }
  });

  /**
   * The paths are derived from the registries, so a terrain or prop added
   * without generating and committing its picture would otherwise only show up
   * as a broken image on the map.
   */
  it('has every map picture committed under public/', () => {
    const files = [...TERRAIN_IDS.map(tileFile), ...PROP_KINDS.map(propFile)];
    const missing = files.filter((file) => !existsSync(`public/${file}`));
    expect(missing).toEqual([]);
  });

  it('keys its question pictures the way questions ask for them', () => {
    const ids = Object.keys(pack.pictures ?? {});
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(id.startsWith('word.')).toBe(true);
  });
});

/**
 * Each character's voice. The clips are generated from `voice-lines.ts` and
 * the pack derives their paths from the same file, so these checks are about
 * the two agreeing — and about every moment actually having something to say.
 */
describe('character voices', () => {
  it('gives every shipped character a voice', () => {
    for (const character of pack.characters) {
      expect(CHARACTER_VOICES[character.id], `${character.id} has no voice`).toBeDefined();
      expect(character.voice, `${character.id} voice not in the pack`).toBeDefined();
    }
  });

  for (const [id, voice] of Object.entries(CHARACTER_VOICES)) {
    describe(id, () => {
      it('has at least one line for every voiced moment', () => {
        for (const event of VOICED_EVENTS) {
          expect(voice.lines[event].length, `${id} ${event}`).toBeGreaterThan(0);
          for (const line of voice.lines[event]) expect(line.trim().length).toBeGreaterThan(0);
        }
      });

      /** Ten right answers a round: one line would be heard ten times. */
      it('has more than one line for a right answer', () => {
        expect(voice.lines.correct.length).toBeGreaterThan(1);
      });

      it('points the pack at the clips the generator writes', () => {
        const character = pack.characters.find((c) => c.id === id)!;
        for (const event of VOICED_EVENTS) {
          const clips = character.voice?.[event] ?? [];
          expect(clips.length).toBe(voice.lines[event].length);
          clips.forEach((clip, index) => {
            expect(clip.src.endsWith(voiceClipPath(id, event, index))).toBe(true);
          });
        }
      });

      it('keeps every line short enough to say in a moment', () => {
        for (const event of VOICED_EVENTS) {
          for (const line of voice.lines[event]) {
            expect(line.split(/\s+/).length, `"${line}"`).toBeLessThanOrEqual(5);
          }
        }
      });
    });
  }
});
