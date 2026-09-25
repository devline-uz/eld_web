// W-12 `All jurisdictions ▾` and W-13 `Group by ▾` — the pure client-side helpers (B-46).
import { describe, expect, it } from 'vitest';
import { activitySummaryItems, iftaSummaryFixture } from '@/mocks/handlers/reports';
import { groupByTerminal, parseGroupBy } from './activityGroups';
import { jurisdictionOptions, kpisForJurisdiction, parseJurisdiction, rowsForJurisdiction } from './iftaJurisdictions';

describe('activityGroups', () => {
  it('parses ?group= to the drawn default unless it is terminal', () => {
    expect(parseGroupBy(null)).toBe('driver');
    expect(parseGroupBy('vehicle')).toBe('driver');
    expect(parseGroupBy('terminal')).toBe('terminal');
  });

  it('sums per home terminal A→Z, drivers without one last', () => {
    const items = [
      ...activitySummaryItems,
      { ...activitySummaryItems[0]!, driverId: 'drv_9', days: 3, certifiedDays: 3, violations: 2 },
      { ...activitySummaryItems[0]!, driverId: 'drv_x' },
    ];
    const terminalOf = new Map([
      ['drv_1', 'Dayton, OH'],
      ['drv_2', 'Columbus, OH'],
      ['drv_9', 'Dayton, OH'],
      ['drv_x', ''],
    ]);
    const groups = groupByTerminal(items, terminalOf);
    expect(groups.map((g) => g.terminal)).toEqual(['Columbus, OH', 'Dayton, OH', null]);
    expect(groups[1]).toMatchObject({ drivers: 2, days: 5, certifiedDays: 4, violations: 3, drivingSec: 122_400, distanceMi: 1_700 });
    expect(groups[2]).toMatchObject({ drivers: 1 });
  });
});

describe('iftaJurisdictions', () => {
  it('parses ?jurisdiction= to an upper-case code or null', () => {
    expect(parseJurisdiction('oh')).toBe('OH');
    expect(parseJurisdiction(null)).toBeNull();
    expect(parseJurisdiction('all')).toBeNull();
    expect(parseJurisdiction('O1')).toBeNull();
  });

  it('offers the loaded codes by display name and keeps an unlisted selection', () => {
    const options = jurisdictionOptions(iftaSummaryFixture.rows, 'TX');
    expect(options.map((o) => o.label)).toEqual([
      'All jurisdictions', 'Illinois', 'Indiana', 'Kentucky', 'Ohio', 'Ontario (CA)', 'Texas',
    ]);
    expect(options.find((o) => o.label === 'Texas')?.value).toBe('TX');
  });

  it('filters rows and derives the KPI row from one jurisdiction', () => {
    const [ohio] = rowsForJurisdiction(iftaSummaryFixture.rows, 'OH');
    expect(ohio?.totalMiles).toBe(96_420);
    expect(rowsForJurisdiction(iftaSummaryFixture.rows, 'TX')).toEqual([]);
    expect(kpisForJurisdiction(ohio!)).toEqual({
      totalMiles: 96_420, taxableMiles: 92_110, taxablePct: 95.5, fuelGal: 14_980, receiptCount: null, fleetMpg: 6.4, fleetMpgPrev: null,
    });
    expect(kpisForJurisdiction({ ...ohio!, totalMiles: 0, taxableMiles: 0 }).taxablePct).toBeNull();
  });
});
