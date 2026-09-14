import { PROP_KINDS, propFile } from '../explore/props';
import { TERRAIN_IDS, tileFile } from '../explore/terrains';
import { MediaPack, SoundDef, SoundId } from './media.types';
import { CHARACTER_VOICES, VOICED_EVENTS, voiceClipPath } from './voice-lines';

/**
 * Resolves an asset path against the document's base href.
 *
 * Using `document.baseURI` rather than a leading slash is what lets the built
 * app work both at a domain root and under a GitHub Pages project subpath,
 * without the paths breaking on deep routes like `/play/maths`.
 */
export function assetUrl(path: string): string {
  return new URL(path, document.baseURI).href;
}

/**
 * The media that ships in the repo, so the game looks and sounds complete on a
 * fresh clone with no API keys at all.
 *
 * Two characters ship, and which one is in play is a choice made in Settings —
 * Momo the fox and Kai the sea-dragon. Having someone to pick gives a child
 * some ownership of the game before she has answered a single question, and
 * both are drawn in the same style so neither feels like the lesser option.
 *
 * It comes from two places:
 *
 *  - **Pictures are generated**, made in the media studio with Gemini and
 *    committed here. Getting good art out of an image model is the studio's
 *    whole job, and a fresh clone should not have to do that work — or hold a
 *    key — to see the game as it is meant to look.
 *  - **Sounds are synthesised** by `scripts/generate-default-media.mts`, which
 *    needs no key at all.
 *
 * Everything is WebP: it keeps the transparency a sprite sheet and a scenery
 * prop both need, at roughly a tenth of the equivalent PNG. The whole media
 * folder is about a megabyte, which matters on a phone.
 *
 * To replace any of it: generate a new one in the studio, then export the pack
 * and drop the pieces back in here.
 */
