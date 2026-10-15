import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { qk } from '@/shared/api/queryKeys';
import type { VehicleRow } from '@/shared/api/vehicles';
import { PRECHECK_MAX_AGE_MS, findCachedVehicleConflicts, findVehicleConflicts, normalizeVehicleUniques } from './vehicleConflicts';

const base = (over: Partial<VehicleRow>): VehicleRow =>
  ({ id: 'x', unitNumber: '#1', vin: '1FUJGLDR8LLLL0000', licensePlate: null, plateState: null, deletedAt: null, ...over }) as VehicleRow;

const A = base({ id: 'a', unitNumber: '#101', vin: '1FUJGLDR8LLLL1111', licensePlate: 'ABC123', plateState: 'OH' });
const B = base({ id: 'b', unitNumber: '#102', vin: '1FUJGLDR8LLLL2222', licensePlate: 'XYZ789', plateState: 'TX' });
const rows = {
  vehicles: [A, B],
  devices: [
    { serial: 'PT30_A', vehicleId: 'a' },
    { serial: 'PT30_B', vehicleId: 'b' },
    { serial: 'PT30_FREE', vehicleId: null },
  ],
};
const draft = { unitNumber: '200', vin: '1FUJGLDR8LLLL9999' };
const run = (v: { licensePlate?: string; licenseState?: string; deviceId?: string }, current?: VehicleRow) => {
  const n = normalizeVehicleUniques(v);
  return findVehicleConflicts(rows, { ...draft, licensePlate: n.licensePlate, licenseState: n.plateState, deviceId: n.deviceId }, current);
};

describe('vehicle uniqueness rules', () => {
  it('(a) a new serial is allowed, an unpaired device too, empty never conflicts', () => {
    expect(run({ deviceId: 'PT30_NEW' })).toEqual([]);
    expect(run({ deviceId: 'PT30_FREE' })).toEqual([]);
    expect(run({ deviceId: '  ' })).toEqual([]);
  });
  it('(b) a serial paired to another unit is rejected', () => {
    expect(run({ deviceId: 'PT30_A' })).toEqual(['eldSerial']);
  });
  it('(c) same plate, different state is allowed', () => {
    expect(run({ licensePlate: 'ABC123', licenseState: 'TX' })).toEqual([]);
    expect(run({ licensePlate: '', licenseState: 'OH' })).toEqual([]);
  });
  it('(d) same plate and state is rejected', () => {
    expect(run({ licensePlate: 'ABC123', licenseState: 'OH' })).toEqual(['licensePlate']);
  });
  it('(e) editing without changing unique values is allowed', () => {
    expect(run({ deviceId: 'PT30_A', licensePlate: 'ABC123', licenseState: 'OH' }, A)).toEqual([]);
  });
  it('(f) edit taking another unit serial is rejected', () => {
    expect(run({ deviceId: 'PT30_B' }, A)).toEqual(['eldSerial']);
  });
  it('(g) edit taking another unit plate + state is rejected', () => {
    expect(run({ licensePlate: 'XYZ789', licenseState: 'TX' }, A)).toEqual(['licensePlate']);
  });
  it('(h) casing and whitespace variants are the same value', () => {
    expect(run({ deviceId: '  pt30_a ' })).toEqual(['eldSerial']);
    expect(run({ licensePlate: ' abc123 ', licenseState: ' oh' })).toEqual(['licensePlate']);
    expect(normalizeVehicleUniques({ licensePlate: ' abc123 ', licenseState: 'oh', deviceId: ' pt30_x ' })).toEqual({
      licensePlate: 'ABC123',
      plateState: 'OH',
      deviceId: 'PT30_X',
    });
  });
  it('CODE-044 plates compare without spaces or dashes', () => {
    expect(run({ licensePlate: 'abc-123', licenseState: 'OH' })).toEqual(['licensePlate']);
    expect(run({ licensePlate: 'ABC 123', licenseState: 'OH' })).toEqual(['licensePlate']);
    expect(normalizeVehicleUniques({ licensePlate: 'pqr-4821', licenseState: 'OH' }).licensePlate).toBe('PQR4821');
  });
  it('a soft-deleted unit does not hold its plate', () => {
    expect(
      findVehicleConflicts({ vehicles: [{ ...A, deletedAt: '2026-01-01' }] }, { ...draft, licensePlate: 'ABC123', licenseState: 'OH' }),
    ).toEqual([]);
  });
});

// FE-09/10 — the cached pre-check must not block on stale data; the server's 409 decides then.
describe('findCachedVehicleConflicts — stale cache never blocks', () => {
  const page = (items: unknown[]) => ({ items, page: 1, limit: 200, total: items.length, totalPages: 1 });
  const values = (over: { licensePlate?: string; licenseState?: string; deviceId?: string }) => ({ ...draft, ...over });

  it('FE-09: an invalidated /devices lookup (just unpaired) does not block the freed serial', () => {
    const qc = new QueryClient();
    qc.setQueryData(qk.devices({ limit: 200 }), page([{ serial: 'PT30_A', vehicleId: 'a' }]));
    expect(findCachedVehicleConflicts(qc, values({ deviceId: 'PT30_A' }))).toEqual(['eldSerial']);
    void qc.invalidateQueries({ queryKey: ['devices'], refetchType: 'none' });
    expect(findCachedVehicleConflicts(qc, values({ deviceId: 'PT30_A' }))).toEqual([]);
  });

  it('FE-09: a device lookup older than the list policy does not block', () => {
    const qc = new QueryClient();
    qc.setQueryData(qk.devices({ limit: 200 }), page([{ serial: 'PT30_A', vehicleId: 'a' }]));
    const later = Date.now() + PRECHECK_MAX_AGE_MS + 1;
    expect(findCachedVehicleConflicts(qc, values({ deviceId: 'PT30_A' }), undefined, later)).toEqual([]);
  });

  it('FE-09: a device held by a soft-deleted unit is free', () => {
    const qc = new QueryClient();
    qc.setQueryData(qk.vehicles({ limit: 200 }), page([{ ...A, deletedAt: '2026-10-01T00:00:00.000Z' }]));
    qc.setQueryData(qk.devices({ limit: 200 }), page([{ serial: 'PT30_A', vehicleId: 'a' }]));
    expect(findCachedVehicleConflicts(qc, values({ deviceId: 'PT30_A' }))).toEqual([]);
  });

  it('FE-10: an older search page row does not overwrite the newer copy of the same unit', () => {
    const qc = new QueryClient();
    const t0 = Date.now();
    qc.setQueryData(qk.vehicles({ limit: 200 }), page([{ ...A, licensePlate: 'XYZ999' }]), { updatedAt: t0 });
    qc.setQueryData(qk.vehicles({ q: '101', limit: 25 }), page([A]), { updatedAt: t0 - 5_000 });
    expect(findCachedVehicleConflicts(qc, values({ licensePlate: 'ABC123', licenseState: 'OH' }), undefined, t0)).toEqual([]);
    expect(findCachedVehicleConflicts(qc, values({ licensePlate: 'XYZ999', licenseState: 'OH' }), undefined, t0)).toEqual(['licensePlate']);
  });

  it('FE-10: a stale search page alone does not block', () => {
    const qc = new QueryClient();
    const t0 = Date.now();
    qc.setQueryData(qk.vehicles({ q: '101', limit: 25 }), page([A]), { updatedAt: t0 - PRECHECK_MAX_AGE_MS - 1 });
    expect(findCachedVehicleConflicts(qc, values({ licensePlate: 'ABC123', licenseState: 'OH' }), undefined, t0)).toEqual([]);
  });
});
