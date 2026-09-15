// owner: web-qa-a11y — sign-in fixture shared by every E2E spec (web/tz.md §10 W-00,
// §6.7). Copy is transcribed verbatim from web/tz.md §10 W-00 so this helper needs no changes
// once web-auth-rbac ships a new screen — only the surrounding `test.fixme` gates lift.
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type Page } from '@playwright/test';

const SUPPORT_DIR = fileURLToPath(new URL('.', import.meta.url));

export type DemoRole = 'ADMIN' | 'FLEET_MANAGER' | 'DISPATCHER' | 'VIEWER';

export const DEMO_ACCOUNTS: Record<DemoRole, { email: string; password: string; demoLink: string }> = {
  ADMIN: { email: 'sarah.chen@universal-logistics.example', password: 'Onebook2026', demoLink: 'admin' },
  FLEET_MANAGER: {
    email: 'mike.torres@universal-logistics.example',
    password: 'Onebook2026',
    demoLink: 'fleet manager',
  },
  DISPATCHER: {
    email: 'carlos.ramirez@universal-logistics.example',
    password: 'Onebook2026',
    demoLink: 'dispatcher',
  },
  VIEWER: { email: 'diane.foster@universal-logistics.example', password: 'Onebook2026', demoLink: 'viewer' },
};

/**
 * Opens the collapsed "▾ Developer sign-in" block and submits the dev password form. There is no
 * second step for any role (web/decisions.md WD-067).
 */
export async function signInAsDev(page: Page, role: DemoRole): Promise<void> {
  const { email, password } = DEMO_ACCOUNTS[role];
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Developer sign-in' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await page.waitForURL('/');
}

/** The `Demo accounts: admin · fleet manager · dispatcher · viewer` link row (§18.1 #1). */
export async function fillViaDemoLink(page: Page, role: DemoRole): Promise<void> {
  const { demoLink } = DEMO_ACCOUNTS[role];
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Developer sign-in' }).click();
  await page.getByRole('button', { name: demoLink, exact: true }).click();
}

/**
 * web/bugs.md WB-006 — `POST /auth/login` is throttled to 5 req/60s per IP. Rather than log in
 * 4 times per spec file, `01-dev-sign-in.spec.ts` (the one spec whose job is to exercise the
 * real login UI) is the *only* place that calls `signInAsDev`; every other spec that needs an
 * authenticated role (`05-sidebar-by-role.spec.ts`) loads the storage state that scenario
 * writes here instead of logging in again. A Playwright project dependency
 * (`playwright.config.ts`) guarantees scenario 1 runs to completion first.
 */
export function authStatePath(role: DemoRole): string {
  return join(SUPPORT_DIR, '..', '.auth', `${role}.json`);
}

export async function signInAndPersist(page: Page, role: DemoRole): Promise<void> {
  await signInAsDev(page, role);
  const path = authStatePath(role);
  mkdirSync(dirname(path), { recursive: true });
  await page.context().storageState({ path });
}

/**
 * `POST /auth/refresh` rotates the refresh token (`backend/src/modules/auth/auth.service.ts`
 * `refreshUser`) and — because reuse of an already-rotated token is treated as a compromise —
 * *revokes every session for that user* if the stale one is ever replayed. Every spec file that
 * loads a role's storage state forces exactly one such rotation the moment the app boots (only
 * `obk.rt` survives in `localStorage`; the access token is memory-only, so the very first API
 * call is always a 401 that triggers a refresh). A spec file that reads the file `signInAndPersist`
 * wrote and then moves on without saving the *new* pair back leaves every following spec holding
 * a now-rotated, now-invalid token — the next one to use it gets "Your session has expired" and,
 * worse, kills that role's session everywhere else it might be signed in (web/bugs.md WB-034).
 * Call this once per spec file right after `test.use({ storageState: authStatePath(role) })` so
 * the rotated pair is written back for whichever spec runs next.
 */
export function keepAuthStateFresh(role: DemoRole): void {
  test.afterEach(async ({ context }) => {
    // A crashed or already-torn-down context (`Target crashed`, `Page crashed` — both seen under
    // heavy shared-machine load) answers `storageState()` with `{ cookies: [], origins: [] }`
    // instead of throwing. Writing that straight to disk would wipe out a perfectly good
    // `obk.rt` with nothing, leaving *every* later spec permanently signed out — worse than the
    // stale-token problem this function exists to fix. Only persist a state that still carries
    // the refresh token.
    const state = await context.storageState().catch(() => null);
    const hasRefreshToken = state?.origins?.some((o) =>
      o.localStorage?.some((entry) => entry.name === 'obk.rt' && entry.value),
    );
    if (!hasRefreshToken) return;
    const path = authStatePath(role);
    mkdirSync(dirname(path), { recursive: true });
    await context.storageState({ path }).catch(() => {});
  });
}
