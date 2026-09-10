import { QUESTION_PACKS } from './pack-registry';
import { Rng } from '../core/rng';
import { defaultSelection } from './question.types';

/**
 * Every question picture the game can use.
 *
 * A spelling round shows the thing being spelled. An emoji does that job
 * badly — several words share one, some have none at all, and a 7-year-old
 * reading "☂️" as *umbrella* rather than *rain* is a coin toss. A drawing of
 * the actual thing is the clue.
 *
 * The list is *discovered* rather than written out: every pack is asked for a
 * pile of questions and the ones naming a picture are collected. That way a
 * word added to a pack shows up in the media studio to be drawn, with no second
 * list to keep in step.
 */
export interface PictureSubject {
  /** The `picture` a question asks for, e.g. `word.apple`. */
  id: string;
  /** What to draw, in words, e.g. "an apple". */
  label: string;
}

/** How many questions to draw per level when hunting for pictures. */
const SAMPLE = 400;

function discover(): PictureSubject[] {
  const found = new Map<string, string>();

  for (const pack of QUESTION_PACKS) {
    const selection = defaultSelection(pack);
    // Every option value switched on, so nothing narrowed today is missed.
    for (const option of pack.options ?? []) {
      selection[option.id] = option.choices.map((choice) => choice.value);
    }
    for (const level of pack.levels) {
      const rng = new Rng(level.number * 7919);
      for (let i = 0; i < SAMPLE; i++) {
        const question = pack.generate(level.number, rng, selection);
        if (question.picture && question.pictureLabel) {
          found.set(question.picture, question.pictureLabel);
        }
      }
    }
    for (const challenge of pack.challenges ?? []) {
      for (const question of challenge.deck(new Rng(11))) {
        if (question.picture && question.pictureLabel) {
          found.set(question.picture, question.pictureLabel);
        }
      }
    }
  }

  return [...found]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export const PICTURE_SUBJECTS: PictureSubject[] = discover();
