// owner: web-qa-a11y — shared write-control absence assertions (web/tz.md §12.2), used by both
// the Viewer-only scenario 15 spec and the 4-role × 26-screen global gate audit (spec 18).
import { expect, type Page } from '@playwright/test';

// §12.2 — the exact set of controls that must be absent from the DOM in read-only mode.
const WRITE_CTA_RE = /^(\+\s*)?(Add|Create|New|Register|Invite)\b/i;

/**
 * web/tz.md §10 W-24 / §21.4, web/bugs.md B-12 — `+ New ticket` is a documented READ-level
 * exception: every role, including Viewer, may open its own support ticket. Excluded here
 * rather than widening the shared regex, which every other screen still needs at full strength.
 */
const EXEMPT_CTA_TEXT = 'New ticket';

export async function assertNoWriteControls(page: Page, label: string): Promise<void> {
  const ctas = page.getByRole('button', { name: WRITE_CTA_RE }).filter({ hasNotText: EXEMPT_CTA_TEXT });
  await expect(ctas, `${label}: a primary CTA is visible`).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Import' }), `${label}: Import is visible`).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /^Import( from CSV)?$/ }),
    `${label}: Import is visible`,
  ).toHaveCount(0);

  // The row "…" menu column.
  await expect(page.getByRole('button', { name: 'More' }), `${label}: row "…" menu is visible`).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Row actions' }), `${label}: row actions menu is visible`).toHaveCount(
    0,
  );

  // The selection checkbox column, including its header checkbox.
  await expect(
    page.locator('table thead input[type="checkbox"]'),
    `${label}: header selection checkbox is visible`,
  ).toHaveCount(0);

  // In-card action buttons and the header Edit button (exact-match to avoid catching "Edit filters" etc).
  for (const name of [
    'Edit',
    'Resolve',
    'Certify all',
    'Assign coaching',
    'Calibrate odometer',
    'New work order',
    'Schedule',
  ]) {
    await expect(page.getByRole('button', { name, exact: true }), `${label}: "${name}" is visible`).toHaveCount(0);
  }
}
