/**
 * Starting again from scratch.
 *
 * Everything the game saves lives under `klg.` in localStorage, so a fresh
 * start erases all of it — stars, prizes, badges, what she has built on the
 * map, where she was standing, which topics are switched on, sound and who she
 * plays with. Matching on the prefix rather than listing keys means a setting
 * added later is reset too without anyone remembering to add it here.
 *
 * The media studio's API keys and generated pictures and sounds are kept: they
 * belong to whoever set the game up, not to her progress, and generated media
 * costs real money to make again.
 */

const PREFIX = 'klg.';

export const KEPT_ON_FRESH_START: readonly string[] = [
  'klg.keys.gemini',
  'klg.keys.elevenlabs',
  'klg.mediaPack',
];

/** Erases every saved game setting and all progress. Returns the keys removed. */
export function eraseForFreshStart(storage: Storage): string[] {
  const doomed: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(PREFIX) && !KEPT_ON_FRESH_START.includes(key)) {
      doomed.push(key);
    }
  }
  // Collected first: removing while indexing would skip keys.
  for (const key of doomed) storage.removeItem(key);
  return doomed;
}
