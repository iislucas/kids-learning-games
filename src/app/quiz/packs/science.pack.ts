import { Rng } from '../../core/rng';
import { makeChoice, Question, QuestionPack } from '../question.types';

interface FactQuestion {
  level: number;
  instruction: string;
  prompt: string;
  emoji: string;
  correct: string;
  distractors: string[];
  explanation: string;
}

const FACTS: FactQuestion[] = [
  // Level 1 — animals
  { level: 1, instruction: 'Where does it live?', prompt: 'Dolphin', emoji: '🐬', correct: 'In the sea', distractors: ['In a tree', 'Under the ground', 'In the desert'], explanation: 'Dolphins live in the sea and breathe air at the surface.' },
  { level: 1, instruction: 'What does it eat?', prompt: 'Rabbit', emoji: '🐰', correct: 'Plants', distractors: ['Meat', 'Rocks', 'Metal'], explanation: 'Rabbits are herbivores, so they eat plants.' },
  { level: 1, instruction: 'How many legs?', prompt: 'Spider', emoji: '🕷️', correct: '8', distractors: ['6', '4', '10'], explanation: 'All spiders have eight legs.' },
  { level: 1, instruction: 'How many legs?', prompt: 'Butterfly', emoji: '🦋', correct: '6', distractors: ['8', '4', '2'], explanation: 'Butterflies are insects, and insects have six legs.' },
  { level: 1, instruction: 'Which animal lays eggs?', prompt: '🥚', emoji: '🥚', correct: 'Chicken', distractors: ['Cow', 'Dog', 'Cat'], explanation: 'Birds like chickens lay eggs.' },
  { level: 1, instruction: 'What is a baby frog called?', prompt: 'Frog', emoji: '🐸', correct: 'Tadpole', distractors: ['Puppy', 'Chick', 'Kitten'], explanation: 'Frogs start life as tadpoles in the water.' },
  { level: 1, instruction: 'Which one can fly?', prompt: '✈️', emoji: '🦅', correct: 'Eagle', distractors: ['Shark', 'Horse', 'Snake'], explanation: 'Eagles are birds, and birds have wings for flying.' },

  // Level 2 — the human body
  { level: 2, instruction: 'What does it do?', prompt: 'Your heart', emoji: '❤️', correct: 'Pumps blood', distractors: ['Helps you think', 'Digests food', 'Helps you see'], explanation: 'The heart pumps blood all around your body.' },
  { level: 2, instruction: 'What do you use to smell?', prompt: '👃', emoji: '👃', correct: 'Nose', distractors: ['Ears', 'Elbow', 'Knee'], explanation: 'You smell with your nose.' },
  { level: 2, instruction: 'What does it do?', prompt: 'Your lungs', emoji: '🫁', correct: 'Help you breathe', distractors: ['Pump blood', 'Store food', 'Make bones'], explanation: 'Lungs take in air so your body gets oxygen.' },
  { level: 2, instruction: 'How many teeth do most grown-ups have?', prompt: '🦷', emoji: '🦷', correct: '32', distractors: ['12', '20', '50'], explanation: 'Adults usually have 32 teeth.' },
  { level: 2, instruction: 'What protects your brain?', prompt: '🧠', emoji: '🧠', correct: 'Your skull', distractors: ['Your ribs', 'Your skin only', 'Your hair'], explanation: 'The skull is a hard bone that protects the brain.' },

  // Level 3 — space
  { level: 3, instruction: 'Which planet do we live on?', prompt: '🌍', emoji: '🌍', correct: 'Earth', distractors: ['Mars', 'Jupiter', 'Venus'], explanation: 'We live on Earth, the third planet from the Sun.' },
  { level: 3, instruction: 'What is the Sun?', prompt: '☀️', emoji: '☀️', correct: 'A star', distractors: ['A planet', 'A moon', 'A cloud'], explanation: 'The Sun is a star — our closest one.' },
  { level: 3, instruction: 'Which planet is called the red planet?', prompt: '🔴', emoji: '🪐', correct: 'Mars', distractors: ['Saturn', 'Neptune', 'Mercury'], explanation: 'Mars looks red because of rusty iron dust.' },
  { level: 3, instruction: 'What goes around the Earth?', prompt: '🌙', emoji: '🌙', correct: 'The Moon', distractors: ['The Sun', 'Mars', 'A comet'], explanation: 'The Moon orbits the Earth about once a month.' },
  { level: 3, instruction: 'Which planet has big rings?', prompt: '🪐', emoji: '🪐', correct: 'Saturn', distractors: ['Earth', 'Mercury', 'Venus'], explanation: 'Saturn has bright rings made of ice and rock.' },

  // Level 4 — nature and weather
  { level: 4, instruction: 'What do plants need to make food?', prompt: '🌱', emoji: '🌱', correct: 'Sunlight', distractors: ['Darkness', 'Sand', 'Plastic'], explanation: 'Plants use sunlight, water and air to make their own food.' },
  { level: 4, instruction: 'What falls from clouds when it is very cold?', prompt: '☁️', emoji: '❄️', correct: 'Snow', distractors: ['Sand', 'Leaves', 'Stones'], explanation: 'When it is cold enough, water in clouds freezes into snow.' },
  { level: 4, instruction: 'What makes a rainbow?', prompt: '🌈', emoji: '🌈', correct: 'Sunlight and rain', distractors: ['Wind and sand', 'Snow and ice', 'Fire and smoke'], explanation: 'Sunlight bends through raindrops and splits into colours.' },
  { level: 4, instruction: 'What do bees collect from flowers?', prompt: '🐝', emoji: '🌸', correct: 'Nectar', distractors: ['Water', 'Sand', 'Leaves'], explanation: 'Bees collect nectar and turn it into honey.' },
  { level: 4, instruction: 'What is ice made of?', prompt: '🧊', emoji: '🧊', correct: 'Frozen water', distractors: ['Frozen milk', 'Frozen sand', 'Frozen air'], explanation: 'Ice is water that has frozen solid.' },
  { level: 4, instruction: 'Which is the largest ocean?', prompt: '🌊', emoji: '🌊', correct: 'Pacific', distractors: ['Atlantic', 'Indian', 'Arctic'], explanation: 'The Pacific Ocean is the biggest ocean on Earth.' },
];

export const sciencePack: QuestionPack = {
  id: 'science',
  title: 'Wonder Quiz',
  emoji: '🔬',
  colour: '#1fa97a',
  description: 'Animals, bodies, space and nature.',
  levels: [
    { number: 1, name: 'Animals' },
    { number: 2, name: 'Your body' },
    { number: 3, name: 'Space' },
    { number: 4, name: 'Nature' },
  ],

  generate(level: number, rng: Rng): Question {
    const pool = FACTS.filter((fact) => fact.level === level);
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
