// web/tz.md §18.1 scenario 7 — Add unit → appears in the table → edit → delete with the
// confirmation text.
import { test, expect } from '@playwright/test';
import { authStatePath, keepAuthStateFresh } from './support/auth';

test.use({ storageState: authStatePath('ADMIN') });
keepAuthStateFresh('ADMIN');

test('add a unit, edit it, then delete it with the confirmation text', async ({ page }) => {
  const unitNumber = `E2E${Date.now() % 100000}`;
  const vin = `1E2E${Date.now()}`.slice(0, 17).padEnd(17, '0');

  await page.goto('/vehicles');
  await page.getByRole('button', { name: 'Add vehicle' }).click();
  const addDialog = page.getByRole('dialog');
  // No `{ exact: true }` on the required fields below: their `<label>` legitimately reads e.g.
  // "Unit number *" (the §11.2 required-field marker) — Playwright's label text comes from raw
  // DOM text, not the ARIA name that strips the marker's `aria-hidden` span for screen readers.
  await addDialog.getByLabel('Unit number').fill(unitNumber);
  await addDialog.getByLabel('Make').fill('Freightliner');
  await addDialog.getByLabel('Model').fill('Cascadia');
  await addDialog.getByLabel('Year').fill('2022');
  await addDialog.getByLabel('VIN').fill(vin);
  await addDialog.getByRole('button', { name: 'Save unit' }).click();
  await expect(addDialog).toBeHidden({ timeout: 10_000 });

  // Appears in the table.
  await page.getByPlaceholder('Search unit #, VIN, plate…').fill(unitNumber);
  const row = page.getByRole('row', { name: new RegExp(unitNumber) });
  await expect(row).toBeVisible({ timeout: 10_000 });

  // Edit. The per-row `…` trigger's real accessible name is `Row actions`
  // (`shared/ui/DataTable.tsx`), not `More` — the header-level dropdown next to `Export` is the
  // one actually named `More`.
  await row.getByRole('button', { name: 'Row actions' }).click();
  await page.getByRole('menuitem', { name: 'Edit unit' }).click();
  const editDialog = page.getByRole('dialog');
  await expect(editDialog.getByRole('heading', { name: new RegExp(`Edit unit #?${unitNumber}`) })).toBeVisible();
  await editDialog.getByLabel('Model').fill('Cascadia Evolution');
  await editDialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(editDialog).toBeHidden({ timeout: 10_000 });

  // Delete with the confirmation text.
  await row.getByRole('button', { name: 'Row actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete unit' }).click();
  const deleteDialog = page.getByRole('dialog');
  await expect(deleteDialog.getByText(/This cannot be undone/)).toBeVisible();
  const deleteButton = deleteDialog.getByRole('button', { name: 'Delete unit' });
  await expect(deleteButton).toBeDisabled();
  await deleteDialog.getByPlaceholder(`UNIT-${unitNumber}`).fill(`UNIT-${unitNumber}`);
  await expect(deleteButton).toBeEnabled();
  await deleteButton.click();
  await expect(deleteDialog).toBeHidden({ timeout: 10_000 });

  // web/tz.md §11.3 — `DELETE /vehicles/:id` soft-deletes (D-003): historical logs/DVIRs/IFTA
  // stay available for audits, so the row does not vanish — it moves to `Inactive`.
  await page.getByPlaceholder('Search unit #, VIN, plate…').fill(unitNumber);
  const deletedRow = page.getByRole('row', { name: new RegExp(unitNumber) });
  await expect(deletedRow).toBeVisible({ timeout: 10_000 });
  await expect(deletedRow.getByText('Inactive', { exact: true })).toBeVisible();
});
