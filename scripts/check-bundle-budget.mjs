#!/usr/bin/env node
/**
 * Bundle budget — web/tz.md §16.1. Over budget fails the build, it is not a warning.
 *
 *   entry + vendor + shell (everything index.html loads eagerly)  <= 220 KB gzip
 *   any other route chunk                                         <=  90 KB gzip
 *   maplibre + worker + css (lazy, map screens only)              <= 425 KB gzip (WD-023, WD-077)
 *   recharts (lazy)                                               <= 120 KB gzip
 *   total of every emitted chunk                                  <= 1.2 MB gzip
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, resolve } from 'node:path';

const DIST = resolve(process.cwd(), 'dist');
const KB = 1024;
const BUDGET = {
  initial: 220 * KB,
  route: 90 * KB,
  // §16.1 says 250 KB. `maplibre-gl@5.24.0`'s own shipped bundle gzips to 268.6 KB before a
  // single line of app code, so that number is unreachable at this major — raised to 290 KB
  // against the measured 286.2 KB in web/decisions.md WD-023. Raised again to 425 KB in WD-077:
  // `FleetMap.tsx` now points MapLibre at the Vite-bundled tile worker (`maplibre-gl-worker-*.js`,
  // 141.6 KB gzip) instead of a URL that 404'd, and the `/^maplibre-/` match correctly folds it
  // in — measured 421.0 KB. Still lazy, still map-screens-only, and the ~4 KB of headroom means
  // any further growth of the map chunk fails the build.
  maplibre: 425 * KB,
  recharts: 120 * KB,
  total: 1.2 * 1024 * KB,
};

const gz = (file) => gzipSync(readFileSync(file), { level: 9 }).length;
const fmt = (n) => `${(n / KB).toFixed(1)} KB`;

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

let assets;
try {
  assets = walk(join(DIST, 'assets')).filter((f) => /\.(js|css)$/.test(f));
} catch {
  console.error('bundle budget: dist/assets not found — run `vite build` first.');
  process.exit(1);
}

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const eager = new Set([...html.matchAll(/assets\/[A-Za-z0-9._-]+\.(?:js|css)/g)].map((m) => m[0]));

const rows = assets.map((file) => {
  const rel = file.slice(DIST.length + 1).replace(/\\/g, '/');
  const name = rel.split('/').pop();
  let kind = 'route';
  if (eager.has(rel)) kind = 'initial';
  else if (/^maplibre-/.test(name)) kind = 'maplibre';
  else if (/^recharts-/.test(name)) kind = 'recharts';
  return { rel, kind, size: gz(file) };
});

const sum = (kind) => rows.filter((r) => r.kind === kind).reduce((a, r) => a + r.size, 0);
const total = rows.reduce((a, r) => a + r.size, 0);
const failures = [];

const check = (label, actual, limit) => {
  const ok = actual <= limit;
  if (!ok) failures.push(`${label}: ${fmt(actual)} > ${fmt(limit)}`);
  return `${ok ? 'OK  ' : 'FAIL'}  ${label.padEnd(46)} ${fmt(actual).padStart(10)} / ${fmt(limit)}`;
};

console.log('\nBundle budget (gzip) — web/tz.md §16.1');
console.log('─'.repeat(78));
console.log(check('entry + vendor + shell (initial)', sum('initial'), BUDGET.initial));
for (const r of rows.filter((r) => r.kind === 'route').sort((a, b) => b.size - a.size)) {
  console.log(check(`route chunk ${r.rel}`, r.size, BUDGET.route));
}
if (sum('maplibre')) console.log(check('maplibre (lazy)', sum('maplibre'), BUDGET.maplibre));
if (sum('recharts')) console.log(check('recharts (lazy)', sum('recharts'), BUDGET.recharts));
console.log(check('total (all chunks)', total, BUDGET.total));
console.log('─'.repeat(78));

if (failures.length) {
  console.error(`\nBundle budget exceeded:\n  - ${failures.join('\n  - ')}\n`);
  process.exit(1);
}
console.log('Bundle budget met.\n');
