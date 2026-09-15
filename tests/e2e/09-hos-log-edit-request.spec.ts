// web/tz.md §18.1 scenario 9 — HOS Logs: pick driver → change date → correct grid segments →
// `Request a log edit` → DRIVING_TIME_IMMUTABLE surfaced.
import { test, expect } from '@playwright/test';
import { authStatePath, keepAuthStateFresh } from './support/auth';

test.use({ storageState: authStatePath('ADMIN') });
keepAuthStateFresh('ADMIN');

test('HOS Logs: driver + date selection renders the grid; requesting an edit against a Driving record surfaces DRIVING_TIME_IMMUTABLE', async ({
  page,
}) => {
  // This walks up to 8 days back (each a fresh log fetch) before the row interaction and modal
  // even start — the default 30 s budget is tight for that many sequential round trips.
  test.setTimeout(90_000);
  await page.goto('/hos-logs');
  await expect(page.getByText('Hours of Service · Driver log')).toBeVisible({ timeout: 10_000 });

  // Not the page's own default driver (`drivers[0]`): the shared dev DB accumulates a fresh
  // `E2E Driver…` account — with no HOS history at all — at the front of `GET /drivers` on every
  // run of `06-add-driver.spec.ts`/`07-unit-crud.spec.ts`, so the default keeps rotating onto a
  // driver that can never have a `Driving` day. Pick a real, named seed driver explicitly.
  // The trigger's accessible name is the *currently selected* driver's name here (unlike the
  // empty FMCSA picker, this page always arrives with `drivers[0]` pre-selected), so it cannot
  // be matched by the `Select a driver` placeholder text — `aria-haspopup="dialog"` inside
  // `<main>` is unique to it (the topbar's search/notifications triggers share the attribute
  // but live in the `banner` landmark, not `main`).
  await page.getByRole('main').locator('button[aria-haspopup="dialog"]').first().click();
  // Radix `Popover.Content` renders with an implicit `role="dialog"` — scope to it rather than
  // `getByRole('listitem')` on the whole page, which also matches the 11-item sidebar nav `<ul>`.
  const driverPopover = page.getByRole('dialog');
  const seedDriverOption = driverPopover.getByRole('listitem').filter({ hasNotText: 'E2E Driver' }).first().getByRole('button');
  await expect(seedDriverOption).toBeVisible({ timeout: 15_000 });
  await seedDriverOption.click();

  // The picked driver + today's date already renders the grid — confirm the §15 accessible
  // equivalent (`role="img"` 24-hour graph) is present before walking the date backwards.
  await expect(page.getByRole('img').first()).toBeVisible({ timeout: 10_000 });
  const prevDayButton = page.getByRole('button', { name: 'Previous day' });

  // `table:not(.sr-only)` excludes the 24-hour grid's spoken-summary table (web/tz.md §15), which
  // also has a `Driving` row but sits invisibly under the SVG and would intercept the hover.
  const visibleTable = page.locator('table:not(.sr-only)');
  let found = false;
  for (let i = 0; i < 8 && !found; i++) {
    // Not `getByText('Driving')` on the whole page: the grid's left-column row label always
    // reads "Driving" (it is the row caption, not a data value) even on a day with zero driving
    // events, so it "found" a day that had nothing to click. Only a row in the real `Log events`
    // table means there is an actual driving record for this day.
    const drivingCell = visibleTable.getByRole('row', { name: /Driving/ }).first();
    if (await drivingCell.count()) {
      found = true;
      break;
    }
    await prevDayButton.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  test.skip(!found, 'No Driving-status log event found in the seeded data within 8 days to exercise §395.30(c)(2) against.');

  const drivingRow = visibleTable.getByRole('row', { name: /Driving/ }).first();
  await drivingRow.hover();
  await drivingRow.getByRole('button', { name: 'Row actions' }).click();
  await page.getByRole('menuitem', { name: 'Request an edit' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Under 49 CFR §395.30 a carrier may only suggest an edit/)).toBeVisible();

  // Re-status the driving record to ON duty — §395.30(c)(2) forbids reducing/reassigning
  // driving time, so the server must refuse this even though the client only disables the
  // `Driving` chip itself.
  await dialog.getByRole('button', { name: 'ON duty' }).click();
  await dialog.getByRole('textbox', { name: /Reason for the edit/ }).fill('E2E requested restatus of driving time.');
  await dialog.getByRole('button', { name: 'Send edit request' }).click();

  await expect(dialog.getByRole('alert')).toBeVisible({ timeout: 10_000 });
  await expect(dialog.getByRole('alert')).toContainText(/driving/i);
});
