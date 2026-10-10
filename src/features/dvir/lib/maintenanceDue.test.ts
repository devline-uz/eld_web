import { describe, expect, it } from 'vitest';
import { computeDue, DUE_SOON_DAYS, DUE_SOON_MILES, overdueReasons } from './maintenanceDue';

const NOW = new Date('2026-10-10T12:00:00.000Z');
const base = { intervalMi: null, intervalDays: null, lastServiceMi: null, lastServiceAt: null, currentOdometerMi: 0, now: NOW };

describe('computeDue — mirrors eld_backend maintenance-due.ts', () => {
  it('uses the backend thresholds', () => {
    expect(DUE_SOON_MILES).toBe(500);
    expect(DUE_SOON_DAYS).toBe(7);
  });

  it('W-09 example: mileage trips first even though the date is a month away', () => {
    const due = computeDue({
      ...base,
      intervalMi: 10_000,
      intervalDays: 30,
      lastServiceMi: 2_000,
      lastServiceAt: new Date('2026-10-09T00:00:00.000Z'),
      currentOdometerMi: 15_000,
    });
    expect(due.nextDueMi).toBe(12_000);
    expect(due.nextDueAt?.toISOString()).toBe('2026-11-08T00:00:00.000Z');
    expect(due.milesRemaining).toBe(-3_000);
    expect(due.daysRemaining).toBe(29);
    expect(due.state).toBe('OVERDUE');
    expect(overdueReasons(due)).toEqual({ miles: true, days: false });
  });

  it('date trips first for a truck that sits', () => {
    const due = computeDue({ ...base, intervalMi: 10_000, intervalDays: 30, lastServiceMi: 0, lastServiceAt: new Date('2026-09-01T00:00:00.000Z'), currentOdometerMi: 100 });
    expect(due.state).toBe('OVERDUE');
    expect(overdueReasons(due)).toEqual({ miles: false, days: true });
  });

  it('exactly at the due point is OVERDUE (<= 0)', () => {
    expect(computeDue({ ...base, intervalMi: 1000, lastServiceMi: 0, currentOdometerMi: 1000 }).state).toBe('OVERDUE');
  });

  it('DUE_SOON within 500 mi or 7 days, OK beyond', () => {
    expect(computeDue({ ...base, intervalMi: 1000, lastServiceMi: 0, currentOdometerMi: 500 }).state).toBe('DUE_SOON');
    expect(computeDue({ ...base, intervalMi: 1000, lastServiceMi: 0, currentOdometerMi: 499 }).state).toBe('OK');
    const at = new Date('2026-10-10T12:00:00.000Z');
    expect(computeDue({ ...base, intervalDays: 7, lastServiceAt: at }).state).toBe('DUE_SOON');
    expect(computeDue({ ...base, intervalDays: 8, lastServiceAt: at }).state).toBe('OK');
  });

  it('missing last service falls back to 0 mi / epoch, like the backend', () => {
    const due = computeDue({ ...base, intervalMi: 5000, intervalDays: 30, currentOdometerMi: 4000 });
    expect(due.nextDueMi).toBe(5000);
    expect(due.nextDueAt?.toISOString()).toBe('1970-01-31T00:00:00.000Z');
    expect(due.state).toBe('OVERDUE');
  });

  it('no interval → OK with all nulls', () => {
    expect(computeDue(base)).toEqual({ state: 'OK', nextDueMi: null, nextDueAt: null, milesRemaining: null, daysRemaining: null });
  });
});
