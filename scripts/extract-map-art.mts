/**
 * Saves the map art from a media pack exported by the studio into the repo.
 *
 * Outputs:
 *   public/media/map/tile-<terrain>.webp
 *   public/media/map/prop-<prop>.webp
 *
 * Run with:  pnpm run extract:map-art path/to/media-pack.json
 *            pnpm run extract:map-art path/to/media-pack.json --only beach,sandcastle
 *
 * The studio ("Export pack" on the Landscape tab) writes everything it has
 * generated into one JSON file as data URIs. This writes each generated tile
 * and prop out as a file at the path `default-pack.ts` expects, so the new art
 * becomes the committed default. Pieces that are still file paths (the
 * existing defaults) are skipped, as are ids the registries do not know.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROP_KINDS, propFile } from '../src/app/explore/props.ts';
import { TERRAIN_IDS, tileFile } from '../src/app/explore/terrains.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

interface ExportedPack {
  map?: {
    tiles?: Record<string, { src?: string } | null>;
    props?: Record<string, { src?: string } | null>;
  } | null;
}

const [packPath] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
if (!packPath) {
  console.error('Usage: pnpm run extract:map-art path/to/media-pack.json [--only id,id]');
  process.exit(1);
}
const onlyIndex = process.argv.indexOf('--only');
const only = onlyIndex >= 0 ? new Set(process.argv[onlyIndex + 1]?.split(',')) : null;

const pack = JSON.parse(readFileSync(packPath, 'utf8')) as ExportedPack;
const WEBP = /^data:image\/webp;base64,/;

function save(
  entries: Record<string, { src?: string } | null> | undefined,
  known: readonly string[],
  fileFor: (id: string) => string,
): number {
  let saved = 0;
  for (const [id, image] of Object.entries(entries ?? {})) {
    const src = image?.src ?? '';
    if (!WEBP.test(src) || !known.includes(id) || (only && !only.has(id))) continue;
    const file = join(ROOT, 'public', fileFor(id));
    writeFileSync(file, Buffer.from(src.replace(WEBP, ''), 'base64'));
    console.log(`saved ${file}`);
    saved++;
  }
  return saved;
}

const total =
  save(pack.map?.tiles, TERRAIN_IDS, (id) => tileFile(id as (typeof TERRAIN_IDS)[number])) +
  save(pack.map?.props, PROP_KINDS, (id) => propFile(id as (typeof PROP_KINDS)[number]));

console.log(total === 0 ? 'No generated map art in that pack.' : `${total} file(s) saved.`);
