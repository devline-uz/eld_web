// owner: web-dispatch-messaging — W-11 Dispatch & Trips, the `PeriodDropdown` "Date range" custom
// inputs. Pure date-math helpers so the From/To bounds and error copy are unit-testable without
// mounting the popover, and so `today` is always caller-supplied (never a module-load constant —
// the two are "yesterday"/"today" of the *browser's* clock at the moment the popover is open).
import { addDays, format, isValid, parse, startOfDay, subDays } from 'date-fns';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_FORMAT = 'yyyy-MM-dd';

/** Earliest date the custom range will ever accept. */
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

/** From: real date only, `[1970-01-01, yesterday]` — the max always leaves at least one valid
 * To date (today). */
export function customFromBounds(today: Date): { min: string; max: string } {
  return { min: CUSTOM_RANGE_MIN, max: toDay(subDays(startOfDay(today), 1)) };
}

/** To: real date only, `[From + 1 day, today]`. With no (or no valid) From yet, the min falls
 * back to the day after the absolute floor, `1970-01-02`. */
export function customToBounds(from: string | null, today: Date): { min: string; max: string } {
  const min = from && isRealCalendarDate(from) ? toDay(addDays(parse(from, DAY_FORMAT, new Date()), 1)) : '1970-01-02';
  return { min, max: toDay(startOfDay(today)) };
}

/** `null` = valid (or empty — emptiness is allowed, the caller decides whether that's enough to
 * apply). Non-null = the inline error to show under the From field. */
export function validateCustomFrom(value: string, today: Date): string | null {
  if (!value) return null;
  if (!isRealCalendarDate(value)) return 'Enter a real date.';
  const { min, max } = customFromBounds(today);
  if (value < min) return `Must be on or after ${min}.`;
  if (value > max) return `Must be on or before ${max}.`;
  return null;
}

/** `null` = valid (or empty). Non-null = the inline error to show under the To field. `from` is
 * the raw (possibly empty/invalid) From field value, so To stays reactive to whatever the user
 * has currently typed there. */
export function validateCustomTo(value: string, from: string, today: Date): string | null {
  if (!value) return null;
  if (!isRealCalendarDate(value)) return 'Enter a real date.';
  const { min, max } = customToBounds(from || null, today);
  if (value < min) return from ? 'Must be later than the From date.' : `Must be on or after ${min}.`;
  if (value > max) return `Must be on or before ${max}.`;
  return null;
}
