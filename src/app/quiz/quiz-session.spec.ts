import { Rng } from '../core/rng';
import { QUESTION_PACKS, findPack } from './pack-registry';
import { QuizSession } from './quiz-session';
import { Question, QuestionPack } from './question.types';

/** A pack whose answer is always index 0, so tests can steer outcomes. */
const stubPack: QuestionPack = {
  id: 'stub',
  title: 'Stub',
  emoji: '🧪',
  colour: '#000',
  description: '',
  levels: [{ number: 1, name: 'One' }],
  generate: (): Question => ({
    prompt: '1 + 1',
    choices: ['2', '3', '4', '5'],
    correctIndex: 0,
  }),
};

function answerAll(session: QuizSession, choice: number, times: number): void {
  for (let i = 0; i < times; i++) {
    session.answer(choice);
    session.advance();
  }
}

/** Answers wrongly, clears the retry, then answers correctly. */
function answerWrongThenRight(session: QuizSession): void {
  session.answer(1);
  session.advance(); // back to the same question
  session.answer(0);
  session.advance(); // on to the next
}

describe('QuizSession', () => {
  it('starts on the first question in the asking phase', () => {
    const session = new QuizSession(stubPack, 1, 10, 1);
    const snapshot = session.snapshot();
    expect(snapshot.phase).toBe('asking');
    expect(snapshot.questionNumber).toBe(1);
    expect(snapshot.totalQuestions).toBe(10);
    expect(snapshot.streak).toBe(0);
  });

  it('builds a streak on consecutive correct answers', () => {
    const session = new QuizSession(stubPack, 1, 10, 1);
    expect(session.answer(0)).toMatchObject({ wasCorrect: true, streak: 1 });
    session.advance();
    expect(session.answer(0)).toMatchObject({ wasCorrect: true, streak: 2 });
    session.advance();
    expect(session.answer(0)).toMatchObject({ wasCorrect: true, streak: 3 });
  });

  it('resets the streak on a wrong answer', () => {
    const session = new QuizSession(stubPack, 1, 10, 1);
    session.answer(0);
    session.advance();
    session.answer(0);
    session.advance();
    expect(session.answer(1)).toMatchObject({ wasCorrect: false, streak: 0 });
    expect(session.snapshot().correctCount).toBe(2);
  });

  it('ignores extra taps while the answer is being revealed', () => {
    const session = new QuizSession(stubPack, 1, 10, 1);
    expect(session.answer(0)).not.toBeNull();
    // A child mashing the buttons must not rack up a streak of 5.
    expect(session.answer(0)).toBeNull();
    expect(session.answer(1)).toBeNull();
    expect(session.streak).toBe(1);
    expect(session.answers).toHaveLength(1);
  });

  // ── retry after a wrong answer ──

  it('returns to the same question after a wrong answer', () => {
    const session = new QuizSession(stubPack, 1, 10, 1);
    const asked = session.snapshot().question;

    session.answer(1);
    const revealing = session.snapshot();
    expect(revealing.phase).toBe('revealing');
    expect(revealing.awaitingRetry).toBe(true);
    expect(revealing.chosenIndex).toBe(1);

    session.advance();
    const retry = session.snapshot();
    expect(retry.phase).toBe('asking');
    expect(retry.question).toBe(asked);
    // Still question 1 — a wrong answer does not consume a question.
    expect(retry.questionNumber).toBe(1);
    // Buttons reset to neutral so she can choose again.
    expect(retry.chosenIndex).toBeNull();
  });

  it('moves on once the retry is answered correctly', () => {
    const session = new QuizSession(stubPack, 1, 10, 1);
    session.answer(1);
    session.advance();

    const result = session.answer(0);
    expect(result).toMatchObject({ wasCorrect: true, isFirstAttempt: false });
    expect(session.snapshot().awaitingRetry).toBe(false);

    session.advance();
    expect(session.snapshot().questionNumber).toBe(2);
  });

  it('awards nothing for a corrected answer', () => {
    const session = new QuizSession(stubPack, 1, 10, 1);
    answerWrongThenRight(session);

    // Getting there on the second go must not pay the same as knowing it.
    expect(session.correctCount).toBe(0);
    expect(session.streak).toBe(0);
    expect(session.answers).toHaveLength(1);
    expect(session.answers[0].wasCorrect).toBe(false);
  });

  it('does not re-break a streak on repeated retries', () => {
    const session = new QuizSession(stubPack, 1, 10, 1);
    answerAll(session, 0, 3);
    expect(session.streak).toBe(3);

    session.answer(1); // wrong: streak gone
    expect(session.streak).toBe(0);
    session.advance();
    session.answer(2); // wrong again on the retry
    expect(session.snapshot().attempts).toBe(2);
    session.advance();
    session.answer(0); // finally right
    session.advance();

    // Only the first attempt was recorded.
    expect(session.answers).toHaveLength(4);
    expect(session.correctCount).toBe(3);
  });

  it('keeps retrying until the answer is right', () => {
    const session = new QuizSession(stubPack, 1, 5, 1);
    for (let i = 0; i < 4; i++) {
      session.answer(1);
      expect(session.snapshot().awaitingRetry).toBe(true);
      session.advance();
      expect(session.snapshot().questionNumber).toBe(1);
    }
    session.answer(0);
    session.advance();
    expect(session.snapshot().questionNumber).toBe(2);
  });

  it('reports isFirstAttempt correctly', () => {
    const session = new QuizSession(stubPack, 1, 10, 1);
    expect(session.answer(1)?.isFirstAttempt).toBe(true);
    session.advance();
    expect(session.answer(1)?.isFirstAttempt).toBe(false);
  });

  it('resets the attempt count on the next question', () => {
    const session = new QuizSession(stubPack, 1, 10, 1);
    answerWrongThenRight(session);
    expect(session.snapshot().attempts).toBe(0);
  });

  it('only advances from the revealing phase', () => {
    const session = new QuizSession(stubPack, 1, 10, 1);
    session.advance(); // no-op: still asking
    expect(session.snapshot().questionNumber).toBe(1);
    session.answer(0);
    session.advance();
    expect(session.snapshot().questionNumber).toBe(2);
  });

  it('finishes after the configured number of questions', () => {
    const session = new QuizSession(stubPack, 1, 5, 1);
    answerAll(session, 0, 5);
    expect(session.isFinished).toBe(true);
    expect(session.snapshot().phase).toBe('finished');
    expect(session.progress).toBe(1);
    expect(session.answers).toHaveLength(5);
  });

  it('refuses further answers once finished', () => {
    const session = new QuizSession(stubPack, 1, 3, 1);
    answerAll(session, 0, 3);
    expect(session.answer(0)).toBeNull();
    expect(session.answers).toHaveLength(3);
  });

  it('awards a level up at 90% or better', () => {
    const session = new QuizSession(stubPack, 1, 10, 1);
    answerAll(session, 0, 9);
    answerWrongThenRight(session); // missed one => 9/10
    expect(session.correctCount).toBe(9);
    expect(session.earnedLevelUp).toBe(true);
  });

  it('withholds a level up below the threshold', () => {
    const session = new QuizSession(stubPack, 1, 10, 1);
    answerAll(session, 0, 8);
    answerWrongThenRight(session);
    answerWrongThenRight(session);
    expect(session.correctCount).toBe(8);
    expect(session.isFinished).toBe(true);
    expect(session.earnedLevelUp).toBe(false);
  });

  it('does not end the round until the last question is answered right', () => {
    const session = new QuizSession(stubPack, 1, 3, 1);
    answerAll(session, 0, 2);
    session.answer(1); // wrong on the final question
    session.advance();
    expect(session.isFinished).toBe(false);
    expect(session.snapshot().questionNumber).toBe(3);

    session.answer(0);
    session.advance();
    expect(session.isFinished).toBe(true);
  });

  it('reports no level up mid-round even at a perfect score', () => {
    const session = new QuizSession(stubPack, 1, 10, 1);
    answerAll(session, 0, 5);
    expect(session.earnedLevelUp).toBe(false);
  });

  it('is deterministic for a given seed', () => {
    const a = new QuizSession(findPack('maths')!, 2, 5, 12345);
    const b = new QuizSession(findPack('maths')!, 2, 5, 12345);
    expect(a.snapshot().question).toEqual(b.snapshot().question);
  });

  it('awards a level up even when wrong answers were corrected', () => {
    // Score is judged on first attempts, so one genuine miss out of ten still
    // clears the bar regardless of how many retries it took to fix.
    const session = new QuizSession(stubPack, 1, 10, 1);
    answerAll(session, 0, 9);
    answerWrongThenRight(session);
    expect(session.correctCount).toBe(9);
    expect(session.earnedLevelUp).toBe(true);
  });
});

