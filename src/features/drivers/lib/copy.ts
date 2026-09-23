// owner: web-vehicles-drivers — W-06/W-07 action copy.
//
// tz.md §13.3 (and therefore `shared/ui/copy.ts`) has no entry for driver deactivation, the bulk
// unit assignment, a bulk message or a queued RODS export. WD-081: rather than each call site
// inventing a sentence, the wording lives here in one keyed table, named and shaped exactly like
// `TOAST_COPY` so it can move into §13.3 unchanged when the table is next extended.
import type { ToastCopy } from '@/shared/ui/copy';

const plural = (count: number, singular: string): string => `${singular}${count === 1 ? '' : 's'}`;

export const DRIVER_TOAST = {
  driversDeactivated: (count: number): ToastCopy => ({
    title: `${count} ${plural(count, 'driver')} deactivated`,
    description: 'Their logs and DVIRs stay available for audits.',
  }),
  driversDeactivateFailed: (failed: number, total: number): ToastCopy => ({
    title: `${failed} of ${total} ${plural(total, 'driver')} could not be deactivated`,
    description: 'Those drivers are unchanged. Try again.',
  }),
  unitAssigned: (unitNumber: string, driverName: string): ToastCopy => ({
    title: `Unit #${unitNumber} assigned`,
    description: `${driverName} drives it from the next sign-in to the app.`,
  }),
  rodsExportQueued: (count: number): ToastCopy => ({
    title: count === 1 ? 'RODS export queued' : `${count} RODS exports queued`,
    description: 'The file appears under Reports as soon as it is ready.',
  }),
  rodsExportFailed: (failed: number, total: number): ToastCopy => ({
    title: `${failed} of ${total} ${plural(total, 'export')} could not be queued`,
    description: 'Nothing was exported for those drivers. Try again.',
  }),
  messageSent: (count: number): ToastCopy => ({
    title: `Message sent to ${count} ${plural(count, 'driver')}`,
    description: 'It appears in each driver conversation in Messages.',
  }),
  driverUpdated: (name: string): ToastCopy => ({
    title: `${name} updated`,
  }),
} as const;

/** B-81 — there is no carrier-side password reset for a driver account (web/backend-gaps.md). */
export const NO_PASSWORD_RESET =
  'No carrier-side reset yet — the driver resets the app password from the sign-in screen.';

/**
 * B-94 (tz.md §20 B-16) — the API stores no driver documents (no S3 upload or metadata
 * endpoint), so the W-07 `Documents` tab stays disabled with this reason on screen (WB-236).
 */
export const DRIVER_DOCUMENTS_REASON =
  'Driver documents are not available yet — the API has no document storage for drivers.';
