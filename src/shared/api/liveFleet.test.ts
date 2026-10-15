// web/bugs.md WB-049 — `hasPosition` must reject everything that can wreck the Live Fleet map's
// camera fit: missing coordinates, NaN, out-of-range values and the `(0, 0)` "null island"
// sentinel a unit with no real fix can report.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasPosition, mapMarkerStatus, noteServerClock, serverNowMs, type LiveFleetUnit } from './liveFleet';

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
    recordStatus: 'ACTIVE',
    connectivity: 'ONLINE',
    isStale: false,
    staleSince: null,
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

// FE-05 — grey marker ⇔ ACTIVE unit with `connectivity: ELD_OFFLINE` (the dashboard KPI's definition).
describe('mapMarkerStatus', () => {
  const base = { recordStatus: 'ACTIVE', connectivity: 'ONLINE', driverDutyStatus: null } as const;
  it('greys an OFF/SB unit whose ELD is silent, like the KPI counts it', () => {
    expect(mapMarkerStatus({ ...base, dutyStatus: 'OFF_DUTY', connectivity: 'ELD_OFFLINE' })).toBe('ELD_OFFLINE');
  });
  it('keeps the last known duty colour for a stale status on an ONLINE ELD', () => {
    expect(mapMarkerStatus({ ...base, dutyStatus: 'ELD_OFFLINE', driverDutyStatus: 'ON_DUTY' })).toBe('ON_DUTY');
    expect(mapMarkerStatus({ ...base, dutyStatus: 'ELD_OFFLINE' })).toBe('INACTIVE');
  });
  it('does not grey an inactive unit (the KPI only counts ACTIVE units)', () => {
    expect(mapMarkerStatus({ ...base, recordStatus: 'INACTIVE', dutyStatus: 'INACTIVE', connectivity: 'ELD_OFFLINE' })).toBe('INACTIVE');
  });
  it('passes a live status through', () => {
    expect(mapMarkerStatus({ ...base, dutyStatus: 'DRIVING' })).toBe('DRIVING');
  });
});

describe('serverNowMs (FE-06)', () => {
  afterEach(() => {
    noteServerClock(new Date().toISOString());
    vi.useRealTimers();
  });

  it('ages fixes on the server clock: a browser 2 min fast reads the server time, not its own', () => {
    vi.useFakeTimers();
    const server = Date.UTC(2026, 9, 15, 12, 0, 0);
    vi.setSystemTime(server + 120_000);
    noteServerClock(new Date(server).toISOString());
    expect(serverNowMs()).toBe(server);
    vi.advanceTimersByTime(5_000);
    expect(serverNowMs()).toBe(server + 5_000);
  });

  it('ignores an unparsable timestamp', () => {
    noteServerClock(new Date(Date.now() - 60_000).toISOString(), Date.now());
    const before = serverNowMs() - Date.now();
    noteServerClock('not a date');
    noteServerClock(undefined);
    expect(Math.abs(serverNowMs() - Date.now() - before)).toBeLessThan(50);
  });
});
