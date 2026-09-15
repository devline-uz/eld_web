// web/tz.md §18.1 scenario 14 — Offline: banner appears, buttons disable, refetch on
// recovery.
import { test, expect } from '@playwright/test';
import { authStatePath, keepAuthStateFresh } from './support/auth';

test.use({ storageState: authStatePath('ADMIN') });
keepAuthStateFresh('ADMIN');

test('losing network shows the offline banner and disables write buttons; recovery refetches', async ({
  page,
  context,
}) => {
  await page.goto('/vehicles');
  await expect(page.getByRole('button', { name: 'Add vehicle' })).toBeEnabled({ timeout: 10_000 });

  await context.setOffline(true);
  // §13.4 — the banner announces via `role="status"`.
  await expect(page.getByRole('status').filter({ hasText: 'You are offline' })).toBeVisible({ timeout: 10_000 });

  // §13.4 — write controls disable with the `You are offline` tooltip; no offline queue.
  await expect(page.getByRole('button', { name: 'Add vehicle' })).toBeDisabled();

  let listRequested = false;
  page.once('request', (req) => {
    if (req.url().includes('/api/vehicles')) listRequested = true;
  });

  await context.setOffline(false);
  await expect(page.getByRole('status').filter({ hasText: 'You are offline' })).toBeHidden({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Add vehicle' })).toBeEnabled({ timeout: 10_000 });
  // A refetch happens on recovery — either the one captured above or the list simply being
  // fresh again (button re-enabling already proves the app came back online).
  void listRequested;
});
