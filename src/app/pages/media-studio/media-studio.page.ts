import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AppPathPatterns, Views } from '../../app.config';
import { RoutingService } from '../../routing/routing.service';
import { AudioService } from '../../core/audio.service';
import { ApiKeysService } from '../../media/api-keys.service';
import { ElevenLabsService } from '../../media/elevenlabs.service';
import { GeminiImageService } from '../../media/gemini-image.service';
import { LyriaService } from '../../media/lyria.service';
import { MediaService } from '../../media/media.service';
import {
  AnimationName,
  CharacterDef,
  SOUND_IDS,
  SOUND_LABELS,
  SoundId,
} from '../../media/media.types';
import { GridPlan } from '../../media/sprite-grid';
import {
  imageToImageData,
  loadImage,
  normaliseSheet,
} from '../../media/sprite-sheet';
import {
  animationsFromPosePlan,
  buildMapPrompt,
  buildSpriteSheetPrompt,
  DEFAULT_STYLE,
} from '../../media/sprite-prompt';
import { approximateBytes, rasterise } from '../../media/raster';
import { findChallenge } from '../../quiz/challenges';
import { buildMapLayout } from '../../explore/map-layout';
import { mapSvg } from '../../explore/map-art';
import { SpriteCharacter } from '../../components/sprite-character/sprite-character';

type Tab = 'sprites' | 'landscape' | 'sounds' | 'music' | 'keys';

/** Suggested prompts per sound, so the studio is usable without inventing them. */
const SOUND_PROMPTS: Record<SoundId, string> = {
  correct: 'A short bright magical chime with sparkles, cheerful, rewarding, for a childrens game',
  wrong: 'A gentle soft descending boop, kind and encouraging, not harsh, for a childrens game',
  prize: 'A happy triumphant fanfare with sparkles and a little cheer, short, for a childrens game',
  levelUp: 'A rising magical whoosh ending in a bright chime, celebratory, short',
  tap: 'A tiny soft pop click, very short, gentle UI sound',
  finish: 'A short happy celebratory jingle with bells, warm and encouraging',
};

@Component({
  selector: 'app-media-studio-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpriteCharacter],
  templateUrl: './media-studio.page.html',
  styleUrl: './media-studio.page.scss',
})
export class MediaStudioPage {
  private readonly router: RoutingService<AppPathPatterns> =
    inject(RoutingService<AppPathPatterns>);
  private readonly keys = inject(ApiKeysService);
  private readonly gemini = inject(GeminiImageService);
  private readonly elevenLabs = inject(ElevenLabsService);
  private readonly lyria = inject(LyriaService);
  private readonly media = inject(MediaService);
  private readonly audio = inject(AudioService);

  private readonly tabParam = this.router.signals[Views.MediaStudio].urlParams.tab;
  readonly tab = computed<Tab>(() => {
    const value = this.tabParam();
    return value === 'landscape' ||
      value === 'sounds' ||
      value === 'music' ||
      value === 'keys'
      ? value
      : 'sprites';
  });

  readonly geminiKey = this.keys.geminiKey;
  readonly elevenLabsKey = this.keys.elevenLabsKey;
  readonly hasGemini = this.keys.hasGemini;
  readonly hasElevenLabs = this.keys.hasElevenLabs;

  readonly character = this.media.character;
  readonly isCustomised = this.media.isCustomised;
  readonly pack = this.media.pack;

  readonly soundIds = SOUND_IDS;
  readonly soundLabels = SOUND_LABELS;
  readonly homeHref = computed(() => this.router.hrefForView(Views.Home));

  // ── Sprite generation state ────────────────────────────────────────────────
  readonly characterPrompt = signal(
    'a fluffy orange fox cub wearing a red scarf, big friendly eyes',
  );
  readonly stylePrompt = signal(DEFAULT_STYLE);
  readonly rawImage = signal<string | null>(null);
  readonly previewSheet = signal<CharacterDef | null>(null);
  readonly plan = signal<GridPlan | null>(null);
  readonly previewAnimation = signal<AnimationName>('idle');

  readonly busy = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  readonly fullPrompt = computed(() =>
    buildSpriteSheetPrompt({
      character: this.characterPrompt(),
      style: this.stylePrompt(),
    }),
  );

  readonly planSummary = computed(() => {
    const plan = this.plan();
    if (!plan) return null;
    return {
      frames: plan.placements.length,
      cols: plan.cols,
      rows: plan.rows,
      cell: `${plan.cellWidth}×${plan.cellHeight}`,
    };
  });

