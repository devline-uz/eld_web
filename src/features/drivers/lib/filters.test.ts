// web/tz.md §11.23 Filters — pure filter-state logic for W-06 Drivers
// ("Drivers: status, terminal, violations, exemptions").
import { describe, expect, it } from 'vitest';
import {
  EMPTY_DRIVER_FILTERS,
  countActiveDriverFilters,
  matchesDriverFilters,
  parseDriverFilters,
  writeDriverFilters,
  type DriverFilters,
} from './filters';
import type { DriverRosterEntry } from '@/shared/api/drivers';

function entry(overrides: Partial<DriverRosterEntry> = {}): DriverRosterEntry {
  return {
    driver: {
      id: 'drv_1',
      username: 'johnsmith',
      firstName: 'John',
      lastName: 'Smith',
      homeTerminalName: 'Columbus, OH',
      appVersion: 'v2.24',
      email: 'john.smith@example.com',
      eldExempt: false,
      allowPersonalConveyance: true,
      allowYardMove: true,
      shortHaulException: false,
      splitSleeperEnabled: false,
    },
    dutyStatus: 'ON_DUTY',
    unit: { id: 'veh_1', unitNumber: '#101' },
    hos: { driveRemainingSec: 0, shiftRemainingSec: 1140, cycleRemainingSec: 46140 },
    openViolations: 1,
    emailVerified: null,
    ...overrides,
  };
}

describe('parseDriverFilters / writeDriverFilters', () => {
  it('round-trips every field through URL search params (shareable per §11.23)', () => {
    const filters: DriverFilters = {
      status: ['DRIVING', 'SLEEPER'],
      terminal: 'Raleigh, NC',
      violationsOnly: true,
      exemptions: ['eldExempt', 'splitSleeperEnabled'],
    };
    const params = writeDriverFilters(new URLSearchParams(), filters);
    expect(parseDriverFilters(params)).toEqual(filters);
  });

  it('deletes page on any filter write', () => {
    const params = writeDriverFilters(new URLSearchParams('page=2'), EMPTY_DRIVER_FILTERS);
    expect(params.get('page')).toBeNull();
  });

  it('returns the empty set when no filter params are present', () => {
    expect(parseDriverFilters(new URLSearchParams())).toEqual(EMPTY_DRIVER_FILTERS);
  });
});

describe('countActiveDriverFilters', () => {
  it('counts one per non-empty group', () => {
    expect(countActiveDriverFilters(EMPTY_DRIVER_FILTERS)).toBe(0);
    expect(
      countActiveDriverFilters({
        status: ['DRIVING'],
        terminal: 'Columbus, OH',
        violationsOnly: true,
        exemptions: ['eldExempt'],
      }),
    ).toBe(4);
  });
});

describe('matchesDriverFilters', () => {
  it('matches everything against the empty filter set', () => {
    expect(matchesDriverFilters(entry(), EMPTY_DRIVER_FILTERS)).toBe(true);
  });

  it('filters by duty status', () => {
    const filters = { ...EMPTY_DRIVER_FILTERS, status: ['DRIVING'] as DriverFilters['status'] };
    expect(matchesDriverFilters(entry({ dutyStatus: 'ON_DUTY' }), filters)).toBe(false);
    expect(matchesDriverFilters(entry({ dutyStatus: 'DRIVING' }), filters)).toBe(true);
  });

  it('filters by home terminal', () => {
    const filters = { ...EMPTY_DRIVER_FILTERS, terminal: 'Raleigh, NC' };
    expect(matchesDriverFilters(entry(), filters)).toBe(false);
    expect(
      matchesDriverFilters(entry({ driver: { ...entry().driver, homeTerminalName: 'Raleigh, NC' } }), filters),
    ).toBe(true);
  });

  it('"only drivers with open violations" excludes zero-violation rows', () => {
    const filters = { ...EMPTY_DRIVER_FILTERS, violationsOnly: true };
    expect(matchesDriverFilters(entry({ openViolations: 0 }), filters)).toBe(false);
    expect(matchesDriverFilters(entry({ openViolations: 2 }), filters)).toBe(true);
  });

  it('exemptions require every selected flag to be true (AND, not OR)', () => {
    const filters = { ...EMPTY_DRIVER_FILTERS, exemptions: ['allowYardMove', 'splitSleeperEnabled'] as DriverFilters['exemptions'] };
    // has allowYardMove but not splitSleeperEnabled
    expect(matchesDriverFilters(entry(), filters)).toBe(false);
    expect(
      matchesDriverFilters(entry({ driver: { ...entry().driver, splitSleeperEnabled: true } }), filters),
    ).toBe(true);
  });
});
