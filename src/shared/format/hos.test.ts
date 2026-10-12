// ⭐ §8.3 — the RODS formatter never falls back to the browser zone.
import { describe, expect, it } from 'vitest';
import {
  formatDailyTotals,
  formatHosHours,
  formatHosHoursFromHours,
  formatRods,
  formatRodsDate,
  formatRodsDateTime,
  formatRodsDayKey,
  formatRodsTime,
  formatRodsTimeSeconds,
  HOS_ZERO_NOTE,
  hosClockNotes,
  rodsDayFraction,
  rodsDayOffsetSec,
} from './hos';
import { formatInTz } from './datetime';

const COLUMBUS = 'America/New_York';
const TASHKENT = 'Asia/Tashkent';
const EVENT = '2026-09-10T18:26:58.000Z';

describe('formatRods — driver home terminal zone', () => {
  it('renders the driver day, not the viewer day', () => {
    expect(formatRodsTime(EVENT, COLUMBUS)).toBe('14:26');
    expect(formatRodsTimeSeconds(EVENT, COLUMBUS)).toBe('14:26:58');
    expect(formatRodsDate(EVENT, COLUMBUS)).toBe('Thu, Sep 10, 2026');
    expect(formatRodsDayKey(EVENT, COLUMBUS)).toBe('2026-09-10');
    expect(formatRodsDateTime(EVENT, COLUMBUS)).toBe('Sep 10, 14:26');
    expect(formatRods(EVENT, COLUMBUS, 'HH')).toBe('14');
    expect(formatRods(new Date(EVENT), COLUMBUS)).toBe('14:26');
  });

  it('splits the same instant differently for a dispatcher in another zone', () => {
    // 02:26 the next day in Tashkent — the log must still be filed under the driver's Sep 10.
    expect(formatRodsTime(EVENT, TASHKENT)).toBe('23:26');
    expect(formatRodsDayKey(EVENT, COLUMBUS)).not.toBe(
      formatInTz(EVENT, 'Pacific/Kiritimati', 'isoDate'),
    );
  });

  it('renders a missing timestamp as an em dash', () => {
    expect(formatRods(null, COLUMBUS)).toBe('—');
    expect(formatRods('nope', COLUMBUS)).toBe('—');
    expect(formatRods('', COLUMBUS)).toBe('—');
  });
});

describe('HOS hours — HH:MM, two digits, uncapped', () => {
  it('formats remaining and spent hours', () => {
    expect(formatHosHours(1140)).toBe('00:19');
    expect(formatHosHours(41160)).toBe('11:26');
    expect(formatHosHours(252000)).toBe('70:00');
    expect(formatHosHours(0)).toBe('00:00');
    expect(formatHosHours(-600)).toBe('00:00');
    expect(formatHosHours(null)).toBe('—');
    expect(formatHosHours(Number.NaN)).toBe('—');
    expect(formatHosHoursFromHours(11.5)).toBe('11:30');
    expect(formatHosHoursFromHours(null)).toBe('—');
    expect(formatDailyTotals([27000, 7200, 41160, 11040])).toBe('07:30 · 02:00 · 11:26 · 03:04');
  });
});

describe('grid coordinates are measured against the backend day length (DST-safe)', () => {
  it('keeps 24 columns on a 23- or 25-hour day', () => {
    expect(rodsDayFraction(43200, 86400)).toBeCloseTo(0.5);
    expect(rodsDayFraction(43200, 82800)).toBeCloseTo(0.5217, 3);
    expect(rodsDayFraction(90000, 86400)).toBe(1);
    expect(rodsDayFraction(-10, 86400)).toBe(0);
    expect(rodsDayFraction(100, 0)).toBe(0);
    expect(rodsDayFraction(Number.NaN)).toBe(0);
    expect(rodsDayFraction(43200)).toBeCloseTo(0.5);
  });

  it('measures the offset from the backend day start', () => {
    expect(rodsDayOffsetSec(EVENT, '2026-09-10T04:00:00.000Z')).toBe(52_018);
    expect(rodsDayOffsetSec(null, '2026-09-10T04:00:00.000Z')).toBe(0);
    expect(rodsDayOffsetSec(EVENT, null)).toBe(0);
  });
});

describe('hosClockNotes — a clock at 00:00 names its reason', () => {
  it('says "limit exceeded" only while the driver is driving on a run-out clock', () => {
    expect(hosClockNotes({ dutyStatus: 'DRIVING', cycleRemainingSec: 0 })).toEqual({
      drive: HOS_ZERO_NOTE.exceeded,
      shift: HOS_ZERO_NOTE.exceeded,
      cycle: HOS_ZERO_NOTE.exceeded,
      break: HOS_ZERO_NOTE.exceeded,
    });
  });

  it('asks for a 10-hour break when an on-duty driver who has not driven today ran out of window', () => {
    // QA: 0:00 driven, 2:46 on duty, no 10-hour break since the last shift.
    const notes = hosClockNotes({ dutyStatus: 'ON_DUTY', cycleRemainingSec: 40 * 3600 });
    expect(notes.drive).toBe('10-hour break required');
    expect(notes.shift).toBe('10-hour break required');
    expect(notes.break).toBe('30-minute break required');
  });

  it('names the cycle when it is what stops driving — a 10-hour break would not help', () => {
    const notes = hosClockNotes({ dutyStatus: 'OFF_DUTY', cycleRemainingSec: 0 });
    // UI-002 — on duty / off duty with the cycle used up is "cycle exhausted", not a violation.
    expect(notes.drive).toBe('cycle exhausted');
    expect(notes.cycle).toBe('cycle exhausted');
  });
});
