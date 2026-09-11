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

/**
 * A walk cycle in eight directions: one row per direction, one column per
 * frame.
 *
 * Kept beside the main sheet rather than folded into `AnimationName` because a
 * saved media pack has a `Record<AnimationName, Animation>` written out in full
 * — widening that union would leave every existing pack missing keys. As an
 * optional extra structure, an old pack simply has no walk, and the map falls
 * back to the idle pose.
 */
export interface WalkSheet {
  sheet: SpriteSheet;
  /** Row order, top to bottom. */
  directions: string[];
  fps: number;
}

export interface CharacterDef {
  id: string;
  name: string;
  sheet: SpriteSheet;
  animations: Record<AnimationName, Animation>;
  walk?: WalkSheet;
  /**
   * Short clips in this character's own voice, played just after the shared
   * sound for the same moment. Several per moment, so a round of ten correct
   * answers does not hear the same line ten times. Optional: a character
   * without one still has the shared sounds.
   */
  voice?: Partial<Record<SoundId, SoundDef[]>>;
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
  /** Generated art for the exploration map. */
  map?: MapMedia | null;
  /**
   * Pictures for questions that have one, keyed by the question's `picture`.
   * A spelling round shows the thing being spelled; a picture is a far better
   * clue than an emoji, and for a word she cannot read yet it is the only clue.
   */
  pictures?: Partial<Record<string, ImageDef>>;
}

export interface ImageDef {
  /** Asset path or `data:` URI. */
  src: string;
}

/**
 * The map's art, generated piece by piece.
 *
 * Tiles and props rather than one painting: each is small enough to store, a
 * tile repeats to fill any region without regenerating, and an image model
 * asked for one tree gets one tree right. `background` is the older
 * whole-map painting; when present it covers everything else.
 */
export interface MapMedia {
  background?: ImageDef | null;
  /** Seamless ground textures, keyed by terrain. */
  tiles?: Partial<Record<string, ImageDef>>;
  /** Scenery sprites, keyed by prop kind. */
  props?: Partial<Record<string, ImageDef>>;
}
