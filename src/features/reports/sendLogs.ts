// owner: web-reports-transfer — 11.14 form rules. FMCSA constraints exactly, never widened:
// inspector address on `fmcsa.dot.gov`, `outputFileComment` 1–60, range at most 8 RODS days.
// The rules and strings are shared/forms'; this schema only fixes two defects of `transferSchema`
// (web/bugs.md WB-029): it required `recipient` for eRODS too, and spelled the method
// `WEB_SERVICE` where the backend enum is `WEB_SERVICES`.
import { z } from 'zod';
import { daySpan, inspectorEmail, isoDay, outputFileComment, requiredString } from '@/shared/forms/fields';
import { LIMITS, VALIDATION_MESSAGES as M } from '@/shared/forms/messages';
import { daysInRange, shiftDayKey } from './reportMeta';

export const sendLogsSchema = z
  .object({
    driverId: requiredString(M.required),
    method: z.enum(['WEB_SERVICES', 'EMAIL']),
    recipient: z.string().trim().optional(),
    outputFileComment: outputFileComment(),
    from: isoDay(),
    to: isoDay(),
  })
  .superRefine((value, ctx) => {
    if (value.method === 'EMAIL') {
      const parsed = inspectorEmail().safeParse(value.recipient ?? '');
      if (!parsed.success) {
        ctx.addIssue({ code: 'custom', path: ['recipient'], message: parsed.error.issues[0]?.message ?? M.inspectorEmail });
      }
    }
    const span = daySpan(value.from, value.to);
    if (!(Number.isFinite(span) && span >= 1 && span <= LIMITS.transferRangeDays)) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: M.transferRange });
    }
  });
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
