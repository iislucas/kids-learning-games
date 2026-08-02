import { Injectable, computed } from '@angular/core';
import { storedSignal } from '../core/stored-signal';

/**
 * Holds the API keys used by the media studio.
 *
 * These live in localStorage on the device, and are sent directly from the
 * browser to Google / ElevenLabs — there is no backend and nothing is
 * transmitted anywhere else. That is fine for a personal machine, and is the
 * reason the studio is a private authoring tool rather than something to
 * expose on a shared or public deployment. The game itself never reads these:
 * it plays the committed default pack, or whatever you saved from the studio.
 */
@Injectable({ providedIn: 'root' })
export class ApiKeysService {
  readonly geminiKey = storedSignal<string>('klg.keys.gemini', '');
  readonly elevenLabsKey = storedSignal<string>('klg.keys.elevenlabs', '');

  readonly hasGemini = computed(() => this.geminiKey().trim().length > 0);
  readonly hasElevenLabs = computed(() => this.elevenLabsKey().trim().length > 0);

  clearAll(): void {
    this.geminiKey.set('');
    this.elevenLabsKey.set('');
  }
}
