import { describe, expect, it } from 'vitest';
import { demoDriverScore, demoFleet, mileWeightedScore, rankDemoRows, severityFactor } from './scoreFormula';

const counts = { milesDriven: 1000, harshSeverities: [] as number[], speedingCount: 0, seatbeltCount: 0, violationCount: 0 };

describe('scoreFormula (demo mirror of backend D-133)', () => {
  it('weights harsh events by severity band', () => {
    expect([1, 2, 3, 4, 5].map(severityFactor)).toEqual([1, 1, 2, 4, 4]);
    expect(demoDriverScore({ ...counts, harshSeverities: [5] })).toBe(92);
    expect(demoDriverScore({ ...counts, harshSeverities: [3] })).toBe(96);
    expect(demoDriverScore({ ...counts, harshSeverities: [1] })).toBe(98);
  });

  it('normalises per 1,000 mi and adds speeding / seatbelt / HOS deductions', () => {
    expect(demoDriverScore({ ...counts, milesDriven: 2000, speedingCount: 2, seatbeltCount: 1, violationCount: 1 })).toBe(95);
  });

  it('returns null under 100 mi and clamps to 0–100', () => {
    expect(demoDriverScore({ ...counts, milesDriven: 99 })).toBeNull();
    expect(demoDriverScore({ ...counts, milesDriven: 100 })).toBe(100);
    expect(demoDriverScore({ ...counts, milesDriven: 100, violationCount: 50 })).toBe(0);
  });

  it('ranks best first, ties by more miles then name; unscored last with no rank', () => {
    const ranked = rankDemoRows([
      { name: 'Zed', score: 90, milesDriven: 500 },
      { name: 'Amy', score: 90, milesDriven: 500 },
      { name: 'Bob', score: 90, milesDriven: 900 },
      { name: 'Low', score: null, milesDriven: 50 },
      { name: 'Top', score: 99, milesDriven: 100 },
    ]);
    expect(ranked.map((r) => [r.name, r.rank])).toEqual([
      ['Top', 1],
      ['Bob', 2],
      ['Amy', 3],
      ['Zed', 4],
      ['Low', null],
    ]);
  });

  it('fleet score is mile-weighted over scored drivers, with trend vs previous', () => {
    expect(mileWeightedScore([{ score: 100, milesDriven: 3000 }, { score: 60, milesDriven: 1000 }, { score: null, milesDriven: 50 }])).toBe(90);
    const fleet = demoFleet(
      [{ score: 100, milesDriven: 3000 }, { score: 60, milesDriven: 1000 }, { score: null, milesDriven: 50 }],
      [{ score: 80, milesDriven: 1000 }],
    );
    expect(fleet).toEqual({ score: 90, previousScore: 80, trend: 10, scoredDrivers: 2, unscoredDrivers: 1, belowThresholdCount: 1, milesDriven: 4050 });
    expect(demoFleet([], []).score).toBeNull();
  });
});
