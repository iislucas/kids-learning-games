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
import { CharacterDef } from '../../media/media.types';
import { Direction } from '../../explore/explorer';

/**
 * The character walking about the map, facing one of eight ways.
 *
 * Same trick as `SpriteCharacter` — a stepped `background-position` over a
 * uniform grid — but indexed by direction (row) and frame (column) rather than
 * by animation name.
 *
 * A media pack saved before walk sheets existed has no `walk`, so this falls
 * back to the first idle frame of the ordinary sheet. She then slides rather
 * than strides, which is a good deal better than a blank square.
 */
@Component({
  selector: 'app-walk-sprite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="walker"
      role="img"
      [attr.aria-label]="label()"
      [style.width.px]="width()"
      [style.height.px]="height()"
      [style.background-image]="'url(' + source().src + ')'"
      [style.background-size]="backgroundSize()"
      [style.background-position]="backgroundPosition()"
    ></div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .walker {
        background-repeat: no-repeat;
        image-rendering: -webkit-optimize-contrast;
        will-change: background-position;
      }
    `,
  ],
})
export class WalkSprite {
  readonly character = input.required<CharacterDef>();
  readonly direction = input<Direction>('s');
  /** Animates only while she is actually going somewhere. */
  readonly moving = input(false);
  readonly size = input(120);

  private readonly frameIndex = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;

  /** The walk sheet if the pack has one, otherwise the ordinary sheet. */
  private readonly walk = computed(() => this.character().walk ?? null);
  readonly source = computed(() => (this.walk() ?? this.character()).sheet);

  readonly width = computed(() => this.size());
  readonly height = computed(() => {
    const sheet = this.source();
    if (!sheet.cellWidth) return this.size();
    return Math.round((this.size() * sheet.cellHeight) / sheet.cellWidth);
  });

  readonly label = computed(
    () => `${this.character().name}, facing ${this.direction()}`,
  );

  readonly backgroundSize = computed(() => {
    const { cols, rows } = this.source();
    return `${Math.max(cols, 1) * 100}% ${Math.max(rows, 1) * 100}%`;
  });

  readonly backgroundPosition = computed(() => {
    const walk = this.walk();
    const sheet = this.source();
    const cols = Math.max(sheet.cols, 1);
    const rows = Math.max(sheet.rows, 1);

    // Without a walk sheet there is nothing to index into; frame 0 of the
    // ordinary sheet is the idle pose.
    const row = walk ? Math.max(walk.directions.indexOf(this.direction()), 0) : 0;
    const col = walk ? this.frameIndex() % cols : 0;

    const x = cols > 1 ? (col / (cols - 1)) * 100 : 0;
    const y = rows > 1 ? (Math.min(row, rows - 1) / (rows - 1)) * 100 : 0;
    return `${x}% ${y}%`;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());

    effect(() => {
      const moving = this.moving();
      const walk = this.walk();
      untracked(() => (moving && walk ? this.start(walk.fps) : this.rest()));
    });
  }

  private start(fps: number): void {
    this.stop();
    const interval = 1000 / Math.max(fps, 0.1);
    this.timer = setInterval(
      () => this.frameIndex.update((n) => n + 1),
      interval,
    );
  }

  /** Standing still shows the first frame of the row: feet together. */
  private rest(): void {
    this.stop();
    this.frameIndex.set(0);
  }

  private stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
