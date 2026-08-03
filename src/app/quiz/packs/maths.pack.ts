import { Rng } from '../../core/rng';
import {
  PackOption,
  PackSelection,
  Question,
  QuestionPack,
  makeChoice,
  numericDistractors,
  selected,
} from '../question.types';

const TABLES_OPTION: PackOption = {
  id: 'tables',
  label: 'Times tables',
  hint: 'Which tables should the multiplying questions use?',
  // Defaults to the set a 7-year-old is typically working through; the 6-9
  // tables are there to switch on as they come up at school.
  defaults: ['2', '3', '4', '5', '10'],
  minSelected: 1,
  levels: [5],
  choices: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => ({
    value: String(n),
    label: `${n}×`,
  })),
};

const OPERATIONS_OPTION: PackOption = {
  id: 'operations',
  label: 'Mixed sums use',
  hint: 'Which kinds of sum appear in the mixed round?',
  defaults: ['add', 'subtract'],
  minSelected: 1,
  levels: [4],
  choices: [
    { value: 'add', label: 'Adding', emoji: '➕' },
    { value: 'subtract', label: 'Taking away', emoji: '➖' },
    { value: 'multiply', label: 'Times', emoji: '✖️' },
  ],
};

/**
 * Arithmetic, generated rather than listed, so it never runs out.
 *
 * The level ladder follows how arithmetic is actually taught at this age: bonds
 * within 10, then within 20, then subtraction, then multiplication. Exactly
 * which tables the multiplying round uses is a pack option rather than a level,
 * so practice can be narrowed to whatever is being learned right now without
 * making the questions easier or harder.
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
    { number: 5, name: 'Times tables' },
  ],
  options: [TABLES_OPTION, OPERATIONS_OPTION],

  generate(level: number, rng: Rng, selection: PackSelection): Question {
    const tables = selected(selection, TABLES_OPTION).map(Number);

    switch (level) {
      case 1:
        return addition(rng, 1, 9, 10);
      case 2:
        return addition(rng, 2, 18, 20);
      case 3:
        return subtraction(rng, 20);
      case 4: {
        const operations = selected(selection, OPERATIONS_OPTION);
        switch (rng.pick(operations)) {
          case 'multiply':
            return multiplication(rng, tables);
          case 'subtract':
            return subtraction(rng, 25);
          default:
            return addition(rng, 2, 20, 25);
        }
      }
      default:
        return multiplication(rng, tables);
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
  // A selection can never legitimately be empty, but a hand-edited store could
  // make it so; fall back rather than throwing mid-round.
  const pool = tables.length > 0 ? tables : [2, 5, 10];
  const a = rng.pick(pool);
  const b = rng.int(1, 10);
  const answer = a * b;
  return makeChoice(rng, {
    prompt: `${a} × ${b} = ?`,
    emoji: '✖️',
    correct: String(answer),
    // Near-miss multiples are the mistakes children actually make, so they
    // make far better distractors than random numbers.
    distractors: [
      String(a * (b + 1)),
      String(a * Math.max(1, b - 1)),
      ...numericDistractors(rng, answer, { min: 0, spread: 6 }),
    ],
    explanation: `${a} × ${b} = ${answer}`,
  });
}
