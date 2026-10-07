import { describe, expect, it } from 'vitest';
import type { VehicleRow } from '@/shared/api/vehicles';
import { findVehicleConflicts, normalizeVehicleUniques } from './vehicleConflicts';

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
  it('a soft-deleted unit does not hold its plate', () => {
    expect(
      findVehicleConflicts({ vehicles: [{ ...A, deletedAt: '2026-01-01' }] }, { ...draft, licensePlate: 'ABC123', licenseState: 'OH' }),
    ).toEqual([]);
  });
});
