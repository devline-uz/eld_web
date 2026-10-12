// ⭐ web/tz.md §8.3 — RODS and HOS rendering. Every timestamp on a log screen goes through this
// file, in the driver's home terminal timezone. `formatLocal` is an ESLint error here: the
// dispatcher may sit in Tashkent while the log belongs to a driver in Columbus.
import { formatInTimeZone } from 'date-fns-tz';
import { DATE_FORMATS, type DateFormatName, type DateInput } from './datetime';
import { EMPTY } from './empty';

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * ⭐ The RODS formatter — deliberately a different function from `formatLocal`, taking the
 * driver's home terminal zone explicitly so it can never silently fall back to the browser.
 */
export function formatRods(
  value: DateInput,
  driverTimezone: string,
  format: DateFormatName | string = 'time',
): string {
  const date = toDate(value);
  if (!date) return EMPTY.dash;
  const resolved = format in DATE_FORMATS ? DATE_FORMATS[format as DateFormatName] : format;
  return formatInTimeZone(date, driverTimezone, resolved);
}

/** `05:30` — grid and table time in the driver's day. */
export const formatRodsTime = (value: DateInput, tz: string): string => formatRods(value, tz, 'time');

/** `14:26:58` — log event time. */
export const formatRodsTimeSeconds = (value: DateInput, tz: string): string =>
  formatRods(value, tz, 'timeSeconds');

/** `Wed, Sep 10, 2025` — the log day header. */
export const formatRodsDate = (value: DateInput, tz: string): string =>
  formatRods(value, tz, 'longDate');

/** `2026-09-10` — the RODS day key used in query keys and `?date=`. */
export const formatRodsDayKey = (value: DateInput, tz: string): string =>
  formatRods(value, tz, 'isoDate');

/** `Sep 10, 14:26` — mixed date and time inside the driver's day. */
export const formatRodsDateTime = (value: DateInput, tz: string): string =>
  formatRods(value, tz, 'dateTime');

/**
 * `00:19` · `11:26` · `70:00` — HOS hours from seconds. Always two digits, always tabular-nums
 * at the call site. Hours are not capped at 24: `70:00` is the weekly cycle.
 */
export function formatHosHours(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return EMPTY.dash;
  const total = Math.max(0, Math.trunc(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** The same clock format from decimal hours (`11.5` → `11:30`). */
export const formatHosHoursFromHours = (hours: number | null | undefined): string =>
  typeof hours === 'number' && Number.isFinite(hours)
    ? formatHosHours(Math.round(hours * 3600))
    : EMPTY.dash;

/** `07:30 · 02:00 · 11:26 · 03:04` — the daily totals strip. */
export function formatDailyTotals(seconds: Array<number | null | undefined>): string {
  return seconds.map(formatHosHours).join(' · ');
}

/**
 * Where a segment sits on the 24-column grid, as a 0…1 fraction of the driver's day.
 * DST-safe: the grid keeps 24 columns and coordinates are measured against
 * `summary.dayLengthSec` from the backend (23 h / 25 h days included).
 */
export function rodsDayFraction(
  offsetSec: number,
  dayLengthSec = 86_400,
): number {
  if (!Number.isFinite(offsetSec) || dayLengthSec <= 0) return 0;
  return Math.min(1, Math.max(0, offsetSec / dayLengthSec));
}

/**
 * Seconds from the start of the driver's RODS day to this instant. The day start comes from the
 * backend (`summary.dayStartAt`), which already resolved the driver's zone — so this is pure
 * instant maths and stays correct across a DST boundary.
 */
export function rodsDayOffsetSec(value: DateInput, dayStartIso: DateInput): number {
  const at = toDate(value);
  const start = toDate(dayStartIso);
  if (!at || !start) return 0;
  return Math.round((at.getTime() - start.getTime()) / 1000);
}

/** What a run-out HOS clock means (`HosMeter` `zeroNote`). Exported for tests and call sites. */
export const HOS_ZERO_NOTE = {
  /** The driver is DRIVING with the clock at 00:00 — a real overrun. */
  exceeded: 'limit exceeded',
  /** 11 h of driving used up or the 14-hour window closed — §395.3(a)(1) 10 h off resets both. */
  tenHourBreak: '10-hour break required',
  /** 70/8 (60/7) used up while NOT driving — not a violation (UI-002): hours come back at recap or
   * after a 34-hour restart (§395.3(c)). */
  cycle: 'cycle exhausted',
  /** 8 h of driving since the last 30-minute interruption (§395.3(a)(3)(ii)). */
  thirtyMinuteBreak: '30-minute break required',
} as const;

export interface HosClockState {
  dutyStatus: 'DRIVING' | 'ON_DUTY' | 'SLEEPER' | 'OFF_DUTY';
  cycleRemainingSec: number;
}

export interface HosClockNotes {
  drive: string;
  shift: string;
  cycle: string;
  break: string;
}

/**
 * The note each clock shows at 00:00. A clock at zero is a violation only while the driver is
 * DRIVING; otherwise it is the reason the driver may not drive yet, and the note names it.
 * Drive left is the tightest of the 11-hour limit, the 14-hour window and the cycle (the backend
 * `driveRemainingSec`), so at 00:00 it names whichever binds — the cycle first, because a 10-hour
 * break does not give cycle hours back.
 */
export function hosClockNotes(clock: HosClockState): HosClockNotes {
  if (clock.dutyStatus === 'DRIVING') {
    return { drive: HOS_ZERO_NOTE.exceeded, shift: HOS_ZERO_NOTE.exceeded, cycle: HOS_ZERO_NOTE.exceeded, break: HOS_ZERO_NOTE.exceeded };
  }
  return {
    drive: clock.cycleRemainingSec <= 0 ? HOS_ZERO_NOTE.cycle : HOS_ZERO_NOTE.tenHourBreak,
    shift: HOS_ZERO_NOTE.tenHourBreak,
    cycle: HOS_ZERO_NOTE.cycle,
    break: HOS_ZERO_NOTE.thirtyMinuteBreak,
  };
}
