// web/tz.md §18.1 scenario 3 — the production build contains no password form at all:
// `dist/` must not contain the string "Developer sign-in". This is a build-artifact test, not
// a browser test: it runs a real `vite build --mode production` with `VITE_AUTH_MODE=production`
// into a scratch output directory (never the `dist/` the bundle-budget script checks) and greps
// the emitted JS for the banned string.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

const OUT_DIR = 'dist-e2e-prod-check';
const ROOT = process.cwd();

test.describe('production build — web/tz.md §18.1 scenario 3', () => {
  test.setTimeout(180_000);

  test('dist/ contains no "Developer sign-in" string', () => {
    execFileSync('npx', ['vite', 'build', '--mode', 'production', '--outDir', OUT_DIR], {
      cwd: ROOT,
      env: { ...process.env, VITE_AUTH_MODE: 'production' },
      stdio: 'pipe',
    });

    try {
      const assetsDir = join(ROOT, OUT_DIR, 'assets');
      expect(existsSync(assetsDir)).toBe(true);

      const files = readdirSync(assetsDir).filter((f) => /\.(js|css|html)$/.test(f));
      const offenders = files.filter((f) =>
        readFileSync(join(assetsDir, f), 'utf8').includes('Developer sign-in'),
      );

      expect(offenders, `found "Developer sign-in" in: ${offenders.join(', ')}`).toEqual([]);
    } finally {
      rmSync(join(ROOT, OUT_DIR), { recursive: true, force: true });
    }
  });
});
