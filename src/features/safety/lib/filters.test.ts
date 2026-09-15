// web/tz.md §11.23 Filters — pure filter-state logic for W-10 Safety.
import { describe, expect, it } from 'vitest';
import {
  EMPTY_SAFETY_FILTERS,
  countActiveSafetyFilters,
  matchesSafetyFilters,
  parseSafetyFilters,
  severityBucket,
  writeSafetyFilters,
  type SafetyFilters,
} from './filters';
import type { SafetyEventTableRow } from '@/shared/api/safety';

function row(overrides: Partial<SafetyEventTableRow> = {}): SafetyEventTableRow {
  return {
    id: 'sfe_1',
    driverId: 'drv_1',
    vehicleId: 'veh_1',
    type: 'HARSH_BRAKING',
    occurredAt: '2025-09-11T05:30:00.000Z',
    severity: 3,
    speedMph: null,
    speedLimitMph: null,
    gForce: '-0.42',
    latitude: null,
    longitude: null,
    locationName: null,
    durationSec: null,
    status: 'NEW',
    coachedById: null,
    coachedAt: null,
    coachingNote: null,
    driver: null,
    vehicle: null,
    ...overrides,
  };
}

describe('severityBucket', () => {
  it('buckets 4-5 as CRITICAL, 3 as MAJOR, 1-2 as MINOR', () => {
    expect(severityBucket(5)).toBe('CRITICAL');
    expect(severityBucket(4)).toBe('CRITICAL');
    expect(severityBucket(3)).toBe('MAJOR');
    expect(severityBucket(2)).toBe('MINOR');
    expect(severityBucket(1)).toBe('MINOR');
  });
});

describe('parseSafetyFilters / writeSafetyFilters', () => {
  it('round-trips every field through URL search params (shareable per §11.23)', () => {
    const filters: SafetyFilters = {
      type: ['HARSH_BRAKING', 'SPEEDING'],
      severity: ['CRITICAL'],
      coachingStatus: ['NEW', 'REVIEWED'],
    };
    const params = writeSafetyFilters(new URLSearchParams(), filters);
    expect(parseSafetyFilters(params)).toEqual(filters);
  });

  it('deletes page on any filter write and drops unset keys entirely', () => {
    const params = writeSafetyFilters(new URLSearchParams('page=3'), EMPTY_SAFETY_FILTERS);
    expect(params.get('page')).toBeNull();
    expect([...params.keys()]).toHaveLength(0);
  });

  it('returns the empty set when no filter params are present', () => {
    expect(parseSafetyFilters(new URLSearchParams())).toEqual(EMPTY_SAFETY_FILTERS);
  });
});

describe('countActiveSafetyFilters', () => {
  it('counts one per non-empty group, not per value', () => {
    expect(countActiveSafetyFilters(EMPTY_SAFETY_FILTERS)).toBe(0);
    expect(countActiveSafetyFilters({ ...EMPTY_SAFETY_FILTERS, type: ['HARSH_BRAKING', 'SPEEDING'] })).toBe(1);
    expect(
      countActiveSafetyFilters({
        type: ['HARSH_BRAKING'],
        severity: ['CRITICAL'],
        coachingStatus: ['NEW'],
      }),
    ).toBe(3);
  });
});

describe('matchesSafetyFilters', () => {
  it('matches everything against the empty filter set', () => {
    expect(matchesSafetyFilters(row(), EMPTY_SAFETY_FILTERS)).toBe(true);
  });

  it('filters by event type', () => {
    const filters = { ...EMPTY_SAFETY_FILTERS, type: ['SPEEDING'] as SafetyFilters['type'] };
    expect(matchesSafetyFilters(row({ type: 'HARSH_BRAKING' }), filters)).toBe(false);
    expect(matchesSafetyFilters(row({ type: 'SPEEDING' }), filters)).toBe(true);
  });

  it('filters by the bucketed severity', () => {
    const filters = { ...EMPTY_SAFETY_FILTERS, severity: ['CRITICAL'] as SafetyFilters['severity'] };
    expect(matchesSafetyFilters(row({ severity: 3 }), filters)).toBe(false);
    expect(matchesSafetyFilters(row({ severity: 5 }), filters)).toBe(true);
  });

  it('filters by coaching status', () => {
    const filters = { ...EMPTY_SAFETY_FILTERS, coachingStatus: ['COACHED'] as SafetyFilters['coachingStatus'] };
    expect(matchesSafetyFilters(row({ status: 'NEW' }), filters)).toBe(false);
    expect(matchesSafetyFilters(row({ status: 'COACHED' }), filters)).toBe(true);
  });

  it('combines all three groups with AND', () => {
    const filters: SafetyFilters = { type: ['SPEEDING'], severity: ['MINOR'], coachingStatus: ['NEW'] };
    expect(matchesSafetyFilters(row({ type: 'SPEEDING', severity: 1, status: 'NEW' }), filters)).toBe(true);
    expect(matchesSafetyFilters(row({ type: 'SPEEDING', severity: 5, status: 'NEW' }), filters)).toBe(false);
  });
});
