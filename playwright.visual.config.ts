// owner: web-design-system — Phase 10 visual-pass capture only (web/tz.md §18). Reuses the same
// server/baseURL/viewport contract as `playwright.config.ts` (owned by web-qa-a11y) but points
// `testDir` at `tests/visual` so this doesn't collide with the 16 mandatory E2E specs or the axe
// sweep. `tests/e2e/.auth/<role>.json` (written by `01-dev-sign-in.spec.ts`) is reused read-only.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    viewport: { width: 1280, height: 800 },
  },
  projects: [{ name: 'visual', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run dev', port: 5173, reuseExistingServer: true, timeout: 60_000 },
});
