import { Rng } from '../../core/rng';
import { makeChoice, Question, QuestionPack } from '../question.types';

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

  generate(level: number, rng: Rng): Question {
    switch (level) {
      case 1:
        return frenchToEnglish(rng);
      case 2:
        return englishToFrench(rng);
      case 3:
        return numbers(rng);
      default:
        return article(rng);
    }
  },
};

function frenchToEnglish(rng: Rng): Question {
  const word = rng.pick(WORDS);
  return makeChoice(rng, {
    instruction: 'What does this mean?',
    prompt: word.fr,
    emoji: '🇫🇷',
    correct: word.en,
    // Distractors from the same topic, so the picture cannot give it away.
    distractors: rng
      .sample(
        WORDS.filter((w) => w.topic === word.topic && w.en !== word.en),
        3,
      )
      .map((w) => w.en),
    explanation: `${word.fr} = ${word.en} ${word.emoji}`,
  });
}

function englishToFrench(rng: Rng): Question {
  const word = rng.pick(WORDS);
  return makeChoice(rng, {
    instruction: 'How do you say this in French?',
    prompt: word.en,
    emoji: word.emoji,
    correct: word.fr,
    distractors: rng
      .sample(
        WORDS.filter((w) => w.topic === word.topic && w.fr !== word.fr),
        3,
      )
      .map((w) => w.fr),
    explanation: `${word.en} = ${word.fr}`,
  });
}

function numbers(rng: Rng): Question {
  const value = rng.int(0, 10);
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

function article(rng: Rng): Question {
  // Colours are adjectives, so "le/la" is meaningless for them.
  const word = rng.pick(WORDS.filter((w) => w.topic !== 'colours'));
  return makeChoice(rng, {
    instruction: 'Le or la?',
    prompt: `___ ${word.fr}`,
    emoji: word.emoji,
    correct: word.gender,
    distractors: [word.gender === 'le' ? 'la' : 'le'],
    explanation: `${word.gender} ${word.fr} (${word.en})`,
  });
}
