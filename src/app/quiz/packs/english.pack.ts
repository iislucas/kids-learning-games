import { Rng } from '../../core/rng';
import { makeChoice, Question, QuestionPack } from '../question.types';

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

  generate(level: number, rng: Rng): Question {
    switch (level) {
      case 1:
        return missingLetter(rng, 1);
      case 2:
        return spellWord(rng, 2);
      case 3:
        return rhyme(rng);
      default:
        return sightWord(rng);
    }
  },
};

function wordsUpToBand(band: number): WordEntry[] {
  return WORDS.filter((entry) => entry.band <= band);
}

function missingLetter(rng: Rng, band: number): Question {
  const entry = rng.pick(wordsUpToBand(band + 1));
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

function spellWord(rng: Rng, band: number): Question {
  const entry = rng.pick(wordsUpToBand(band + 1));
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
  const group = rng.pick(RHYME_GROUPS);
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
  const word = rng.pick(SIGHT_WORDS);
  return makeChoice(rng, {
    instruction: 'Which one is spelled correctly?',
    prompt: '👀',
    emoji: '📖',
    correct: word,
    distractors: misspellings(rng, word),
    explanation: `The word is "${word}".`,
  });
}
