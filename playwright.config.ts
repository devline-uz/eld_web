// owner: web-qa-a11y — the 16 mandatory E2E scenarios and the visual pass (web/tz.md §15/§18).
// Runs against the Vite dev server (5173) talking to the live dev API (3002 — web/decisions.md
// WD-001), not a preview build: the 16 scenarios exercise real sign-in against the seeded dev
// DB, which a static `vite preview` of a stale `dist/` cannot do. Scenario 3 is the one
// exception — it inspects the already-built `dist/` directly via `node:fs` and needs no server.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // web/bugs.md WB-034 — `POST /auth/refresh` rotates the refresh token and treats reuse of an
  // already-rotated one as a compromise (revokes every session for that user). Every spec file
  // that loads a role's `tests/e2e/.auth/<role>.json` forces exactly one such rotation the
  // moment the app boots (only `obk.rt` survives in `localStorage`, so the first API call is
  // always a 401 that triggers a refresh); `support/auth.ts`'s `keepAuthStateFresh()` writes the
  // rotated pair back after each test, but that only keeps the file valid if specs sharing a
  // role never read and rotate it concurrently. Single-worker, non-parallel execution is what
  // makes that hold.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    // §16.2 — every target is measured at 1280×800.
    viewport: { width: 1280, height: 800 },
  },
  // web/bugs.md WB-006 — `01-dev-sign-in.spec.ts` is the only spec allowed to call
  // `POST /auth/login` (throttled 5/60s per IP); everything else that needs to be signed in
  // reuses the storage state it writes via `signInAndPersist`. The dependency guarantees that
  // file finishes — in one worker, so its own four logins can't race each other — before any
  // spec that reads `tests/e2e/.auth/*.json` starts.
  projects: [
    {
      name: 'e2e-sign-in',
      testMatch: '01-dev-sign-in.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'e2e',
      testIgnore: '01-dev-sign-in.spec.ts',
      dependencies: ['e2e-sign-in'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run dev', port: 5173, reuseExistingServer: true, timeout: 60_000 },
});
