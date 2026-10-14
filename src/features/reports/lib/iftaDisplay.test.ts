import { describe, expect, it } from 'vitest';
import { iftaReadinessLabel, sortByJurisdictionName } from './iftaDisplay';

describe('IFTA display (LIVE-031)', () => {
  it('sorts by the displayed name, not the code', () => {
    const rows = [{ jurisdiction: 'IA' }, { jurisdiction: 'IL' }, { jurisdiction: 'MO' }, { jurisdiction: 'MS' }];
    expect(sortByJurisdictionName(rows).map((r) => r.jurisdiction)).toEqual(['IL', 'IA', 'MS', 'MO']);
  });

  it('is only "IFTA-ready" with fuel on file', () => {
    expect(iftaReadinessLabel({ fuelGal: 1200 })).toBe('IFTA-ready');
    expect(iftaReadinessLabel({ fuelGal: null })).toBe('Fuel receipts missing — not IFTA-ready');
    expect(iftaReadinessLabel({ fuelGal: 0 })).toBe('Fuel receipts missing — not IFTA-ready');
    expect(iftaReadinessLabel(undefined)).toBe('');
  });
});
