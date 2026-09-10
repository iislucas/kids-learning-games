import { Injectable, computed, signal } from '@angular/core';
import { readJson, removeKey, storedSignal, writeJson } from '../core/stored-signal';
import { defaultMediaPack } from './default-pack';
import { CharacterDef, ImageDef, MediaPack, SoundDef, SoundId } from './media.types';

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

  /**
   * Which character has been picked, kept apart from the media pack.
   *
   * The pack carries an `activeCharacterId` too, but that belongs to the pack —
   * it travels with an export. Choosing between the characters that ship with
   * the game is a preference of *this device*, and storing it here means
   * picking one does not write a whole pack override and light up "you are
   * using custom media".
   */
  private readonly chosenCharacterId = storedSignal<string>('klg.character', '');

  readonly characters = computed(() => this.pack().characters);

  /** True when there is a choice to offer at all. */
  readonly hasSeveralCharacters = computed(() => this.characters().length > 1);

  chooseCharacter(id: string): void {
    this.chosenCharacterId.set(id);
  }

  isChosen(id: string): boolean {
    return this.character().id === id;
  }

  readonly character = computed<CharacterDef>(() => {
    const pack = this.pack();
    const chosen = this.chosenCharacterId();
    return (
      // A choice made on this device wins, but only while it still names a
      // character the pack has — importing a pack without it falls back rather
      // than leaving the game with no character at all.
      (chosen ? pack.characters.find((c) => c.id === chosen) : undefined) ??
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
    // Otherwise a character picked earlier would keep overriding the one just
    // made, which looks like the save having failed.
    this.chooseCharacter(character.id);
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

  // ── Map art ────────────────────────────────────────────────────────────────

  readonly map = computed(() => this.pack().map ?? {});

  /** A whole-map painting, or null to fall back to tiles and props. */
  setMapBackground(background: ImageDef | null): void {
    this.update((pack) => ({ ...pack, map: { ...pack.map, background } }));
  }

  setMapTile(terrain: string, tile: ImageDef | null): void {
    this.update((pack) => ({
      ...pack,
      map: { ...pack.map, tiles: withEntry(pack.map?.tiles, terrain, tile) },
    }));
  }

  setMapProp(kind: string, prop: ImageDef | null): void {
    this.update((pack) => ({
      ...pack,
      map: { ...pack.map, props: withEntry(pack.map?.props, kind, prop) },
    }));
  }

  mapTile(terrain: string): string | undefined {
    return this.map().tiles?.[terrain]?.src;
  }

  mapProp(kind: string): string | undefined {
    return this.map().props?.[kind]?.src;
  }

  /** Everything generated for the map thrown away, back to the drawn one. */
  clearMap(): void {
    this.update((pack) => ({ ...pack, map: null }));
  }

  // ── Question pictures ──────────────────────────────────────────────────────

  readonly pictures = computed(() => this.pack().pictures ?? {});

  picture(id: string): string | undefined {
    return this.pictures()[id]?.src;
  }

  setPicture(id: string, picture: ImageDef | null): void {
    this.update((pack) => ({
      ...pack,
      pictures: withEntry(pack.pictures, id, picture) ?? {},
    }));
  }

  resetToDefaults(): void {
    removeKey(STORAGE_KEY);
    this.overridePack.set(null);
    // The chosen character may not exist in the built-in pack; `character`
    // falls back safely, but clearing it keeps the stored state honest.
    this.chosenCharacterId.set('');
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

/**
 * Sets or removes one entry in an optional record, returning undefined once it
 * is empty so an untouched pack does not carry an empty object around.
 */
function withEntry(
  record: Partial<Record<string, ImageDef>> | undefined,
  key: string,
  value: ImageDef | null,
): Partial<Record<string, ImageDef>> | undefined {
  const next = { ...(record ?? {}) };
  if (value) next[key] = value;
  else delete next[key];
  return Object.keys(next).length > 0 ? next : undefined;
}
