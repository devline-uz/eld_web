// W-02 — `telemetry.point` → one unit's row in the cached fleet (web/tz.md §7.2, WB-258).
import { describe, expect, it } from 'vitest';
import type { LiveFleetResponse, LiveFleetUnit } from '@/shared/api/liveFleet';
import { applyUnitPatches, fleetHasUnit, telemetryUnitPatch, type TelemetryPointPayload } from './telemetryPatch';

const unit = (vehicleId: string): LiveFleetUnit => ({
  vehicleId,
  unitNumber: vehicleId,
  driverId: null,
  driverName: null,
  driverPhone: null,
  dutyStatus: 'DRIVING',
  speedMph: 10,
  headingDeg: null,
  odometerMi: null,
  lat: 40,
  lon: -83,
  locationLabel: null,
  lastSeenAt: null,
  driveRemainingSec: null,
  shiftEndsAt: null,
  eldSerial: null,
  bleState: null,
});
const FLEET: LiveFleetResponse = { items: [unit('v1'), unit('v2')], generatedAt: '2026-09-30T00:00:00Z' };
const frame = (extra: Record<string, unknown>) => ({ vehicleId: 'v1', count: 1, ...extra }) as TelemetryPointPayload;

describe('telemetryUnitPatch', () => {
  it('today\'s `{ vehicleId, count }` frame has no fix, so it cannot be mapped', () => {
    expect(telemetryUnitPatch({ vehicleId: 'v1', count: 3 })).toBeNull();
    expect(telemetryUnitPatch(frame({ latitude: 'x', longitude: -83 }))).toBeNull();
  });

  it('maps ingest-style and short field names, numeric strings included', () => {
    expect(
      telemetryUnitPatch(frame({ latitude: '41.5', longitude: -84, speedMph: 55, headingDeg: 90, time: '2026-09-30T01:00:00Z' })),
    ).toEqual({ lat: 41.5, lon: -84, speedMph: 55, headingDeg: 90, lastSeenAt: '2026-09-30T01:00:00Z' });
    expect(telemetryUnitPatch(frame({ lat: 41, lon: -84, at: '2026-09-30T01:00:00Z' }))).toEqual({
      lat: 41,
      lon: -84,
      lastSeenAt: '2026-09-30T01:00:00Z',
    });
  });
});

describe('applyUnitPatches', () => {
  it('patches only the affected unit and keeps every other row object as is', () => {
    const next = applyUnitPatches(FLEET, new Map([['v1', { lat: 41, lon: -84 }]]))!;
    expect(next.items[0]).toMatchObject({ vehicleId: 'v1', lat: 41, lon: -84, speedMph: 10 });
    expect(next.items[1]).toBe(FLEET.items[1]);
    expect(next.generatedAt).toBe(FLEET.generatedAt);
  });

  it('returns the cache untouched when there is nothing to apply', () => {
    expect(applyUnitPatches(undefined, new Map([['v1', { lat: 1 }]]))).toBeUndefined();
    expect(applyUnitPatches(FLEET, new Map())).toBe(FLEET);
    expect(applyUnitPatches(FLEET, new Map([['v9', { lat: 1 }]]))).toBe(FLEET);
  });

  it('fleetHasUnit tells whether a patch has a row to land on', () => {
    expect(fleetHasUnit(FLEET, 'v2')).toBe(true);
    expect(fleetHasUnit(FLEET, 'v9')).toBe(false);
    expect(fleetHasUnit(undefined, 'v1')).toBe(false);
  });
});
