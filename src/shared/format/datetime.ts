// web/tz.md §8.2 / §8.3 — date and time formatting.
//
// ⭐ Three display zones, never mixed:
//   RODS / HOS      → driver.homeTerminalTimezone  (format/hos.ts — formatRods*)
//   company context → carrier.timezone             (formatCarrier*)
//   user locale     → the browser                  (formatLocal*, relative time only)
// formatLocal is banned on log screens by ESLint; use formatRods there.
import { formatInTimeZone } from 'date-fns-tz';
import { EMPTY } from './empty';

export type DateInput = string | number | Date | null | undefined;

/** The §8.2 patterns, in one place. */
export const DATE_FORMATS = {
  /** `05:30` — table time, 24-hour. */
  time: 'HH:mm',
  /** `14:26:58` — log event time. */
  timeSeconds: 'HH:mm:ss',
  /** `Sep 10, 05:12` */
  dateTime: 'MMM dd, HH:mm',
  /** `Sep 10, 15:42:08` */
  dateTimeSeconds: 'MMM dd, HH:mm:ss',
  /** `Wed, Sep 10, 2025` */
  longDate: 'EEE, MMM d, yyyy',
  /** `Sep 11, 2025` */
  shortDate: 'MMM dd, yyyy',
  /** `Sep 24` — the date half of a due-by string. */
  monthDay: 'MMM dd',
  /** `2026-09-10` — a RODS day key. */
  isoDate: 'yyyy-MM-dd',
} as const;

export type DateFormatName = keyof typeof DATE_FORMATS;

export const BROWSER_TIMEZONE = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const pattern = (format: DateFormatName | string): string =>
  format in DATE_FORMATS ? DATE_FORMATS[format as DateFormatName] : format;

/**
 * The one primitive every other function is built on: render a UTC instant in an explicit zone.
 * DST is handled by date-fns-tz, so a 23/25-hour day formats correctly.
 */
export function formatInTz(
  value: DateInput,
  timeZone: string,
  format: DateFormatName | string = 'dateTime',
): string {
  const date = toDate(value);
  if (!date) return EMPTY.dash;
  return formatInTimeZone(date, timeZone, pattern(format));
}

/**
 * Browser-zone rendering — relative time and `Now · this device` only.
 * ⛔ Never on an HOS/RODS screen (§8.3): the log is split by the *driver's* day.
 */
export function formatLocal(value: DateInput, format: DateFormatName | string = 'dateTime'): string {
  return formatInTz(value, BROWSER_TIMEZONE(), format);
}

/** Company context — dashboard subtitle, audit log, report ranges, tickets (`carrier.timezone`). */
export function formatCarrier(
  value: DateInput,
  carrierTimezone: string,
  format: DateFormatName | string = 'dateTime',
): string {
  return formatInTz(value, carrierTimezone, format);
}

/** The `en-US` short zone name (`EDT`, `MST`, `HST`, `GMT+5`) in force at `date`. */
function shortZoneName(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
    .formatToParts(date)
    .filter((part) => part.type === 'timeZoneName')
    .map((part) => part.value)
    .join('');
}

/**
 * `ET` / `CT` — the abbreviation a company-context subtitle ends with.
 *
 * Read from `Intl` for the actual instant; the daylight letter is dropped (`EDT` → `ET`,
 * `AKST` → `AKT`) only when the zone really alternates between a `…ST` and a `…DT` name that
 * year. A zone that never observes DST keeps its real label (`America/Phoenix` → `MST`,
 * `Pacific/Honolulu` → `HST`), and anything else (`GMT+5`) passes through (web/bugs.md WB-092).
 */
export function timezoneAbbreviation(timeZone: string, at: DateInput = new Date()): string {
  const date = toDate(at) ?? new Date();
  const current = shortZoneName(date, timeZone);
  const year = date.getUTCFullYear();
  // January and July straddle DST in both hemispheres.
  const [first, second] = [
    shortZoneName(new Date(Date.UTC(year, 0, 15)), timeZone),
    shortZoneName(new Date(Date.UTC(year, 6, 15)), timeZone),
  ].sort() as [string, string];
  const daylight = /^([A-Z]+)DT$/.exec(first);
  const standard = /^([A-Z]+)ST$/.exec(second);
  if (daylight && standard && daylight[1] === standard[1]) return `${standard[1]}T`;
  return current;
}

/** `Sep 01 – Sep 10, 2025` — en dash, year once. Zone-explicit, never the browser's. */
export function formatDateRange(from: DateInput, to: DateInput, timeZone: string): string {
  const start = toDate(from);
  const end = toDate(to);
  if (!start || !end) return EMPTY.dash;
  const year = formatInTimeZone(end, timeZone, 'yyyy');
  const startYear = formatInTimeZone(start, timeZone, 'yyyy');
  if (year !== startYear) {
    return `${formatInTimeZone(start, timeZone, DATE_FORMATS.shortDate)} – ${formatInTimeZone(
      end,
      timeZone,
      DATE_FORMATS.shortDate,
    )}`;
  }
  return `${formatInTimeZone(start, timeZone, DATE_FORMATS.monthDay)} – ${formatInTimeZone(
    end,
    timeZone,
    DATE_FORMATS.monthDay,
  )}, ${year}`;
}

/** `Due in 3,100 mi · Sep 24` / `Due in 41 days · Oct 21` (§8.2). */
export function formatDueBy(lead: string, due: DateInput, timeZone: string): string {
  const date = toDate(due);
  if (!date) return lead;
  return `${lead} · ${formatInTimeZone(date, timeZone, DATE_FORMATS.monthDay)}`;
}

/** `Due in 41 days` */
export function formatDaysRemaining(days: number | null | undefined): string {
  if (typeof days !== 'number' || !Number.isFinite(days)) return EMPTY.dash;
  return `Due in ${days.toLocaleString('en-US')} ${days === 1 ? 'day' : 'days'}`;
}
