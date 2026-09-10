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
  WALK_COLS,
  WALK_DIRECTIONS,
  WALK_ROWS,
  animationsFromPosePlan,
  buildPropPrompt,
  buildWalkSheetPrompt,
  describeGridMismatch,
  describeWalkGridMismatch,
  buildSingleImagePrompt,
  buildSpriteSheetPrompt,
  buildTilePrompt,
  DEFAULT_STYLE,
} from '../../media/sprite-prompt';
import { cutOutSubject, rasterise } from '../../media/raster';
import { PICTURE_SUBJECTS } from '../../quiz/pictures';
import { buildMapLayout } from '../../explore/map-layout';
import {
  PROP_DESCRIPTIONS,
  PROP_KINDS,
  PROP_SIZE,
  PropKind,
  TERRAIN_DESCRIPTIONS,
  TERRAIN_IDS,
  TILE_SIZE,
  TerrainId,
  mapSketchSvg,
  propSvg,
  svgDataUrl,
  terrainTileSvg,
} from '../../explore/map-art';
import { SpriteCharacter } from '../../components/sprite-character/sprite-character';

type Tab = 'sprites' | 'landscape' | 'pictures' | 'sounds' | 'music' | 'keys';

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
      value === 'pictures' ||
      value === 'sounds' ||
      value === 'music' ||
      value === 'keys'
      ? value
      : 'sprites';
  });

  // The typed-in values are what the boxes edit; `hasGemini` and friends
  // resolve to the local key file when nothing has been typed.
  readonly savedGeminiKey = this.keys.savedGeminiKey;
  readonly savedElevenLabsKey = this.keys.savedElevenLabsKey;
  readonly geminiFromFile = this.keys.geminiFromFile;
  readonly elevenLabsFromFile = this.keys.elevenLabsFromFile;
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
  /**
   * Set when the analysed grid is not the grid that was asked for.
   *
   * Getting this wrong is silent and ruinous: a sheet read as 4×1 instead of
   * 4×2 still animates, but every frame index points at the wrong drawing, so
   * "celebrate" plays an idle pose. Saying so is far better than a preview that
   * looks plausible and is not.
   */
  readonly sheetProblem = signal<string | null>(null);

  // ── Walk sheet ─────────────────────────────────────────────────────────────

  /**
   * The eight-direction walk cycle the map uses.
   *
   * Separate from the pose sheet because it is a different grid and a different
   * question — and because a character saved without one still works: the map
   * falls back to the idle pose. It just does not turn.
   */
  readonly walkRawImage = signal<string | null>(null);
  readonly walkPreview = signal<CharacterDef | null>(null);
  readonly walkProblem = signal<string | null>(null);
  readonly hasWalkSheet = computed(() => !!this.character().walk);

  readonly walkPrompt = computed(() =>
    buildWalkSheetPrompt({
      character: this.characterPrompt(),
      style: this.stylePrompt(),
    }),
  );
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
   * The map is generated a piece at a time — one seamless tile per kind of
   * ground, one sprite per kind of scenery — rather than as a single painting.
   * An image model asked for one tree gets one tree right; asked for a whole
   * map with forty-seven clearings in exact places, it does not. The pieces are
   * also small enough to survive the `localStorage` quota, which a full-size
   * painting is not.
   */
  readonly mapLayout = buildMapLayout();
  readonly terrains = TERRAIN_IDS;
  readonly propKinds = PROP_KINDS;

  readonly mapStyle = signal(
    'soft anime and manga background art, gentle colour gradients, painted light, ' +
      'clean shapes, warm and friendly, no outlines that look like clip art',
  );

  /** The whole layout at a glance, so it is obvious what is being dressed. */
  readonly mapPlan = computed(() => svgDataUrl(mapSketchSvg(this.mapLayout)));

  /** What the game currently uses for each piece, generated or drawn. */
  readonly tileRows = computed(() =>
    this.terrains.map((terrain) => ({
      id: terrain,
      description: TERRAIN_DESCRIPTIONS[terrain],
      generated: !!this.media.mapTile(terrain),
      src: this.media.mapTile(terrain) ?? svgDataUrl(terrainTileSvg(terrain)),
    })),
  );

  readonly propRows = computed(() =>
    this.propKinds.map((kind) => ({
      id: kind,
      description: PROP_DESCRIPTIONS[kind],
      generated: !!this.media.mapProp(kind),
      src: this.media.mapProp(kind) ?? svgDataUrl(propSvg(kind)),
    })),
  );

  readonly hasGeneratedMapArt = computed(
    () =>
      this.tileRows().some((row) => row.generated) ||
      this.propRows().some((row) => row.generated),
  );

  // ── Question pictures ──────────────────────────────────────────────────────

  /**
   * Every question that wants a picture, gathered by asking each pack for a lot
   * of questions and keeping the ones that name one. Spelling is the case that
   * needs it: a child who cannot yet read the word cannot be shown the word.
   */
  readonly pictureRows = computed(() => {
    this.media.pictures();
    return PICTURE_SUBJECTS.map((subject) => ({
      ...subject,
      src: this.media.picture(subject.id) ?? null,
    }));
  });

  readonly pictureCount = computed(
    () => this.pictureRows().filter((row) => row.src).length,
  );

  readonly pictureStyle = signal(
    'soft anime and manga illustration for young children, gentle colour ' +
      'gradients, painted light, friendly and clear',
  );

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
      // No aspect ratio: a 4-by-2 sheet wants 2:1, which the API does not
      // offer, and its default of 1408×768 is about 1.83:1 — near enough that
      // the cells stay close to square.
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
    this.sheetProblem.set(
      describeGridMismatch(normalised.plan.cols, normalised.plan.rows),
    );
    this.previewSheet.set({
      id: 'custom',
      name: 'Momo',
      sheet: normalised.sheet,
      animations: {
        idle: { frames: frameMap.idle, fps: 1.4, loop: true },
        correct: { frames: frameMap.correct, fps: 6, loop: false },
        wrong: { frames: frameMap.wrong, fps: 2.5, loop: false },
        celebrate: { frames: frameMap.celebrate, fps: 5, loop: true },
      },
    });
    const found = `Found ${normalised.sheet.frameCount} poses in a ${normalised.plan.cols}×${normalised.plan.rows} grid.`;
    if (this.sheetProblem()) this.notice.set(null);
    else this.notice.set(found);
  }

  async generateWalkSheet(): Promise<void> {
    await this.run('Drawing the walk cycle…', async () => {
      // 4 columns by 8 rows is 1:2, which the API does not offer; 9:16 is the
      // nearest it does and keeps the cells close to square.
      const image = await this.gemini.generateImage(this.walkPrompt(), {
        aspectRatio: '9:16',
      });
      this.walkRawImage.set(image.dataUrl);
      await this.analyseWalkSheet();
    });
  }

  async reanalyseWalk(): Promise<void> {
    if (!this.walkRawImage()) return;
    await this.run('Finding the walk frames…', () => this.analyseWalkSheet());
  }

  private async analyseWalkSheet(): Promise<void> {
    const source = this.walkRawImage();
    if (!source) return;

    const image = await loadImage(source);
    const normalised = normaliseSheet(imageToImageData(image));
    this.walkProblem.set(
      describeWalkGridMismatch(normalised.plan.cols, normalised.plan.rows),
    );

    const current = this.character();
    this.walkPreview.set({
      ...current,
      walk: {
        sheet: normalised.sheet,
        directions: WALK_DIRECTIONS.map((row) => row.id),
        fps: 8,
      },
    });
    if (!this.walkProblem()) {
      this.notice.set(
        `Found ${normalised.sheet.frameCount} walk frames in a ${normalised.plan.cols}×${normalised.plan.rows} grid.`,
      );
    }
  }

  /** Keeps the current character's poses and gives it the new walk cycle. */
  saveWalkSheet(): void {
    const preview = this.walkPreview();
    if (!preview || this.walkProblem()) return;
    try {
      this.media.setCharacter(preview);
      this.notice.set('Saved! She walks with that now.');
      this.error.set(null);
    } catch (error) {
      this.error.set(messageOf(error));
    }
  }

  saveCharacter(): void {
    const character = this.previewSheet();
    if (!character) return;
    try {
      // Keep any walk cycle already saved: the pose sheet and the walk sheet
      // are generated separately, and replacing one should not lose the other.
      this.media.setCharacter({ ...character, walk: this.character().walk });
      this.notice.set(
        this.character().walk
          ? 'Saved! Your character is now in the game.'
          : 'Saved! Make a walk cycle too, so she turns as she walks the map.',
      );
      this.error.set(null);
    } catch (error) {
      this.error.set(messageOf(error));
    }
  }

  // ── Landscape ──────────────────────────────────────────────────────────────

  /**
   * A seamless ground tile.
   *
   * "Seamless" is the whole job here and the only thing worth checking in the
   * result: a tile with a visible edge repeats into a grid, which is far more
   * obvious than any amount of pretty texture is nice.
   */
  async generateTile(terrain: string): Promise<void> {
    await this.run(`Making the ${terrain} ground…`, async () => {
      const image = await this.gemini.generateImage(
        buildTilePrompt(TERRAIN_DESCRIPTIONS[terrain as TerrainId], this.mapStyle()),
        // Square, or the tile arrives stretched and repeats as stretched.
        { aspectRatio: '1:1' },
      );
      const src = await rasterise(image.dataUrl, {
        width: TILE_SIZE,
        height: TILE_SIZE,
        type: 'image/jpeg',
        quality: 0.82,
      });
      this.media.setMapTile(terrain, { src });
      this.notice.set(`Saved the ${terrain} ground.`);
    });
  }

  /** One scenery sprite, on a transparent background so it sits on any tile. */
  async generateProp(kind: string): Promise<void> {
    await this.run(`Drawing the ${kind}…`, async () => {
      const image = await this.gemini.generateImage(
        buildPropPrompt(PROP_DESCRIPTIONS[kind as PropKind], this.mapStyle()),
        { aspectRatio: '1:1' },
      );
      // Knocking the flat background out to transparency is the same trick the
      // sprite sheet uses; without it every prop sits in a white box.
      const source = imageToImageData(await loadImage(image.dataUrl));
      const cut = cutOutSubject(source, { padding: 6 });
      const src = await rasterise(cut, {
        width: PROP_SIZE * 2,
        height: PROP_SIZE * 2,
        type: 'image/png',
      });
      this.media.setMapProp(kind, { src });
      this.notice.set(`Saved the ${kind}.`);
    });
  }

  clearMapArt(): void {
    this.media.clearMap();
    this.notice.set('Back to the drawn landscape.');
  }

  // ── Question pictures ──────────────────────────────────────────────────────

  async generatePicture(subject: { id: string; label: string }): Promise<void> {
    await this.run(`Drawing "${subject.label}"…`, async () => {
      const image = await this.gemini.generateImage(
        buildSingleImagePrompt(
          `A single clear picture of ${subject.label}, filling the frame`,
          this.pictureStyle(),
        ),
        { aspectRatio: '1:1' },
      );
      const source = imageToImageData(await loadImage(image.dataUrl));
      const cut = cutOutSubject(source, { padding: 8 });
      const src = await rasterise(cut, {
        width: 256,
        height: 256,
        type: 'image/png',
      });
      this.media.setPicture(subject.id, { src });
    });
  }

  /**
   * Everything missing, one after another. Forty-odd calls is a lot to start by
   * accident, so the button says how many and the work stops at the first
   * failure rather than burning through a rate limit.
   */
  async generateMissingPictures(): Promise<void> {
    const missing = this.pictureRows().filter((row) => !row.src);
    await this.run(`Drawing ${missing.length} pictures…`, async () => {
      for (const [index, subject] of missing.entries()) {
        this.busy.set(`Drawing "${subject.label}" (${index + 1} of ${missing.length})…`);
        const image = await this.gemini.generateImage(
          buildSingleImagePrompt(
            `A single clear picture of ${subject.label}, filling the frame`,
            this.pictureStyle(),
          ),
          { aspectRatio: '1:1' },
        );
        const source = imageToImageData(await loadImage(image.dataUrl));
        const cut = cutOutSubject(source, { padding: 8 });
        this.media.setPicture(subject.id, {
          src: await rasterise(cut, { width: 256, height: 256, type: 'image/png' }),
        });
      }
      this.notice.set(`Drew ${missing.length} pictures.`);
    });
  }

  clearPictures(): void {
    for (const row of this.pictureRows()) {
      if (row.src) this.media.setPicture(row.id, null);
    }
    this.notice.set('Pictures removed; questions show their emoji again.');
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

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
