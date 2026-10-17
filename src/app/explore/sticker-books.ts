import { findChallenge } from '../quiz/challenges';
import { findPack } from '../quiz/pack-registry';
import { MapLayout, MapSpot, regionForRound, spotFor } from './map-layout';

/**
 * Which sticker book a round fills.
 *
 * Every game in every area has its own book of stickers, so each one pays out
 * from the first sticker again and she can fill a lot of them:
 *
 * - a challenge (a spot on the map) is its own book, keyed by challenge id;
 * - an ordinary round from the games list has no spot, so each level of each
 *   game is its own book: `level:<packId>:<level>`;
 * - `region:<id>` holds stickers carried over from old saves that only knew
 *   their area, and `crossroads` the ones that knew nothing at all.
 *
 * Like `map-layout.ts`, this stays free of Angular.
 */

export const CROSSROADS = 'crossroads';

export function levelBookKey(packId: string, level: number): string {
  return `level:${packId}:${level}`;
}

/** The book a round fills, and the area (region id) it sits in. */
export function bookForRound(
  layout: MapLayout,
  round: { packId: string; level: number; challengeId?: string | null },
): { book: string; area: string } {
  const area = regionForRound(layout, round)?.id ?? CROSSROADS;
  if (round.challengeId && spotFor(layout, round.challengeId)) {
    return { book: round.challengeId, area };
  }
  return { book: levelBookKey(round.packId, round.level), area };
}

export interface BookInfo {
  key: string;
  /** Full name, e.g. "The 7 times table". */
  name: string;
  /** A few characters, e.g. "7×". */
  short: string;
  emoji: string;
  /** The spot on the map, when the book is a challenge. */
  spot: MapSpot | undefined;
}

/** What a book is called, and where it lives on the map. */
export function describeBook(layout: MapLayout, key: string): BookInfo {
  const spot = spotFor(layout, key);
  const ref = findChallenge(key);
  if (ref) {
    return {
      key,
      name: ref.challenge.name,
      short: ref.challenge.short,
      emoji: ref.challenge.emoji,
      spot,
    };
  }
  if (key.startsWith('level:')) {
    const [, packId, level] = key.split(':');
    const pack = findPack(packId);
    const levelName = pack?.levels[Number(level) - 1]?.name;
    return {
      key,
      name: `${pack?.title ?? packId}, level ${level}${levelName ? ` (${levelName})` : ''}`,
      short: `Lv ${level}`,
      emoji: pack?.emoji ?? '🎲',
      spot: undefined,
    };
  }
  if (key.startsWith('region:')) {
    const region = layout.regions.find((r) => r.id === key.slice('region:'.length));
    return {
      key,
      name: region ? `Around ${region.name}` : 'Somewhere',
      short: 'Extra',
      emoji: region?.emoji ?? '⭐',
      spot: undefined,
    };
  }
  return { key, name: 'The crossroads', short: 'Extra', emoji: '🧭', spot: undefined };
}
