// web/tz.md §11.23 Filters — pure filter-state logic for W-03 Vehicles.
import { describe, expect, it } from 'vitest';
import {
  EMPTY_VEHICLE_FILTERS,
  countActiveVehicleFilters,
  effectiveVehicleStatus,
  matchesVehicleFilters,
  parseVehicleFilters,
  writeVehicleFilters,
  type VehicleFilters,
} from './filters';
import type { VehicleTableRow } from '@/shared/api/vehicles';

function row(overrides: Partial<VehicleTableRow> = {}): VehicleTableRow {
  return {
    id: 'veh_1',
    unitNumber: '#101',
    vin: '1FUJGLDR8LLLL1234',
    make: 'Freightliner',
    model: 'Cascadia',
    year: 2021,
    licensePlate: null,
    plateState: null,
    fuelType: 'DIESEL',
    sleeperBerth: true,
    odometerMi: 993589,
    deviceOdometerMi: 981109,
    odometerOffsetMi: 12480,
    odometerCalibratedAt: null,
    engineHours: '1070.2',
    busType: null,
    status: 'ACTIVE',
    notes: null,
    activatedAt: null,
    createdAt: '2025-04-18T00:00:00.000Z',
    driver: null,
    eldSerial: 'PT30_A86E',
    eldDeviceStatus: 'ASSIGNED',
    eldDeviceModel: 'PT30',
    firmwareOutdated: false,
    ...overrides,
  };
}

describe('parseVehicleFilters / writeVehicleFilters', () => {
  it('round-trips every field through URL search params (shareable per §11.23)', () => {
    const filters: VehicleFilters = {
      status: ['DRIVING', 'IDLE'],
      eldDevice: ['PT30', 'UNASSIGNED'],
      make: ['Freightliner'],
      yearFrom: 2018,
      yearTo: 2025,
      terminal: 'Columbus, OH',
      openDefectsOnly: true,
      firmwareOutdatedOnly: true,
    };
    const params = writeVehicleFilters(new URLSearchParams(), filters);
    expect(parseVehicleFilters(params)).toEqual(filters);
  });

  it('deletes page on any filter write and drops unset keys entirely', () => {
    const params = writeVehicleFilters(new URLSearchParams('page=3'), EMPTY_VEHICLE_FILTERS);
    expect(params.get('page')).toBeNull();
    expect([...params.keys()]).toHaveLength(0);
  });

  it('returns the empty set when no filter params are present', () => {
    expect(parseVehicleFilters(new URLSearchParams())).toEqual(EMPTY_VEHICLE_FILTERS);
  });
});

describe('countActiveVehicleFilters', () => {
  it('counts one per non-empty group, not per value', () => {
    expect(countActiveVehicleFilters(EMPTY_VEHICLE_FILTERS)).toBe(0);
    expect(countActiveVehicleFilters({ ...EMPTY_VEHICLE_FILTERS, status: ['DRIVING', 'IDLE'] })).toBe(1);
    expect(
      countActiveVehicleFilters({
        ...EMPTY_VEHICLE_FILTERS,
        status: ['DRIVING'],
        make: ['Volvo'],
        yearFrom: 2018,
        openDefectsOnly: true,
      }),
    ).toBe(4);
  });
});

describe('effectiveVehicleStatus', () => {
  it('is INACTIVE for an inactive unit regardless of live duty', () => {
    expect(effectiveVehicleStatus(row({ status: 'INACTIVE' }), 'DRIVING')).toBe('INACTIVE');
  });
  it('follows live duty for the four moving states', () => {
    expect(effectiveVehicleStatus(row(), 'DRIVING')).toBe('DRIVING');
    expect(effectiveVehicleStatus(row(), 'IDLE')).toBe('IDLE');
    expect(effectiveVehicleStatus(row(), 'OFF_DUTY')).toBe('OFF_DUTY');
    expect(effectiveVehicleStatus(row(), 'ELD_OFFLINE')).toBe('ELD_OFFLINE');
  });
  it('is null with no live duty and no other 11.23 status match (e.g. OUT_OF_SERVICE, plain ACTIVE)', () => {
    expect(effectiveVehicleStatus(row(), undefined)).toBeNull();
    expect(effectiveVehicleStatus(row({ status: 'OUT_OF_SERVICE' }), undefined)).toBeNull();
  });
});

