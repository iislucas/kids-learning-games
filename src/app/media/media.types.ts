/** Every sound the game can play. Keep this list small — each one is an asset. */
export type SoundId =
  | 'correct'
  | 'wrong'
  | 'prize'
  | 'levelUp'
  | 'tap'
  | 'finish';

export const SOUND_IDS: readonly SoundId[] = [
  'correct',
  'wrong',
  'prize',
  'levelUp',
  'tap',
  'finish',
] as const;

export const SOUND_LABELS: Record<SoundId, string> = {
  correct: 'Correct answer',
  wrong: 'Wrong answer',
  prize: 'Prize unlocked',
  levelUp: 'Level up',
  tap: 'Button tap',
  finish: 'Round finished',
};

/**
 * What the character is doing. The play screen drives these from quiz events.
 */
export type AnimationName = 'idle' | 'correct' | 'wrong' | 'celebrate';

export const ANIMATION_NAMES: readonly AnimationName[] = [
  'idle',
  'correct',
  'wrong',
  'celebrate',
] as const;

export interface Animation {
  /** Frame indices into the sheet, in play order. */
  frames: number[];
  fps: number;
  loop: boolean;
}

export interface SpriteSheet {
  /** A `/media/...` asset path, or a `data:` URI for a locally generated sheet. */
  src: string;
  cellWidth: number;
  cellHeight: number;
  cols: number;
  rows: number;
  frameCount: number;
}

export interface CharacterDef {
  id: string;
  name: string;
  sheet: SpriteSheet;
  animations: Record<AnimationName, Animation>;
}

export interface SoundDef {
  /** Asset path or `data:` URI. */
  src: string;
  /** 0..1, defaults to 1. */
  volume?: number;
}

/**
 * The complete set of swappable assets. The repo ships a default pack; the
 * media studio writes an override to localStorage. Nothing else in the app
 * knows where the media came from.
 */
export interface MediaPack {
  version: 1;
  /** Which character in `characters` is currently in play. */
  activeCharacterId: string;
  characters: CharacterDef[];
  sounds: Partial<Record<SoundId, SoundDef>>;
  /** Looping background music, or null for none. */
  music: SoundDef | null;
}
