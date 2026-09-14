import { Rng } from '../../core/rng';
import {
  Challenge,
  PackOption,
  PackSelection,
  Question,
  QuestionPack,
  completeSet,
  makeChoice,
  selected,
} from '../question.types';

interface FrenchWord {
  fr: string;
  en: string;
  emoji: string;
  /** Grammatical gender, for the article questions. */
  gender: 'le' | 'la';
  topic: 'animals' | 'food' | 'colours' | 'school' | 'family';
}

const WORDS: FrenchWord[] = [
  { fr: 'chat', en: 'cat', emoji: '🐱', gender: 'le', topic: 'animals' },
  { fr: 'chien', en: 'dog', emoji: '🐶', gender: 'le', topic: 'animals' },
  { fr: 'oiseau', en: 'bird', emoji: '🐦', gender: 'le', topic: 'animals' },
  { fr: 'souris', en: 'mouse', emoji: '🐭', gender: 'la', topic: 'animals' },
  { fr: 'cheval', en: 'horse', emoji: '🐴', gender: 'le', topic: 'animals' },
  { fr: 'poisson', en: 'fish', emoji: '🐟', gender: 'le', topic: 'animals' },
  { fr: 'grenouille', en: 'frog', emoji: '🐸', gender: 'la', topic: 'animals' },
  { fr: 'vache', en: 'cow', emoji: '🐮', gender: 'la', topic: 'animals' },

  { fr: 'pomme', en: 'apple', emoji: '🍎', gender: 'la', topic: 'food' },
  { fr: 'pain', en: 'bread', emoji: '🍞', gender: 'le', topic: 'food' },
  { fr: 'fromage', en: 'cheese', emoji: '🧀', gender: 'le', topic: 'food' },
  { fr: 'gâteau', en: 'cake', emoji: '🍰', gender: 'le', topic: 'food' },
  { fr: 'lait', en: 'milk', emoji: '🥛', gender: 'le', topic: 'food' },
  { fr: 'fraise', en: 'strawberry', emoji: '🍓', gender: 'la', topic: 'food' },
  { fr: 'banane', en: 'banana', emoji: '🍌', gender: 'la', topic: 'food' },

  { fr: 'rouge', en: 'red', emoji: '🔴', gender: 'le', topic: 'colours' },
  { fr: 'bleu', en: 'blue', emoji: '🔵', gender: 'le', topic: 'colours' },
  { fr: 'vert', en: 'green', emoji: '🟢', gender: 'le', topic: 'colours' },
  { fr: 'jaune', en: 'yellow', emoji: '🟡', gender: 'le', topic: 'colours' },
  { fr: 'noir', en: 'black', emoji: '⚫', gender: 'le', topic: 'colours' },
  { fr: 'violet', en: 'purple', emoji: '🟣', gender: 'le', topic: 'colours' },

  { fr: 'livre', en: 'book', emoji: '📖', gender: 'le', topic: 'school' },
  { fr: 'crayon', en: 'pencil', emoji: '✏️', gender: 'le', topic: 'school' },
  { fr: 'école', en: 'school', emoji: '🏫', gender: 'la', topic: 'school' },
  { fr: 'chaise', en: 'chair', emoji: '🪑', gender: 'la', topic: 'school' },
  { fr: 'porte', en: 'door', emoji: '🚪', gender: 'la', topic: 'school' },

  { fr: 'maman', en: 'mum', emoji: '👩', gender: 'la', topic: 'family' },
  { fr: 'papa', en: 'dad', emoji: '👨', gender: 'le', topic: 'family' },
  { fr: 'soeur', en: 'sister', emoji: '👧', gender: 'la', topic: 'family' },
  { fr: 'frère', en: 'brother', emoji: '👦', gender: 'le', topic: 'family' },
  { fr: 'maison', en: 'house', emoji: '🏠', gender: 'la', topic: 'family' },
];

const NUMBERS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq',
  'six', 'sept', 'huit', 'neuf', 'dix',
];

const TOPICS_OPTION: PackOption = {
  id: 'topics',
  label: 'Word topics',
  hint: 'Which kinds of French word should come up?',
  defaults: ['animals', 'food', 'colours', 'school', 'family'],
  levels: [1, 2, 4],
  choices: [
    { value: 'animals', label: 'Animals', emoji: '🐱' },
    { value: 'food', label: 'Food', emoji: '🍎' },
    { value: 'colours', label: 'Colours', emoji: '🔴' },
    { value: 'school', label: 'School', emoji: '📖' },
    { value: 'family', label: 'Family & home', emoji: '🏠' },
  ],
};

/**
 * One challenge per topic — every word in it, French to English — plus the
 * numbers, which are a closed set of eleven and belong to no topic.
 */
