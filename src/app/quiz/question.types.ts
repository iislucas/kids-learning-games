import { Rng } from '../core/rng';

export interface Question {
  /** Main text, e.g. "7 + 5" or "Which animal lives in the sea?". */
  prompt: string;
  /** Optional smaller line above the prompt, e.g. "Spell the missing letter". */
  instruction?: string;
  /** Large decorative emoji shown with the question. */
  emoji?: string;
  choices: string[];
  correctIndex: number;
  /** Shown after a wrong answer to teach rather than just mark. */
  explanation?: string;
}

export interface Level {
  /** 1-based. */
  number: number;
  name: string;
}

export interface QuestionPack {
  id: string;
  title: string;
  emoji: string;
  /** Theme colour, used for the card and the play screen accent. */
  colour: string;
  description: string;
  levels: Level[];
  /** Generates one question for the given 1-based level. */
  generate(level: number, rng: Rng): Question;
}

/** Builds a multiple-choice question, shuffling so the answer moves around. */
export function makeChoice(
  rng: Rng,
  parts: {
    prompt: string;
    correct: string;
    distractors: string[];
    instruction?: string;
    emoji?: string;
    explanation?: string;
  },
): Question {
  const unique = [...new Set(parts.distractors.filter((d) => d !== parts.correct))];
  const choices = rng.shuffle([parts.correct, ...unique.slice(0, 3)]);
  return {
    prompt: parts.prompt,
    instruction: parts.instruction,
    emoji: parts.emoji,
    explanation: parts.explanation,
    choices,
    correctIndex: choices.indexOf(parts.correct),
  };
}

/**
 * Builds numeric distractors that are close enough to require actually doing
 * the sum. Options that are wildly off can be eliminated at a glance, which
 * turns the question into a spotting exercise rather than a maths one.
 */
export function numericDistractors(
  rng: Rng,
  answer: number,
  options: { min?: number; spread?: number } = {},
): string[] {
  const min = options.min ?? 0;
  const spread = options.spread ?? 3;
  const candidates = new Set<number>();
  let guard = 0;
  while (candidates.size < 6 && guard++ < 60) {
    const offset = rng.int(-spread, spread);
    const candidate = answer + offset;
    if (candidate !== answer && candidate >= min) candidates.add(candidate);
  }
  // Guarantee three options even for tiny answers where the window is narrow.
  let extra = answer + spread + 1;
  while (candidates.size < 3) candidates.add(extra++);
  return rng.shuffle([...candidates]).map(String);
}
