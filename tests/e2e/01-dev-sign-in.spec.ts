// web/tz.md §18.1 scenario 1 — dev mode: all four demo accounts sign in, each sees its own
// sidebar; the `Demo accounts` link fills the fields.
import { test, expect } from '@playwright/test';
import { DEMO_ACCOUNTS, fillViaDemoLink, signInAndPersist, type DemoRole } from './support/auth';

const ROLES: DemoRole[] = ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER', 'VIEWER'];

// web/bugs.md WB-006 — `POST /auth/login` is throttled to 5 req/60s per IP. Four logins in one
// file is safely under that, but only if they run one at a time rather than racing across
// Playwright workers, so this file is serial. Every other spec that needs an authenticated
// role reuses the storage state `signInAndPersist` writes here instead of logging in again —
// see the `dependencies: ['e2e-sign-in']` project wiring in playwright.config.ts.
test.describe.configure({ mode: 'serial' });

for (const role of ROLES) {
  test(`${role} demo account signs in and reaches the dashboard`, async ({ page }) => {
    await signInAndPersist(page, role);
    await expect(page).toHaveURL('/');
  });
}

test('the Demo accounts link fills email + password without submitting', async ({ page }) => {
  await fillViaDemoLink(page, 'ADMIN');
  await expect(page.getByLabel('Email')).toHaveValue(DEMO_ACCOUNTS.ADMIN.email);
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue(DEMO_ACCOUNTS.ADMIN.password);
});