export function defaultMediaPack(): MediaPack {
  return {
    version: 1,
    activeCharacterId: 'momo',
    characters: [
      {
        id: 'momo',
        name: 'Momo',
        voice: voiceFor('momo'),
        sheet: {
          src: assetUrl('media/characters/fox-poses.webp'),
          // The cell size is only ever used as an aspect ratio, so these are the
          // proportions the sheet was normalised to rather than its pixel size.
          cellWidth: 262,
          cellHeight: 340,
          cols: 4,
          rows: 2,
          frameCount: 8,
        },
        // Frame order follows POSE_PLAN in `sprite-prompt.ts`: two idle, two
        // correct, two wrong, two celebrate.
        animations: {
          idle: { frames: [0, 1], fps: 1.4, loop: true },
          correct: { frames: [2, 3, 3, 2, 3], fps: 6, loop: false },
          wrong: { frames: [4, 5], fps: 2.5, loop: false },
          celebrate: { frames: [6, 7], fps: 5, loop: true },
        },
        walk: {
          sheet: {
            src: assetUrl('media/characters/fox-walk.webp'),
            cellWidth: 129,
            cellHeight: 154,
            cols: 4,
            rows: 8,
            frameCount: 32,
          },
          // Row order, and it must match `DIRECTIONS` in explore/explorer.ts.
          directions: ['s', 'sw', 'w', 'nw', 'n', 'ne', 'e', 'se'],
          fps: 8,
        },
      },
      {
        id: 'kai',
        name: 'Kai',
        voice: voiceFor('kai'),
        sheet: {
          src: assetUrl('media/characters/dragon-poses.webp'),
          cellWidth: 265,
          cellHeight: 330,
          cols: 4,
          rows: 2,
          frameCount: 8,
        },
        animations: {
          idle: { frames: [0, 1], fps: 1.4, loop: true },
          correct: { frames: [2, 3, 3, 2, 3], fps: 6, loop: false },
          wrong: { frames: [4, 5], fps: 2.5, loop: false },
          celebrate: { frames: [6, 7], fps: 5, loop: true },
        },
        walk: {
          sheet: {
            src: assetUrl('media/characters/dragon-walk.webp'),
            cellWidth: 121,
            cellHeight: 164,
            cols: 4,
            rows: 8,
            frameCount: 32,
          },
          directions: ['s', 'sw', 'w', 'nw', 'n', 'ne', 'e', 'se'],
          fps: 8,
        },
      },
    ],
    sounds: {
      correct: { src: assetUrl('media/sounds/correct.wav') },
      wrong: { src: assetUrl('media/sounds/wrong.wav'), volume: 0.7 },
      prize: { src: assetUrl('media/sounds/prize.wav') },
      levelUp: { src: assetUrl('media/sounds/levelUp.wav') },
      tap: { src: assetUrl('media/sounds/tap.wav'), volume: 0.5 },
      finish: { src: assetUrl('media/sounds/finish.wav') },
    },
    music: { src: assetUrl('media/music/happy-loop.wav'), volume: 0.3 },
    // One ground tile per terrain and one picture per prop, at the paths the
    // registries name. A new terrain or prop is picked up here by itself, and
    // the spec checks that its file has actually been committed.
    map: {
      tiles: Object.fromEntries(
        TERRAIN_IDS.map((terrain) => [terrain, { src: assetUrl(tileFile(terrain)) }]),
      ),
      props: Object.fromEntries(
        PROP_KINDS.map((kind) => [kind, { src: assetUrl(propFile(kind)) }]),
      ),
    },
    // Keyed by the `picture` a question asks for. Spelling is what needs these:
    // the whole question is "what is this?", and an emoji is a poor and
    // sometimes ambiguous stand-in — "☂️" reads as *rain* as readily as
    // *umbrella*.
    pictures: {
      'word.apple': { src: assetUrl('media/pictures/apple.webp') },
      'word.book': { src: assetUrl('media/pictures/book.webp') },
      'word.bread': { src: assetUrl('media/pictures/bread.webp') },
      'word.bus': { src: assetUrl('media/pictures/bus.webp') },
      'word.butterfly': { src: assetUrl('media/pictures/butterfly.webp') },
      'word.cat': { src: assetUrl('media/pictures/cat.webp') },
      'word.chair': { src: assetUrl('media/pictures/chair.webp') },
      'word.cloud': { src: assetUrl('media/pictures/cloud.webp') },
      'word.cup': { src: assetUrl('media/pictures/cup.webp') },
      'word.dinosaur': { src: assetUrl('media/pictures/dinosaur.webp') },
      'word.dog': { src: assetUrl('media/pictures/dog.webp') },
      'word.elephant': { src: assetUrl('media/pictures/elephant.webp') },
      'word.fish': { src: assetUrl('media/pictures/fish.webp') },
      'word.flower': { src: assetUrl('media/pictures/flower.webp') },
      'word.frog': { src: assetUrl('media/pictures/frog.webp') },
      'word.hat': { src: assetUrl('media/pictures/hat.webp') },
      'word.horse': { src: assetUrl('media/pictures/horse.webp') },
      'word.house': { src: assetUrl('media/pictures/house.webp') },
      'word.penguin': { src: assetUrl('media/pictures/penguin.webp') },
      'word.rainbow': { src: assetUrl('media/pictures/rainbow.webp') },
      'word.rocket': { src: assetUrl('media/pictures/rocket.webp') },
      'word.star': { src: assetUrl('media/pictures/star.webp') },
      'word.strawberry': { src: assetUrl('media/pictures/strawberry.webp') },
      'word.sun': { src: assetUrl('media/pictures/sun.webp') },
      'word.train': { src: assetUrl('media/pictures/train.webp') },
      'word.tree': { src: assetUrl('media/pictures/tree.webp') },
      'word.umbrella': { src: assetUrl('media/pictures/umbrella.webp') },
    },
  };
}

/**
 * A character's voiced clips, as the audio service wants them. The lines are
 * listed in `voice-lines.ts` and the files follow from them by name, so there
 * is no second list here to fall out of step.
 */
function voiceFor(characterId: string): Partial<Record<SoundId, SoundDef[]>> | undefined {
  const voice = CHARACTER_VOICES[characterId];
  if (!voice) return undefined;
  const clips: Partial<Record<SoundId, SoundDef[]>> = {};
  for (const event of VOICED_EVENTS) {
    clips[event] = voice.lines[event].map((_, index) => ({
      src: assetUrl(voiceClipPath(characterId, event, index)),
      volume: 0.9,
    }));
  }
  return clips;
}
