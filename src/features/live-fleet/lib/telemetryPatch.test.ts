// W-02 — `telemetry.point` → one unit's row in the cached fleet (web/tz.md §7.2, WB-258).
import { describe, expect, it } from 'vitest';
import type { LiveFleetResponse, LiveFleetUnit } from '@/shared/api/liveFleet';
import { appliedFrameAt, applyUnitPatches, fleetHasUnit, isStaleFrame, telemetryUnitPatch, type TelemetryPointPayload } from './telemetryPatch';

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
  recordStatus: 'ACTIVE',
  connectivity: 'ONLINE',
  isStale: false,
  staleSince: null,
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

describe('isStaleFrame (CODE-023)', () => {
  const t = (iso: string) => `2026-10-14T${iso}:00.000Z`;

  it('drops a frame older than the newest one already applied for the unit', () => {
    expect(isStaleFrame(t('09:00'), t('12:00'), Date.parse(t('12:00')))).toBe(true);
    expect(isStaleFrame(t('12:01'), t('12:00'), Date.parse(t('12:00')))).toBe(false);
  });

  it('before any frame, compares with lastSeenAt minus a heartbeat slack', () => {
    expect(isStaleFrame(t('09:00'), t('12:00'), undefined)).toBe(true);
    // a fix a minute older than the latest heartbeat is still the newest position
    expect(isStaleFrame(t('11:59'), t('12:00'), undefined)).toBe(false);
  });

  it('applies untimed frames as before', () => {
    expect(isStaleFrame(undefined, t('12:00'), Date.parse(t('12:00')))).toBe(false);
  });
});

describe('appliedFrameAt (FE-06)', () => {
  const now = Date.parse('2026-10-15T12:00:00.000Z');

  it('keeps a frame time at or before the server now', () => {
    expect(appliedFrameAt('2026-10-15T11:59:30.000Z', now)).toBe(now - 30_000);
  });

  it('clamps a future-dated frame so the next correctly-timed frame is not dropped as stale', () => {
    const future = '2026-10-15T12:10:00.000Z';
    const applied = appliedFrameAt(future, now);
    expect(applied).toBe(now);
    expect(isStaleFrame('2026-10-15T12:00:05.000Z', null, applied)).toBe(false);
    // Unclamped, the same frame would have been thrown away.
    expect(isStaleFrame('2026-10-15T12:00:05.000Z', null, Date.parse(future))).toBe(true);
  });
});
