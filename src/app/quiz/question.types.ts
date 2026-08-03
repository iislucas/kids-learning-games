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

export interface PackOptionChoice {
  value: string;
  label: string;
  emoji?: string;
}

/**
 * A set of content toggles for a pack — which times tables, which French
 * topics, and so on. Options control *what she practises*; levels control *how
 * hard it is*. Keeping those separate is what lets a parent narrow a round to
 * whatever is being taught this term without also changing the difficulty.
 */
export interface PackOption {
  id: string;
  label: string;
  hint?: string;
  choices: PackOptionChoice[];
  /** Selected on a fresh install. */
  defaults: string[];
  /** Refuse to go below this many, so a round can always be generated. */
  minSelected: number;
  /** 1-based levels this option affects; omit when it affects all of them. */
  levels?: number[];
}

/** Chosen values per option id. */
export type PackSelection = Record<string, string[]>;

export interface QuestionPack {
  id: string;
  title: string;
  emoji: string;
  /** Theme colour, used for the card and the play screen accent. */
  colour: string;
  description: string;
  levels: Level[];
  options?: PackOption[];
  /** Generates one question for the given 1-based level. */
  generate(level: number, rng: Rng, selection: PackSelection): Question;
}

export function defaultSelection(pack: QuestionPack): PackSelection {
  const selection: PackSelection = {};
  for (const option of pack.options ?? []) {
    selection[option.id] = [...option.defaults];
  }
  return selection;
}

/**
 * Cleans a stored selection against a pack's current options: drops values that
 * no longer exist, fills in options added since it was saved, and falls back to
 * the defaults for anything left below `minSelected`.
 *
 * Without this, editing a pack's option list would leave existing players with
 * a selection that generates nothing.
 */
export function resolveSelection(
  pack: QuestionPack,
  stored: PackSelection | undefined,
): PackSelection {
  const selection: PackSelection = {};
  for (const option of pack.options ?? []) {
    const valid = new Set(option.choices.map((choice) => choice.value));
    const chosen = (stored?.[option.id] ?? option.defaults).filter((value) =>
      valid.has(value),
    );
    selection[option.id] =
      chosen.length >= option.minSelected ? chosen : [...option.defaults];
  }
  return selection;
}

/**
 * Reads one option's values. Falls back to everything available when the
 * selection is empty or missing, so a pack can never be asked to draw from an
 * empty pool.
 */
export function selected(
  selection: PackSelection,
  option: PackOption,
): string[] {
  const values = selection[option.id];
  if (values && values.length > 0) return values;
  return option.defaults.length > 0
    ? option.defaults
    : option.choices.map((choice) => choice.value);
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
