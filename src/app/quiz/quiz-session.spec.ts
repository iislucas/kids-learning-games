import { Rng } from '../core/rng';
import { QUESTION_PACKS, findPack } from './pack-registry';
import { QuizSession } from './quiz-session';
import {
  PackSelection,
  Question,
  QuestionPack,
  availableLevels,
  defaultSelection,
  isLevelAvailable,
  resolveSelection,
  selected,
} from './question.types';

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

/**
 * A challenge round: a fixed deck instead of a generator. The retry and
 * first-attempt-only scoring have to behave exactly as they do in a normal
 * round, because that is what makes a perfect score mean anything.
 */
describe('QuizSession with a deck', () => {
  const deck: Question[] = [1, 2, 3, 4, 5].map((n) => ({
    prompt: `7 x ${n}`,
    choices: [String(7 * n), 'a', 'b', 'c'],
    correctIndex: 0,
  }));

  const deckSession = () => new QuizSession(stubPack, 1, 10, 1, undefined, deck);

  it('takes its length from the deck, not the round default', () => {
    const session = deckSession();
    expect(session.totalQuestions).toBe(5);
    expect(session.snapshot().totalQuestions).toBe(5);
  });

  it('asks every question in the deck exactly once, in order', () => {
    const session = deckSession();
    const asked: string[] = [];
    for (let i = 0; i < 5; i++) {
      asked.push(session.snapshot().question.prompt);
      session.answer(0);
      session.advance();
    }
    expect(asked).toEqual(deck.map((question) => question.prompt));
    expect(session.isFinished).toBe(true);
  });

  it('is perfect only when every answer was right first time', () => {
    const session = deckSession();
    answerAll(session, 0, 5);
    expect(session.isPerfect).toBe(true);
    expect(session.correctCount).toBe(5);
  });

  it('is not perfect when one had to be corrected', () => {
    const session = deckSession();
    answerWrongThenRight(session);
    answerAll(session, 0, 4);
    expect(session.isFinished).toBe(true);
    expect(session.isPerfect).toBe(false);
    expect(session.correctCount).toBe(4);
  });

  it('still puts a wrong question back rather than skipping it', () => {
    const session = deckSession();
    const first = session.snapshot().question.prompt;
    session.answer(1);
    expect(session.snapshot().awaitingRetry).toBe(true);
    session.advance();
    expect(session.snapshot().question.prompt).toBe(first);
  });

  it('is not perfect before the round has finished', () => {
    const session = deckSession();
    answerAll(session, 0, 4);
    expect(session.isPerfect).toBe(false);
  });

  it('ignores an empty deck and generates as usual', () => {
    const session = new QuizSession(stubPack, 1, 10, 1, undefined, []);
    expect(session.totalQuestions).toBe(10);
    expect(session.snapshot().question.prompt).toBe('1 + 1');
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
  it('registers five packs with unique ids', () => {
    const ids = QUESTION_PACKS.map((pack) => pack.id);
    expect(ids).toEqual(['counting', 'maths', 'english', 'french', 'science']);
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
            const question = pack.generate(
              level.number,
              rng,
              defaultSelection(pack),
            );

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
      const question = pack.generate(3, rng, defaultSelection(pack));
      const answer = Number(question.choices[question.correctIndex]);
      expect(Number.isFinite(answer)).toBe(true);
      expect(answer).toBeGreaterThanOrEqual(0);
    }
  });

  it('shows as many things to count as the right answer, within the level', () => {
    const pack = findPack('counting')!;
    const rng = new Rng(2024);
    for (const [level, max] of [[1, 5], [2, 10], [3, 20]]) {
      const seen = new Set<number>();
      for (let i = 0; i < 300; i++) {
        const question = pack.generate(level, rng, defaultSelection(pack));
        const answer = Number(question.choices[question.correctIndex]);
        expect(question.count?.amount).toBe(answer);
        expect(answer).toBeGreaterThanOrEqual(1);
        expect(answer).toBeLessThanOrEqual(max);
        expect(question.choices.length).toBe(4);
        for (const choice of question.choices) {
          expect(Number(choice)).toBeGreaterThanOrEqual(1);
        }
        seen.add(answer);
      }
      // Every number up to the top of the level turns up.
      expect(seen.size).toBe(max);
    }
  });

  it('offers exactly two options for French le/la', () => {
    const pack = findPack('french')!;
    const rng = new Rng(99);
    for (let i = 0; i < 100; i++) {
      const question = pack.generate(4, rng, defaultSelection(pack));
      expect(question.choices.sort()).toEqual(['la', 'le']);
    }
  });
});

describe('pack options', () => {
  it('gives every option a valid, non-empty default', () => {
    for (const pack of QUESTION_PACKS) {
      for (const option of pack.options ?? []) {
        const values = new Set(option.choices.map((c) => c.value));
        expect(option.defaults.length).toBeGreaterThan(0);
        for (const value of option.defaults) {
          expect(values.has(value), `${pack.id}/${option.id}: ${value}`).toBe(true);
        }
        // Options that name levels must name ones the pack actually has.
        for (const level of option.levels ?? []) {
          expect(pack.levels.some((l) => l.number === level)).toBe(true);
        }
      }
    }
  });

  it('every level is available on the default selection', () => {
    for (const pack of QUESTION_PACKS) {
      const selection = defaultSelection(pack);
      for (const level of pack.levels) {
        expect(
          isLevelAvailable(pack, level.number, selection),
          `${pack.id} level ${level.number}`,
        ).toBe(true);
      }
    }
  });

  it('still generates valid questions with only one value selected', () => {
    // The narrowest possible setting is the one most likely to empty a pool.
    for (const pack of QUESTION_PACKS) {
      for (const option of pack.options ?? []) {
        for (const choice of option.choices) {
          const selection: PackSelection = {
            ...defaultSelection(pack),
            [option.id]: [choice.value],
          };
          const rng = new Rng(31);
          for (const level of pack.levels) {
            for (let i = 0; i < 40; i++) {
              const question = pack.generate(level.number, rng, selection);
              expect(
                question.choices.length,
                `${pack.id}/${option.id}=${choice.value} level ${level.number}`,
              ).toBeGreaterThanOrEqual(2);
              expect(new Set(question.choices).size).toBe(question.choices.length);
              expect(question.correctIndex).toBeLessThan(question.choices.length);
            }
          }
        }
      }
    }
  });

  it('restricts maths to the selected times tables', () => {
    const pack = findPack('maths')!;
    const rng = new Rng(7);
    const selection: PackSelection = { ...defaultSelection(pack), tables: ['3'] };

    for (let i = 0; i < 200; i++) {
      const question = pack.generate(5, rng, selection);
      const [a] = question.prompt.split(' ');
      expect(a, question.prompt).toBe('3');
      expect(Number(question.choices[question.correctIndex]) % 3).toBe(0);
    }
  });

  it('uses every selected table over enough draws', () => {
    const pack = findPack('maths')!;
    const rng = new Rng(11);
    const selection: PackSelection = {
      ...defaultSelection(pack),
      tables: ['2', '7'],
    };
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      seen.add(pack.generate(5, rng, selection).prompt.split(' ')[0]);
    }
    expect([...seen].sort()).toEqual(['2', '7']);
  });

  it('keeps the mixed maths round to the selected operations', () => {
    const pack = findPack('maths')!;
    const rng = new Rng(3);
    const selection: PackSelection = {
      ...defaultSelection(pack),
      operations: ['multiply'],
    };
    for (let i = 0; i < 100; i++) {
      expect(pack.generate(4, rng, selection).prompt).toContain('×');
    }
  });

  it('restricts the science quiz to the selected topics', () => {
    const pack = findPack('science')!;
    const rng = new Rng(5);
    const selection: PackSelection = { topics: ['space'] };
    const prompts = new Set<string>();
    for (let i = 0; i < 200; i++) {
      prompts.add(pack.generate(1, rng, selection).prompt);
    }
    // Every space prompt, and nothing from the other topics.
    expect(prompts.has('Spider')).toBe(false);
    expect(prompts.has('Your heart')).toBe(false);
    expect(prompts.size).toBeGreaterThan(1);
  });

  it('restricts French vocabulary to the selected topics', () => {
    const pack = findPack('french')!;
    const rng = new Rng(13);
    const selection: PackSelection = { topics: ['colours'] };
    const colours = ['rouge', 'bleu', 'vert', 'jaune', 'noir', 'violet'];
    for (let i = 0; i < 100; i++) {
      expect(colours).toContain(pack.generate(1, rng, selection).prompt);
    }
  });

  it('falls back for French le/la when only colours are selected', () => {
    // Colours are adjectives and are excluded from that round, so the
    // selection has to be ignored rather than leaving nothing to ask.
    const pack = findPack('french')!;
    const rng = new Rng(17);
    for (let i = 0; i < 100; i++) {
      const question = pack.generate(4, rng, { topics: ['colours'] });
      expect(question.choices.sort()).toEqual(['la', 'le']);
    }
  });
});

