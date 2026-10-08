import { describe, expect, it } from 'vitest';
import { scheduleConflictField, scheduleConflictMessage } from './copy';
import type { TripScheduleConflict } from '@/shared/api/trips';

const base: TripScheduleConflict = {
  resource: 'vehicle', tripId: 't', number: 'TRP-1', unitNumber: '101', driverName: null, trailerNumber: null,
  start: '2031-01-05T14:00:00.000Z', end: null,
};

describe('scheduleConflictMessage', () => {
  it('names the unit, driver or trailer and routes to the matching field', () => {
    expect(scheduleConflictMessage(base)).toMatch(/^Unit 101 is already assigned to another trip \(TRP-1\)/);
    expect(scheduleConflictMessage({ ...base, resource: 'driver', driverName: 'Ana Silva' })).toMatch(/^Driver Ana Silva is already/);
    expect(scheduleConflictMessage({ ...base, resource: 'trailer', trailerNumber: 'T-7' })).toMatch(/^Trailer T-7 is already/);
    expect(scheduleConflictField({ ...base, resource: 'driver' })).toBe('driverId');
    expect(scheduleConflictField({ ...base, resource: 'trailer' })).toBe('trailerId');
    expect(scheduleConflictField(base)).toBe('vehicleId');
  });
});
