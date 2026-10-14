// web/tz.md §18.1 scenario 10, revised by CODE-029 — certification is the driver's own signature
// (§395.8(e)) and is given only in the driver app. No web role, not even ADMIN, gets `Certify all`;
// the card says who signs instead.
import { test, expect } from '@playwright/test';
import { authStatePath, keepAuthStateFresh } from './support/auth';

for (const role of ['ADMIN', 'FLEET_MANAGER'] as const) {
  test.describe(role, () => {
    test.use({ storageState: authStatePath(role) });
    keepAuthStateFresh(role);
    test(`Certify all is absent for ${role}; the card says drivers certify in the app`, async ({ page }) => {
      await page.goto('/hos-logs');
      // Wait for the page to actually be interactive before asserting an absence.
      await expect(page.getByText('Hours of Service · Driver log')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('Drivers certify in the app')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Certify all' })).toHaveCount(0);
    });
  });
}