describe('resolveSelection', () => {
  const pack = findPack('maths')!;

  it('returns the defaults when nothing is stored', () => {
    expect(resolveSelection(pack, undefined)).toEqual(defaultSelection(pack));
  });

  it('keeps a valid stored selection', () => {
    const stored = { tables: ['3', '4'], operations: ['add'] };
    expect(resolveSelection(pack, stored)).toEqual(stored);
  });

  it('drops values that no longer exist', () => {
    const resolved = resolveSelection(pack, { tables: ['3', '99'] });
    expect(resolved['tables']).toEqual(['3']);
  });

  it('preserves an option that was deliberately emptied', () => {
    // "None of this category" is a real choice and has to survive a reload.
    const resolved = resolveSelection(pack, { tables: [] });
    expect(resolved['tables']).toEqual([]);
  });

  it('fills in options added since it was saved', () => {
    const resolved = resolveSelection(pack, { tables: ['2'] });
    expect(resolved['operations']).toBeDefined();
  });
});

describe('selected', () => {
  const pack = findPack('maths')!;
  const option = pack.options![0];

  it('reads the chosen values', () => {
    expect(selected({ tables: ['5'] }, option)).toEqual(['5']);
  });

  it('falls back to defaults only when the option is absent', () => {
    expect(selected({}, option)).toEqual(option.defaults);
    // An empty option stays empty — that is "none of this", not "unset".
    expect(selected({ tables: [] }, option)).toEqual([]);
  });
});

