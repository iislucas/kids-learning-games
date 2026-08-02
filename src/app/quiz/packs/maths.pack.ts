import { Rng } from '../../core/rng';
import {
  makeChoice,
  numericDistractors,
  Question,
  QuestionPack,
} from '../question.types';

/**
 * Arithmetic, generated rather than listed, so it never runs out.
 *
 * The level ladder follows how arithmetic is actually taught at this age:
 * bonds within 10, then within 20, then subtraction, then the easy times
 * tables (2, 5, 10) before the harder ones.
 */
export const mathsPack: QuestionPack = {
  id: 'maths',
  title: 'Number Fun',
  emoji: '🔢',
  colour: '#4f8ff7',
  description: 'Adding, taking away and times tables.',
  levels: [
    { number: 1, name: 'Adding to 10' },
    { number: 2, name: 'Adding to 20' },
    { number: 3, name: 'Taking away' },
    { number: 4, name: 'Mixed sums' },
    { number: 5, name: '2, 5 and 10 times' },
    { number: 6, name: 'All times tables' },
  ],

  generate(level: number, rng: Rng): Question {
    switch (level) {
      case 1:
        return addition(rng, 1, 9, 10);
      case 2:
        return addition(rng, 2, 18, 20);
      case 3:
        return subtraction(rng, 20);
      case 4:
        return rng.next() < 0.5 ? addition(rng, 2, 20, 25) : subtraction(rng, 25);
      case 5:
        return multiplication(rng, [2, 5, 10]);
      default:
        return multiplication(rng, [2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
  },
};

function addition(rng: Rng, min: number, max: number, total: number): Question {
  const a = rng.int(min, Math.max(min, total - min));
  const b = rng.int(min, Math.max(min, Math.min(max, total - a)));
  const answer = a + b;
  return makeChoice(rng, {
    prompt: `${a} + ${b} = ?`,
    emoji: '➕',
    correct: String(answer),
    distractors: numericDistractors(rng, answer, { min: 0, spread: 3 }),
    explanation: `${a} + ${b} = ${answer}`,
  });
}

function subtraction(rng: Rng, max: number): Question {
  // Pick the larger number first so the answer is never negative.
  const a = rng.int(3, max);
  const b = rng.int(1, a);
  const answer = a - b;
  return makeChoice(rng, {
    prompt: `${a} − ${b} = ?`,
    emoji: '➖',
    correct: String(answer),
    distractors: numericDistractors(rng, answer, { min: 0, spread: 3 }),
    explanation: `${a} − ${b} = ${answer}`,
  });
}

function multiplication(rng: Rng, tables: number[]): Question {
  const a = rng.pick(tables);
  const b = rng.int(1, 10);
  const answer = a * b;
  return makeChoice(rng, {
    prompt: `${a} × ${b} = ?`,
    emoji: '✖️',
    // Near-miss multiples are the mistakes children actually make, so they
    // make far better distractors than random numbers.
    correct: String(answer),
    distractors: [
      String(a * (b + 1)),
      String(a * Math.max(1, b - 1)),
      String(answer + a > 0 ? answer + rng.int(1, 3) : answer + 1),
      ...numericDistractors(rng, answer, { min: 0, spread: 6 }),
    ],
    explanation: `${a} × ${b} = ${answer}`,
  });
}
