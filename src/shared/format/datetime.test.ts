import { describe, expect, it, vi } from 'vitest';
import {
  BROWSER_TIMEZONE,
  DATE_FORMATS,
  dateOnlyKey,
  dateOnlyToInstant,
  formatCarrier,
  formatCarrierDateTime,
  formatDateOnly,
  formatDateRange,
  formatDaysRemaining,
  formatDueBy,
  formatInTz,
  formatLocal,
  formatLocalDateTime,
  timezoneAbbreviation,
  todayInTz,
} from './datetime';

const ET = 'America/New_York';
const NOON_UTC = '2025-09-10T19:12:00.000Z';

describe('§8.2 date and time formats', () => {
  it('renders each documented pattern in an explicit zone', () => {
    expect(formatInTz(NOON_UTC, ET, 'time')).toBe('15:12');
    expect(formatInTz(NOON_UTC, ET, 'timeSeconds')).toBe('15:12:00');
    expect(formatInTz(NOON_UTC, ET, 'dateTime')).toBe('Sep 10, 15:12');
    expect(formatInTz(NOON_UTC, ET, 'dateTimeSeconds')).toBe('Sep 10, 15:12:00');
    expect(formatInTz(NOON_UTC, ET, 'longDate')).toBe('Wed, Sep 10, 2025');
    expect(formatInTz(NOON_UTC, ET, 'shortDate')).toBe('Sep 10, 2025');
    expect(formatInTz(NOON_UTC, ET, 'isoDate')).toBe('2025-09-10');
    expect(formatInTz(NOON_UTC, ET, "yyyy'/'MM")).toBe('2025/09');
    expect(formatInTz(NOON_UTC, ET)).toBe('Sep 10, 15:12');
    expect(DATE_FORMATS.monthDay).toBe('MMM dd');
  });

  it('accepts a Date, an epoch and an ISO string, and refuses anything else', () => {
    expect(formatInTz(new Date(NOON_UTC), ET, 'time')).toBe('15:12');
    expect(formatInTz(Date.parse(NOON_UTC), ET, 'time')).toBe('15:12');
    expect(formatInTz('not a date', ET)).toBe('—');
    expect(formatInTz(null, ET)).toBe('—');
    expect(formatInTz(undefined, ET)).toBe('—');
    expect(formatInTz('', ET)).toBe('—');
  });

  it('falls back to UTC when the browser reports no zone', () => {
    const spy = vi
      .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
      .mockReturnValue({ timeZone: '' } as Intl.ResolvedDateTimeFormatOptions);
    expect(BROWSER_TIMEZONE()).toBe('UTC');
    spy.mockRestore();
  });

  it('uses the browser zone only for formatLocal, and the carrier zone for company context', () => {
    expect(BROWSER_TIMEZONE()).toBeTypeOf('string');
    expect(formatLocal(NOON_UTC, 'isoDate')).toBe(
      formatInTz(NOON_UTC, BROWSER_TIMEZONE(), 'isoDate'),
    );
    expect(formatLocal(NOON_UTC)).toBeTypeOf('string');
    expect(formatCarrier(NOON_UTC, ET, 'time')).toBe('15:12');
  });

  it('shortens a US zone abbreviation to the form the subtitle uses', () => {
    expect(timezoneAbbreviation(ET, NOON_UTC)).toBe('ET');
    expect(timezoneAbbreviation('America/Chicago', '2025-01-10T19:12:00.000Z')).toBe('CT');
    expect(timezoneAbbreviation('Asia/Tashkent', NOON_UTC)).toMatch(/GMT/);
    expect(timezoneAbbreviation(ET)).toBe('ET');
    expect(timezoneAbbreviation(ET, 'nonsense')).toBe('ET');
  });

  it('keeps the real label for zones that never observe DST (WB-092)', () => {
    const winter = '2025-01-10T19:12:00.000Z';
    expect(timezoneAbbreviation('America/Phoenix', NOON_UTC)).toBe('MST');
    expect(timezoneAbbreviation('America/Phoenix', winter)).toBe('MST');
    expect(timezoneAbbreviation('Pacific/Honolulu', NOON_UTC)).toBe('HST');
    expect(timezoneAbbreviation('Pacific/Honolulu', winter)).toBe('HST');
    // Four-letter DST pair collapses like the three-letter ones.
    expect(timezoneAbbreviation('America/Anchorage', NOON_UTC)).toBe('AKT');
    expect(timezoneAbbreviation('America/Anchorage', winter)).toBe('AKT');
    expect(timezoneAbbreviation('America/Denver', NOON_UTC)).toBe('MT');
    // A zone that switches between offsets with no named pair passes through.
    expect(timezoneAbbreviation('Europe/London', NOON_UTC)).toMatch(/GMT/);
  });
});