describe('QuizSession question variety', () => {
  for (const pack of QUESTION_PACKS) {
    it(`never repeats a question back-to-back in ${pack.id}`, () => {
      for (const level of pack.levels) {
        // Long rounds across several seeds: repeats are random, so a short run
        // would pass by luck.
        for (const seed of [1, 7, 99, 12345]) {
          const session = new QuizSession(pack, level.number, 40, seed);
          let previous = keyOf(session.snapshot().question);

          while (!session.isFinished) {
            session.answer(session.snapshot().question.correctIndex);
            session.advance();
            if (session.isFinished) break;

            const current = keyOf(session.snapshot().question);
            expect(
              current,
              `${pack.id} level ${level.number} seed ${seed} repeated "${current}"`,
            ).not.toBe(previous);
            previous = current;
          }
        }
      }
    });
  }

  it('keeps showing the same question during a retry', () => {
    // The no-repeat rule must not fight the retry rule.
    const session = new QuizSession(findPack('maths')!, 1, 10, 5);
    const asked = session.snapshot().question;
    const wrong = (asked.correctIndex + 1) % asked.choices.length;

    session.answer(wrong);
    session.advance();
    expect(session.snapshot().question).toBe(asked);
  });
});

function keyOf(question: {
  instruction?: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
}): string {
  return `${question.instruction ?? ''}|${question.prompt}|${
    question.choices[question.correctIndex] ?? ''
  }`;
}

