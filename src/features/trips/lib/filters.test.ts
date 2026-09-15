// web/tz.md §11.23 Filters — pure filter-state logic for W-11 Dispatch & Trips.
import { describe, expect, it } from 'vitest';
import {
  EMPTY_TRIP_FILTERS,
  countActiveTripFilters,
  matchesTripFilters,
  parseTripFilters,
  writeTripFilters,
  type TripFilters,
} from './filters';
import type { TripTableRow } from '@/shared/api/trips';

function row(overrides: Partial<TripTableRow> = {}): TripTableRow {
  return {
    id: 'trp_1',
    number: 'TR-4821',
    driverId: 'drv_1',
    vehicleId: 'veh_1',
    trailerId: 'trl_1',
    status: 'IN_PROGRESS',
    shippingDocument: null,
    commodity: null,
    weightLbs: null,
    pieces: null,
    plannedStartAt: '2025-09-11T05:30:00.000Z',
    plannedEndAt: null,
    startedAt: '2025-09-11T05:30:00.000Z',
    completedAt: null,
    etaAt: '2025-09-11T17:40:00.000Z',
    onTime: true,
    notes: null,
    createdById: 'usr_1',
    createdAt: '2025-09-10T00:00:00.000Z',
    stops: [],
    driver: { id: 'drv_1', homeTerminalName: 'Columbus, OH' } as never,
    vehicle: { id: 'veh_1', unitNumber: '#101' } as never,
    pickup: null,
    delivery: null,
    displayStatus: 'On time',
    ...overrides,
  };
}

describe('parseTripFilters / writeTripFilters', () => {
  it('round-trips every field through URL search params (shareable per §11.23)', () => {
    const filters: TripFilters = {
      status: ['Late', 'Loading'],
      driverId: ['drv_1'],
      vehicleId: ['veh_1'],
      terminal: 'Columbus, OH',
      departFrom: '2025-09-01',
      departTo: '2025-09-10',
      noTrailerOnly: true,
    };
    const params = writeTripFilters(new URLSearchParams(), filters);
    expect(parseTripFilters(params)).toEqual(filters);
  });

  it('deletes page on any filter write and drops unset keys entirely', () => {
    const params = writeTripFilters(new URLSearchParams('page=3'), EMPTY_TRIP_FILTERS);
    expect(params.get('page')).toBeNull();
    expect([...params.keys()]).toHaveLength(0);
  });

  it('returns the empty set when no filter params are present', () => {
    expect(parseTripFilters(new URLSearchParams())).toEqual(EMPTY_TRIP_FILTERS);
  });
});

describe('countActiveTripFilters', () => {
  it('counts one per non-empty group, not per value', () => {
    expect(countActiveTripFilters(EMPTY_TRIP_FILTERS)).toBe(0);
    expect(countActiveTripFilters({ ...EMPTY_TRIP_FILTERS, status: ['Late', 'On time'] })).toBe(1);
    expect(
      countActiveTripFilters({
        ...EMPTY_TRIP_FILTERS,
        status: ['Late'],
        driverId: ['drv_1'],
        departFrom: '2025-09-01',
        noTrailerOnly: true,
      }),
    ).toBe(4);
  });

  it('counts unit and terminal groups individually', () => {
    expect(countActiveTripFilters({ ...EMPTY_TRIP_FILTERS, vehicleId: ['veh_1'] })).toBe(1);
    expect(countActiveTripFilters({ ...EMPTY_TRIP_FILTERS, terminal: 'Columbus, OH' })).toBe(1);
  });

  it('counts the depart range as a single group whether one or both ends are set', () => {
    expect(countActiveTripFilters({ ...EMPTY_TRIP_FILTERS, departFrom: '2025-09-01' })).toBe(1);
    expect(countActiveTripFilters({ ...EMPTY_TRIP_FILTERS, departFrom: '2025-09-01', departTo: '2025-09-10' })).toBe(1);
  });
});

describe('matchesTripFilters', () => {
  it('matches everything against the empty filter set', () => {
    expect(matchesTripFilters(row(), EMPTY_TRIP_FILTERS)).toBe(true);
  });

  it('filters by displayStatus, not the raw lifecycle status', () => {
    const filters = { ...EMPTY_TRIP_FILTERS, status: ['Late'] as TripFilters['status'] };
    expect(matchesTripFilters(row({ displayStatus: 'On time' }), filters)).toBe(false);
    expect(matchesTripFilters(row({ displayStatus: 'Late' }), filters)).toBe(true);
  });

  it('filters by driver, excluding unassigned trips', () => {
    const filters = { ...EMPTY_TRIP_FILTERS, driverId: ['drv_1'] };
    expect(matchesTripFilters(row({ driverId: null }), filters)).toBe(false);
    expect(matchesTripFilters(row({ driverId: 'drv_2' }), filters)).toBe(false);
    expect(matchesTripFilters(row({ driverId: 'drv_1' }), filters)).toBe(true);
  });

  it('filters by unit, excluding unassigned trips', () => {
    const filters = { ...EMPTY_TRIP_FILTERS, vehicleId: ['veh_1'] };
    expect(matchesTripFilters(row({ vehicleId: null }), filters)).toBe(false);
    expect(matchesTripFilters(row({ vehicleId: 'veh_1' }), filters)).toBe(true);
  });

  it('filters by the driver-joined home terminal', () => {
    const filters = { ...EMPTY_TRIP_FILTERS, terminal: 'Columbus, OH' };
    expect(matchesTripFilters(row({ driver: null }), filters)).toBe(false);
    expect(matchesTripFilters(row({ driver: { homeTerminalName: 'Florence, KY' } as never }), filters)).toBe(false);
    expect(matchesTripFilters(row(), filters)).toBe(true);
  });

  it('filters by depart date range, inclusive on both ends, preferring startedAt over plannedStartAt', () => {
    const filters = { ...EMPTY_TRIP_FILTERS, departFrom: '2025-09-10', departTo: '2025-09-12' };
    expect(matchesTripFilters(row({ startedAt: '2025-09-11T05:30:00.000Z' }), filters)).toBe(true);
    expect(matchesTripFilters(row({ startedAt: '2025-09-09T05:30:00.000Z' }), filters)).toBe(false);
    expect(matchesTripFilters(row({ startedAt: null, plannedStartAt: '2025-09-13T00:00:00.000Z' }), filters)).toBe(false);
    expect(matchesTripFilters(row({ startedAt: null, plannedStartAt: null }), filters)).toBe(false);
  });

  it('"no trailer only" excludes trips with a trailer assigned', () => {
    const filters = { ...EMPTY_TRIP_FILTERS, noTrailerOnly: true };
    expect(matchesTripFilters(row({ trailerId: 'trl_1' }), filters)).toBe(false);
    expect(matchesTripFilters(row({ trailerId: null }), filters)).toBe(true);
  });
});
