import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { AnimationName, CharacterDef } from '../../media/media.types';

/**
 * Plays one animation from a sprite sheet.
 *
 * The sheet is a CSS background stepped with `background-position`, which is
 * why `normaliseSheet` goes to the trouble of producing a perfectly uniform
 * grid. Sizing in percentages rather than pixels means the same sheet scales to
 * any display size without recomputing anything.
 *
 * A non-looping animation returns to `idle` when it ends, so callers can fire
 * "correct!" and forget about it.
 */
@Component({
  selector: 'app-sprite-character',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="sprite"
      role="img"
      [attr.aria-label]="label()"
      [style.width.px]="width()"
      [style.height.px]="height()"
      [style.background-image]="'url(' + character().sheet.src + ')'"
      [style.background-size]="backgroundSize()"
      [style.background-position]="backgroundPosition()"
    ></div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .sprite {
        background-repeat: no-repeat;
        /* Sprite art should stay crisp rather than being smoothed when scaled
           up on a big screen. */
        image-rendering: -webkit-optimize-contrast;
        will-change: background-position;
      }
    `,
  ],
})
export class SpriteCharacter {
  readonly character = input.required<CharacterDef>();
  readonly animation = input<AnimationName>('idle');
  /** Rendered width in CSS pixels; height follows the cell aspect ratio. */
  readonly size = input(200);

  private readonly frameIndex = signal(0);
  private readonly playing = signal<AnimationName>('idle');
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly width = computed(() => this.size());
  readonly height = computed(() => {
    const sheet = this.character().sheet;
    if (!sheet.cellWidth) return this.size();
    return Math.round((this.size() * sheet.cellHeight) / sheet.cellWidth);
  });

  readonly label = computed(
    () => `${this.character().name}, ${this.playing()}`,
  );

  readonly backgroundSize = computed(() => {
    const { cols, rows } = this.character().sheet;
    return `${Math.max(cols, 1) * 100}% ${Math.max(rows, 1) * 100}%`;
  });

  readonly backgroundPosition = computed(() => {
    const sheet = this.character().sheet;
    const cols = Math.max(sheet.cols, 1);
    const rows = Math.max(sheet.rows, 1);
    const frame = this.currentFrame();
    const col = frame % cols;
    const row = Math.floor(frame / cols);
    // With background-size at N*100%, positions are fractions of (N-1) steps.
    const x = cols > 1 ? (col / (cols - 1)) * 100 : 0;
    const y = rows > 1 ? (row / (rows - 1)) * 100 : 0;
    return `${x}% ${y}%`;
  });

  private readonly currentFrame = computed(() => {
    const animation = this.character().animations[this.playing()];
    const frames = animation?.frames ?? [0];
    if (frames.length === 0) return 0;
    const frame = frames[Math.min(this.frameIndex(), frames.length - 1)];
    // Guard against a hand-edited pack referencing frames off the end of the
    // sheet, which would otherwise show blank.
    return Math.min(frame, Math.max(this.character().sheet.frameCount - 1, 0));
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());

    effect(() => {
      const requested = this.animation();
      this.character();
      untracked(() => this.start(requested));
    });
  }

  private start(name: AnimationName): void {
    this.stop();
    this.playing.set(name);
    this.frameIndex.set(0);

    const animation = this.character().animations[name];
    if (!animation || animation.frames.length <= 1) return;

    const interval = 1000 / Math.max(animation.fps, 0.1);
    this.timer = setInterval(() => {
      const next = this.frameIndex() + 1;
      if (next < animation.frames.length) {
        this.frameIndex.set(next);
        return;
      }
      if (animation.loop) {
        this.frameIndex.set(0);
        return;
      }
      // One-shot finished: settle back into idle so the caller does not have
      // to remember to reset it.
      this.stop();
      if (name !== 'idle') this.start('idle');
    }, interval);
  }

  private stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
