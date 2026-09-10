import { Rng } from '../../core/rng';
import {
  Challenge,
  PackOption,
  PackSelection,
  Question,
  QuestionPack,
  makeChoice,
  selected,
} from '../question.types';

interface WordEntry {
  word: string;
  emoji: string;
  /** Rough difficulty band, 1 (easiest) to 3. */
  band: number;
}

const WORDS: WordEntry[] = [
  { word: 'cat', emoji: '🐱', band: 1 },
  { word: 'dog', emoji: '🐶', band: 1 },
  { word: 'sun', emoji: '☀️', band: 1 },
  { word: 'hat', emoji: '🎩', band: 1 },
  { word: 'bus', emoji: '🚌', band: 1 },
  { word: 'cup', emoji: '☕', band: 1 },
  { word: 'fish', emoji: '🐟', band: 1 },
  { word: 'frog', emoji: '🐸', band: 1 },
  { word: 'star', emoji: '⭐', band: 1 },
  { word: 'tree', emoji: '🌳', band: 1 },
  { word: 'book', emoji: '📖', band: 2 },
  { word: 'apple', emoji: '🍎', band: 2 },
  { word: 'house', emoji: '🏠', band: 2 },
  { word: 'train', emoji: '🚂', band: 2 },
  { word: 'horse', emoji: '🐴', band: 2 },
  { word: 'cloud', emoji: '☁️', band: 2 },
  { word: 'chair', emoji: '🪑', band: 2 },
  { word: 'bread', emoji: '🍞', band: 2 },
  { word: 'flower', emoji: '🌸', band: 2 },
  { word: 'rocket', emoji: '🚀', band: 3 },
  { word: 'penguin', emoji: '🐧', band: 3 },
  { word: 'rainbow', emoji: '🌈', band: 3 },
  { word: 'elephant', emoji: '🐘', band: 3 },
  { word: 'butterfly', emoji: '🦋', band: 3 },
  { word: 'strawberry', emoji: '🍓', band: 3 },
  { word: 'dinosaur', emoji: '🦕', band: 3 },
  { word: 'umbrella', emoji: '☂️', band: 3 },
];

/** Common sight words, which are learned by shape rather than sounded out. */
const SIGHT_WORDS = [
  'the', 'and', 'said', 'you', 'they', 'was', 'have', 'like',
  'some', 'come', 'were', 'there', 'little', 'what', 'when', 'because',
];

const RHYME_GROUPS: string[][] = [
  ['cat', 'hat', 'bat', 'mat'],
  ['dog', 'log', 'frog', 'jog'],
  ['sun', 'run', 'fun', 'bun'],
  ['tree', 'bee', 'see', 'free'],
  ['star', 'car', 'jar', 'far'],
  ['cake', 'lake', 'snake', 'rake'],
];

const WORD_SETS_OPTION: PackOption = {
  id: 'wordSets',
  label: 'Word difficulty',
  hint: 'Which words appear in the letter and spelling rounds?',
  defaults: ['1', '2'],
  levels: [1, 2],
  choices: [
    { value: '1', label: 'Short words', emoji: '🐱' },
    { value: '2', label: 'Longer words', emoji: '🏠' },
    { value: '3', label: 'Tricky words', emoji: '🦋' },
  ],
};

/**
 * The sixteen sight words are two challenges rather than one: a sixteen-question
 * round is a long time to hold a perfect score for a seven-year-old, and the
 * badge is meant to be winnable.
 */
const SIGHT_WORD_DECKS = [SIGHT_WORDS.slice(0, 8), SIGHT_WORDS.slice(8)];

const ENGLISH_CHALLENGES: Challenge[] = [
  ...WORD_SETS_OPTION.choices.map((choice): Challenge => {
    const band = Number(choice.value);
    const words = WORDS.filter((entry) => entry.band === band);
    return {
      id: `english.words.${band}`,
      name: `Spell every ${choice.label.toLowerCase().replace(/ words$/, '')} word`,
      short: choice.emoji ?? choice.label,
      emoji: choice.emoji ?? '📚',
      goal: `Spell all ${words.length} of them!`,
      requires: { optionId: WORD_SETS_OPTION.id, value: choice.value },
      deck: (rng: Rng) =>
        rng.shuffle(words).map((entry) => spellWordFor(rng, entry)),
    };
  }),
  ...SIGHT_WORD_DECKS.map((words, index): Challenge => ({
    id: `english.sight.${index + 1}`,
    name: `Tricky words ${index + 1}`,
    short: `👀${index + 1}`,
    emoji: '👀',
    goal: `Get all ${words.length} right!`,
    deck: (rng: Rng) =>
      rng.shuffle(words).map((word) => sightWordFor(rng, word)),
  })),
  {
    id: 'english.rhyme',
    name: 'Every rhyming family',
    short: '🎵',
    emoji: '🎵',
    goal: `Get all ${RHYME_GROUPS.length} right!`,
    deck: (rng: Rng) =>
      rng.shuffle(RHYME_GROUPS).map((group) => rhymeFor(rng, group)),
  },
];

