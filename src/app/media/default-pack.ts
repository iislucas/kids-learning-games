import { MediaPack } from './media.types';

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
    map: {
      tiles: {
        hills: { src: assetUrl('media/map/tile-hills.webp') },
        water: { src: assetUrl('media/map/tile-water.webp') },
        caves: { src: assetUrl('media/map/tile-caves.webp') },
        forest: { src: assetUrl('media/map/tile-forest.webp') },
        village: { src: assetUrl('media/map/tile-village.webp') },
        meadow: { src: assetUrl('media/map/tile-meadow.webp') },
      },
      props: {
        tree: { src: assetUrl('media/map/prop-tree.webp') },
        pine: { src: assetUrl('media/map/prop-pine.webp') },
        boulder: { src: assetUrl('media/map/prop-boulder.webp') },
        cottage: { src: assetUrl('media/map/prop-cottage.webp') },
        pond: { src: assetUrl('media/map/prop-pond.webp') },
        flower: { src: assetUrl('media/map/prop-flower.webp') },
      },
    },
  };
}
