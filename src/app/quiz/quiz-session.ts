import { Rng } from '../core/rng';
import {
  PackSelection,
  Question,
  QuestionPack,
  defaultSelection,
} from './question.types';

export const QUESTIONS_PER_ROUND = 10;

export type QuizPhase = 'asking' | 'revealing' | 'finished';

export interface AnswerRecord {
  question: Question;
  chosenIndex: number;
  wasCorrect: boolean;
}

export interface AnswerResult {
  wasCorrect: boolean;
  streak: number;
  /**
   * False when this was a retry of a question already answered wrongly. Only
   * first attempts count towards stars, streaks and the score.
   */
  isFirstAttempt: boolean;
}

export interface QuizSnapshot {
  phase: QuizPhase;
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  streak: number;
  correctCount: number;
  chosenIndex: number | null;
  /** Revealing a wrong answer — advancing returns to the same question. */
  awaitingRetry: boolean;
  /** How many times the current question has been answered. */
  attempts: number;
}

/** How many times to re-draw before accepting a repeat of the last question. */
const MAX_REDRAWS = 12;

/**
 * The rules of a round, with no Angular and no side effects, so the awkward
 * parts — streak accounting, when an answer is allowed, when the round ends —
 * are testable directly.
 *
 * A round is a fixed number of questions rather than open-ended: a clear finish
 * line gives a natural stopping point and something to celebrate, which is
 * better for a seven-year-old than a session that just trails off.
 *
 * A wrong answer does not skip ahead. The correct choice is shown, then the
 * same question comes back to be answered properly — the point is to learn the
 * answer, not to be marked on it. That retry earns nothing, so a wrong answer
 * still costs the streak.
 */
export class QuizSession {
  private readonly rng: Rng;
  private questionIndex = 0;
  private current: Question;
  private phase: QuizPhase = 'asking';
  private chosenIndex: number | null = null;
  private awaitingRetry = false;
  private attempts = 0;
  /** Identity of the previous question, to avoid drawing it twice running. */
  private lastKey: string | null = null;

  readonly answers: AnswerRecord[] = [];
  streak = 0;
  correctCount = 0;

  private readonly selection: PackSelection;

  readonly totalQuestions: number;

  /**
   * A fixed set of questions to ask, one each, instead of generating them.
   * See `Challenge`: this is what lets a round mean "the whole 7× table" rather
   * than "ten multiplication questions".
   */
  private readonly deck: Question[] | null;

  constructor(
    readonly pack: QuestionPack,
    readonly level: number,
    totalQuestions: number = QUESTIONS_PER_ROUND,
    seed?: number,
    selection?: PackSelection,
    deck?: Question[],
  ) {
    this.rng = new Rng(seed);
    this.selection = selection ?? defaultSelection(pack);
    this.deck = deck && deck.length > 0 ? deck : null;
    // A deck is the round: its length decides how many questions there are, so
    // a five-fact topic is a five-question round rather than one padded to ten.
    this.totalQuestions = this.deck ? this.deck.length : totalQuestions;
    this.current = this.drawQuestion();
  }

  /**
   * Draws a question that is not a repeat of the previous one. Small packs can
   * exhaust their pool, so this gives up after a bounded number of tries rather
   * than looping forever.
   */
  private drawQuestion(): Question {
    if (this.deck) {
      // Already shuffled and already distinct, so it is simply dealt in order.
      const question = this.deck[Math.min(this.questionIndex, this.deck.length - 1)];
      this.lastKey = keyOf(question);
      return question;
    }
    let question = this.pack.generate(this.level, this.rng, this.selection);
    for (let i = 0; i < MAX_REDRAWS && keyOf(question) === this.lastKey; i++) {
      question = this.pack.generate(this.level, this.rng, this.selection);
    }
    this.lastKey = keyOf(question);
    return question;
  }

  snapshot(): QuizSnapshot {
    return {
      phase: this.phase,
      question: this.current,
      questionNumber: Math.min(this.questionIndex + 1, this.totalQuestions),
      totalQuestions: this.totalQuestions,
      streak: this.streak,
      correctCount: this.correctCount,
      chosenIndex: this.chosenIndex,
      awaitingRetry: this.awaitingRetry,
      attempts: this.attempts,
    };
  }

  /**
   * Records an answer. Returns null if the tap should be ignored — a second tap
   * while the result is showing, or after the round is over. Without this
   * guard, an excited child mashing buttons inflates the streak.
   */
  answer(choiceIndex: number): AnswerResult | null {
    if (this.phase !== 'asking') return null;

    const wasCorrect = choiceIndex === this.current.correctIndex;
    const isFirstAttempt = this.attempts === 0;
    this.attempts++;

    // Only the first attempt scores. Otherwise getting it wrong then correcting
    // it would pay the same as knowing it, and the streak would mean nothing.
    if (isFirstAttempt) {
      this.streak = wasCorrect ? this.streak + 1 : 0;
      if (wasCorrect) this.correctCount++;
      this.answers.push({
        question: this.current,
        chosenIndex: choiceIndex,
        wasCorrect,
      });
    }

    this.chosenIndex = choiceIndex;
    this.phase = 'revealing';
    this.awaitingRetry = !wasCorrect;

    return { wasCorrect, streak: this.streak, isFirstAttempt };
  }

  /**
   * Leaves the reveal: back to the same question after a wrong answer,
   * otherwise on to the next one (or the end of the round).
   */
  advance(): void {
    if (this.phase !== 'revealing') return;

    if (this.awaitingRetry) {
      this.awaitingRetry = false;
      this.chosenIndex = null;
      this.phase = 'asking';
      return;
    }

    this.questionIndex++;
    this.chosenIndex = null;
    this.attempts = 0;

    if (this.questionIndex >= this.totalQuestions) {
      this.phase = 'finished';
      return;
    }
    this.current = this.drawQuestion();
    this.phase = 'asking';
  }

  get isFinished(): boolean {
    return this.phase === 'finished';
  }

  /**
   * Every question answered correctly first time.
   *
   * `correctCount` only ever counts first attempts, so a question that was got
   * wrong and then corrected does not qualify — which is exactly what makes a
   * perfect challenge round mean the whole set is known.
   */
  get isPerfect(): boolean {
    return this.isFinished && this.correctCount === this.totalQuestions;
  }

  /** 0..1, for the round progress bar. */
  get progress(): number {
    return this.questionIndex / this.totalQuestions;
  }

  /**
   * Whether the player did well enough to move up a level. Judged on first
   * attempts only, so corrected answers do not count towards it.
   */
  get earnedLevelUp(): boolean {
    return (
      this.isFinished && this.correctCount >= Math.ceil(this.totalQuestions * 0.9)
    );
  }
}

/**
 * Identity of a question for repeat detection.
 *
 * The correct answer has to be part of this. Some questions are asked entirely
 * through their options — the English sight-word round shows a fixed prompt
 * ("👀", "Which one is spelled correctly?") and varies only the choices, so
 * keying on prompt and instruction alone makes every one of them look like the
 * same question.
 */
function keyOf(question: Question): string {
  const answer = question.choices[question.correctIndex] ?? '';
  return `${question.instruction ?? ''}|${question.prompt}|${answer}`;
}