export const englishPack: QuestionPack = {
  id: 'english',
  title: 'Word Play',
  emoji: '📚',
  colour: '#e8484f',
  description: 'Spelling, missing letters and rhyming words.',
  levels: [
    { number: 1, name: 'Missing letter' },
    { number: 2, name: 'Spell the word' },
    { number: 3, name: 'Rhyming words' },
    { number: 4, name: 'Tricky words' },
  ],
  options: [WORD_SETS_OPTION],
  challenges: ENGLISH_CHALLENGES,

  generate(level: number, rng: Rng, selection: PackSelection): Question {
    const bands = selected(selection, WORD_SETS_OPTION).map(Number);
    switch (level) {
      case 1:
        return missingLetter(rng, bands);
      case 2:
        return spellWord(rng, bands);
      case 3:
        return rhyme(rng);
      default:
        return sightWord(rng);
    }
  },
};

function wordsInBands(bands: number[]): WordEntry[] {
  const matching = WORDS.filter((entry) => bands.includes(entry.band));
  // Unreachable safety net: with every band switched off these levels are not
  // offered at all. Falling back beats throwing mid-round if that ever slips.
  return matching.length > 0 ? matching : WORDS;
}

function missingLetter(rng: Rng, bands: number[]): Question {
  const entry = rng.pick(wordsInBands(bands));
  const index = rng.int(0, entry.word.length - 1);
  const missing = entry.word[index];
  const masked =
    entry.word.slice(0, index) + '_' + entry.word.slice(index + 1);

  const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
  return makeChoice(rng, {
    instruction: 'Which letter is missing?',
    prompt: masked.split('').join(' '),
    emoji: entry.emoji,
    correct: missing,
    distractors: rng.sample(
      alphabet.filter((letter) => letter !== missing),
      3,
    ),
    explanation: `The word is "${entry.word}".`,
  });
}

function spellWord(rng: Rng, bands: number[]): Question {
  return spellWordFor(rng, rng.pick(wordsInBands(bands)));
}

/** Spelling one specific word. Shared with the challenge decks. */
function spellWordFor(rng: Rng, entry: WordEntry): Question {
  return makeChoice(rng, {
    instruction: 'How do you spell it?',
    prompt: entry.emoji,
    correct: entry.word,
    distractors: misspellings(rng, entry.word),
    explanation: `It is spelled "${entry.word}".`,
  });
}

/**
 * Plausible misspellings: swapped neighbours, doubled letters and dropped
 * letters are the errors children actually make, so wrong options look
 * tempting rather than obviously silly.
 */
function misspellings(rng: Rng, word: string): string[] {
  const out = new Set<string>();
  const letters = word.split('');

  if (letters.length > 2) {
    const i = rng.int(0, letters.length - 2);
    const swapped = [...letters];
    [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
    out.add(swapped.join(''));
  }
  const doubleAt = rng.int(0, letters.length - 1);
  out.add(
    word.slice(0, doubleAt) + letters[doubleAt] + word.slice(doubleAt),
  );
  const dropAt = rng.int(1, letters.length - 1);
  out.add(word.slice(0, dropAt) + word.slice(dropAt + 1));

  const vowelSwap = word.replace(/[aeiou]/, (v) =>
    v === 'e' ? 'a' : v === 'a' ? 'e' : v === 'i' ? 'e' : 'a',
  );
  out.add(vowelSwap);

  out.delete(word);
  return rng.shuffle([...out]);
}

function rhyme(rng: Rng): Question {
  return rhymeFor(rng, rng.pick(RHYME_GROUPS));
}

/** A rhyme question drawn from one specific family. */
function rhymeFor(rng: Rng, group: string[]): Question {
  const [target, ...rest] = rng.shuffle(group);
  const answer = rng.pick(rest);
  const others = RHYME_GROUPS.filter((g) => g !== group).flat();

  return makeChoice(rng, {
    instruction: 'Which word rhymes?',
    prompt: target,
    emoji: '🎵',
    correct: answer,
    distractors: rng.sample(others, 3),
    explanation: `"${target}" and "${answer}" rhyme.`,
  });
}

function sightWord(rng: Rng): Question {
  return sightWordFor(rng, rng.pick(SIGHT_WORDS));
}

/** "Which one is spelled correctly?" for one specific sight word. */
function sightWordFor(rng: Rng, word: string): Question {
  return makeChoice(rng, {
    instruction: 'Which one is spelled correctly?',
    prompt: '👀',
    emoji: '📖',
    correct: word,
    distractors: misspellings(rng, word),
    explanation: `The word is "${word}".`,
  });
}
