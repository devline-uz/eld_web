import { describe, expect, it } from 'vitest';
import { buildIftaMockSummary } from './iftaMockData';

const ratio = (miles: number, fuel: number | null) => (fuel ? Math.round((miles / fuel) * 10) / 10 : null);

describe('buildIftaMockSummary — MPG column is TOTAL MILES ÷ FUEL of the same line', () => {
  it('every jurisdiction row and the Total row divide their own miles by their own gallons', () => {
    const summary = buildIftaMockSummary({ quarter: '2026-Q2' });
    expect(summary.rows.length).toBeGreaterThan(1);
    for (const row of summary.rows) expect(row.mpg).toBe(ratio(row.totalMiles, row.fuelGal));
    expect(summary.totals.mpg).toBe(ratio(summary.totals.totalMiles, summary.totals.fuelGal));
  });

  it('a single-jurisdiction filter shows the same MPG on the row and the Total row', () => {
    const [first] = buildIftaMockSummary({ quarter: '2026-Q2' }).rows;
    const summary = buildIftaMockSummary({ quarter: '2026-Q2', jurisdiction: first!.jurisdiction });
    expect(summary.rows).toHaveLength(1);
    expect(summary.totals.mpg).toBe(summary.rows[0]!.mpg);
    expect(summary.totals.mpg).toBe(ratio(first!.totalMiles, first!.fuelGal));
  });

  it('keeps the KPI fleet MPG fleet-wide (the IFTA taxable-gallons divisor) under a jurisdiction filter', () => {
    const all = buildIftaMockSummary({ quarter: '2026-Q2' });
    const one = buildIftaMockSummary({ quarter: '2026-Q2', jurisdiction: all.rows[0]!.jurisdiction });
    expect(one.kpis.fleetMpg).toBe(all.kpis.fleetMpg);
  });
});
