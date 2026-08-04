/**
 * Post-build step for GitHub Pages. Run via `pnpm run build:pages`.
 *
 * Two things Pages needs that the Angular build does not produce:
 *
 *  - `404.html`: Pages serves it for any path with no file behind it. Making it
 *    a copy of index.html means a deep link like `/play/maths`, or a reload on
 *    one, boots the app instead of showing GitHub's 404 page. The app's router
 *    then reads the URL as normal.
 *  - `.nojekyll`: stops Pages running the output through Jekyll, which would
 *    otherwise drop files and folders whose names begin with an underscore.
 */
import { copyFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(import.meta.dirname, '..', 'dist', 'kids-learning-games', 'browser');

copyFileSync(join(outDir, 'index.html'), join(outDir, '404.html'));
writeFileSync(join(outDir, '.nojekyll'), '');

console.log(`Prepared ${outDir} for GitHub Pages (404.html, .nojekyll).`);