describe('matchesVehicleFilters', () => {
  it('matches everything against the empty filter set', () => {
    expect(matchesVehicleFilters(row(), 'DRIVING', EMPTY_VEHICLE_FILTERS)).toBe(true);
  });

  it('filters by status', () => {
    const filters = { ...EMPTY_VEHICLE_FILTERS, status: ['IDLE'] as VehicleFilters['status'] };
    expect(matchesVehicleFilters(row(), 'DRIVING', filters)).toBe(false);
    expect(matchesVehicleFilters(row(), 'IDLE', filters)).toBe(true);
  });

  it('filters by ELD device, including the "Not assigned" bucket', () => {
    const byModel = { ...EMPTY_VEHICLE_FILTERS, eldDevice: ['PT30'] };
    expect(matchesVehicleFilters(row(), undefined, byModel)).toBe(true);
    expect(matchesVehicleFilters(row({ eldSerial: null, eldDeviceModel: null }), undefined, byModel)).toBe(false);

    const unassigned = { ...EMPTY_VEHICLE_FILTERS, eldDevice: ['UNASSIGNED'] };
    expect(matchesVehicleFilters(row({ eldSerial: null, eldDeviceModel: null }), undefined, unassigned)).toBe(true);
    expect(matchesVehicleFilters(row(), undefined, unassigned)).toBe(false);
  });

  it('filters by make', () => {
    const filters = { ...EMPTY_VEHICLE_FILTERS, make: ['Volvo'] };
    expect(matchesVehicleFilters(row({ make: 'Freightliner' }), undefined, filters)).toBe(false);
    expect(matchesVehicleFilters(row({ make: 'Volvo' }), undefined, filters)).toBe(true);
  });

  it('filters by year range, inclusive on both ends', () => {
    const filters = { ...EMPTY_VEHICLE_FILTERS, yearFrom: 2018, yearTo: 2021 };
    expect(matchesVehicleFilters(row({ year: 2021 }), undefined, filters)).toBe(true);
    expect(matchesVehicleFilters(row({ year: 2022 }), undefined, filters)).toBe(false);
    expect(matchesVehicleFilters(row({ year: 2017 }), undefined, filters)).toBe(false);
  });

  it('filters by the driver-joined home terminal', () => {
    const filters = { ...EMPTY_VEHICLE_FILTERS, terminal: 'Columbus, OH' };
    expect(matchesVehicleFilters(row({ driver: null }), undefined, filters)).toBe(false);
    expect(
      matchesVehicleFilters(
        row({ driver: { homeTerminalName: 'Columbus, OH' } as never }),
        undefined,
        filters,
      ),
    ).toBe(true);
  });

  it('"open defects only" uses OUT_OF_SERVICE as the real critical-defect signal', () => {
    const filters = { ...EMPTY_VEHICLE_FILTERS, openDefectsOnly: true };
    expect(matchesVehicleFilters(row({ status: 'ACTIVE' }), undefined, filters)).toBe(false);
    expect(matchesVehicleFilters(row({ status: 'OUT_OF_SERVICE' }), undefined, filters)).toBe(true);
  });

  it('"firmware outdated only" reads the joined device flag', () => {
    const filters = { ...EMPTY_VEHICLE_FILTERS, firmwareOutdatedOnly: true };
    expect(matchesVehicleFilters(row({ firmwareOutdated: false }), undefined, filters)).toBe(false);
    expect(matchesVehicleFilters(row({ firmwareOutdated: true }), undefined, filters)).toBe(true);
  });
});
