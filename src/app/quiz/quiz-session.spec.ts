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
    expect(session.answer(0)).toEqual({ wasCorrect: true, streak: 1 });
    session.advance();
    expect(session.answer(0)).toEqual({ wasCorrect: true, streak: 2 });
    session.advance();
    expect(session.answer(0)).toEqual({ wasCorrect: true, streak: 3 });
  });

  it('resets the streak on a wrong answer', () => {
    const session = new QuizSession(stubPack, 1, 10, 1);
    session.answer(0);
    session.advance();
    session.answer(0);
    session.advance();
    expect(session.answer(1)).toEqual({ wasCorrect: false, streak: 0 });
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
    session.answer(1); // one wrong => 9/10
    session.advance();
    expect(session.correctCount).toBe(9);
    expect(session.earnedLevelUp).toBe(true);
  });

  it('withholds a level up below the threshold', () => {
    const session = new QuizSession(stubPack, 1, 10, 1);
    answerAll(session, 0, 8);
    session.answer(1);
    session.advance();
    session.answer(1);
    session.advance();
    expect(session.correctCount).toBe(8);
    expect(session.earnedLevelUp).toBe(false);
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
});

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
