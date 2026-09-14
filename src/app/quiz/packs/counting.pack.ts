import { Rng } from '../../core/rng';
import {
  Challenge,
  PackSelection,
  Question,
  QuestionPack,
  completeSet,
  makeChoice,
  numericDistractors,
} from '../question.types';

interface Thing {
  emoji: string;
  one: string;
  many: string;
}

/**
 * What there is to count. Everyday things a small child can name, and nothing
 * that looks like the game's own ⭐ rewards.
 */
const THINGS: Thing[] = [
  { emoji: '🌼', one: 'flower', many: 'flowers' },
  { emoji: '🌳', one: 'tree', many: 'trees' },
  { emoji: '🐱', one: 'cat', many: 'cats' },
  { emoji: '🐶', one: 'dog', many: 'dogs' },
  { emoji: '🍎', one: 'apple', many: 'apples' },
  { emoji: '🐟', one: 'fish', many: 'fish' },
  { emoji: '🦆', one: 'duck', many: 'ducks' },
  { emoji: '🦋', one: 'butterfly', many: 'butterflies' },
  { emoji: '🎈', one: 'balloon', many: 'balloons' },
  { emoji: '🚗', one: 'car', many: 'cars' },
  { emoji: '🍓', one: 'strawberry', many: 'strawberries' },
  { emoji: '🐸', one: 'frog', many: 'frogs' },
  // Its place on the map is a beach.
  { emoji: '🐚', one: 'shell', many: 'shells' },
  { emoji: '🦀', one: 'crab', many: 'crabs' },
];

/** The numbers each level counts up to, from 1. */
const LEVEL_MAX: Record<number, number> = { 1: 5, 2: 10, 3: 20 };

/** Every whole number from `from` to `to`. */
function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/**
 * One challenge per band of five, so each is short enough for a small child to
 * get every one right and the next band is always in sight.
 */
const COUNTING_CHALLENGES: Challenge[] = [1, 6, 11, 16].map((from) => {
  const to = from + 4;
  return completeSet({
    id: `counting.${from}-${to}`,
    name: `Counting ${from} to ${to}`,
    // "11–15" is too long for a signpost; the top of the band says enough.
    short: `…${to}`,
    emoji: '🐚',
    items: range(from, to),
    ask: countingQuestion,
  });
});

/**
 * Counting, for younger players: a group of things, and four numbers to pick
 * how many there are.
 *
 * The levels are how far the counting goes. The things themselves are just
 * variety — a cat is not harder to count than a flower — so they are neither a
 * level nor an option.
 */
export const countingPack: QuestionPack = {
  id: 'counting',
  title: 'Counting',
  emoji: '🐚',
  colour: '#f29a2e',
  description: 'How many are there? Count and pick the number.',
  levels: [
    { number: 1, name: 'Up to 5' },
    { number: 2, name: 'Up to 10' },
    { number: 3, name: 'Up to 20' },
  ],
  challenges: COUNTING_CHALLENGES,

  generate(level: number, rng: Rng, _selection: PackSelection): Question {
    const max = LEVEL_MAX[level] ?? LEVEL_MAX[1];
    return countingQuestion(rng, rng.int(1, max));
  },
};

/** "How many cats?" with that many cats to count. */
function countingQuestion(rng: Rng, amount: number): Question {
  const thing = rng.pick(THINGS);
  const name = amount === 1 ? thing.one : thing.many;
  const question = makeChoice(rng, {
    instruction: `How many ${thing.many}?`,
    // The things themselves are the question (see `count`); this is only what
    // tells two counts of different things apart.
    prompt: thing.emoji,
    correct: String(amount),
    // Neighbouring numbers: miscounting by one is the mistake worth catching,
    // and a far-off number could be ruled out without counting at all.
    distractors: numericDistractors(rng, amount, {
      min: 1,
      spread: amount <= 5 ? 2 : 3,
    }),
    // The play screen numbers each thing alongside this, which does the
    // counting out loud better than a long list of numbers would.
    explanation: amount === 1 ? `There is just 1 ${name}.` : `There are ${amount} ${name}.`,
  });
  return { ...question, count: { emoji: thing.emoji, amount } };
}