const FRENCH_CHALLENGES: Challenge[] = [
  ...TOPICS_OPTION.choices.map((choice) => {
    const words = WORDS.filter((word) => word.topic === choice.value);
    return completeSet({
      id: `french.topic.${choice.value}`,
      name: `${choice.label} in French`,
      short: choice.emoji ?? choice.label,
      emoji: choice.emoji ?? '🇫🇷',
      requires: { optionId: TOPICS_OPTION.id, value: choice.value },
      items: words,
      // Distractors come from the same topic, exactly as in a normal round, so
      // the emoji cannot give the answer away.
      ask: (rng, word) => frenchToEnglishFor(rng, word, words),
    });
  }),
  completeSet({
    id: 'french.numbers',
    name: 'Zéro to dix',
    short: '🔢',
    emoji: '🔢',
    items: NUMBERS.map((_, value) => value),
    ask: numberFor,
  }),
];

export const frenchPack: QuestionPack = {
  id: 'french',
  title: 'Français',
  emoji: '🇫🇷',
  colour: '#7a5cf0',
  description: 'French words, numbers and le or la.',
  levels: [
    { number: 1, name: 'What does it mean?' },
    { number: 2, name: 'Say it in French' },
    { number: 3, name: 'Numbers' },
    { number: 4, name: 'Le or la?' },
  ],
  options: [TOPICS_OPTION],
  challenges: FRENCH_CHALLENGES,

  generate(level: number, rng: Rng, selection: PackSelection): Question {
    const topics = selected(selection, TOPICS_OPTION);
    switch (level) {
      case 1:
        return frenchToEnglish(rng, topics);
      case 2:
        return englishToFrench(rng, topics);
      case 3:
        return numbers(rng);
      default:
        return article(rng, topics);
    }
  },

  levelAvailable(level: number, selection: PackSelection): boolean {
    // Colours are adjectives and have no le/la, so that round needs at least
    // one topic that contains nouns.
    if (level === 4) {
      return selected(selection, TOPICS_OPTION).some(
        (topic) => topic !== 'colours',
      );
    }
    return true;
  },
};

/**
 * Words in the chosen topics, never empty. `needed` guards the case where a
 * single narrow topic cannot supply enough distractors on its own.
 */
function wordsInTopics(topics: string[], needed = 1): FrenchWord[] {
  const matching = WORDS.filter((word) => topics.includes(word.topic));
  return matching.length >= needed ? matching : WORDS;
}

function frenchToEnglish(rng: Rng, topics: string[]): Question {
  const pool = wordsInTopics(topics);
  return frenchToEnglishFor(rng, rng.pick(pool), pool);
}

/** One specific word, French to English. Shared with the challenge decks. */
function frenchToEnglishFor(
  rng: Rng,
  word: FrenchWord,
  pool: FrenchWord[],
): Question {
  // Distractors from the same topic, so the picture cannot give it away —
  // falling back to the whole pool when that topic is too small.
  const sameTopic = pool.filter((w) => w.topic === word.topic && w.en !== word.en);
  const distractors = sameTopic.length >= 3 ? sameTopic : pool.filter((w) => w.en !== word.en);
  return makeChoice(rng, {
    instruction: 'What does this mean?',
    prompt: word.fr,
    emoji: '🇫🇷',
    correct: word.en,
    distractors: rng.sample(distractors, 3).map((w) => w.en),
    explanation: `${word.fr} = ${word.en} ${word.emoji}`,
  });
}

function englishToFrench(rng: Rng, topics: string[]): Question {
  const pool = wordsInTopics(topics);
  const word = rng.pick(pool);
  const sameTopic = pool.filter((w) => w.topic === word.topic && w.fr !== word.fr);
  const distractors = sameTopic.length >= 3 ? sameTopic : pool.filter((w) => w.fr !== word.fr);
  return makeChoice(rng, {
    instruction: 'How do you say this in French?',
    prompt: word.en,
    emoji: word.emoji,
    correct: word.fr,
    distractors: rng.sample(distractors, 3).map((w) => w.fr),
    explanation: `${word.en} = ${word.fr}`,
  });
}

function numbers(rng: Rng): Question {
  return numberFor(rng, rng.int(0, NUMBERS.length - 1));
}

/** "Which number is this?" for one specific number. */
function numberFor(rng: Rng, value: number): Question {
  return makeChoice(rng, {
    instruction: 'Which number is this?',
    prompt: NUMBERS[value],
    emoji: '🔢',
    correct: String(value),
    distractors: rng
      .sample(
        NUMBERS.map((_, i) => i).filter((i) => i !== value),
        3,
      )
      .map(String),
    explanation: `${NUMBERS[value]} = ${value}`,
  });
}

function article(rng: Rng, topics: string[]): Question {
  // Colours are adjectives, so "le/la" is meaningless for them. `levelAvailable`
  // keeps this round out of play when colours are the only topic chosen; the
  // fallback below is an unreachable safety net.
  const nouns = WORDS.filter((w) => w.topic !== 'colours');
  const inTopics = nouns.filter((w) => topics.includes(w.topic));
  const word = rng.pick(inTopics.length > 0 ? inTopics : nouns);
  return makeChoice(rng, {
    instruction: 'Le or la?',
    prompt: `___ ${word.fr}`,
    emoji: word.emoji,
    correct: word.gender,
    distractors: [word.gender === 'le' ? 'la' : 'le'],
    explanation: `${word.gender} ${word.fr} (${word.en})`,
  });
}
