// owner: web-settings-admin — WB-042 filters (W-18 Users). 100% coverage required.
import { describe, expect, it } from 'vitest';
import type { UserRow } from '@/shared/api/settingsAdmin';
import {
  EMPTY_USER_FILTERS,
  countActiveUserFilters,
  matchesUserFilters,
  parseUserFilters,
  writeUserFilters,
  type UserFilters,
} from './filters';

function user(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 'usr_1',
    email: 'a@example.com',
    firstName: 'A',
    lastName: 'B',
    status: 'ACTIVE',
    role: { key: 'ADMIN', name: 'Administrator' },
    ...overrides,
  };
}

describe('parseUserFilters / writeUserFilters', () => {
  it('parses empty params to the empty filter set', () => {
    expect(parseUserFilters(new URLSearchParams())).toEqual(EMPTY_USER_FILTERS);
  });

  it('round-trips a full filter set through the URL', () => {
    const filters: UserFilters = { role: ['ADMIN', 'VIEWER'], status: ['ACTIVE'] };
    const params = writeUserFilters(new URLSearchParams(), filters);
    expect(parseUserFilters(params)).toEqual(filters);
  });

  it('removes keys when the filter is cleared back to empty', () => {
    const filters: UserFilters = { role: ['ADMIN'], status: [] };
    const params = writeUserFilters(new URLSearchParams(), filters);
    const cleared = writeUserFilters(params, EMPTY_USER_FILTERS);
    expect(Array.from(cleared.keys())).toHaveLength(0);
  });

  it('preserves unrelated params already on the URL', () => {
    const params = new URLSearchParams({ q: 'anna' });
    const next = writeUserFilters(params, { role: ['VIEWER'], status: [] });
    expect(next.get('q')).toBe('anna');
    expect(next.get('fRole')).toBe('VIEWER');
  });
});

describe('countActiveUserFilters', () => {
  it('counts zero for the empty set', () => {
    expect(countActiveUserFilters(EMPTY_USER_FILTERS)).toBe(0);
  });

  it('counts each non-empty group once, regardless of how many values it holds', () => {
    expect(countActiveUserFilters({ role: ['ADMIN', 'VIEWER'], status: ['ACTIVE'] })).toBe(2);
    expect(countActiveUserFilters({ role: ['ADMIN'], status: [] })).toBe(1);
  });
});

describe('matchesUserFilters', () => {
  it('matches everything against the empty filter set', () => {
    expect(matchesUserFilters(user(), EMPTY_USER_FILTERS)).toBe(true);
  });

  it('filters by role', () => {
    const filters: UserFilters = { role: ['VIEWER'], status: [] };
    expect(matchesUserFilters(user({ role: { key: 'VIEWER', name: 'Viewer' } }), filters)).toBe(true);
    expect(matchesUserFilters(user({ role: { key: 'ADMIN', name: 'Administrator' } }), filters)).toBe(false);
  });

  it('filters by status', () => {
    const filters: UserFilters = { role: [], status: ['INVITED'] };
    expect(matchesUserFilters(user({ status: 'INVITED' }), filters)).toBe(true);
    expect(matchesUserFilters(user({ status: 'ACTIVE' }), filters)).toBe(false);
  });

  it('combines multiple groups with AND', () => {
    const filters: UserFilters = { role: ['ADMIN'], status: ['ACTIVE'] };
    expect(matchesUserFilters(user({ role: { key: 'ADMIN', name: 'Administrator' }, status: 'ACTIVE' }), filters)).toBe(true);
    expect(matchesUserFilters(user({ role: { key: 'ADMIN', name: 'Administrator' }, status: 'DISABLED' }), filters)).toBe(false);
  });
});
