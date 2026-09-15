// web/tz.md §18.1 scenario 16 — No SMS: the SMS channel cannot be clicked in Alert rules and
// `SMS` is never sent to the API (Q-2).
import { test, expect } from '@playwright/test';
import { authStatePath, keepAuthStateFresh } from './support/auth';

test.use({ storageState: authStatePath('ADMIN') });
keepAuthStateFresh('ADMIN');

test('the SMS channel is disabled in Alert rules and SMS never reaches the API', async ({ page }) => {
  let lastChannelsSent: string[] | null = null;
  await page.route('**/api/alert-rules', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      lastChannelsSent = body?.channels ?? null;
    }
    await route.continue();
  });

  await page.goto('/settings/alerts');
  await expect(page.getByText('SMS', { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: 'New rule' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // The SMS checkbox in the create-rule Delivery section is present but disabled — it cannot be
  // clicked, per Q-2 (a permanently-unavailable channel, not a removed §12.2 control).
  const smsRow = dialog.locator('label', { hasText: 'SMS' });
  await expect(smsRow.locator('input[type="checkbox"]')).toBeDisabled();
  await expect(smsRow.locator('input[type="checkbox"]')).not.toBeChecked();

  // No `{ exact: true }`: the `<label>` legitimately reads "Rule name *" (the required-field
  // marker) — Playwright's label text is raw DOM text, not the ARIA name that strips the
  // marker's `aria-hidden` span for screen readers.
  await dialog.getByLabel('Rule name').fill(`E2E no-SMS rule ${Date.now()}`);
  await dialog.getByRole('button', { name: 'Create rule' }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });

  expect(lastChannelsSent).not.toBeNull();
  expect(lastChannelsSent).not.toContain('SMS');
});
