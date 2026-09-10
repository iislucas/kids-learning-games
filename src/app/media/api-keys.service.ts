import { Injectable, computed, isDevMode, signal } from '@angular/core';
import { storedSignal } from '../core/stored-signal';
import { assetUrl } from './default-pack';

/**
 * The file keys can be kept in, so they survive a cleared browser and do not
 * have to be pasted in again every time.
 *
 * `public/local-keys.json`, git-ignored, copied from
 * `public/local-keys.example.json`. It is read **only when running the dev
 * server**, and `scripts/prepare-pages.mts` refuses to build the site if it
 * ever turns up in the output — the deployed game is public, and a key in it
 * would be a key given away.
 */
const LOCAL_KEYS_FILE = 'local-keys.json';

interface LocalKeys {
  gemini?: string;
  elevenLabs?: string;
}

/**
 * Holds the API keys used by the media studio.
 *
 * A key comes from one of two places: typed into the studio and kept in this
 * browser's localStorage, or read from the local file above. What is typed
 * wins, so a key can always be overridden on the device without editing files.
 *
 * The file's value is deliberately **not** copied into localStorage. Keeping it
 * out means the file stays the single source of truth: delete it and the key is
 * gone, rather than lingering invisibly in a browser you have to remember to
 * clear.
 *
 * Keys are sent directly from the browser to Google / ElevenLabs — there is no
 * backend and nothing is transmitted anywhere else. That is fine for a personal
 * machine, and is the reason the studio is a private authoring tool rather than
 * something to expose on a shared or public deployment. The game itself never
 * reads these: it plays the committed default pack, or whatever you saved from
 * the studio.
 */
@Injectable({ providedIn: 'root' })
export class ApiKeysService {
  /** What has been typed into the studio and kept in this browser. */
  readonly savedGeminiKey = storedSignal<string>('klg.keys.gemini', '');
  readonly savedElevenLabsKey = storedSignal<string>('klg.keys.elevenlabs', '');

  private readonly fileKeys = signal<LocalKeys>({});

  /** True when a key is coming from the file rather than from this browser. */
  readonly geminiFromFile = computed(
    () => !this.savedGeminiKey().trim() && !!this.fileKeys().gemini?.trim(),
  );
  readonly elevenLabsFromFile = computed(
    () => !this.savedElevenLabsKey().trim() && !!this.fileKeys().elevenLabs?.trim(),
  );

  /** The key actually used: what was typed, otherwise the file. */
  readonly geminiKey = computed(
    () => this.savedGeminiKey().trim() || this.fileKeys().gemini?.trim() || '',
  );
  readonly elevenLabsKey = computed(
    () => this.savedElevenLabsKey().trim() || this.fileKeys().elevenLabs?.trim() || '',
  );

  readonly hasGemini = computed(() => this.geminiKey().length > 0);
  readonly hasElevenLabs = computed(() => this.elevenLabsKey().length > 0);

  constructor() {
    // Development only. In a production build this never runs, so there is no
    // request for the file and nothing to find even if one were deployed.
    if (isDevMode()) void this.loadLocalKeys();
  }

  private async loadLocalKeys(): Promise<void> {
    try {
      const response = await fetch(assetUrl(LOCAL_KEYS_FILE));
      if (!response.ok) return;
      const parsed: unknown = await response.json();
      if (parsed && typeof parsed === 'object') {
        const { gemini, elevenLabs } = parsed as LocalKeys;
        this.fileKeys.set({
          gemini: typeof gemini === 'string' ? gemini : undefined,
          elevenLabs: typeof elevenLabs === 'string' ? elevenLabs : undefined,
        });
      }
    } catch {
      // No file, or not JSON. It is entirely optional — the studio still works
      // with a key typed in, so there is nothing to report.
    }
  }

  /** Clears the keys held in this browser. The file is not ours to delete. */
  clearAll(): void {
    this.savedGeminiKey.set('');
    this.savedElevenLabsKey.set('');
  }
}