describe('question packs', () => {
  it('registers four packs with unique ids', () => {
    const ids = QUESTION_PACKS.map((pack) => pack.id);
    expect(ids).toEqual(['maths', 'english', 'french', 'science']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const pack of QUESTION_PACKS) {
    describe(pack.id, () => {
      it('generates valid questions at every level', () => {
        for (const level of pack.levels) {
          const rng = new Rng(level.number * 977);
          // Many draws per level: the generators are random, so a single
          // sample would not catch an occasional bad question.
          for (let i = 0; i < 200; i++) {
            const question = pack.generate(level.number, rng);

            expect(question.prompt.length).toBeGreaterThan(0);
            expect(question.choices.length).toBeGreaterThanOrEqual(2);
            expect(question.correctIndex).toBeGreaterThanOrEqual(0);
            expect(question.correctIndex).toBeLessThan(question.choices.length);

            // Duplicate options would make a question unanswerable or give it
            // two right answers.
            expect(new Set(question.choices).size).toBe(question.choices.length);
            for (const choice of question.choices) {
              expect(choice.trim().length).toBeGreaterThan(0);
            }
          }
        }
      });
    });
  }

  it('never produces a negative answer in maths subtraction', () => {
    const pack = findPack('maths')!;
    const rng = new Rng(4242);
    for (let i = 0; i < 500; i++) {
      const question = pack.generate(3, rng);
      const answer = Number(question.choices[question.correctIndex]);
      expect(Number.isFinite(answer)).toBe(true);
      expect(answer).toBeGreaterThanOrEqual(0);
    }
  });

  it('offers exactly two options for French le/la', () => {
    const pack = findPack('french')!;
    const rng = new Rng(99);
    for (let i = 0; i < 100; i++) {
      const question = pack.generate(4, rng);
      expect(question.choices.sort()).toEqual(['la', 'le']);
    }
  });
});
