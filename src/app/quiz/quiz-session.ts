import { Rng } from '../core/rng';
import { Question, QuestionPack } from './question.types';

export const QUESTIONS_PER_ROUND = 10;

export type QuizPhase = 'asking' | 'revealing' | 'finished';

export interface AnswerRecord {
  question: Question;
  chosenIndex: number;
  wasCorrect: boolean;
}

export interface QuizSnapshot {
  phase: QuizPhase;
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  streak: number;
  correctCount: number;
  chosenIndex: number | null;
}

/**
 * The rules of a round, with no Angular and no side effects, so the awkward
 * parts — streak accounting, when an answer is allowed, when the round ends —
 * are testable directly.
 *
 * A round is a fixed number of questions rather than open-ended: a clear finish
 * line gives a natural stopping point and something to celebrate, which is
 * better for a seven-year-old than a session that just trails off.
 */
export class QuizSession {
  private readonly rng: Rng;
  private questionIndex = 0;
  private current: Question;
  private phase: QuizPhase = 'asking';
  private chosenIndex: number | null = null;

  readonly answers: AnswerRecord[] = [];
  streak = 0;
  correctCount = 0;

  constructor(
    readonly pack: QuestionPack,
    readonly level: number,
    readonly totalQuestions: number = QUESTIONS_PER_ROUND,
    seed?: number,
  ) {
    this.rng = new Rng(seed);
    this.current = pack.generate(level, this.rng);
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
    };
  }

  /**
   * Records an answer. Returns null if the tap should be ignored — a second tap
   * while the result is showing, or after the round is over. Without this
   * guard, an excited child mashing buttons inflates the streak.
   */
  answer(choiceIndex: number): { wasCorrect: boolean; streak: number } | null {
    if (this.phase !== 'asking') return null;

    const wasCorrect = choiceIndex === this.current.correctIndex;
    this.streak = wasCorrect ? this.streak + 1 : 0;
    if (wasCorrect) this.correctCount++;

    this.answers.push({
      question: this.current,
      chosenIndex: choiceIndex,
      wasCorrect,
    });
    this.chosenIndex = choiceIndex;
    this.phase = 'revealing';

    return { wasCorrect, streak: this.streak };
  }

  /** Moves to the next question, or finishes the round. */
  advance(): void {
    if (this.phase !== 'revealing') return;
    this.questionIndex++;
    this.chosenIndex = null;

    if (this.questionIndex >= this.totalQuestions) {
      this.phase = 'finished';
      return;
    }
    this.current = this.pack.generate(this.level, this.rng);
    this.phase = 'asking';
  }

  get isFinished(): boolean {
    return this.phase === 'finished';
  }

  /** 0..1, for the round progress bar. */
  get progress(): number {
    return this.questionIndex / this.totalQuestions;
  }

  /**
   * Whether the player did well enough to move up a level. Set high enough
   * that levelling up means it, but reachable — nine out of ten.
   */
  get earnedLevelUp(): boolean {
    return (
      this.isFinished && this.correctCount >= Math.ceil(this.totalQuestions * 0.9)
    );
  }
}
