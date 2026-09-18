#!/usr/bin/env node
/**
 * WB-054 — source maps must never be published.
 *
 * `vite.config.ts` builds with `sourcemap: 'hidden'`: maps are generated (so a release can upload
 * them to Sentry — src/shared/observability/sentry.ts) but no `//# sourceMappingURL` comment is
 * emitted. This step then moves every `*.map` out of `dist/` into `sourcemaps/` (git-ignored,
 * same relative layout), so whatever syncs `dist/` to the web server cannot ship them.
 * Fails the build if a map or a sourceMappingURL reference is still in `dist/` afterwards.
 */
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const DIST = resolve(process.cwd(), 'dist');
const OUT = resolve(process.cwd(), 'sourcemaps');

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

rmSync(OUT, { recursive: true, force: true });
let moved = 0;
for (const file of walk(DIST)) {
  if (!file.endsWith('.map')) continue;
  const target = join(OUT, relative(DIST, file));
  mkdirSync(dirname(target), { recursive: true });
  renameSync(file, target);
  moved += 1;
}

const leaks = walk(DIST).filter(
  (file) =>
    file.endsWith('.map') ||
    (/\.(js|css)$/.test(file) && /sourceMappingURL=/.test(readFileSync(file, 'utf8'))),
);
if (leaks.length) {
  console.error(`sourcemaps: ${leaks.length} file(s) in dist/ still expose a source map:`);
  for (const file of leaks) console.error(`  ${relative(process.cwd(), file)}`);
  process.exit(1);
}
console.log(`sourcemaps: moved ${moved} map(s) from dist/ to sourcemaps/ — dist/ publishes none.`);
