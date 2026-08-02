import { Injectable, computed, signal } from '@angular/core';
import { readJson, removeKey, writeJson } from '../core/stored-signal';
import { defaultMediaPack } from './default-pack';
import { CharacterDef, MediaPack, SoundDef, SoundId } from './media.types';

const STORAGE_KEY = 'klg.mediaPack';

/**
 * The single source of truth for what the game looks and sounds like.
 *
 * The repo default is always available; anything saved from the media studio is
 * layered on top and stored on the device. Nothing else in the app needs to
 * know whether a given asset was shipped or generated.
 *
 * Generated assets are large base64 data URIs, so a save can exceed the
 * localStorage quota — `saveOverride` reports that rather than failing silently
 * and leaving the studio showing edits that were never persisted.
 */
@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly overridePack = signal<MediaPack | null>(
    readJson<MediaPack | null>(STORAGE_KEY, null),
  );

  readonly pack = computed<MediaPack>(
    () => this.overridePack() ?? defaultMediaPack(),
  );

  readonly isCustomised = computed(() => this.overridePack() !== null);

  readonly character = computed<CharacterDef>(() => {
    const pack = this.pack();
    return (
      pack.characters.find((c) => c.id === pack.activeCharacterId) ??
      pack.characters[0] ??
      defaultMediaPack().characters[0]
    );
  });

  sound(id: SoundId): SoundDef | undefined {
    return this.pack().sounds[id];
  }

  /** Persists a whole pack. Throws if the browser refuses to store it. */
  saveOverride(pack: MediaPack): void {
    const before = localStorage.getItem(STORAGE_KEY);
    writeJson(STORAGE_KEY, pack);
    const after = localStorage.getItem(STORAGE_KEY);
    if (after === before) {
      throw new Error(
        'Could not save — the media is too large for browser storage. ' +
          'Try exporting the pack to a file instead, or generate a smaller sheet.',
      );
    }
    this.overridePack.set(pack);
  }

  /** Applies a change to the current pack and persists the result. */
  update(change: (pack: MediaPack) => MediaPack): void {
    this.saveOverride(change(structuredClone(this.pack())));
  }

  setCharacter(character: CharacterDef): void {
    this.update((pack) => {
      const others = pack.characters.filter((c) => c.id !== character.id);
      return {
        ...pack,
        characters: [...others, character],
        activeCharacterId: character.id,
      };
    });
  }

  setSound(id: SoundId, sound: SoundDef | undefined): void {
    this.update((pack) => {
      const sounds = { ...pack.sounds };
      if (sound) {
        sounds[id] = sound;
      } else {
        delete sounds[id];
      }
      return { ...pack, sounds };
    });
  }

  setMusic(music: SoundDef | null): void {
    this.update((pack) => ({ ...pack, music }));
  }

  resetToDefaults(): void {
    removeKey(STORAGE_KEY);
    this.overridePack.set(null);
  }

  exportJson(): string {
    return JSON.stringify(this.pack(), null, 2);
  }

  importJson(json: string): void {
    const parsed = JSON.parse(json) as MediaPack;
    if (parsed?.version !== 1 || !Array.isArray(parsed.characters)) {
      throw new Error('That does not look like a media pack file.');
    }
    this.saveOverride(parsed);
  }
}
