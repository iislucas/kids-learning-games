import { Injectable, effect, inject, untracked } from '@angular/core';
import { Howl, Howler } from 'howler';
import { MediaService } from '../media/media.service';
import { SoundId } from '../media/media.types';
import { storedSignal } from './stored-signal';

/**
 * All sound playback.
 *
 * Howler is here specifically for its mobile handling: iOS and Android refuse
 * to start audio outside a user gesture, and Howler's unlock handling plus its
 * pooled playback (so rapid-fire correct answers overlap instead of cutting
 * each other off) is the whole reason not to use bare Audio elements.
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
  private readonly media = inject(MediaService);

  readonly soundsEnabled = storedSignal('klg.audio.sounds', true);
  /** Off by default — background music is divisive, and it is a big download. */
  readonly musicEnabled = storedSignal('klg.audio.music', false);

  private readonly cache = new Map<string, Howl>();
  private music: Howl | null = null;
  private musicSrc: string | null = null;

  constructor() {
    // Rebuild cached Howls whenever the media pack changes, so swapping a
    // sound in the studio takes effect without a reload.
    effect(() => {
      this.media.pack();
      untracked(() => this.disposeSounds());
    });

    effect(() => {
      const enabled = this.musicEnabled();
      const track = this.media.pack().music;
      untracked(() => this.syncMusic(enabled, track?.src ?? null, track?.volume));
    });
  }

  play(id: SoundId): void {
    if (!this.soundsEnabled()) return;
    const def = this.media.sound(id);
    if (!def?.src) return;

    try {
      let howl = this.cache.get(def.src);
      if (!howl) {
        howl = new Howl({
          src: [def.src],
          // Data URIs carry no file extension, so Howler cannot sniff the
          // format and needs to be told.
          format: formatsFor(def.src),
          volume: def.volume ?? 1,
          preload: true,
          html5: false,
        });
        this.cache.set(def.src, howl);
      }
      howl.play();
    } catch {
      // A missing or malformed asset must never break the game loop.
    }
  }

  toggleSounds(): void {
    this.soundsEnabled.set(!this.soundsEnabled());
  }

  toggleMusic(): void {
    this.musicEnabled.set(!this.musicEnabled());
  }

  private syncMusic(
    enabled: boolean,
    src: string | null,
    volume: number | undefined,
  ): void {
    if (!enabled || !src) {
      this.music?.stop();
      this.music?.unload();
      this.music = null;
      this.musicSrc = null;
      return;
    }
    if (this.music && this.musicSrc === src) {
      if (!this.music.playing()) this.music.play();
      return;
    }

    this.music?.stop();
    this.music?.unload();
    try {
      this.music = new Howl({
        src: [src],
        format: formatsFor(src),
        loop: true,
        volume: volume ?? 0.3,
        // Streamed rather than fully decoded: the loop is long, and decoding it
        // into memory stalls the first interaction on low-end phones.
        html5: true,
      });
      this.musicSrc = src;
      this.music.play();
    } catch {
      this.music = null;
      this.musicSrc = null;
    }
  }

  private disposeSounds(): void {
    for (const howl of this.cache.values()) {
      howl.unload();
    }
    this.cache.clear();
  }

  /** Muted globally, e.g. when the tab is hidden. */
  setGlobalMute(muted: boolean): void {
    Howler.mute(muted);
  }
}

function formatsFor(src: string): string[] {
  const match = /^data:audio\/([a-z0-9.+-]+)/i.exec(src);
  if (match) {
    const subtype = match[1].toLowerCase();
    if (subtype === 'mpeg' || subtype === 'mp3') return ['mp3'];
    if (subtype === 'wav' || subtype === 'x-wav' || subtype === 'wave') return ['wav'];
    if (subtype === 'ogg') return ['ogg'];
    return [subtype];
  }
  const extension = src.split('?')[0].split('.').pop()?.toLowerCase();
  return extension ? [extension] : ['wav'];
}
