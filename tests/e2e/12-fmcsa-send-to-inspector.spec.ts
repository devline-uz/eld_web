// web/tz.md §18.1 scenario 12 — FMCSA pack → Send to inspector → TEST-mode banner → transfer
// listed as "Test only".
import { test, expect } from '@playwright/test';
import { authStatePath, keepAuthStateFresh } from './support/auth';

test.use({ storageState: authStatePath('ADMIN') });
keepAuthStateFresh('ADMIN');

test('Send to inspector shows the TEST-mode banner and the transfer is listed as Test only', async ({ page }) => {
  await page.goto('/reports/fmcsa');
  await page.getByRole('button', { name: 'Send to inspector' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // §11.14 / B-45 — TEST mode is never hidden; it fails safe to TEST when the carrier's real
  // mode cannot be read (web/decisions.md WD-038).
  await expect(dialog.getByText('eRODS · TEST mode')).toBeVisible();

  // `DriverPicker`'s popover portals its own `role="dialog"`, separate from the Send-logs
  // modal, so this is scoped to the page, not `dialog`. An explicit visibility wait (rather
  // than relying on `.click()`'s own actionability polling) gives the driver list — now several
  // hundred rows deep from accumulated E2E runs against the shared dev DB — room to settle
  // before the click fires.
  await dialog.getByRole('button', { name: 'Select a driver' }).click();
  const firstDriverOption = page.getByRole('listitem').first().getByRole('button');
  await expect(firstDriverOption).toBeVisible({ timeout: 15_000 });
  await firstDriverOption.click();

  await dialog.getByPlaceholder('ROADSIDE INSPECTION 2025-09-10').fill('E2E ROADSIDE INSPECTION');

  await dialog.getByRole('button', { name: 'Send transfer' }).click();

  // Not a wait for the "eRODS · TEST mode" banner alone — that's `builtInTest`, shown before the
  // send too, so it is already true at this point and proves nothing about the transfer having
  // finished. `Close` only replaces the footer's `Cancel` once `result` (the mutation response)
  // is set (`SendLogsModal`'s `sent`); waiting for two `Close`-named buttons — the header `X`
  // plus the relabelled footer button — is the real signal the transfer is done.
  await expect(dialog.getByText(/Test only|TEST_ONLY|eRODS · TEST mode/).first()).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByRole('button', { name: 'Close' })).toHaveCount(2, { timeout: 15_000 });

  // Two elements share the accessible name `Close` once the transfer is sent: the modal header's
  // dismiss `X` and the footer's `Close` button (§11.14, `Cancel` relabels to `Close` post-send).
  // `.last()` targets the footer button — the intended "I'm done" action.
  await dialog.getByRole('button', { name: 'Close' }).last().click();
  await expect(dialog).toBeHidden();

  // The Previous transfers card lists it as `Test only`.
  await expect(page.getByText('Test only').first()).toBeVisible({ timeout: 10_000 });
});
