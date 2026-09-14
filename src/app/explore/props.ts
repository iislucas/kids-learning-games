/**
 * Every picture that stands on the map: the scattered scenery, the landmark
 * that grows at a place as it is won, and each region's random extra.
 *
 * One entry per picture. Its `description` is what the media studio asks the
 * image model for, and the generated file lives at
 * `public/media/map/prop-<id>.webp` (see `default-pack.ts`). Which terrain uses
 * which picture is decided in `terrains.ts`.
 *
 * Only the first few have a hand-drawn SVG fallback, for a media pack whose art
 * has been cleared (`DRAWN_PROP_KINDS`, drawn in `map-art.ts`). Anything else
 * names the drawing it most `looksLike` — good enough as a fallback, and not
 * worth a hand-drawn SVG apiece for something that is meant to be generated.
 *
 * Angular-free, with no `enum`s, like the rest of `explore/`.
 */

/** The props with a drawing of their own in `map-art.ts`. */
export const DRAWN_PROP_KINDS = [
  'tree',
  'pine',
  'boulder',
  'cottage',
  'pond',
  'flower',
  'palm',
  'shells',
] as const;

export type DrawnPropKind = (typeof DRAWN_PROP_KINDS)[number];

export interface PropDef {
  /** What to ask the image model for: one object, described plainly. */
  description: string;
  /** The drawing to fall back on, for a prop without one of its own. */
  looksLike?: DrawnPropKind;
  /** Scattered at this fraction of scenery size. Shells are pocket-sized. */
  scale?: number;
}

const PROP_TABLE = {
  // ── Scenery, scattered over the ground ──
  tree: { description: 'a single round leafy broadleaf tree' },
  pine: { description: 'a single tall pointed pine tree' },
  boulder: { description: 'a single mossy grey boulder with a small dark cave mouth in it' },
  cottage: { description: 'a single small cottage with a red roof and a round window' },
  pond: { description: 'a small round pond with lily pads and a flower' },
  flower: { description: 'a single large pink flower with a yellow centre on a green stem' },
  palm: { description: 'a single small leaning palm tree with a few coconuts' },
  shells: {
    description: 'a little cluster of three pretty seashells, a scallop, a spiral and a pink one',
    scale: 0.5,
  },

  // ── Landmarks, grown at a place as it is won ──
  windmill: {
    description: 'a single cheerful wooden windmill with four white sails on a small grassy mound',
    looksLike: 'cottage',
  },
  lilypad: {
    description:
      'a single big round green lily pad floating on a little patch of water, with a pink water lily in bloom on it',
    looksLike: 'pond',
  },
  cave: {
    description: 'a single rocky hillock of grey stones with a dark arched cave entrance in the front',
    looksLike: 'boulder',
  },
  oak: {
    description: 'a single big old oak tree with a thick trunk and a wide, full, round crown of leaves',
    looksLike: 'tree',
  },
  townhouse: {
    description:
      'a single charming two-storey town house with a blue door, window boxes of flowers and a tiled roof',
    looksLike: 'cottage',
  },
  sunflower: {
    description: 'a single tall sunflower with a big golden flower head and broad green leaves',
    looksLike: 'flower',
  },
  sandcastle: {
    description: 'a single sandcastle with three towers, crenellations and a little red flag on top',
    looksLike: 'boulder',
  },

  // ── Extras, one picked at random for each region ──
  sheep: {
    description: 'a single fluffy white sheep standing on four little black legs',
    looksLike: 'boulder',
  },
  haybarn: {
    description: 'a single small red wooden barn with a white-trimmed door and hay poking out',
    looksLike: 'cottage',
  },
  rowboat: {
    description: 'a single small wooden rowing boat with two oars resting inside it',
    looksLike: 'pond',
  },
  duckhouse: {
    description: 'a single little wooden duck house on a floating raft, with a yellow duck beside it',
    looksLike: 'cottage',
  },
  crystals: {
    description: 'a single cluster of glowing purple and blue crystals growing from a grey rock',
    looksLike: 'boulder',
  },
  minecart: {
    description: 'a single old wooden mine cart full of shiny rocks, on a short piece of track',
    looksLike: 'boulder',
  },
  mushrooms: {
    description: 'a single group of three red-capped toadstools with white spots',
    looksLike: 'flower',
  },
  logcabin: {
    description: 'a single small log cabin with a mossy roof and a stone chimney',
    looksLike: 'cottage',
  },
  well: {
    description: 'a single round stone wishing well with a little wooden roof and a bucket',
    looksLike: 'boulder',
  },
  fruitstall: {
    description: 'a single small market stall with a striped awning and crates of colourful fruit',
    looksLike: 'cottage',
  },
  beehive: {
    description: 'a single old-fashioned straw beehive on a wooden stand, with two bees',
    looksLike: 'boulder',
  },
  scarecrow: {
    description: 'a single friendly scarecrow in a straw hat and patched shirt on a pole',
    looksLike: 'tree',
  },
  parasol: {
    description: 'a single striped beach umbrella above a folded beach towel and a bucket and spade',
    looksLike: 'flower',
  },
  lighthouse: {
    description: 'a single small red and white striped lighthouse on a few rocks',
    looksLike: 'pine',
  },
} satisfies Record<string, PropDef>;

export type PropKind = keyof typeof PROP_TABLE;

export const PROPS: Record<PropKind, PropDef> = PROP_TABLE;

/** Every picture the map can use, in the order the media studio lists them. */
export const PROP_KINDS = Object.keys(PROPS) as PropKind[];

export function isDrawnProp(kind: string): kind is DrawnPropKind {
  return (DRAWN_PROP_KINDS as readonly string[]).includes(kind);
}

/** Where the generated picture for a prop is committed, under `public/`. */
export function propFile(kind: PropKind): string {
  return `media/map/prop-${kind}.webp`;
}