describe('ranges and due-by strings', () => {
  it('renders a range with the year stated once', () => {
    expect(formatDateRange('2025-09-01T04:00:00Z', '2025-09-10T04:00:00Z', ET)).toBe(
      'Sep 01 – Sep 10, 2025',
    );
  });

  it('states both years when the range crosses new year', () => {
    expect(formatDateRange('2024-12-28T05:00:00Z', '2025-01-03T05:00:00Z', ET)).toBe(
      'Dec 28, 2024 – Jan 03, 2025',
    );
  });

  it('renders an incomplete range as an em dash', () => {
    expect(formatDateRange(null, '2025-09-10T04:00:00Z', ET)).toBe('—');
    expect(formatDateRange('2025-09-01T04:00:00Z', null, ET)).toBe('—');
  });

  it('formats the future strings from §8.2', () => {
    expect(formatDueBy('Due in 3,100 mi', '2025-09-24T12:00:00Z', ET)).toBe(
      'Due in 3,100 mi · Sep 24',
    );
    expect(formatDueBy('Due in 3,100 mi', null, ET)).toBe('Due in 3,100 mi');
    expect(formatDaysRemaining(41)).toBe('Due in 41 days');
    expect(formatDaysRemaining(1)).toBe('Due in 1 day');
    expect(formatDaysRemaining(null)).toBe('—');
    expect(formatDaysRemaining(Number.NaN)).toBe('—');
  });
});

// ⭐ §8.3 — the three display zones, and the DST days where getting this wrong is visible.
// `formatRods` is imported from ./hos on purpose: it must stay a different function from
// `formatLocal`, taking the driver's home terminal zone explicitly.
describe('three timezones — driver home terminal vs carrier vs browser', () => {
  const COLUMBUS = 'America/New_York';
  const TASHKENT = 'Asia/Tashkent';

  it('renders one instant three different ways without ever guessing the zone', async () => {
    const { formatRods } = await import('./hos');
    const instant = '2026-09-10T23:30:00.000Z';

    // Driver in Columbus: still Sep 10, 19:30 — the RODS day it belongs to.
    expect(formatRods(instant, COLUMBUS, 'dateTime')).toBe('Sep 10, 19:30');
    // Dispatcher in Tashkent looking at the same event: Sep 11 on their wall clock.
    expect(formatInTz(instant, TASHKENT, 'dateTime')).toBe('Sep 11, 04:30');
    // The carrier's own zone drives the dashboard subtitle.
    expect(formatCarrier(instant, COLUMBUS, 'dateTime')).toBe('Sep 10, 19:30');
    // The two functions are genuinely separate implementations, not aliases.
    expect(formatRods).not.toBe(formatLocal);
  });

  it('keeps the RODS day key on the driver day, not the viewer day', async () => {
    const { formatRodsDayKey } = await import('./hos');
    const instant = '2026-09-11T03:30:00.000Z'; // 23:30 on Sep 10 in Columbus
    expect(formatRodsDayKey(instant, COLUMBUS)).toBe('2026-09-10');
    expect(formatInTz(instant, TASHKENT, 'isoDate')).toBe('2026-09-11');
  });

  it('survives spring forward — 02:00 never exists on the 23-hour day', async () => {
    const { formatRods, formatRodsDayKey } = await import('./hos');
    // 2026-03-08: US DST starts, 02:00 → 03:00 local.
    expect(formatRods('2026-03-08T06:30:00.000Z', COLUMBUS, 'time')).toBe('01:30'); // EST
    expect(formatRods('2026-03-08T07:30:00.000Z', COLUMBUS, 'time')).toBe('03:30'); // EDT
    expect(formatRodsDayKey('2026-03-08T07:30:00.000Z', COLUMBUS)).toBe('2026-03-08');
    expect(timezoneAbbreviation(COLUMBUS, '2026-03-08T06:30:00.000Z')).toBe('ET');
  });

  it('survives fall back — 01:30 happens twice on the 25-hour day', async () => {
    const { formatRods } = await import('./hos');
    // 2026-11-01: US DST ends, 02:00 → 01:00 local.
    expect(formatRods('2026-11-01T05:30:00.000Z', COLUMBUS, 'time')).toBe('01:30'); // EDT
    expect(formatRods('2026-11-01T06:30:00.000Z', COLUMBUS, 'time')).toBe('01:30'); // EST, again
    // Same wall clock, different instants — the day is 25 hours long and the grid still has
    // 24 columns because coordinates come from summary.dayLengthSec (see hos.test.ts).
    expect(formatRods('2026-11-01T05:30:00.000Z', COLUMBUS, 'dateTimeSeconds')).toBe(
      'Nov 01, 01:30:00',
    );
  });

  it('formats a range that crosses a DST boundary in the stated zone', () => {
    // Both ends are local midnight, but in different offsets: EST (-05:00) then EDT (-04:00).
    expect(formatDateRange('2026-03-06T05:00:00Z', '2026-03-10T04:00:00Z', COLUMBUS)).toBe(
      'Mar 06 – Mar 10, 2026',
    );
  });
});

