// LIVE-007 — trip windows and delivery times are typed in the carrier's zone (`datetime-local`
// carries no zone), so a dispatcher in another zone books the same instant the board shows.
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/** What `datetime-local` emits — `YYYY-MM-DDTHH:mm[:ss[.sss]]`, and never more than a 4-digit year. */
const LOCAL_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/;

/** An instant as the `datetime-local` value (minutes) in `timeZone`. */
export const toZonedInput = (d: Date, timeZone: string): string => formatInTimeZone(d, timeZone, "yyyy-MM-dd'T'HH:mm");

/** An ISO instant as the `datetime-local` value in `timeZone`; `''` for none / invalid. */
export function isoToZonedInput(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : toZonedInput(d, timeZone);
}

/** A `datetime-local` value read as wall time in `timeZone`, or `null` when blank, malformed or a
 * calendar date that does not exist (Feb 30, Feb 29 of a common year). */
export function parseZonedInput(value: string | undefined, timeZone: string): Date | null {
  const m = value ? LOCAL_DATETIME_RE.exec(value) : null;
  if (!m) return null;
  const [year, month, day, hour, minute, second] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? '0'].map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return null;
  // Calendar check without any zone: `Date.UTC` rolls a non-existent day over into the next month.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  const at = fromZonedTime(value as string, timeZone);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** A `datetime-local` value in `timeZone` as the ISO instant the API stores; undefined when blank. */
export function zonedInputToIso(value: string | undefined, timeZone: string): string | undefined {
  return parseZonedInput(value, timeZone)?.toISOString();
}

/** Start of today and end of the same day one year later, both in `timeZone`. */
export function zonedPickupRange(timeZone: string, now: Date = new Date()): { min: Date; max: Date } {
  const today = formatInTimeZone(now, timeZone, 'yyyy-MM-dd');
  const [y, rest] = [Number(today.slice(0, 4)), today.slice(4)];
  // Feb 29 + 1 year has no such day: fall back to Feb 28.
  const nextYear = rest === '-02-29' ? `${y + 1}-02-28` : `${y + 1}${rest}`;
  return {
    min: fromZonedTime(`${today}T00:00:00`, timeZone),
    max: fromZonedTime(`${nextYear}T23:59:59.999`, timeZone),
  };
}
