import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Prize } from '../../core/prizes';

interface Placed {
  id: string;
  emoji: string;
  name: string;
  left: number;
  top: number;
  size: number;
  rotation: number;
  isNew: boolean;
}

/** Slots across the screen. Enough columns that 30 prizes never overlap. */
const COLUMNS = 5;
const ROWS = 6;

/** Stable per-id jitter, so a prize never moves between renders. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/**
 * The order slots get filled.
 *
 * Filling row by row would pile the first dozen prizes into the top of the
 * screen and leave the bottom empty. Ordering by the golden-ratio sequence
 * spreads each new prize far from the last, so the backdrop looks balanced at
 * every collection size while each prize still keeps one fixed slot forever.
 */
const SLOT_ORDER: number[] = Array.from(
  { length: COLUMNS * ROWS },
  (_, i) => i,
).sort((a, b) => {
  const key = (n: number) => ((n + 1) * 0.618033988749895) % 1;
  return key(a) - key(b);
});

/**
 * Draws the prizes already won as a faint scatter behind the game.
 *
 * Prizes fill fixed slots in the order they were earned, rather than being
 * placed randomly: that way the backdrop visibly grows outward as the
 * collection does, and an existing prize never jumps to a new spot when a new
 * one arrives. Winning one mid-round pops it into place, so the reward is
 * felt where she is actually looking.
 */
@Component({
  selector: 'app-prize-backdrop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="backdrop" aria-hidden="true">
      @for (item of placed(); track item.id) {
        <span
          class="prize"
          [class.prize--new]="item.isNew"
          [style.left.%]="item.left"
          [style.top.%]="item.top"
          [style.font-size.px]="item.size"
          [style.--rot]="item.rotation + 'deg'"
          >{{ item.emoji }}</span
        >
      }
    </div>
  `,
  styles: [
    `
      .backdrop {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
        z-index: 0;
      }

      .prize {
        position: absolute;
        transform: translate(-50%, -50%) rotate(var(--rot));
        /* Faint enough to sit under the question without competing with it. */
        opacity: 0.22;
        line-height: 1;
        user-select: none;
      }

      /* A prize won this round lands with a pop and stays a little brighter,
         so the change is noticeable without stopping play. */
      .prize--new {
        opacity: 0.5;
        animation: land 0.7s cubic-bezier(0.2, 1.6, 0.4, 1) both;
      }

      @keyframes land {
        0% {
          transform: translate(-50%, -50%) rotate(var(--rot)) scale(0);
          opacity: 0;
        }
        60% {
          transform: translate(-50%, -50%) rotate(var(--rot)) scale(1.35);
          opacity: 0.7;
        }
        100% {
          transform: translate(-50%, -50%) rotate(var(--rot)) scale(1);
          opacity: 0.5;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .prize--new {
          animation: none;
        }
      }
    `,
  ],
})
export class PrizeBackdrop {
  /** Prizes already collected, in the order they were earned. */
  readonly prizes = input.required<readonly Prize[]>();
  /** Prizes won during this round, drawn brighter and animated in. */
  readonly highlightIds = input<readonly string[]>([]);

  readonly placed = computed<Placed[]>(() => {
    const highlights = new Set(this.highlightIds());
    const slots = COLUMNS * ROWS;

    return this.prizes().map((prize, index) => {
      // Wrapping past the last slot starts a second, offset pass rather than
      // stacking exactly on top of the first.
      const slot = SLOT_ORDER[index % slots];
      const pass = Math.floor(index / slots);
      const column = slot % COLUMNS;
      const row = Math.floor(slot / COLUMNS);

      const jitterX = hash(prize.id) - 0.5;
      const jitterY = hash(prize.id + 'y') - 0.5;

      return {
        id: prize.id,
        emoji: prize.emoji,
        name: prize.name,
        left: ((column + 0.5) / COLUMNS) * 100 + jitterX * 12 + pass * 4,
        top: ((row + 0.5) / ROWS) * 100 + jitterY * 10,
        size: 34 + Math.round(hash(prize.id + 's') * 20),
        rotation: Math.round((hash(prize.id + 'r') - 0.5) * 44),
        isNew: highlights.has(prize.id),
      };
    });
  });
}
