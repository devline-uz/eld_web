// web/tz.md §18.1 scenario 15 — Read-only: Viewer sees no write control on any of its
// screens (§12.2). W-26 My account is excluded here — it is being built by another agent in
// parallel (see the Phase 10 brief) — leaving 15 of the Viewer's 16 screens.
import { test } from '@playwright/test';
import { authStatePath, keepAuthStateFresh } from './support/auth';
import { assertNoWriteControls } from './support/rbacControls';
import { RBAC_SCREENS } from '../fixtures/rbacScreens';

test.use({ storageState: authStatePath('VIEWER') });
keepAuthStateFresh('VIEWER');

const STATIC_SCREENS = RBAC_SCREENS.filter(
  (s) => s.visibleForRole.VIEWER && !s.route.includes(':id'),
);

for (const screen of STATIC_SCREENS) {
  test(`${screen.id} ${screen.label} — no write control for Viewer`, async ({ page }) => {
    await page.goto(screen.route);
    // Let the screen finish its first paint / query before asserting absence.
    await page.waitForLoadState('networkidle').catch(() => {});
    await assertNoWriteControls(page, screen.label);
  });
}

test('W-04 Unit profile — no write control for Viewer', async ({ page }) => {
  await page.goto('/vehicles');
  await page.waitForLoadState('networkidle').catch(() => {});
  const firstRow = page.locator('table tbody tr').first();
  await firstRow.click();
  await page.waitForURL(/\/vehicles\/.+/);
  await assertNoWriteControls(page, 'W-04 Unit profile');
});

// web/backend-gaps.md B-1 — `GET /drivers/roster` (W-06 Drivers) is confirmed missing on the
// real dev API (`404 DRIVER_NOT_FOUND`, the router falling through to `GET /drivers/:id`); it
// is MSW-mocked for unit/contract tests only. Against the real backend the Drivers table is
// always empty, so there is no row to click into W-07. Un-fixme once B-1 ships.
test.fixme('B-1 — W-07 Driver profile — no write control for Viewer', async ({ page }) => {
  await page.goto('/drivers');
  await page.waitForLoadState('networkidle').catch(() => {});
  const firstRow = page.locator('table tbody tr').first();
  await firstRow.click();
  await page.waitForURL(/\/drivers\/.+/);
  await assertNoWriteControls(page, 'W-07 Driver profile');
});
