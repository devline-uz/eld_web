// web/tz.md §11.23 Filters — pure filter-state logic for W-09 DVIR & Maintenance.
import { describe, expect, it } from 'vitest';
import {
  EMPTY_DVIR_FILTERS,
  countActiveDvirFilters,
  matchesDvirFilters,
  parseDvirFilters,
  writeDvirFilters,
  type DvirFilters,
} from './filters';
import type { DvirTableRow } from '@/shared/api/dvir';

function row(overrides: Partial<DvirTableRow> = {}): DvirTableRow {
  return {
    id: 'dvir_1',
    driverId: 'drv_1',
    vehicleId: 'veh_1',
    trailerId: null,
    type: 'PRE_TRIP',
    submittedAt: '2025-09-11T05:30:00.000Z',
    odometerMi: 100000,
    latitude: null,
    longitude: null,
    locationName: null,
    vehicleCondition: 'DEFECTS_FOUND',
    driverSignatureUrl: 'https://example.com/sig.png',
    notes: null,
    mechanicName: null,
    mechanicSignedAt: null,
    mechanicNote: null,
    repairStatus: 'PENDING',
    nextDriverReviewedAt: null,
    createdAt: '2025-09-11T05:30:00.000Z',
    driver: null,
    vehicle: null,
    defects: [],
    ...overrides,
  };
}

function defect(overrides: Partial<DvirTableRow['defects'][number]> = {}): DvirTableRow['defects'][number] {
  return {
    id: 'def_1',
    dvirId: 'dvir_1',
    vehicleId: 'veh_1',
    category: 'Brakes',
    part: 'TRUCK',
    severity: 'MAJOR',
    description: 'Worn brake pad',
    status: 'OPEN',
    outOfService: false,
    workOrderId: null,
    resolvedAt: null,
    resolvedById: null,
    resolutionNote: null,
    createdAt: '2025-09-11T05:30:00.000Z',
    ...overrides,
  };
}

describe('parseDvirFilters / writeDvirFilters', () => {
  it('round-trips every field through URL search params (shareable per §11.23)', () => {
    const filters: DvirFilters = {
      type: ['PRE_TRIP', 'POST_TRIP'],
      severity: ['CRITICAL'],
      repairStatus: ['PENDING', 'DEFERRED'],
    };
    const params = writeDvirFilters(new URLSearchParams(), filters);
    expect(parseDvirFilters(params)).toEqual(filters);
  });

  it('deletes page on any filter write and drops unset keys entirely', () => {
    const params = writeDvirFilters(new URLSearchParams('page=3'), EMPTY_DVIR_FILTERS);
    expect(params.get('page')).toBeNull();
    expect([...params.keys()]).toHaveLength(0);
  });

  it('returns the empty set when no filter params are present', () => {
    expect(parseDvirFilters(new URLSearchParams())).toEqual(EMPTY_DVIR_FILTERS);
  });
});

describe('countActiveDvirFilters', () => {
  it('counts one per non-empty group, not per value', () => {
    expect(countActiveDvirFilters(EMPTY_DVIR_FILTERS)).toBe(0);
    expect(countActiveDvirFilters({ ...EMPTY_DVIR_FILTERS, type: ['PRE_TRIP', 'POST_TRIP'] })).toBe(1);
    expect(
      countActiveDvirFilters({
        type: ['PRE_TRIP'],
        severity: ['CRITICAL'],
        repairStatus: ['PENDING'],
      }),
    ).toBe(3);
  });
});

describe('matchesDvirFilters', () => {
  it('matches everything against the empty filter set', () => {
    expect(matchesDvirFilters(row(), EMPTY_DVIR_FILTERS)).toBe(true);
  });

  it('filters by DVIR type', () => {
    const filters = { ...EMPTY_DVIR_FILTERS, type: ['POST_TRIP'] as DvirFilters['type'] };
    expect(matchesDvirFilters(row({ type: 'PRE_TRIP' }), filters)).toBe(false);
    expect(matchesDvirFilters(row({ type: 'POST_TRIP' }), filters)).toBe(true);
  });

  it('filters by the severity of any defect the DVIR raised', () => {
    const filters = { ...EMPTY_DVIR_FILTERS, severity: ['CRITICAL'] as DvirFilters['severity'] };
    expect(matchesDvirFilters(row({ defects: [defect({ severity: 'MINOR' })] }), filters)).toBe(false);
    expect(matchesDvirFilters(row({ defects: [] }), filters)).toBe(false);
    expect(
      matchesDvirFilters(row({ defects: [defect({ severity: 'MINOR' }), defect({ id: 'def_2', severity: 'CRITICAL' })] }), filters),
    ).toBe(true);
  });

  it('filters by repair status', () => {
    const filters = { ...EMPTY_DVIR_FILTERS, repairStatus: ['REPAIRED'] as DvirFilters['repairStatus'] };
    expect(matchesDvirFilters(row({ repairStatus: 'PENDING' }), filters)).toBe(false);
    expect(matchesDvirFilters(row({ repairStatus: 'REPAIRED' }), filters)).toBe(true);
  });

  it('combines all three groups with AND', () => {
    const filters: DvirFilters = { type: ['PRE_TRIP'], severity: ['CRITICAL'], repairStatus: ['REPAIRED'] };
    expect(
      matchesDvirFilters(row({ type: 'PRE_TRIP', repairStatus: 'REPAIRED', defects: [defect({ severity: 'CRITICAL' })] }), filters),
    ).toBe(true);
    expect(
      matchesDvirFilters(row({ type: 'POST_TRIP', repairStatus: 'REPAIRED', defects: [defect({ severity: 'CRITICAL' })] }), filters),
    ).toBe(false);
  });
});