describe('switching a whole category off', () => {
  it('takes the levels that depend on it out of play', () => {
    const pack = findPack('maths')!;
    const selection: PackSelection = { ...defaultSelection(pack), tables: [] };

    // Times tables is gone; adding and taking away are untouched.
    expect(isLevelAvailable(pack, 5, selection)).toBe(false);
    expect(isLevelAvailable(pack, 1, selection)).toBe(true);
    expect(isLevelAvailable(pack, 3, selection)).toBe(true);
    expect(availableLevels(pack, selection).map((l) => l.number)).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it('drops multiplying from the mixed round when no tables are on', () => {
    const pack = findPack('maths')!;
    const selection: PackSelection = {
      tables: [],
      operations: ['add', 'subtract', 'multiply'],
    };
    const rng = new Rng(21);
    for (let i = 0; i < 200; i++) {
      expect(pack.generate(4, rng, selection).prompt).not.toContain('×');
    }
    expect(isLevelAvailable(pack, 4, selection)).toBe(true);
  });

  it('closes the mixed round when its only operation is impossible', () => {
    // Multiplying is the only thing chosen, but every table is switched off.
    const pack = findPack('maths')!;
    const selection: PackSelection = { tables: [], operations: ['multiply'] };
    expect(isLevelAvailable(pack, 4, selection)).toBe(false);
  });

  it('lets maths drop addition entirely', () => {
    const pack = findPack('maths')!;
    const selection: PackSelection = {
      ...defaultSelection(pack),
      operations: ['subtract', 'multiply'],
    };
    const rng = new Rng(33);
    for (let i = 0; i < 200; i++) {
      expect(pack.generate(4, rng, selection).prompt).not.toContain('+');
    }
  });

  it('closes the French le/la round when only colours are chosen', () => {
    // Colours are adjectives, so that round genuinely cannot be built.
    const pack = findPack('french')!;
    expect(isLevelAvailable(pack, 4, { topics: ['colours'] })).toBe(false);
    expect(isLevelAvailable(pack, 1, { topics: ['colours'] })).toBe(true);
    // Numbers do not use topics at all, so they stay open.
    expect(isLevelAvailable(pack, 3, { topics: [] })).toBe(true);
  });

  it('can leave a pack with nothing playable at all', () => {
    // Science has one level fed by one option, so emptying it empties the game.
    const pack = findPack('science')!;
    expect(availableLevels(pack, { topics: [] })).toEqual([]);
  });

  it('keeps English rounds that do not use word sets', () => {
    const pack = findPack('english')!;
    const numbers = availableLevels(pack, { wordSets: [] }).map((l) => l.number);
    expect(numbers).toEqual([3, 4]);
  });
});
