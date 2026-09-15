// web/tz.md §18.1 scenario 11 — Unassigned driving: assign 2 segments → toast → counter
// decreases.
import { test, expect } from '@playwright/test';
import { authStatePath, keepAuthStateFresh } from './support/auth';

test.use({ storageState: authStatePath('ADMIN') });
keepAuthStateFresh('ADMIN');

test('assigning 2 unassigned-driving segments shows a toast and decrements the counter', async ({ page }) => {
  await page.goto('/hos-logs');
  await expect(page.getByText('Hours of Service · Driver log')).toBeVisible({ timeout: 10_000 });

  const chip = page.getByText(/^\d+ unassigned segments?$/);
  const count = await chip.count();
  test.skip(count === 0, 'No unassigned-driving segments in the seeded data to exercise this scenario against.');

  const before = Number((await chip.first().textContent())?.match(/\d+/)?.[0] ?? '0');
  test.skip(before < 2, 'Fewer than 2 unassigned-driving segments in the seeded data.');

  await chip.first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Unassigned segments must be assigned to a driver or annotated/)).toBeVisible();

  const checkboxes = dialog.locator('input[type="checkbox"]');
  const selects = dialog.locator('select');
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  await selects.nth(0).selectOption({ index: 1 });
  await selects.nth(1).selectOption({ index: 1 });
  await dialog.getByRole('textbox').fill('E2E bulk-assigned during scenario 11.');

  await expect(dialog.getByRole('button', { name: 'Assign 2 segments' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Assign 2 segments' }).click();

  await expect(page.getByText('2 segments assigned')).toBeVisible({ timeout: 10_000 });
  await expect(dialog).toBeHidden({ timeout: 10_000 });

  const after = page.getByText(/^\d+ unassigned segments?$/);
  if (await after.count()) {
    const afterCount = Number((await after.first().textContent())?.match(/\d+/)?.[0] ?? '0');
    expect(afterCount).toBe(before - 2);
  } else {
    await expect(page.getByText('No unassigned segments')).toBeVisible();
  }
});
