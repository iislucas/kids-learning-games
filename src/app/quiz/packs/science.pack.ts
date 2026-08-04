import { Rng } from '../../core/rng';
import {
  PackOption,
  PackSelection,
  Question,
  QuestionPack,
  makeChoice,
  selected,
} from '../question.types';

interface FactQuestion {
  topic: string;
  instruction: string;
  prompt: string;
  emoji: string;
  correct: string;
  distractors: string[];
  explanation: string;
}

const FACTS: FactQuestion[] = [
  // animals
  { topic: 'animals', instruction: 'Where does it live?', prompt: 'Dolphin', emoji: '🐬', correct: 'In the sea', distractors: ['In a tree', 'Under the ground', 'In the desert'], explanation: 'Dolphins live in the sea and breathe air at the surface.' },
  { topic: 'animals', instruction: 'What does it eat?', prompt: 'Rabbit', emoji: '🐰', correct: 'Plants', distractors: ['Meat', 'Rocks', 'Metal'], explanation: 'Rabbits are herbivores, so they eat plants.' },
  { topic: 'animals', instruction: 'How many legs?', prompt: 'Spider', emoji: '🕷️', correct: '8', distractors: ['6', '4', '10'], explanation: 'All spiders have eight legs.' },
  { topic: 'animals', instruction: 'How many legs?', prompt: 'Butterfly', emoji: '🦋', correct: '6', distractors: ['8', '4', '2'], explanation: 'Butterflies are insects, and insects have six legs.' },
  { topic: 'animals', instruction: 'Which animal lays eggs?', prompt: '🥚', emoji: '🥚', correct: 'Chicken', distractors: ['Cow', 'Dog', 'Cat'], explanation: 'Birds like chickens lay eggs.' },
  { topic: 'animals', instruction: 'What is a baby frog called?', prompt: 'Frog', emoji: '🐸', correct: 'Tadpole', distractors: ['Puppy', 'Chick', 'Kitten'], explanation: 'Frogs start life as tadpoles in the water.' },
  { topic: 'animals', instruction: 'Which one can fly?', prompt: '✈️', emoji: '🦅', correct: 'Eagle', distractors: ['Shark', 'Horse', 'Snake'], explanation: 'Eagles are birds, and birds have wings for flying.' },

  // the human body
  { topic: 'body', instruction: 'What does it do?', prompt: 'Your heart', emoji: '❤️', correct: 'Pumps blood', distractors: ['Helps you think', 'Digests food', 'Helps you see'], explanation: 'The heart pumps blood all around your body.' },
  { topic: 'body', instruction: 'What do you use to smell?', prompt: '👃', emoji: '👃', correct: 'Nose', distractors: ['Ears', 'Elbow', 'Knee'], explanation: 'You smell with your nose.' },
  { topic: 'body', instruction: 'What does it do?', prompt: 'Your lungs', emoji: '🫁', correct: 'Help you breathe', distractors: ['Pump blood', 'Store food', 'Make bones'], explanation: 'Lungs take in air so your body gets oxygen.' },
  { topic: 'body', instruction: 'How many teeth do most grown-ups have?', prompt: '🦷', emoji: '🦷', correct: '32', distractors: ['12', '20', '50'], explanation: 'Adults usually have 32 teeth.' },
  { topic: 'body', instruction: 'What protects your brain?', prompt: '🧠', emoji: '🧠', correct: 'Your skull', distractors: ['Your ribs', 'Your skin only', 'Your hair'], explanation: 'The skull is a hard bone that protects the brain.' },

  // space
  { topic: 'space', instruction: 'Which planet do we live on?', prompt: '🌍', emoji: '🌍', correct: 'Earth', distractors: ['Mars', 'Jupiter', 'Venus'], explanation: 'We live on Earth, the third planet from the Sun.' },
  { topic: 'space', instruction: 'What is the Sun?', prompt: '☀️', emoji: '☀️', correct: 'A star', distractors: ['A planet', 'A moon', 'A cloud'], explanation: 'The Sun is a star — our closest one.' },
  { topic: 'space', instruction: 'Which planet is called the red planet?', prompt: '🔴', emoji: '🪐', correct: 'Mars', distractors: ['Saturn', 'Neptune', 'Mercury'], explanation: 'Mars looks red because of rusty iron dust.' },
  { topic: 'space', instruction: 'What goes around the Earth?', prompt: '🌙', emoji: '🌙', correct: 'The Moon', distractors: ['The Sun', 'Mars', 'A comet'], explanation: 'The Moon orbits the Earth about once a month.' },
  { topic: 'space', instruction: 'Which planet has big rings?', prompt: '🪐', emoji: '🪐', correct: 'Saturn', distractors: ['Earth', 'Mercury', 'Venus'], explanation: 'Saturn has bright rings made of ice and rock.' },

  // nature and weather
  { topic: 'nature', instruction: 'What do plants need to make food?', prompt: '🌱', emoji: '🌱', correct: 'Sunlight', distractors: ['Darkness', 'Sand', 'Plastic'], explanation: 'Plants use sunlight, water and air to make their own food.' },
  { topic: 'nature', instruction: 'What falls from clouds when it is very cold?', prompt: '☁️', emoji: '❄️', correct: 'Snow', distractors: ['Sand', 'Leaves', 'Stones'], explanation: 'When it is cold enough, water in clouds freezes into snow.' },
  { topic: 'nature', instruction: 'What makes a rainbow?', prompt: '🌈', emoji: '🌈', correct: 'Sunlight and rain', distractors: ['Wind and sand', 'Snow and ice', 'Fire and smoke'], explanation: 'Sunlight bends through raindrops and splits into colours.' },
  { topic: 'nature', instruction: 'What do bees collect from flowers?', prompt: '🐝', emoji: '🌸', correct: 'Nectar', distractors: ['Water', 'Sand', 'Leaves'], explanation: 'Bees collect nectar and turn it into honey.' },
  { topic: 'nature', instruction: 'What is ice made of?', prompt: '🧊', emoji: '🧊', correct: 'Frozen water', distractors: ['Frozen milk', 'Frozen sand', 'Frozen air'], explanation: 'Ice is water that has frozen solid.' },
  { topic: 'nature', instruction: 'Which is the largest ocean?', prompt: '🌊', emoji: '🌊', correct: 'Pacific', distractors: ['Atlantic', 'Indian', 'Arctic'], explanation: 'The Pacific Ocean is the biggest ocean on Earth.' },
];

