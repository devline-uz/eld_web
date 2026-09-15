// web/tz.md §18.1 scenario 10 — `Certify all` visible only to ADMIN; absent for FM.
import { test, expect } from '@playwright/test';
import { authStatePath, keepAuthStateFresh } from './support/auth';

test.describe('ADMIN', () => {
  test.use({ storageState: authStatePath('ADMIN') });
  keepAuthStateFresh('ADMIN');
  test('Certify all is present for ADMIN', async ({ page }) => {
    await page.goto('/hos-logs');
    await expect(page.getByRole('button', { name: 'Certify all' })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('FLEET_MANAGER', () => {
  test.use({ storageState: authStatePath('FLEET_MANAGER') });
  keepAuthStateFresh('FLEET_MANAGER');
  test('Certify all is absent from the DOM for a fleet manager', async ({ page }) => {
    await page.goto('/hos-logs');
    // Wait for the page to actually be interactive before asserting an absence.
    await expect(page.getByText('Hours of Service · Driver log')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Certify all' })).toHaveCount(0);
  });
});
