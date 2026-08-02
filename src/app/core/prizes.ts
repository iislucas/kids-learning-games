/**
 * The prize catalogue.
 *
 * Prizes unlock in a fixed order as stars accumulate, and are interleaved
 * across collections on purpose: being two stickers short of finishing the
 * Space set while also having started Ocean is a much stronger pull than
 * completing one set before seeing the next exists.
 */

export interface PrizeSet {
  id: string;
  name: string;
  emoji: string;
  /** Trophy awarded for completing the whole set. */
  trophy: string;
}

export interface Prize {
  id: string;
  name: string;
  emoji: string;
  setId: string;
  /** Cumulative lifetime stars needed to unlock this. */
  starsRequired: number;
}

export const PRIZE_SETS: PrizeSet[] = [
  { id: 'space', name: 'Space Explorers', emoji: '🚀', trophy: '🌌' },
  { id: 'ocean', name: 'Ocean Friends', emoji: '🐬', trophy: '🌊' },
  { id: 'jungle', name: 'Jungle Party', emoji: '🦁', trophy: '🌴' },
  { id: 'treats', name: 'Sweet Treats', emoji: '🍩', trophy: '🎂' },
  { id: 'magic', name: 'Magic Things', emoji: '🦄', trophy: '✨' },
  { id: 'weather', name: 'Sky and Weather', emoji: '🌈', trophy: '⛅' },
];

/** Ordered by unlock; the interleaving across sets is deliberate. */
const PRIZE_ORDER: [setId: string, id: string, name: string, emoji: string][] = [
  ['space', 'star', 'Little Star', '⭐'],
  ['ocean', 'fish', 'Rainbow Fish', '🐠'],
  ['treats', 'cookie', 'Cookie', '🍪'],
  ['jungle', 'monkey', 'Cheeky Monkey', '🐵'],
  ['magic', 'wand', 'Magic Wand', '🪄'],
  ['weather', 'sun', 'Sunshine', '☀️'],
  ['space', 'rocket', 'Rocket', '🚀'],
  ['ocean', 'turtle', 'Sea Turtle', '🐢'],
  ['treats', 'donut', 'Sprinkle Donut', '🍩'],
  ['jungle', 'parrot', 'Loud Parrot', '🦜'],
  ['magic', 'unicorn', 'Unicorn', '🦄'],
  ['weather', 'rainbow', 'Rainbow', '🌈'],
  ['space', 'moon', 'Crescent Moon', '🌙'],
  ['ocean', 'dolphin', 'Dolphin', '🐬'],
  ['treats', 'cupcake', 'Cupcake', '🧁'],
  ['jungle', 'lion', 'Brave Lion', '🦁'],
  ['magic', 'crystal', 'Crystal Ball', '🔮'],
  ['weather', 'snowflake', 'Snowflake', '❄️'],
  ['space', 'planet', 'Ringed Planet', '🪐'],
  ['ocean', 'octopus', 'Silly Octopus', '🐙'],
  ['treats', 'iceCream', 'Ice Cream', '🍦'],
  ['jungle', 'elephant', 'Gentle Elephant', '🐘'],
  ['magic', 'fairy', 'Fairy', '🧚'],
  ['weather', 'storm', 'Thunder Cloud', '⛈️'],
  ['space', 'astronaut', 'Astronaut', '🧑‍🚀'],
  ['ocean', 'whale', 'Great Whale', '🐳'],
  ['treats', 'cake', 'Birthday Cake', '🍰'],
  ['jungle', 'tiger', 'Striped Tiger', '🐯'],
  ['magic', 'dragon', 'Friendly Dragon', '🐲'],
  ['weather', 'comet', 'Shooting Star', '🌠'],
];

/**
 * Star cost of the nth prize.
 *
 * Tuned against the actual earn rate: a ten-question round with a decent streak
 * pays roughly 15-25 stars, so a couple of rounds a day is ~40 stars. That puts
 * the first sticker three correct answers in, the tenth at around a week, and
 * the full set of 30 within a few months of regular play — ambitious but
 * genuinely reachable, which a steeper curve is not.
 */
export function starsForPrizeIndex(index: number): number {
  return Math.round(3 + 0.85 * index * index + 5 * index);
}

export const PRIZES: Prize[] = PRIZE_ORDER.map(
  ([setId, id, name, emoji], index) => ({
    id,
    name,
    emoji,
    setId,
    starsRequired: starsForPrizeIndex(index),
  }),
);

export const PRIZES_BY_ID = new Map(PRIZES.map((prize) => [prize.id, prize]));

export function prizesInSet(setId: string): Prize[] {
  return PRIZES.filter((prize) => prize.setId === setId);
}

/** Every prize whose star threshold has been reached. */
export function prizesUnlockedAt(stars: number): Prize[] {
  return PRIZES.filter((prize) => prize.starsRequired <= stars);
}

/** The next prize still to earn, or null once everything is collected. */
export function nextPrizeAfter(stars: number): Prize | null {
  return PRIZES.find((prize) => prize.starsRequired > stars) ?? null;
}

export function completedSets(unlockedIds: ReadonlySet<string>): PrizeSet[] {
  return PRIZE_SETS.filter((set) =>
    prizesInSet(set.id).every((prize) => unlockedIds.has(prize.id)),
  );
}
