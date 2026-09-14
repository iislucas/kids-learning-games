import { Rng } from '../core/rng';

/**
 * What every question shows, whatever kind of answer it wants: the words, the
 * picture or the things to count, and what to say after a wrong answer.
 */
export interface QuestionBase {
  /** Main text, e.g. "7 + 5" or "Which animal lives in the sea?". */
  prompt: string;
  /** Optional smaller line above the prompt, e.g. "Spell the missing letter". */
  instruction?: string;
  /** Large decorative emoji shown with the question. */
  emoji?: string;
  /**
   * A picture to show instead of the emoji, if the media pack has one drawn.
   * Spelling needs this: the whole question is "what is this a picture of?",
   * and an emoji is a poor and sometimes ambiguous stand-in.
   */
  picture?: string;
  /** What that picture should be of, for whoever is generating it. */
  pictureLabel?: string;
  /**
   * A group of things to count, shown in place of the prompt: `amount` copies
   * of `emoji`. The counting round asks "how many?" with the things themselves.
   */
  count?: { emoji: string; amount: number };
  /** Shown after a wrong answer to teach rather than just mark. */
  explanation?: string;
}

/** Pick the right one of a few buttons. The only kind so far. */
export interface ChoiceQuestion extends QuestionBase {
  kind: 'choice';
  choices: string[];
  correctIndex: number;
}

export interface ChoiceAnswer {
  kind: 'choice';
  index: number;
}

/**
 * Every kind of question a game can ask, told apart by `kind`.
 *
 * A new kind — typing the answer, putting things in order — is a new member
 * here, a matching member of `Answer`, its rules in `game-kinds.ts` and a
 * component that takes the answer. The round, the stars, the retry after a
 * wrong answer and the map all work on any kind without knowing which.
 */
export type Question = ChoiceQuestion;

/** What the player gave in reply, one member per kind of question. */
export type Answer = ChoiceAnswer;

export type QuestionKind = Question['kind'];

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
  /**
   * 1-based levels this option affects; omit when it affects all of them.
   *
   * An option may be emptied completely — "no adding at all" is a legitimate
   * thing to want. Emptying it makes the levels listed here unavailable rather
   * than silently falling back to everything, which is the whole point of being
   * able to switch a category off.
   */
  levels?: number[];
}

/** Chosen values per option id. */
export type PackSelection = Record<string, string[]>;

/**
 * One complete, finite set of questions — the 7× table is exactly 7×1 … 7×10,
 * the Space topic is exactly its six facts.
 *
 * This is what makes "I know my 7× table" something the game can actually see.
 * A normal round samples a level at random and can only ever say "9 out of 10
 * of *some* questions"; a challenge round asks every question in the set once,
 * so getting them all right first time means the whole thing is known, not that
 * the easy ones came up.
 *
 * Levels are difficulty and options are content; a challenge is neither. It is
 * a named slice of content played to completion, so it lives alongside them
 * rather than inside either.
 */
export interface Challenge {
  /** Unique across all packs, e.g. `maths.times.7`. */
  id: string;
  /** Full name, e.g. "The 7 times table". */
  name: string;
  /** What the signpost on the map says, e.g. "7×". Keep it to a few characters. */
  short: string;
  emoji: string;
  /** One line of encouragement naming the target, e.g. "Get all 10 right!". */
  goal: string;
  /**
   * Closes this challenge when that option value is switched off, so emptying a
   * category takes its challenges out of play too rather than leaving spots
   * that contradict the settings.
   */
  requires?: { optionId: string; value: string };
  /**
   * The complete question set, in a freshly shuffled order. Its length is the
   * length of the round.
   */
  deck(rng: Rng): Question[];
}

/**
 * A challenge built from a list: every item asked once, in a fresh order.
 *
 * That is the shape of every challenge in the game — the ten facts of a times
 * table, the words of a topic, the numbers one to five — so a pack only has to
 * say what the items are and how to ask one. The goal defaults to "Get all N
 * right!", counted from the items so it can never disagree with the round.
 */
export function completeSet<T>(parts: {
  id: string;
  name: string;
  short: string;
  emoji: string;
  items: readonly T[];
  ask: (rng: Rng, item: T) => Question;
  goal?: string;
  requires?: Challenge['requires'];
}): Challenge {
  const { items, ask, goal, ...rest } = parts;
  return {
    ...rest,
    goal: goal ?? `Get all ${items.length} right!`,
    deck: (rng: Rng) => rng.shuffle(items).map((item) => ask(rng, item)),
  };
}

export interface QuestionPack {
  id: string;
  title: string;
  emoji: string;
  /** Theme colour, used for the card and the play screen accent. */
  colour: string;
  description: string;
  levels: Level[];
  options?: PackOption[];
  /**
   * Complete question sets that can be played to completion for a badge. See
   * `Challenge`; the map lays these out as places to visit.
   */
  challenges?: Challenge[];
  /** Generates one question for the given 1-based level. */
  generate(level: number, rng: Rng, selection: PackSelection): Question;
  /**
   * Extra availability rule, on top of the generic "an option this level uses
   * is empty" check. Only needed where a level draws from a subset of an
   * option's values — see the French `le`/`la` round, which cannot use colours.
   */
  levelAvailable?(level: number, selection: PackSelection): boolean;
}

/** The options that affect a given level. */
export function optionsForLevel(
  pack: QuestionPack,
  level: number,
): PackOption[] {
  return (pack.options ?? []).filter(
    (option) => !option.levels || option.levels.includes(level),
  );
}

/**
 * Whether a level can currently produce questions.
 *
 * A level is unavailable when any option feeding it has been emptied — that is
 * how "no adding" is honoured, rather than quietly ignoring the choice.
 */
export function isLevelAvailable(
  pack: QuestionPack,
  level: number,
  selection: PackSelection,
): boolean {
  for (const option of optionsForLevel(pack, level)) {
    if ((selection[option.id]?.length ?? 0) === 0) return false;
  }
  return pack.levelAvailable?.(level, selection) ?? true;
}

export function availableLevels(
  pack: QuestionPack,
  selection: PackSelection,
): Level[] {
  return pack.levels.filter((level) =>
    isLevelAvailable(pack, level.number, selection),
  );
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
 * no longer exist and fills in options added since it was saved.
 *
 * An option that is *present but empty* is left empty — that is a deliberate
 * "none of this" and must survive a reload. Only an option that is *absent*
 * (never set, or added to the pack since) picks up its defaults.
 */
export function resolveSelection(
  pack: QuestionPack,
  stored: PackSelection | undefined,
): PackSelection {
  const selection: PackSelection = {};
  for (const option of pack.options ?? []) {
    const valid = new Set(option.choices.map((choice) => choice.value));
    const chosen = stored?.[option.id] ?? option.defaults;
    selection[option.id] = chosen.filter((value) => valid.has(value));
  }
  return selection;
}

/**
 * Reads one option's values. An absent option falls back to its defaults; an
 * empty one stays empty, because emptying it is a real choice.
 */
export function selected(
  selection: PackSelection,
  option: PackOption,
): string[] {
  return selection[option.id] ?? option.defaults;
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
    picture?: string;
    pictureLabel?: string;
    explanation?: string;
  },
): ChoiceQuestion {
  const unique = [...new Set(parts.distractors.filter((d) => d !== parts.correct))];
  const choices = rng.shuffle([parts.correct, ...unique.slice(0, 3)]);
  return {
    kind: 'choice',
    prompt: parts.prompt,
    instruction: parts.instruction,
    emoji: parts.emoji,
    picture: parts.picture,
    pictureLabel: parts.pictureLabel,
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
