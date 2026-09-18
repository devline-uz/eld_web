// owner: web-reports-transfer — 11.14 form rules. FMCSA constraints exactly, never widened:
// inspector address on `fmcsa.dot.gov`, `outputFileComment` 1–60, range at most 8 RODS days.
// The schema is the shared `transferSchema` (`shared/forms/schemas.ts`) plus the 11.14 driver picker —
// one source of truth for the FMCSA rules (web/bugs.md WB-029).
import type { z } from 'zod';
import { requiredString } from '@/shared/forms/fields';
import { LIMITS, VALIDATION_MESSAGES as M } from '@/shared/forms/messages';
import { refineTransfer, transferFields } from '@/shared/forms/schemas';
import { daysInRange, shiftDayKey } from './reportMeta';

export const sendLogsSchema = transferFields
  .extend({ driverId: requiredString(M.required) })
  .superRefine(refineTransfer);
export type SendLogsValues = z.infer<typeof sendLogsSchema>;

/** 11.14 banner text, verbatim; W-15 repeats it on the Data transfer card. */
export const TEST_BANNER_TEXT =
  'The output file is built in full FMCSA format and sent to the FMCSA TEST endpoint. Production eRODS registration is pending — keep a downloaded copy for the officer.';

/** The page range narrowed to the last 8 RODS days when it is longer — never widened (WD-045). */
export function transferRangeFor(from: string, to: string): { from: string; to: string } {
  return daysInRange(from, to) > LIMITS.transferRangeDays
    ? { from: shiftDayKey(to, -(LIMITS.transferRangeDays - 1)), to }
    : { from, to };
}
