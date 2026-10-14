// QA LIVE-002 / CODE-020 — one "on duty" definition for the dashboard KPI and the duty donut.
import { describe, expect, it } from 'vitest';
import type { LiveFleetUnit } from '@/shared/api/liveFleet';
import { driverDutyOf, summarizeDriverDuty } from './driverDuty';

type U = Pick<LiveFleetUnit, 'driverId' | 'dutyStatus' | 'driverDutyStatus'>;
const u = (over: Partial<U>): U => ({ driverId: 'd1', dutyStatus: 'OFF_DUTY', ...over });

describe('driverDutyOf', () => {
  it("reads the driver's HOS status, not the unit's live marker", () => {
    expect(driverDutyOf(u({ dutyStatus: 'ELD_OFFLINE', driverDutyStatus: 'DRIVING' }))).toBe('DRIVING');
    expect(driverDutyOf(u({ dutyStatus: 'INACTIVE', driverDutyStatus: 'ON_DUTY' }))).toBe('ON_DUTY');
  });

  it('is null for a unit without a driver and UNKNOWN when the HOS status is unavailable', () => {
    expect(driverDutyOf(u({ driverId: null, driverDutyStatus: 'DRIVING' }))).toBeNull();
    expect(driverDutyOf(u({ driverDutyStatus: null }))).toBe('UNKNOWN');
  });

  it('falls back to the live marker when the API omits driverDutyStatus (IDLE / YM on duty, PC off)', () => {
    expect(driverDutyOf(u({ dutyStatus: 'IDLE' }))).toBe('ON_DUTY');
    expect(driverDutyOf(u({ dutyStatus: 'YARD_MOVE' }))).toBe('ON_DUTY');
    expect(driverDutyOf(u({ dutyStatus: 'PERSONAL_CONVEYANCE' }))).toBe('OFF_DUTY');
    expect(driverDutyOf(u({ dutyStatus: 'ELD_OFFLINE' }))).toBe('UNKNOWN');
  });
});

describe('summarizeDriverDuty', () => {
  it('slices always sum to the assigned drivers; on duty = every status but Off-duty (Drivers list)', () => {
    const summary = summarizeDriverDuty([
      u({ driverDutyStatus: 'DRIVING' }),
      u({ driverDutyStatus: 'ON_DUTY' }),
      u({ driverDutyStatus: 'SLEEPER' }),
      u({ driverDutyStatus: 'OFF_DUTY' }),
      u({ driverDutyStatus: null }),
      u({ driverId: null, driverDutyStatus: null }),
    ]);
    expect(summary.assigned).toBe(5);
    expect(summary.onDuty).toBe(3);
    expect(Object.values(summary.counts).reduce((a, b) => a + b, 0)).toBe(summary.assigned);
    expect(summary.counts).toEqual({ DRIVING: 1, ON_DUTY: 1, SLEEPER: 1, OFF_DUTY: 1, UNKNOWN: 1 });
  });
});
