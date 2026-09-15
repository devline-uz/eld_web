// web/tz.md §18.1 scenario 5 — sidebar contents match the §4.2 table for all four roles.
//
// web/bugs.md WB-006 — reuses the storage state `01-dev-sign-in.spec.ts` (scenario 1) writes
// after each real login instead of logging in a second time (the `e2e-sign-in` → `e2e` project
// dependency in playwright.config.ts guarantees that file finishes first), and waits for the
// first nav link before reading `allInnerTexts()` — that call has no auto-wait of its own and
// was returning `[]` while the app shell was still mounting.
import { test, expect } from '@playwright/test';
import { authStatePath, keepAuthStateFresh, type DemoRole } from './support/auth';

// web/tz.md §4.2 — the exact, ordered top-level sidebar per role (mirrors
// tests/rbac/navigation.rbac.test.ts, which asserts the same table against the app's own
// navigation.ts at the unit level — this spec is the end-to-end confirmation in a real browser).
const EXPECTED_SIDEBAR: Record<DemoRole, string[]> = {
  ADMIN: [
    'Dashboard',
    'Live Fleet',
    'Vehicles',
    'Drivers',
    'Dispatch & Trips',
    'HOS Logs',
    'DVIR & Maintenance',
    'Safety',
    'Reports',
    'Messages',
    'Settings',
  ],
  FLEET_MANAGER: [
    'Dashboard',
    'Live Fleet',
    'Vehicles',
    'Drivers',
    'Dispatch & Trips',
    'HOS Logs',
    'DVIR & Maintenance',
    'Safety',
    'Reports',
    'Messages',
    'Settings',
  ],
  DISPATCHER: [
    'Dashboard',
    'Live Fleet',
    'Vehicles',
    'Drivers',
    'Dispatch & Trips',
    'HOS Logs',
    'Reports',
    'Messages',
    'Settings',
  ],
  VIEWER: [
    'Dashboard',
    'Live Fleet',
    'Vehicles',
    'Drivers',
    'HOS Logs',
    'DVIR & Maintenance',
    'Safety',
    'Reports',
    'Settings',
  ],
};

for (const role of Object.keys(EXPECTED_SIDEBAR) as DemoRole[]) {
  test.describe(role, () => {
    test.use({ storageState: authStatePath(role) });
    keepAuthStateFresh(role);

    test(`${role} sidebar matches web/tz.md §4.2`, async ({ page }) => {
      await page.goto('/');
      const nav = page.getByRole('navigation', { name: 'Main' });
      // WB-006: allInnerTexts() has no auto-wait — wait for the shell to actually mount first.
      await nav.getByRole('link').first().waitFor();
      const labels = await nav.getByRole('link').allInnerTexts();
      expect(labels.map((l) => l.trim())).toEqual(EXPECTED_SIDEBAR[role]);
    });
  });
}
