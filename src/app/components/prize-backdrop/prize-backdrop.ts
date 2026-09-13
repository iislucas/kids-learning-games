import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Prize } from '../../core/prizes';
import { Rect, stackSlots } from '../../core/prize-stack';

interface Placed {
  id: string;
  emoji: string;
  left: number;
  top: number;
  rotation: number;
  isNew: boolean;
}

interface Geometry {
  width: number;
  height: number;
  obstacles: Rect[];
}

/** Marks the things a prize must never sit underneath. */
export const PRIZE_AVOID_ATTRIBUTE = 'data-prize-avoid';

/** Cell size for the stack; the emoji itself is drawn a little smaller. */
const CELL = 48;

/** Stable per-id tilt, so a prize never wobbles between renders. */
function tilt(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.round(((h >>> 0) / 4294967296 - 0.5) * 30);
}

/**
 * Draws the prizes already won here, piled up behind the game.
 *
 * They are the real thing, not a watermark: fully opaque, so she can see how
 * much she has done. That is only bearable because none of them ever sits
 * under a card — the component measures everything in its container marked
 * `data-prize-avoid` and stacks the prizes, from the bottom up, into the
 * space that is left (see `prize-stack.ts`). Winning one mid-round pops it
 * into place, so the reward is felt where she is actually looking.
 */
@Component({
  selector: 'app-prize-backdrop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="backdrop" #backdrop aria-hidden="true">
      @for (item of placed(); track item.id) {
        <span
          class="prize"
          [class.prize--new]="item.isNew"
          [style.left.px]="item.left"
          [style.top.px]="item.top"
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
        font-size: 36px;
        line-height: 1;
        transform: translate(-50%, -50%) rotate(var(--rot));
        filter: drop-shadow(0 2px 1px rgba(44, 36, 64, 0.25));
        user-select: none;
        /* Cards change height between questions; slide rather than jump. */
        transition:
          left 0.3s ease,
          top 0.3s ease;
      }

      .prize--new {
        animation: land 0.7s cubic-bezier(0.2, 1.6, 0.4, 1) both;
      }

      @keyframes land {
        0% {
          transform: translate(-50%, -50%) rotate(var(--rot)) scale(0);
        }
        60% {
          transform: translate(-50%, -50%) rotate(var(--rot)) scale(1.5);
        }
        100% {
          transform: translate(-50%, -50%) rotate(var(--rot)) scale(1);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .prize {
          transition: none;
        }
        .prize--new {
          animation: none;
        }
      }
    `,
  ],
})
export class PrizeBackdrop {
  /** Prizes won here, in the order they were earned. */
  readonly prizes = input.required<readonly Prize[]>();
  /** Prizes won during this round, animated in. */
  readonly highlightIds = input<readonly string[]>([]);

  private readonly backdrop = viewChild<ElementRef<HTMLElement>>('backdrop');
  private readonly geometry = signal<Geometry | null>(null, {
    // Measuring is frequent and usually finds nothing moved.
    equal: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });

  readonly placed = computed<Placed[]>(() => {
    const geometry = this.geometry();
    if (!geometry) return [];
    const highlights = new Set(this.highlightIds());
    const prizes = this.prizes();
    const slots = stackSlots(prizes.length, geometry, geometry.obstacles, {
      cell: CELL,
    });
    return slots.map((slot, index) => ({
      id: prizes[index].id,
      emoji: prizes[index].emoji,
      left: slot.x,
      top: slot.y,
      rotation: tilt(prizes[index].id),
      isNew: highlights.has(prizes[index].id),
    }));
  });

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const backdrop = this.backdrop()?.nativeElement;
      const container = backdrop?.offsetParent;
      if (!backdrop || !(container instanceof HTMLElement)) return;

      let frame: number | null = null;
      let settle: ReturnType<typeof setTimeout> | null = null;
      const resizes = new ResizeObserver(() => schedule());

      const measure = () => {
        frame = null;
        const base = backdrop.getBoundingClientRect();
        const avoid = container.querySelectorAll(`[${PRIZE_AVOID_ATTRIBUTE}]`);
        resizes.disconnect();
        resizes.observe(container);
        const obstacles: Rect[] = [];
        avoid.forEach((element) => {
          resizes.observe(element);
          const rect = element.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) return;
          obstacles.push({
            left: rect.left - base.left,
            top: rect.top - base.top,
            width: rect.width,
            height: rect.height,
          });
        });
        this.geometry.set({ width: base.width, height: base.height, obstacles });
      };

      const schedule = () => {
        if (frame === null) frame = requestAnimationFrame(measure);
      };

      // Cards come and go with each phase of the round, and some pop in with a
      // scale animation, so measure straight away and again once it settles.
      // The prizes being drawn are mutations too; those change nothing here.
      const mutations = new MutationObserver((records) => {
        if (records.every((record) => backdrop.contains(record.target))) return;
        schedule();
        if (settle !== null) clearTimeout(settle);
        settle = setTimeout(schedule, 500);
      });
      mutations.observe(container, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      addEventListener('resize', schedule);
      measure();

      destroyRef.onDestroy(() => {
        resizes.disconnect();
        mutations.disconnect();
        removeEventListener('resize', schedule);
        if (frame !== null) cancelAnimationFrame(frame);
        if (settle !== null) clearTimeout(settle);
      });
    });
  }
}
