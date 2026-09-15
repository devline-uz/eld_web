// web/bugs.md WB-049 — `hasPosition` must reject everything that can wreck the Live Fleet map's
// camera fit: missing coordinates, NaN, out-of-range values and the `(0, 0)` "null island"
// sentinel a unit with no real fix can report.
import { describe, expect, it } from 'vitest';
import { hasPosition, type LiveFleetUnit } from './liveFleet';

function unit(overrides: Partial<LiveFleetUnit>): LiveFleetUnit {
  return {
    vehicleId: 'v1',
    unitNumber: '101',
    driverId: null,
    driverName: null,
    driverPhone: null,
    dutyStatus: 'DRIVING',
    speedMph: null,
    headingDeg: null,
    odometerMi: null,
    lat: null,
    lon: null,
    locationLabel: null,
    lastSeenAt: null,
    driveRemainingSec: null,
    shiftEndsAt: null,
    eldSerial: null,
    bleState: null,
    ...overrides,
  };
}

describe('hasPosition', () => {
  it('accepts a real continental-US fix', () => {
    expect(hasPosition(unit({ lat: 39.96, lon: -83.0 }))).toBe(true);
  });

  it('rejects null lat/lon', () => {
    expect(hasPosition(unit({ lat: null, lon: null }))).toBe(false);
  });

  it('rejects the (0, 0) null-island sentinel', () => {
    expect(hasPosition(unit({ lat: 0, lon: 0 }))).toBe(false);
  });

  it('rejects NaN', () => {
    expect(hasPosition(unit({ lat: Number.NaN, lon: -83 }))).toBe(false);
  });

  it('rejects out-of-range latitude', () => {
    expect(hasPosition(unit({ lat: 190, lon: -83 }))).toBe(false);
  });

  it('rejects out-of-range longitude (e.g. swapped lat/lon)', () => {
    expect(hasPosition(unit({ lat: -83, lon: 190 }))).toBe(false);
  });
});
