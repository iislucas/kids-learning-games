/**
 * The prize catalogue.
 *
 * Every area on the map has its own copy of the whole catalogue: stars earned
 * in an area unlock that area's stickers, so each place fills up with its own
 * collection and a new place starts paying out again from the first sticker.
 * The same sticker can therefore be owned several times over, once per area.
 *
 * Within an area, prizes unlock in a fixed order as stars accumulate, and are interleaved
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
  /** Stars earned in one area needed to unlock this there. */
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
 * Star cost of the nth prize, counted in the stars earned in one area.
 *
 * A ten-question round with a decent streak pays roughly 15-25 stars. That
 * puts an area's first sticker three correct answers in and its first handful
 * within a round or two, while the full set of 30 in one area is still a long
 * project. Because every area counts from zero, moving to a new place always
 * brings a quick sticker.
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

/** Every prize whose star threshold has been reached in one area. */
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

/**
 * What an area holds after earning `stars` there: everything it already had,
 * plus everything the stars now reach. Held prizes are kept even below their
 * threshold (stickers carried over from before areas had their own), so a
 * sticker is never taken away. Returned in unlock order.
 */
export function areaPrizesAt(stars: number, held: ReadonlySet<string>): Prize[] {
  return PRIZES.filter((prize) => held.has(prize.id) || prize.starsRequired <= stars);
}

/** The next sticker an area is working towards, or null once it has them all. */
export function nextAreaPrize(held: ReadonlySet<string>): Prize | null {
  return PRIZES.find((prize) => !held.has(prize.id)) ?? null;
}

/** 0..1 towards an area's next sticker, or 1 when it has them all. */
export function progressTowardNextPrize(
  stars: number,
  held: ReadonlySet<string>,
): number {
  const next = nextAreaPrize(held);
  if (!next) return 1;
  const reached = PRIZES.filter((prize) => prize.starsRequired <= stars);
  const floor = reached.length ? reached[reached.length - 1].starsRequired : 0;
  const span = next.starsRequired - floor;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (stars - floor) / span));
}
