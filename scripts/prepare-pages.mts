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
 *
 * It also refuses to build if an API key file has found its way into the
 * output. See below — this is the check that makes keeping keys in
 * `public/local-keys.json` safe rather than merely convenient.
 */
import { copyFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(import.meta.dirname, '..', 'dist', 'kids-learning-games', 'browser');

/**
 * Everything in `public/` is copied into the build, and this build is published
 * to GitHub Pages for anyone to read. A key file there would be a key given
 * away, so stop rather than deploy.
 *
 * This is the whole safety net. It runs on every deploy — the workflow's only
 * build command is `build:pages` — and CI never has the file, since it is
 * git-ignored. So the only thing this can catch is a local `pnpm run
 * build:pages` on a machine that has keys, which is exactly when someone needs
 * stopping.
 */
const keyFile = join(outDir, 'local-keys.json');
if (existsSync(keyFile)) {
  rmSync(keyFile);
  console.error(
    'Refusing to prepare a build containing local-keys.json.\n' +
      'It was removed from the output, but the build is not safe to publish:\n' +
      'run `pnpm run build:pages` again now that it is gone.',
  );
  process.exit(1);
}

copyFileSync(join(outDir, 'index.html'), join(outDir, '404.html'));
writeFileSync(join(outDir, '.nojekyll'), '');

console.log(`Prepared ${outDir} for GitHub Pages (404.html, .nojekyll).`);
