import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MediaService } from '../../media/media.service';
import { QuestionBase } from '../../quiz/question.types';

/**
 * What a question shows, for any kind of question: things to count, a drawn
 * picture, or the prompt text — in that order of preference.
 *
 * Shared by every kind, because what is being asked is independent of how it
 * is answered. With `numbered`, the things to count get their numbers under
 * them, which is how a wrong count is taught.
 */
@Component({
  selector: 'app-question-prompt',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (countItems().length > 0) {
      <!-- Rows of five, the way counting is taught with a ten frame. -->
      <ul
        class="things"
        [class.things--numbered]="numbered()"
        [style.--cols]="countItems().length < 5 ? countItems().length : 5"
        [attr.aria-label]="question().instruction"
      >
        @for (item of countItems(); track item.number) {
          <li class="things__item">
            <span class="things__emoji" aria-hidden="true">{{ item.emoji }}</span>
            @if (numbered()) {
              <span class="things__number">{{ item.number }}</span>
            }
          </li>
        }
      </ul>
    } @else if (!numbered()) {
      @if (picture(); as src) {
        <img
          class="picture"
          [src]="src"
          [attr.alt]="question().instruction ?? 'The picture to answer'"
        />
      } @else {
        <p class="prompt">{{ question().prompt }}</p>
      }
    }
  `,
  styles: `
    :host {
      display: contents;
    }

    .picture {
      display: block;
      width: min(180px, 46vw);
      height: auto;
      margin: 4px auto 0;
    }

    .prompt {
      margin: 2px 0 0;
      font-size: clamp(1.6rem, 8vw, 2.4rem);
      font-weight: 800;
      line-height: 1.15;
      word-break: break-word;
    }

    .things {
      display: grid;
      grid-template-columns: repeat(var(--cols, 5), minmax(0, 2.4rem));
      justify-content: center;
      gap: 4px 2px;
      margin: 6px 0 0;
      padding: 0;
      list-style: none;
    }

    .things__item {
      display: grid;
      justify-items: center;
    }

    .things__emoji {
      font-size: clamp(1.35rem, 6.6vw, 2rem);
      line-height: 1.15;
    }

    .things__number {
      min-width: 1.4rem;
      border-radius: 999px;
      background: var(--good);
      color: #fff;
      font-size: 0.75rem;
      font-weight: 800;
      line-height: 1.4;
    }
  `,
})
export class QuestionPrompt {
  private readonly media = inject(MediaService);

  readonly question = input.required<QuestionBase>();
  /**
   * The counting-along view after a wrong answer: only the things to count,
   * each with its number. Shows nothing for a question with nothing to count.
   */
  readonly numbered = input(false);

  /**
   * The drawing for this question, when the media pack has one. Spelling asks
   * "how do you write this?", so the picture *is* the question.
   */
  readonly picture = computed(() => {
    const id = this.question().picture;
    return id ? (this.media.picture(id) ?? null) : null;
  });

  /** The things to count, one entry each, numbered from 1. */
  readonly countItems = computed(() => {
    const count = this.question().count;
    if (!count) return [];
    return Array.from({ length: count.amount }, (_, i) => ({
      number: i + 1,
      emoji: count.emoji,
    }));
  });
}
