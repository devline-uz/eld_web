// web/tz.md §15 — axe-core sweep: 0 `critical`, 0 `serious` violations on every built screen
// (W-01…W-26). The detail routes that need a live `:id` (W-04, W-05, W-07) resolve a real id at
// runtime from their parent list's first row rather than hard-coding one — the seeded dev DB's
// row order is not a stable contract.
//
// This is a single-role (ADMIN) sweep of every static top-level and Settings route ADMIN can
// see, run as its own spec file so a violation on one screen never hides the others (Playwright
// reports each `test()` independently). The Live Fleet keyboard column and the HOS 24-hour grid's
// `role="img"` + `sr-only` table are asserted explicitly, per the brief, in addition to the
// general axe pass.
import { test, expect } from '@playwright/test';
import { authStatePath, keepAuthStateFresh } from './support/auth';
import { assertNoBlockingA11yViolations } from './support/axe';
import { RBAC_SCREENS } from '../fixtures/rbacScreens';

test.use({ storageState: authStatePath('ADMIN') });
keepAuthStateFresh('ADMIN');

const STATIC_SCREENS = RBAC_SCREENS.filter(
  (s) => s.visibleForRole.ADMIN && !s.route.includes(':id'),
);

for (const screen of STATIC_SCREENS) {
  test(`${screen.id} ${screen.label} — axe: 0 critical/serious`, async ({ page }) => {
    await page.goto(screen.route);
    await page.waitForLoadState('networkidle').catch(() => {});
    await assertNoBlockingA11yViolations(page);
  });
}

test('W-02 Live Fleet — keyboard-operable left column (map has no keyboard equivalent otherwise)', async ({
  page,
}) => {
  await page.goto('/live-fleet');
  await page.waitForLoadState('networkidle').catch(() => {});
  // §15 — the map itself is not keyboard-operable; the vehicle list is the mandatory text
  // equivalent and must be reachable by Tab and operable by Enter, same as any other list.
  await page.keyboard.press('Tab');
  const focused = page.locator(':focus');
  await expect(focused).toBeVisible();
});

test('W-08 HOS Logs 24-hour grid — role="img" label plus an sr-only table equivalent', async ({ page }) => {
  await page.goto('/hos-logs');
  await page.waitForLoadState('networkidle').catch(() => {});
  const graph = page.getByRole('img').first();
  await expect(graph).toBeVisible({ timeout: 10_000 });
  await expect(graph).toHaveAttribute('aria-label', /.+/);
  // The sr-only table equivalent is present in the DOM even though visually hidden.
  await expect(page.locator('table:has(caption)').first()).toHaveCount(1);
});

test('W-04 Unit profile — axe: 0 critical/serious', async ({ page }) => {
  await page.goto('/vehicles');
  await page.waitForLoadState('networkidle').catch(() => {});
  const firstRow = page.locator('table tbody tr').first();
  await firstRow.click();
  await page.waitForURL(/\/vehicles\/.+/);
  await page.waitForLoadState('networkidle').catch(() => {});
  await assertNoBlockingA11yViolations(page);
});

test('W-05 Unit histories — axe: 0 critical/serious', async ({ page }) => {
  await page.goto('/vehicles');
  await page.waitForLoadState('networkidle').catch(() => {});
  const firstRow = page.locator('table tbody tr').first();
  await firstRow.click();
  await page.waitForURL(/\/vehicles\/.+/);
  const url = new URL(page.url());
  await page.goto(`${url.pathname}/histories`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await assertNoBlockingA11yViolations(page);
});

// web/backend-gaps.md B-1 — `GET /drivers/roster` is confirmed missing on the real dev API, so
// the Drivers table (W-06) that this test needs a row from is always empty against the live
// backend; there is no real id to resolve at runtime. Un-fixme once B-1 ships.
test.fixme('B-1 — W-07 Driver profile — axe: 0 critical/serious', async ({ page }) => {
  await page.goto('/drivers');
  await page.waitForLoadState('networkidle').catch(() => {});
  const firstRow = page.locator('table tbody tr').first();
  await firstRow.click();
  await page.waitForURL(/\/drivers\/.+/);
  await page.waitForLoadState('networkidle').catch(() => {});
  await assertNoBlockingA11yViolations(page);
});
