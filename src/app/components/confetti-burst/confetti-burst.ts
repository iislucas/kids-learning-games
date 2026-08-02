import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';

interface Piece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  colour: string;
  rotation: number;
  emoji: string | null;
}

const COLOURS = ['#ffc53f', '#7a5cf0', '#1fa97a', '#e8484f', '#4f8ff7', '#ff8fc7'];
const EMOJI = ['⭐', '✨', '🎉', '💫'];

/**
 * A short celebratory burst, done with plain DOM elements and CSS keyframes.
 *
 * Deliberately not a canvas particle library: a couple of dozen absolutely
 * positioned divs animate on the compositor, cost nothing on a cheap phone, and
 * disappear entirely when `prefers-reduced-motion` is set.
 */
@Component({
  selector: 'app-confetti-burst',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="burst" aria-hidden="true">
      @for (piece of pieces(); track piece.id) {
        <span
          class="piece"
          [style.left.%]="piece.left"
          [style.animation-delay.ms]="piece.delay"
          [style.animation-duration.ms]="piece.duration"
          [style.--rot]="piece.rotation + 'deg'"
          [style.background]="piece.emoji ? 'transparent' : piece.colour"
          >{{ piece.emoji }}</span
        >
      }
    </div>
  `,
  styles: [
    `
      .burst {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
        z-index: 5;
      }

      .piece {
        position: absolute;
        top: -8%;
        width: 12px;
        height: 12px;
        border-radius: 3px;
        font-size: 22px;
        line-height: 1;
        animation-name: fall;
        animation-timing-function: cubic-bezier(0.2, 0.6, 0.5, 1);
        animation-fill-mode: both;
      }

      @keyframes fall {
        0% {
          transform: translateY(0) rotate(0deg) scale(0.6);
          opacity: 0;
        }
        12% {
          opacity: 1;
        }
        100% {
          transform: translateY(115vh) rotate(var(--rot)) scale(1);
          opacity: 0;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .piece {
          display: none;
        }
      }
    `,
  ],
})
export class ConfettiBurst {
  /** Increment this to fire a burst. */
  readonly trigger = input(0);
  readonly count = input(28);

  readonly pieces = signal<Piece[]>([]);
  private nextId = 0;
  private clearTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.clearTimer !== null) clearTimeout(this.clearTimer);
    });

    effect(() => {
      const trigger = this.trigger();
      untracked(() => {
        if (trigger > 0) this.fire();
      });
    });
  }

  private fire(): void {
    const pieces: Piece[] = [];
    for (let i = 0; i < this.count(); i++) {
      const useEmoji = i % 5 === 0;
      pieces.push({
        id: this.nextId++,
        left: Math.random() * 100,
        delay: Math.random() * 260,
        duration: 1400 + Math.random() * 900,
        colour: COLOURS[i % COLOURS.length],
        rotation: (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 540),
        emoji: useEmoji ? EMOJI[i % EMOJI.length] : null,
      });
    }
    this.pieces.set(pieces);

    // Drop the elements once they have fallen, so they do not accumulate.
    if (this.clearTimer !== null) clearTimeout(this.clearTimer);
    this.clearTimer = setTimeout(() => this.pieces.set([]), 2800);
  }
}
