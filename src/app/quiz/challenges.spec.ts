import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import {
  ALL_CHALLENGES,
  blockingOption,
  findChallenge,
  isChallengeAvailable,
} from './challenges';
import { QUESTION_PACKS } from './pack-registry';
import { defaultSelection } from './question.types';

/**
 * The contract every challenge has to meet. Like the pack spec, this covers any
 * challenge added later for free, as soon as it is on a pack.
 */
describe('challenges', () => {
  it('gives every pack at least one place on the map', () => {
    for (const pack of QUESTION_PACKS) {
      expect(
        ALL_CHALLENGES.filter((ref) => ref.pack.id === pack.id).length,
      ).toBeGreaterThan(0);
    }
  });

  it('has unique ids', () => {
    const ids = ALL_CHALLENGES.map((ref) => ref.challenge.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('finds a challenge by id, and nothing by a made-up one', () => {
    const first = ALL_CHALLENGES[0];
    expect(findChallenge(first.challenge.id)?.challenge).toBe(first.challenge);
    expect(findChallenge('not.a.challenge')).toBeUndefined();
  });

  for (const ref of ALL_CHALLENGES) {
    describe(ref.challenge.id, () => {
      it('deals a complete, valid, non-repeating set', () => {
        // Several seeds: the deck is shuffled and its distractors are drawn, so
        // one lucky draw proves nothing.
        for (const seed of [1, 7, 99, 12345]) {
          const deck = ref.challenge.deck(new Rng(seed));

          // Long enough to be an achievement, short enough that a seven-year-old
          // can hold a perfect score all the way through.
          expect(deck.length).toBeGreaterThanOrEqual(4);
          expect(deck.length).toBeLessThanOrEqual(12);

          for (const question of deck) {
            expect(question.prompt.length).toBeGreaterThan(0);
            expect(question.choices.length).toBeGreaterThanOrEqual(2);
            expect(question.correctIndex).toBeGreaterThanOrEqual(0);
            expect(question.correctIndex).toBeLessThan(question.choices.length);
            expect(new Set(question.choices).size).toBe(question.choices.length);
            for (const choice of question.choices) {
              expect(choice.trim().length).toBeGreaterThan(0);
            }
          }

          // Every question in the set exactly once — that is what makes "all of
          // them right" mean the whole thing is known.
          const keys = deck.map(
            (q) => `${q.instruction ?? ''}|${q.prompt}|${q.choices[q.correctIndex]}`,
          );
          expect(new Set(keys).size).toBe(deck.length);
        }
      });

      it('is the same size whatever the shuffle', () => {
        const sizes = [1, 2, 3, 4, 5].map(
          (seed) => ref.challenge.deck(new Rng(seed)).length,
        );
        expect(new Set(sizes).size).toBe(1);
      });

      it('names an option value that really exists, if it names one', () => {
        const requires = ref.challenge.requires;
        if (!requires) return;
        const option = (ref.pack.options ?? []).find(
          (candidate) => candidate.id === requires.optionId,
        );
        expect(option, `${ref.challenge.id} requires a missing option`).toBeDefined();
        expect(option!.choices.map((choice) => choice.value)).toContain(
          requires.value,
        );
        // Needed for the "why is this shut?" line on the map.
        expect(blockingOption(ref)).toBe(option);
      });

      it('has short text that fits on a signpost', () => {
        expect(ref.challenge.short.length).toBeGreaterThan(0);
        expect(ref.challenge.short.length).toBeLessThanOrEqual(4);
        expect(ref.challenge.name.length).toBeGreaterThan(0);
        expect(ref.challenge.goal.length).toBeGreaterThan(0);
      });
    });
  }

  describe('availability', () => {
    it('is open on a fresh install when its category is on by default', () => {
      for (const ref of ALL_CHALLENGES) {
        const selection = defaultSelection(ref.pack);
        const requires = ref.challenge.requires;
        const expected =
          !requires || (selection[requires.optionId] ?? []).includes(requires.value);
        expect(isChallengeAvailable(ref, selection)).toBe(expected);
      }
    });

    /**
     * The point of being able to switch a category off. A spot for the 8× table
     * that still plays after 8× has been turned off would make the switch a lie.
     */
    it('closes when its category is switched off', () => {
      for (const ref of ALL_CHALLENGES) {
        const requires = ref.challenge.requires;
        if (!requires) continue;
        const selection = defaultSelection(ref.pack);
        expect(
          isChallengeAvailable(ref, { ...selection, [requires.optionId]: [] }),
        ).toBe(false);
        expect(
          isChallengeAvailable(ref, {
            ...selection,
            [requires.optionId]: [requires.value],
          }),
        ).toBe(true);
      }
    });

    it('stays open when nothing gates it', () => {
      for (const ref of ALL_CHALLENGES) {
        if (ref.challenge.requires) continue;
        expect(isChallengeAvailable(ref, {})).toBe(true);
        expect(blockingOption(ref)).toBeUndefined();
      }
    });
  });

  describe('the maths tables', () => {
    it('asks every fact in the table once', () => {
      const seven = findChallenge('maths.times.7');
      expect(seven).toBeDefined();
      const prompts = seven!.challenge
        .deck(new Rng(3))
        .map((question) => question.prompt)
        .sort();
      expect(prompts).toEqual(
        Array.from({ length: 10 }, (_, i) => `7 × ${i + 1} = ?`).sort(),
      );
    });

    it('asks every fact in an adding family once', () => {
      const adding = findChallenge('maths.add.6');
      expect(adding).toBeDefined();
      const prompts = adding!.challenge
        .deck(new Rng(3))
        .map((question) => question.prompt)
        .sort();
      expect(prompts).toEqual(
        Array.from({ length: 10 }, (_, i) => `6 + ${i + 1} = ?`).sort(),
      );
    });
  });
});