const TOPICS_OPTION: PackOption = {
  id: 'topics',
  label: 'Quiz topics',
  hint: 'What should the questions be about?',
  defaults: ['animals', 'body', 'space', 'nature'],
  choices: [
    { value: 'animals', label: 'Animals', emoji: '🐬' },
    { value: 'body', label: 'Your body', emoji: '❤️' },
    { value: 'space', label: 'Space', emoji: '🪐' },
    { value: 'nature', label: 'Nature & weather', emoji: '🌈' },
  ],
};

/**
 * General knowledge. Topics are a pack option rather than levels: space is not
 * harder than animals, so making them a difficulty ladder was never honest, and
 * as options they can be mixed freely or narrowed to whatever is being covered
 * at school.
 */
export const sciencePack: QuestionPack = {
  id: 'science',
  title: 'Wonder Quiz',
  emoji: '🔬',
  colour: '#1fa97a',
  description: 'Animals, bodies, space and nature.',
  levels: [{ number: 1, name: 'Quiz' }],
  options: [TOPICS_OPTION],

  generate(_level: number, rng: Rng, selection: PackSelection): Question {
    const topics = selected(selection, TOPICS_OPTION);
    const pool = FACTS.filter((fact) => topics.includes(fact.topic));
    const fact = rng.pick(pool.length > 0 ? pool : FACTS);
    return makeChoice(rng, {
      instruction: fact.instruction,
      prompt: fact.prompt,
      emoji: fact.emoji,
      correct: fact.correct,
      distractors: fact.distractors,
      explanation: fact.explanation,
    });
  },
};
