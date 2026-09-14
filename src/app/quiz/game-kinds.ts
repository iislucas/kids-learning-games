import {
  Answer,
  ChoiceAnswer,
  ChoiceQuestion,
  Question,
  QuestionKind,
} from './question.types';

/**
 * The rules for one kind of question: how to mark an answer, how to tell two
 * questions apart, and what makes one broken.
 *
 * The round (`QuizSession`) and the pack specs only ever go through this, so a
 * new kind of game — typing a number, putting pictures in order — plugs in by
 * adding an entry to `GAME_KINDS` and a component that takes the answer, with
 * no change to how rounds, stars, retries or challenges work.
 *
 * Plain objects, Angular-free, so the rules are tested directly.
 */
export interface GameKind<Q extends Question = Question, A extends Answer = Answer> {
  isCorrect(question: Q, answer: A): boolean;

  /**
   * Identity for "never the same question twice running". It has to include
   * the right answer: some rounds keep a fixed prompt and vary only what is
   * being asked for (the sight-word round always shows "👀").
   */
  key(question: Q): string;

  /** Everything wrong with a question, for the pack spec. Empty when it is fine. */
  problems(question: Q): string[];

  /** Said under the explanation after a wrong answer, before the retry. */
  retryHint: string;
}

export const choiceKind: GameKind<ChoiceQuestion, ChoiceAnswer> = {
  isCorrect: (question, answer) => answer.index === question.correctIndex,

  key: (question) =>
    `${question.instruction ?? ''}|${question.prompt}|${
      question.choices[question.correctIndex] ?? ''
    }`,

  problems(question) {
    const problems: string[] = [];
    if (question.choices.length < 2) problems.push('fewer than two choices');
    if (question.correctIndex < 0 || question.correctIndex >= question.choices.length) {
      problems.push(`correctIndex ${question.correctIndex} is out of range`);
    }
    // Duplicates would make it unanswerable or give it two right answers.
    if (new Set(question.choices).size !== question.choices.length) {
      problems.push(`duplicate choices: ${question.choices.join(', ')}`);
    }
    if (question.choices.some((choice) => choice.trim().length === 0)) {
      problems.push('an empty choice');
    }
    return problems;
  },

  retryHint: 'The green one is right — try it!',
};

export const GAME_KINDS: { [K in QuestionKind]: GameKind } = {
  choice: choiceKind,
};

export function kindOf(question: Question): GameKind {
  return GAME_KINDS[question.kind];
}

/** An answer of the wrong kind for the question is simply not right. */
export function isCorrect(question: Question, answer: Answer): boolean {
  return answer.kind === question.kind && kindOf(question).isCorrect(question, answer);
}

export function questionKey(question: Question): string {
  return kindOf(question).key(question);
}

/**
 * Everything wrong with a question, of any kind — including the parts every
 * kind shares.
 */
export function questionProblems(question: Question): string[] {
  const problems = kindOf(question).problems(question);
  if (question.prompt.length === 0) problems.unshift('an empty prompt');
  return problems;
}