describe('formatLocalDateTime (QA UI-018)', () => {
  it('omits the year for the current year and shows it for any other year', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    expect(formatLocalDateTime('2026-06-10T12:00:00Z', now)).not.toMatch(/2026/);
    expect(formatLocalDateTime('2025-06-10T12:00:00Z', now)).toMatch(/^Jun \d{2}, 2025, \d{2}:\d{2}$/);
    expect(formatLocalDateTime(null, now)).toBe('—');
  });
});

// LIVE-007 — one company-context instant reads the same whatever the browser zone.
describe('formatCarrierDateTime', () => {
  const now = new Date('2026-10-14T12:00:00Z');
  it('renders the carrier zone, adding the year only for another year', () => {
    // The QA DVIR: 2026-10-13T21:15:54Z is Oct 13 15:15 in Denver (and Oct 14 02:15 in Tashkent).
    expect(formatCarrierDateTime('2026-10-13T21:15:54Z', 'America/Denver', now)).toBe('Oct 13, 15:15');
    expect(formatCarrierDateTime('2025-10-26T19:41:00Z', 'America/Denver', now)).toBe('Oct 26, 2025, 13:41');
    expect(formatCarrierDateTime(null, 'America/Denver', now)).toBe('—');
  });

  it('defaults now to the current clock', () => {
    expect(formatCarrierDateTime(new Date(), 'UTC')).not.toMatch(/\d{4},/);
  });
});

// CODE-038 — date-only fields: never a day early west of UTC, "today" never in the future.
describe('date-only helpers', () => {
  it('todayInTz is the calendar day in that zone', () => {
    const at = new Date('2026-10-14T03:00:00Z');
    expect(todayInTz('America/Denver', at)).toBe('2026-10-13');
    expect(todayInTz('Asia/Tashkent', at)).toBe('2026-10-14');
    expect(todayInTz('UTC')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('dateOnlyToInstant is midnight of that day in the zone, so today is never ahead of the clock', () => {
    expect(dateOnlyToInstant('2026-10-14', 'America/Denver')).toBe('2026-10-14T06:00:00.000Z');
    expect(dateOnlyToInstant('2026-10-14', 'Asia/Tashkent')).toBe('2026-10-13T19:00:00.000Z');
    const today = todayInTz('Asia/Tashkent');
    expect(new Date(dateOnlyToInstant(today, 'Asia/Tashkent')!).getTime()).toBeLessThanOrEqual(Date.now());
    expect(dateOnlyToInstant('', 'UTC')).toBeUndefined();
    expect(dateOnlyToInstant('14/10/2026', 'UTC')).toBeUndefined();
  });

  it('dateOnlyKey round-trips a picked day and reads a legacy UTC midnight as a UTC date', () => {
    expect(dateOnlyKey(dateOnlyToInstant('2026-10-14', 'America/Denver'), 'America/Denver')).toBe('2026-10-14');
    expect(dateOnlyKey('2026-10-14T00:00:00.000Z', 'America/Denver')).toBe('2026-10-14');
    expect(dateOnlyKey('2026-10-14T03:00:00.000Z', 'America/Denver')).toBe('2026-10-13');
    expect(dateOnlyKey(null, 'UTC')).toBe('');
  });

  it('formatDateOnly shows the picked day in any format', () => {
    expect(formatDateOnly('2026-10-14T00:00:00.000Z', 'America/Chicago')).toBe('Oct 14, 2026');
    expect(formatDateOnly('2026-10-14T05:00:00.000Z', 'America/Chicago', 'monthDay')).toBe('Oct 14');
    expect(formatDateOnly(undefined, 'UTC')).toBe('—');
  });
});