  // ── Sound state ────────────────────────────────────────────────────────────
  readonly soundPrompts = signal<Record<string, string>>({ ...SOUND_PROMPTS });
  readonly musicPrompt = signal(
    'gentle cheerful playful background music for a childrens learning game, ' +
      'soft marimba and light bells, warm and encouraging, not distracting',
  );
  readonly musicSeconds = signal(20);

  readonly animationNames: AnimationName[] = ['idle', 'correct', 'wrong', 'celebrate'];

  // ── Landscape state ────────────────────────────────────────────────────────

  /**
   * The map's own geometry. Both the sketch the model is shown and the prompt
   * describing it come from here, which is what keeps a generated painting
   * lined up with the signposts the game actually places.
   */
  readonly mapLayout = buildMapLayout();
  readonly mapStyle = signal(
    'soft watercolour storybook map, hand-painted, warm and friendly, seen from above',
  );
  readonly mapSketch = computed(() =>
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(mapSvg(this.mapLayout, { labelled: true }))}`,
  );
  readonly generatedMap = signal<string | null>(null);
  readonly savedMap = computed(() => this.media.pack().map?.src ?? null);

  readonly mapPrompt = computed(() =>
    buildMapPrompt(
      this.mapLayout.spots.map((spot) => ({
        number: spot.index + 1,
        name: findChallenge(spot.challengeId)?.challenge.name ?? spot.challengeId,
        region:
          this.mapLayout.regions.find((region) => region.id === spot.regionId)
            ?.name ?? spot.regionId,
      })),
      this.mapLayout.regions.map((region) => ({
        name: region.name,
        terrain: TERRAIN_DESCRIPTIONS[region.terrain],
      })),
      this.mapStyle(),
    ),
  );

  readonly generatedMapSize = computed(() => {
    const map = this.generatedMap();
    return map ? Math.round(approximateBytes(map) / 1024) : 0;
  });

  setTab(tab: Tab): void {
    this.tabParam.set(tab);
    this.error.set(null);
    this.notice.set(null);
  }

  go(event: Event, href: string): void {
    const mouse = event as MouseEvent;
    if (mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.button > 0) return;
    event.preventDefault();
    this.router.navigateTo(href, { clearUrlParams: true });
  }

  // ── Sprites ────────────────────────────────────────────────────────────────

  async generateSprites(): Promise<void> {
    await this.run('Drawing your character…', async () => {
      const image = await this.gemini.generateImage(this.fullPrompt());
      this.rawImage.set(image.dataUrl);
      await this.analyseCurrentImage();
    });
  }

  /** Lets an image generated elsewhere be dropped straight into the pipeline. */
  async onFileChosen(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    await this.run('Reading the picture…', async () => {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Could not read that file.'));
        reader.readAsDataURL(file);
      });
      this.rawImage.set(dataUrl);
      await this.analyseCurrentImage();
    });
    input.value = '';
  }

  async reanalyse(): Promise<void> {
    if (!this.rawImage()) return;
    await this.run('Finding the sprites…', () => this.analyseCurrentImage());
  }

  private async analyseCurrentImage(): Promise<void> {
    const source = this.rawImage();
    if (!source) return;

    const image = await loadImage(source);
    const normalised = normaliseSheet(imageToImageData(image));
    const frameMap = animationsFromPosePlan(normalised.sheet.frameCount);

    this.plan.set(normalised.plan);
    this.previewSheet.set({
      id: 'custom',
      name: 'My character',
      sheet: normalised.sheet,
      animations: {
        idle: { frames: frameMap.idle, fps: 1.4, loop: true },
        correct: { frames: frameMap.correct, fps: 6, loop: false },
        wrong: { frames: frameMap.wrong, fps: 2.5, loop: false },
        celebrate: { frames: frameMap.celebrate, fps: 5, loop: true },
      },
    });
    this.notice.set(
      `Found ${normalised.sheet.frameCount} poses in a ${normalised.plan.cols}×${normalised.plan.rows} grid.`,
    );
  }

  saveCharacter(): void {
    const character = this.previewSheet();
    if (!character) return;
    try {
      this.media.setCharacter(character);
      this.notice.set('Saved! Your character is now in the game.');
      this.error.set(null);
    } catch (error) {
      this.error.set(messageOf(error));
    }
  }

  // ── Landscape ──────────────────────────────────────────────────────────────

  async generateMap(): Promise<void> {
    await this.run('Painting the landscape…', async () => {
      // The sketch goes as a PNG rather than the SVG: it is what the model can
      // read, and rendering it here means what is sent is exactly what is shown
      // on the page above the button.
      const sketch = await rasterise(this.mapSketch(), {
        width: this.mapLayout.width,
        height: this.mapLayout.height,
        type: 'image/png',
        background: '#ffffff',
      });
      const image = await this.gemini.generateImage(this.mapPrompt(), {
        dataUrl: sketch,
        mimeType: 'image/png',
      });
      // Down to the size the map is actually drawn at before it goes anywhere
      // near localStorage — a full-size PNG data URI will trip the quota.
      this.generatedMap.set(
        await rasterise(image.dataUrl, {
          width: this.mapLayout.width,
          height: this.mapLayout.height,
          type: 'image/jpeg',
          quality: 0.82,
          background: '#cdeccb',
        }),
      );
    });
  }

  saveMap(): void {
    const map = this.generatedMap();
    if (!map) return;
    try {
      this.media.setMap({ src: map });
      this.notice.set('Saved! The map now uses your landscape.');
      this.error.set(null);
    } catch (error) {
      this.error.set(messageOf(error));
    }
  }

  clearMap(): void {
    try {
      this.media.setMap(null);
      this.generatedMap.set(null);
      this.notice.set('Back to the drawn landscape.');
      this.error.set(null);
    } catch (error) {
      this.error.set(messageOf(error));
    }
  }

  // ── Sounds ─────────────────────────────────────────────────────────────────

  soundPromptFor(id: SoundId): string {
    return this.soundPrompts()[id] ?? '';
  }

  setSoundPrompt(id: SoundId, value: string): void {
    this.soundPrompts.update((prompts) => ({ ...prompts, [id]: value }));
  }

  async generateSound(id: SoundId): Promise<void> {
    await this.run(`Making the ${SOUND_LABELS[id].toLowerCase()} sound…`, async () => {
      const dataUrl = await this.elevenLabs.generateSound(this.soundPromptFor(id), {
        durationSeconds: id === 'tap' ? 0.5 : 2,
        promptInfluence: 0.5,
      });
      this.media.setSound(id, { src: dataUrl });
      this.audio.play(id);
      this.notice.set(`Saved a new "${SOUND_LABELS[id]}" sound.`);
    });
  }

  preview(id: SoundId): void {
    this.audio.play(id);
  }

  resetSound(id: SoundId): void {
    // Dropping the override falls back to the shipped default for that sound.
    this.media.setSound(id, undefined);
    this.media.resetToDefaults();
    this.notice.set('Restored the built-in sounds.');
  }

  // ── Music ──────────────────────────────────────────────────────────────────

  async generateMusic(): Promise<void> {
    await this.run(
      `Composing ${this.musicSeconds()} seconds of music… this takes a while.`,
      async () => {
        const dataUrl = await this.lyria.generateMusicLoop(this.musicPrompt(), {
          seconds: this.musicSeconds(),
        });
        this.media.setMusic({ src: dataUrl, volume: 0.3 });
        this.notice.set('Saved a new background track. Turn music on in Settings.');
      },
    );
  }

  // ── Pack import / export ───────────────────────────────────────────────────

  exportPack(): void {
    const blob = new Blob([this.media.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'media-pack.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  async importPack(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      this.media.importJson(await file.text());
      this.notice.set('Media pack loaded.');
      this.error.set(null);
    } catch (error) {
      this.error.set(messageOf(error));
    }
    input.value = '';
  }

  resetAll(): void {
    this.media.resetToDefaults();
    this.previewSheet.set(null);
    this.rawImage.set(null);
    this.plan.set(null);
    this.notice.set('Restored all the built-in pictures and sounds.');
  }

  clearKeys(): void {
    this.keys.clearAll();
    this.notice.set('API keys removed from this device.');
  }

  private async run(label: string, work: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(label);
    this.error.set(null);
    this.notice.set(null);
    try {
      await work();
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.busy.set(null);
    }
  }
}

/** How the prompt should describe each kind of ground. */
const TERRAIN_DESCRIPTIONS: Record<string, string> = {
  hills: 'rolling grassy hills with little winding paths',
  water: 'a chain of bright blue ponds with reeds and lily pads',
  forest: 'a friendly wood full of round leafy trees',
  village: 'a tiny village of little cottages with a cobbled square',
  meadow: 'a wildflower meadow with butterflies and long grass',
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
