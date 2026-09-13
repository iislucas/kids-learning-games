import { afterEach, describe, expect, it } from 'vitest';
import { KEPT_ON_FRESH_START, eraseForFreshStart } from './fresh-start';

describe('starting again from scratch', () => {
  afterEach(() => localStorage.clear());

  it('erases progress, badges, options and settings', () => {
    const erased = [
      'klg.progress',
      'klg.mastery',
      'klg.packOptions',
      'klg.mapAt',
      'klg.audio.sounds',
      'klg.audio.music',
      'klg.character',
      'klg.somethingAddedLater',
    ];
    for (const key of erased) localStorage.setItem(key, '1');

    expect(eraseForFreshStart(localStorage).sort()).toEqual([...erased].sort());
    for (const key of erased) expect(localStorage.getItem(key)).toBeNull();
  });

  it('keeps the studio keys and generated media', () => {
    for (const key of KEPT_ON_FRESH_START) localStorage.setItem(key, 'kept');
    eraseForFreshStart(localStorage);
    for (const key of KEPT_ON_FRESH_START) expect(localStorage.getItem(key)).toBe('kept');
  });

  it('leaves anything that is not the game\'s alone', () => {
    localStorage.setItem('another-app', 'mine');
    eraseForFreshStart(localStorage);
    expect(localStorage.getItem('another-app')).toBe('mine');
  });
});
