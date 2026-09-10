/**
 * What the fox builds at each place, drawn in three states.
 *
 * The badges are the reward, but a row of identical signposts makes a map where
 * the only way to see progress is to read every label. A thing that visibly
 * grows — bare plot, walls up, finished with a flag — turns the whole landscape
 * into the progress bar, readable at a glance and from across the map.
 *
 * Each region builds something of its own, so a finished Word Wood does not
 * look like a finished Adding Pond.
 *
 * Pure string-building, Angular-free, so it can be unit-tested and reused by
 * the generator script if it ever wants it.
 */

export type BuildStage = 'plot' | 'started' | 'finished';

/** The box every build is drawn in. */
export const BUILD_WIDTH = 64;
export const BUILD_HEIGHT = 60;

/** Which stage a place is at, from the badges won there. */
export function stageFor(badges: readonly string[]): BuildStage {
  if (badges.includes('mastered')) return 'finished';
  if (badges.includes('cleared')) return 'started';
  return 'plot';
}

function shade(colour: string, amount: number): string {
  const value = parseInt(colour.slice(1), 16);
  const towards = amount >= 0 ? 255 : 0;
  const strength = Math.abs(amount);
  const channel = (shift: number) => {
    const base = (value >> shift) & 0xff;
    return Math.round(base + (towards - base) * strength);
  };
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(channel(16))}${hex(channel(8))}${hex(channel(0))}`;
}

const TIMBER = '#a9793f';
const TIMBER_DARK = '#7c5326';
const STONE = '#cfc6b4';

/**
 * Nothing built yet: an empty signpost on a bare patch.
 *
 * Deliberately small and narrow. Anything wide here reads as a fence across the
 * path — and with most of the map unbuilt at the start, whatever this is gets
 * repeated forty-odd times, so it has to be quiet.
 */
function plot(): string {
  return (
    `<ellipse cx="32" cy="54" rx="15" ry="4.5" fill="#2c2440" opacity="0.14"/>` +
    `<rect x="29.5" y="26" width="5" height="28" rx="2.5" fill="${TIMBER_DARK}"/>` +
    `<rect x="19" y="22" width="26" height="15" rx="3" fill="${shade(TIMBER, 0.45)}" ` +
    `stroke="${TIMBER_DARK}" stroke-width="2"/>`
  );
}

/** Walls up, roof not on: the shape of the finished thing is already visible. */
function walls(colour: string): string {
  return (
    `<ellipse cx="32" cy="54" rx="24" ry="6" fill="#2c2440" opacity="0.14"/>` +
    `<rect x="14" y="30" width="36" height="24" rx="3" fill="${shade(colour, 0.74)}"/>` +
    `<rect x="14" y="30" width="12" height="24" fill="${shade(colour, 0.55)}" opacity="0.55"/>` +
    // Scaffolding, so it reads as half-done rather than as a low building.
    `<rect x="10" y="24" width="4" height="30" rx="2" fill="${TIMBER}"/>` +
    `<rect x="50" y="24" width="4" height="30" rx="2" fill="${TIMBER}"/>` +
    `<rect x="10" y="27" width="44" height="3.5" rx="1.75" fill="${TIMBER_DARK}"/>`
  );
}

/** The roof and the flag that only a crown pays for. */
function roof(colour: string, flag: string): string {
  return (
    `<path d="M 8 30 L 32 12 L 56 30 z" fill="${colour}"/>` +
    `<path d="M 8 30 L 32 12 L 32 30 z" fill="${shade(colour, 0.28)}"/>` +
    `<rect x="31" y="0" width="3" height="14" rx="1.5" fill="${TIMBER_DARK}"/>` +
    `<path d="M 34 1 L 48 5 L 34 9 z" fill="${flag}"/>`
  );
}

/**
 * The build for one place. Returns the inner SVG of a 64×60 box, so the caller
 * decides the size and the viewBox.
 */
export function buildSvg(
  terrain: string,
  stage: BuildStage,
  colour: string,
): string {
  if (stage === 'plot') return plot();

  switch (terrain) {
    case 'water': {
      // A jetty, then a little boat moored at the end of it.
      const deck =
        `<ellipse cx="32" cy="54" rx="24" ry="6" fill="#2c2440" opacity="0.12"/>` +
        `<rect x="8" y="38" width="48" height="7" rx="2" fill="${TIMBER}"/>` +
        `<rect x="8" y="38" width="48" height="3" rx="1.5" fill="${shade(TIMBER, 0.3)}"/>` +
        `<rect x="13" y="45" width="4" height="10" rx="2" fill="${TIMBER_DARK}"/>` +
        `<rect x="47" y="45" width="4" height="10" rx="2" fill="${TIMBER_DARK}"/>`;
      if (stage === 'started') return deck;
      return (
        deck +
        `<path d="M 16 38 L 50 38 L 44 27 L 22 27 z" fill="${shade(colour, 0.2)}"/>` +
        `<path d="M 16 38 L 33 38 L 33 27 L 22 27 z" fill="${shade(colour, 0.45)}"/>` +
        `<rect x="31" y="4" width="3" height="24" rx="1.5" fill="${TIMBER_DARK}"/>` +
        `<path d="M 34 5 L 48 15 L 34 22 z" fill="#fff6da"/>`
      );
    }

    case 'caves': {
      // A propped-open cave mouth, then a lantern hung over it.
      const props =
        `<ellipse cx="32" cy="54" rx="24" ry="6" fill="#2c2440" opacity="0.14"/>` +
        `<path d="M 10 54 q 0 -32 22 -32 q 22 0 22 32 z" fill="${shade(colour, 0.4)}"/>` +
        `<path d="M 19 54 q 0 -22 13 -22 q 13 0 13 22 z" fill="${shade(colour, -0.75)}"/>` +
        `<rect x="15" y="30" width="5" height="24" rx="2" fill="${TIMBER}"/>` +
        `<rect x="44" y="30" width="5" height="24" rx="2" fill="${TIMBER}"/>`;
      if (stage === 'started') return props;
      return (
        props +
        `<rect x="13" y="26" width="38" height="5" rx="2.5" fill="${TIMBER_DARK}"/>` +
        `<rect x="30.5" y="10" width="3" height="16" rx="1.5" fill="${TIMBER_DARK}"/>` +
        `<circle cx="32" cy="9" r="8" fill="#ffd45e"/>` +
        `<circle cx="30" cy="7" r="4" fill="#fff6da"/>`
      );
    }

    case 'forest': {
      // A treehouse: the platform first, the hut and the ladder after.
      const trunk =
        `<ellipse cx="32" cy="54" rx="20" ry="6" fill="#2c2440" opacity="0.14"/>` +
        `<rect x="27" y="26" width="10" height="28" rx="3" fill="${TIMBER_DARK}"/>` +
        `<rect x="10" y="34" width="44" height="6" rx="3" fill="${TIMBER}"/>`;
      if (stage === 'started') return trunk;
      return (
        trunk +
        `<rect x="16" y="16" width="32" height="18" rx="3" fill="${shade(colour, 0.7)}"/>` +
        `<rect x="16" y="16" width="11" height="18" fill="${shade(colour, 0.48)}" opacity="0.55"/>` +
        `<path d="M 11 17 L 32 3 L 53 17 z" fill="${shade(colour, 0.12)}"/>` +
        `<path d="M 11 17 L 32 3 L 32 17 z" fill="${shade(colour, 0.34)}"/>` +
        `<rect x="20" y="40" width="3" height="14" rx="1.5" fill="${TIMBER}"/>` +
        `<rect x="30" y="40" width="3" height="14" rx="1.5" fill="${TIMBER}"/>`
      );
    }

    case 'hills': {
      // A cairn, then a beacon on top of it.
      const stones =
        `<ellipse cx="32" cy="54" rx="22" ry="6" fill="#2c2440" opacity="0.14"/>` +
        `<ellipse cx="32" cy="47" rx="21" ry="9" fill="${STONE}"/>` +
        `<ellipse cx="32" cy="44" rx="21" ry="7" fill="${shade(STONE, 0.3)}"/>` +
        `<ellipse cx="32" cy="36" rx="15" ry="8" fill="${shade(STONE, -0.08)}"/>` +
        `<ellipse cx="32" cy="34" rx="15" ry="6" fill="${shade(STONE, 0.24)}"/>`;
      if (stage === 'started') return stones;
      return (
        stones +
        `<ellipse cx="32" cy="26" rx="10" ry="6" fill="${shade(STONE, -0.14)}"/>` +
        `<ellipse cx="32" cy="24" rx="10" ry="5" fill="${shade(STONE, 0.2)}"/>` +
        `<rect x="30.5" y="10" width="3" height="12" rx="1.5" fill="${TIMBER_DARK}"/>` +
        `<path d="M 32 2 q 7 6 5 11 q -2 4 -5 4 q -3 0 -5 -4 q -2 -5 5 -11 z" fill="#ff9b3d"/>` +
        `<path d="M 32 7 q 3.5 3.5 2.5 6.5 q -1 2 -2.5 2 q -1.5 0 -2.5 -2 q -1 -3 2.5 -6.5 z" fill="#ffe27a"/>`
      );
    }

    default:
      // Village, meadow and anything added later: a cottage.
      return stage === 'started'
        ? walls(colour)
        : walls(colour) + roof(shade(colour, -0.05), '#ffd45e');
  }
}

/**
 * A build as a complete `data:` URI, so the map can render it as an ordinary
 * `<img>` rather than injecting markup — which Angular's sanitiser would strip
 * half of anyway.
 */
export function buildDataUrl(
  terrain: string,
  stage: BuildStage,
  colour: string,
): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BUILD_WIDTH}" height="${BUILD_HEIGHT}" ` +
    `viewBox="0 0 ${BUILD_WIDTH} ${BUILD_HEIGHT}">${buildSvg(terrain, stage, colour)}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
