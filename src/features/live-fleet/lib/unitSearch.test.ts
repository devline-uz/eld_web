import { describe, expect, it } from 'vitest';
import type { LiveFleetUnit } from '@/shared/api/liveFleet';
import { matchesUnitSearch, normalizeUnitQuery } from './unitSearch';

const unit = { vehicleId: 'v1', unitNumber: '104', driverName: 'John Smith' } as LiveFleetUnit;

describe('Live Fleet unit search (FE-006)', () => {
  it('strips a leading "Unit" and "#"', () => {
    expect(normalizeUnitQuery('Unit 104')).toBe('104');
    expect(normalizeUnitQuery('unit #104')).toBe('104');
    expect(normalizeUnitQuery('#104')).toBe('104');
    expect(normalizeUnitQuery('  Smith ')).toBe('smith');
  });

  it('finds the unit by "Unit 104", "#104", "104", the driver and the plate', () => {
    for (const q of ['Unit 104', '#104', '104', 'smith', 'ABC 123', 'abc-123', 'abc123']) {
      expect(matchesUnitSearch(unit, q, 'ABC-123')).toBe(true);
    }
    expect(matchesUnitSearch({ ...unit, unitNumber: '#104' }, 'Unit 104')).toBe(true);
    expect(matchesUnitSearch(unit, 'Unit 999', 'ABC-123')).toBe(false);
    expect(matchesUnitSearch(unit, 'XYZ', null)).toBe(false);
    expect(matchesUnitSearch(unit, '')).toBe(true);
  });
});
