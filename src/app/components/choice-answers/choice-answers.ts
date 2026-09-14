import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { ChoiceAnswer, ChoiceQuestion } from '../../quiz/question.types';

type ChoiceState = 'idle' | 'right' | 'wrong' | 'dimmed';

/**
 * The answer buttons for a `choice` question: a two-by-two grid at the bottom
 * of the screen, in thumb reach.
 *
 * Each kind of question has a component like this that takes its answer. It
 * knows nothing about rounds or stars — it shows the question's options, says
 * which one was picked, and colours them in once the answer is revealed.
 */
@Component({
  selector: 'app-choice-answers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-prize-avoid': '' },
  template: `
    <ul class="choices">
      @for (choice of question().choices; track $index) {
        <li>
          <button
            type="button"
            class="choice"
            [class.choice--right]="states()[$index] === 'right'"
            [class.choice--wrong]="states()[$index] === 'wrong'"
            [class.choice--dimmed]="states()[$index] === 'dimmed'"
            [disabled]="revealed()"
            (click)="answered.emit({ kind: 'choice', index: $index })"
          >
            {{ choice }}
          </button>
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
    }

    .choices {
      list-style: none;
      /* Pinned to the bottom: that is where thumbs are. */
      margin: 0;
      padding: 0;
      display: grid;
      gap: 12px;
      grid-template-columns: 1fr 1fr;
    }

    .choice {
      width: 100%;
      /* Big enough to hit reliably with a small finger in a moving car. */
      min-height: 76px;
      padding: 12px 10px;
      border-radius: var(--radius);
      background: var(--paper);
      box-shadow: 0 5px 0 var(--line);
      font-size: clamp(1.15rem, 5vw, 1.5rem);
      font-weight: 800;
      color: var(--ink);
      word-break: break-word;
      transition: transform 0.08s ease, box-shadow 0.08s ease, background 0.15s ease,
        opacity 0.15s ease;

      &:active:not(:disabled) {
        transform: translateY(5px);
        box-shadow: none;
      }

      &:disabled {
        /* Overrides the global disabled fade; the reveal colours carry the meaning. */
        opacity: 1;
        cursor: default;
      }
    }

    .choice--right {
      background: var(--good);
      color: #fff;
      box-shadow: 0 5px 0 var(--good-dark);
      animation: pop 0.35s cubic-bezier(0.2, 1.5, 0.5, 1) both;
    }

    .choice--wrong {
      background: var(--bad);
      color: #fff;
      box-shadow: 0 5px 0 var(--bad-dark);
      animation: shake 0.4s ease both;
    }

    .choice--dimmed {
      opacity: 0.4;
    }

    @keyframes pop {
      from {
        transform: scale(0.5);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }

    @keyframes shake {
      0%,
      100% {
        transform: translateX(0);
      }
      20% {
        transform: translateX(-7px);
      }
      40% {
        transform: translateX(7px);
      }
      60% {
        transform: translateX(-4px);
      }
      80% {
        transform: translateX(4px);
      }
    }
  `,
})
export class ChoiceAnswers {
  readonly question = input.required<ChoiceQuestion>();
  /** The answer being revealed, or null while she is still choosing. */
  readonly answer = input<ChoiceAnswer | null>(null);
  readonly revealed = input(false);

  readonly answered = output<ChoiceAnswer>();

  /** Once revealed: the right one green, her pick red if it was wrong, the rest faded. */
  readonly states = computed<ChoiceState[]>(() => {
    const question = this.question();
    const picked = this.answer()?.index ?? null;
    return question.choices.map((_, index) => {
      if (!this.revealed()) return 'idle';
      if (index === question.correctIndex) return 'right';
      if (index === picked) return 'wrong';
      return 'dimmed';
    });
  });
}
