// owner: web-dispatch-messaging — W-11 Dispatch & Trips, the depart-date range shared by the
// `PeriodDropdown` custom inputs and the Filters drawer "Depart" group. Pure date-math helpers so
// the bounds and error copy are unit-testable without mounting either, and so `today` is always
// caller-supplied (never a module-load constant). The bounds only keep out nonsense years
// (1000, 5000, …) — past and future trips are both legitimate to filter on.
import { addYears, endOfYear, format, isValid, parse } from 'date-fns';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_FORMAT = 'yyyy-MM-dd';

/** Earliest depart date the range will ever accept. */
export const CUSTOM_RANGE_MIN = '1970-01-01';

/** True only for a real, existing calendar date written as canonical `yyyy-MM-dd` — rejects
 * malformed strings (wrong digit counts, e.g. a 5/6-digit year) and non-existent dates
 * (`2026-02-31`) that `date-fns`' `parse` would otherwise silently roll over (to `2026-03-03`). */
export function isRealCalendarDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const parsed = parse(value, DAY_FORMAT, new Date());
  return isValid(parsed) && format(parsed, DAY_FORMAT) === value;
}

function toDay(d: Date): string {
  return format(d, DAY_FORMAT);
}

/** Latest depart date the range accepts — the end of next year, so planned trips a dispatcher
 * looks ahead to (and the future To the `This week`/`This month` presets write) stay reachable. */
export function departRangeMax(today: Date): string {
  return toDay(endOfYear(addYears(today, 1)));
}

/** From/To: each a real date within `[1970-01-01, departRangeMax]`, and From on or before To
 * (a single-day range is fine). Empty is allowed. Returns the inline error for each field, `null` = valid. */
export function validateDepartRange(
  from: string | null,
  to: string | null,
  today: Date,
): { fromError: string | null; toError: string | null } {
  const max = departRangeMax(today);
  const check = (value: string | null): string | null => {
    if (!value) return null;
    if (!isRealCalendarDate(value)) return 'Enter a real date.';
    if (value < CUSTOM_RANGE_MIN) return `Must be on or after ${CUSTOM_RANGE_MIN}.`;
    if (value > max) return `Must be on or before ${max}.`;
    return null;
  };
  const fromError = check(from);
  let toError = check(to);
  if (!fromError && !toError && from && to && to < from) toError = 'Must be on or after the From date.';
  return { fromError, toError };
}
