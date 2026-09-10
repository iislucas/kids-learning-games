import { QUESTION_PACKS } from './pack-registry';
import { Challenge, PackSelection, QuestionPack } from './question.types';

/**
 * The challenge registry: every complete-set round in the game, flattened out
 * of the packs.
 *
 * A challenge is always looked up with the pack it came from — the play screen
 * needs the pack's colour and the settings panel behind it, and the map groups
 * spots by pack — so the pair travels together rather than each challenge
 * repeating a `packId` that could drift out of step with where it actually
 * lives.
 */
export interface ChallengeRef {
  pack: QuestionPack;
  challenge: Challenge;
}

export const ALL_CHALLENGES: ChallengeRef[] = QUESTION_PACKS.flatMap((pack) =>
  (pack.challenges ?? []).map((challenge) => ({ pack, challenge })),
);

const BY_ID = new Map(ALL_CHALLENGES.map((ref) => [ref.challenge.id, ref]));

export function findChallenge(id: string): ChallengeRef | undefined {
  return BY_ID.get(id);
}

export function challengesFor(packId: string): ChallengeRef[] {
  return ALL_CHALLENGES.filter((ref) => ref.pack.id === packId);
}

/**
 * Whether a challenge can be played right now.
 *
 * Emptying a category has to close its challenges too. Leaving the 8× table
 * playable on the map after it has been switched off in the settings would make
 * the switch a lie — the same reasoning as `isLevelAvailable`, applied to a
 * single option value rather than to a whole option.
 */
export function isChallengeAvailable(
  ref: ChallengeRef,
  selection: PackSelection,
): boolean {
  const requires = ref.challenge.requires;
  if (!requires) return true;
  return (selection[requires.optionId] ?? []).includes(requires.value);
}

/** The option a closed challenge is waiting on, for explaining why it is shut. */
export function blockingOption(ref: ChallengeRef) {
  const requires = ref.challenge.requires;
  if (!requires) return undefined;
  return (ref.pack.options ?? []).find(
    (option) => option.id === requires.optionId,
  );
}
