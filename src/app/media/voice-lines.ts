/**
 * What each character says, and in what voice.
 *
 * The single source of truth for the voiced clips: `default-pack.ts` derives
 * the file paths from it, and `scripts/generate-voices.mts` generates the clips
 * from it. Change a line here and re-run `pnpm run gen:voices`.
 *
 * **This module must not import anything.** The generator script imports it
 * directly and Node only strips types; an extensionless import here would
 * break the script.
 *
 * Wrong-answer lines are warm and point at the retry, because the same question
 * really does come back — "not quite, try again" is literally what happens
 * next, never a buzzer.
 */

export type VoicedEvent = 'correct' | 'wrong' | 'prize' | 'finish';

export const VOICED_EVENTS: VoicedEvent[] = ['correct', 'wrong', 'prize', 'finish'];

export interface CharacterVoice {
  /** A Gemini TTS prebuilt voice. */
  voiceName: string;
  /** Who is speaking, as direction for the voice model. */
  style: string;
  lines: Record<VoicedEvent, string[]>;
}

/** How each moment should sound, whoever is speaking. */
export const MOODS: Record<VoicedEvent, string> = {
  correct: 'delighted and bouncy',
  wrong: 'gentle, warm and encouraging, never disappointed',
  prize: 'amazed and thrilled',
  finish: 'proud and excited',
};

export const CHARACTER_VOICES: Record<string, CharacterVoice> = {
  momo: {
    voiceName: 'Leda',
    style: 'a tiny, bright, squeaky cartoon fox-cub voice',
    lines: {
      correct: ['Yip yip!', 'Yay!', 'Woo-hoo!', 'You got it!'],
      wrong: ['Hmm, not quite!', 'Ooh, so close! Try again!'],
      prize: ['Ooh, a prize!'],
      finish: ['Yippee! We did it!', 'Hooray! All done!'],
    },
  },
  kai: {
    voiceName: 'Puck',
    style: 'a small, friendly, slightly growly cartoon baby-dragon voice',
    lines: {
      correct: ['Rawr! Yes!', 'Woo-hoo!', 'Awesome!', 'You got it!'],
      wrong: ['Hmm, nearly!', "Oops! Let's try again!"],
      prize: ['Ooh, treasure!'],
      finish: ['Rawr! We did it!', 'Hooray! All done!'],
    },
  },
};

/** Where one line's clip lives, relative to the base href. */
export function voiceClipPath(
  characterId: string,
  event: VoicedEvent,
  index: number,
): string {
  return `media/voices/${characterId}/${event}-${index + 1}.m4a`;
}
