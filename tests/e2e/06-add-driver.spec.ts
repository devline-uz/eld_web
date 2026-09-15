// web/tz.md §18.1 scenario 6 — Add driver: `Email address` required and unique; the new
// driver appears in the Drivers table.
import { test, expect } from '@playwright/test';
import { authStatePath, keepAuthStateFresh } from './support/auth';

test.use({ storageState: authStatePath('ADMIN') });
keepAuthStateFresh('ADMIN');

function uniqueDriver() {
  const stamp = Date.now();
  return {
    firstName: 'E2E',
    lastName: `Driver${stamp}`,
    email: `e2e.driver.${stamp}@example.com`,
    username: `e2e_driver_${stamp}`,
  };
}

test('Add driver requires Email address, and the create call succeeds', async ({ page }) => {
  const d = uniqueDriver();
  await page.goto('/drivers');
  await page.getByRole('button', { name: 'Add driver' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Submit with Email address left blank — the required-field error surfaces.
  await dialog.getByLabel('First name').fill(d.firstName);
  await dialog.getByLabel('Last name').fill(d.lastName);
  await dialog.getByLabel('Username').fill(d.username);
  // `getByRole('textbox', { name, exact: true })`, not `getByLabel`: the field's `<label>`
  // legitimately reads "Password *" (the §11.8 required-field marker) — an exact `getByLabel`
  // match against the bare word never resolves, since Playwright's label text there is raw DOM
  // text, not the ARIA name (which correctly strips the marker's `aria-hidden` span). A
  // non-exact `getByLabel('Password')` is ambiguous the other way: it also matches the
  // show/hide toggle's `aria-label="Show password"`. `getByRole` computes the real accessible
  // name, so `exact: true` against "Password" resolves to the input alone.
  await dialog.getByRole('textbox', { name: 'Password', exact: true }).fill('Onebook2026x');
  await dialog.getByLabel('Driver licence number').fill(`CDL${Date.now()}`);
  await dialog.getByRole('button', { name: 'Save driver' }).click();
  // `shared/forms/fields.ts` `email()` shares its message with the format check
  // ("Enter a valid email address.") rather than a distinct "required" string — an empty field
  // fails the same `zod` rule a malformed one would.
  await expect(dialog.getByText('Enter a valid email address.')).toBeVisible();

  // Fill the email and save for real — `POST /drivers` is a real, working endpoint.
  await dialog.getByLabel('Email address').fill(d.email);
  await dialog.getByRole('button', { name: 'Save driver' }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
});

// web/backend-gaps.md B-1 — `GET /drivers/roster` (W-06 Drivers) is confirmed missing on the real
// dev API (`404 DRIVER_NOT_FOUND`, the router falling through to `GET /drivers/:id`); it is
// MSW-mocked for unit/contract tests only (`features/drivers/DriversPage.tsx`'s own file header:
// "this screen does not ship for real without it"). Against the real backend the Drivers table
// is always the error card, so the newly-created driver can never be confirmed in it. Un-fixme
// once B-1 ships.
test.fixme('B-1 — the new driver appears in the Drivers table', async ({ page }) => {
  const d = uniqueDriver();
  await page.goto('/drivers');
  await page.getByRole('button', { name: 'Add driver' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('First name').fill(d.firstName);
  await dialog.getByLabel('Last name').fill(d.lastName);
  await dialog.getByLabel('Username').fill(d.username);
  await dialog.getByRole('textbox', { name: 'Password', exact: true }).fill('Onebook2026x');
  await dialog.getByLabel('Driver licence number').fill(`CDL${Date.now()}`);
  await dialog.getByLabel('Email address').fill(d.email);
  await dialog.getByRole('button', { name: 'Save driver' }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });

  await page.getByPlaceholder('Search driver, username…').fill(d.username);
  await expect(page.getByText(`${d.firstName} ${d.lastName}`)).toBeVisible({ timeout: 10_000 });
});

// web/backend-gaps.md B-30 — `Driver.email` is `String?`, not `@unique`, on the live API; the
// panel "enforces uniqueness client-side only" and cannot see other drivers' emails to check
// against, so submitting a second driver with an already-used email is accepted, not rejected.
// The duplicate-email half of scenario 6 cannot pass honestly until B-30 ships.
test.fixme(
  'B-30 — a second driver with an already-used Email address is rejected as a duplicate',
  async () => {},
);

