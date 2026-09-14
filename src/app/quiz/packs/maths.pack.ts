import { Rng } from '../../core/rng';
import {
  Challenge,
  PackOption,
  PackSelection,
  Question,
  QuestionPack,
  completeSet,
  makeChoice,
  numericDistractors,
  selected,
} from '../question.types';

/** How far up each times table and each adding family goes. */
const FACTS_PER_FAMILY = 10;

const TABLES_OPTION: PackOption = {
  id: 'tables',
  label: 'Times tables',
  hint: 'Which tables should the multiplying questions use?',
  // Defaults to the set a 7-year-old is typically working through; the 6-9
  // tables are there to switch on as they come up at school.
  defaults: ['2', '3', '4', '5', '10'],
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
  levels: [4],
  choices: [
    { value: 'add', label: 'Adding', emoji: '➕' },
    { value: 'subtract', label: 'Taking away', emoji: '➖' },
    { value: 'multiply', label: 'Times', emoji: '✖️' },
  ],
};

/** 1 … 10, the multiplier or the number being added on. */
const FACT_RANGE = Array.from({ length: FACTS_PER_FAMILY }, (_, i) => i + 1);

/**
 * One challenge per times table, and one per adding family.
 *
 * The table challenges are gated on the `tables` option: switching the 8× table
 * off because it has not been taught yet should close its place on the map too,
 * not leave a spot that contradicts the settings. The adding families are not
 * gated, because no option narrows adding — the level ladder does that instead,
 * and a challenge is not a level.
 */
const MATHS_CHALLENGES: Challenge[] = [
  ...TABLES_OPTION.choices.map((choice) => {
    const table = Number(choice.value);
    return completeSet({
      id: `maths.times.${table}`,
      name: `The ${table} times table`,
      short: `${table}×`,
      emoji: '✖️',
      requires: { optionId: TABLES_OPTION.id, value: choice.value },
      items: FACT_RANGE,
      ask: (rng, b) => multiplicationFact(rng, table, b),
    });
  }),
  ...FACT_RANGE.map((n) =>
    completeSet({
      id: `maths.add.${n}`,
      name: `Adding ${n}`,
      short: `+${n}`,
      emoji: '➕',
      items: FACT_RANGE,
      ask: (rng, b) => additionFact(rng, n, b),
    }),
  ),
  // The exact inverse of the adding family: `n + b` becomes `(n + b) − n`, so
  // the answers are the same 1…10 and the pair can be practised against each
  // other. That is how taking away is taught at this age — as adding undone.
  ...FACT_RANGE.map((n) =>
    completeSet({
      id: `maths.sub.${n}`,
      name: `Taking away ${n}`,
      short: `−${n}`,
      emoji: '➖',
      items: FACT_RANGE,
      ask: (rng, b) => subtractionFact(rng, n + b, n),
    }),
  ),
];

/**
 * Arithmetic, generated rather than listed, so it never runs out.
 *
 * The level ladder follows how arithmetic is actually taught at this age: bonds
 * within 10, then within 20, then subtraction, then multiplication. Exactly
 * which tables the multiplying round uses is a pack option rather than a level,
 * so practice can be narrowed to whatever is being learned right now without
 * making the questions easier or harder.
 *
 * The challenges cut across that ladder: one table, or one adding family, asked
 * right through.
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
  challenges: MATHS_CHALLENGES,

  generate(level: number, rng: Rng, selection: PackSelection): Question {
    const tables = selected(selection, TABLES_OPTION).map(Number);

    switch (level) {
      case 1:
        return addition(rng, 1, 9, 10);
      case 2:
        return addition(rng, 2, 18, 20);
      case 3:
        return subtraction(rng, 20);
      case 4:
        switch (rng.pick(effectiveOperations(selection))) {
          case 'multiply':
            return multiplication(rng, tables);
          case 'subtract':
            return subtraction(rng, 25);
          default:
            return addition(rng, 2, 20, 25);
        }
      default:
        return multiplication(rng, tables);
    }
  },

  levelAvailable(level: number, selection: PackSelection): boolean {
    // Mixed sums can be left with nothing to do even though its own option is
    // non-empty: "Times" is the only operation chosen but every times table has
    // been switched off.
    if (level === 4) return effectiveOperations(selection).length > 0;
    return true;
  },
};

/**
 * The operations the mixed round can actually produce. Multiplying needs at
 * least one times table, so it drops out when they have all been turned off.
 */
function effectiveOperations(selection: PackSelection): string[] {
  const operations = selected(selection, OPERATIONS_OPTION);
  if (selected(selection, TABLES_OPTION).length > 0) return operations;
  return operations.filter((operation) => operation !== 'multiply');
}

function addition(rng: Rng, min: number, max: number, total: number): Question {
  const a = rng.int(min, Math.max(min, total - min));
  const b = rng.int(min, Math.max(min, Math.min(max, total - a)));
  return additionFact(rng, a, b);
}

/** One specific sum. Shared so a challenge deck asks it exactly as a round does. */
function additionFact(rng: Rng, a: number, b: number): Question {
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
  return subtractionFact(rng, a, rng.int(1, a));
}

/** One specific take-away, `a − b`. */
function subtractionFact(rng: Rng, a: number, b: number): Question {
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
  // Unreachable safety net: a level whose tables are all off is not offered in
  // the first place. Falling back beats throwing mid-round if that ever slips.
  const pool = tables.length > 0 ? tables : [2, 5, 10];
  return multiplicationFact(rng, rng.pick(pool), rng.int(1, FACTS_PER_FAMILY));
}

/** One specific times fact, `a × b`. */
function multiplicationFact(rng: Rng, a: number, b: number): Question {
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
