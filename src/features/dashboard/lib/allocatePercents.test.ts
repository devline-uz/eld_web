// web/bugs.md WB-118 — donut segment percentages must sum to exactly 100, not float 33/33/33 or
// 34/33/34 from independent per-segment rounding.
import { describe, expect, it } from 'vitest';
import { allocatePercents } from './allocatePercents';

describe('allocatePercents (WB-118)', () => {
  it('sums to exactly 100 for the classic thirds case', () => {
    const result = allocatePercents([1, 1, 1], 3);
    expect(result.reduce((a, b) => a + b, 0)).toBe(100);
    // largest-remainder gives the extra point to the first equal-fraction segment, deterministically
    expect(result).toEqual([34, 33, 33]);
  });

  it('sums to exactly 100 across a range of random-ish splits', () => {
    const cases: Array<[number[], number]> = [
      [[7, 5, 3, 1], 16],
      [[2, 2, 2, 2, 1], 9],
      [[10, 0, 0, 0], 10],
      [[1, 2, 3], 6],
      [[97, 1, 1, 1], 100],
    ];
    for (const [counts, total] of cases) {
      const result = allocatePercents(counts, total);
      expect(result.reduce((a, b) => a + b, 0)).toBe(100);
    }
  });

  it('returns all zeros when total is 0', () => {
    expect(allocatePercents([0, 0, 0], 0)).toEqual([0, 0, 0]);
  });

  it('preserves segments that round exactly', () => {
    expect(allocatePercents([1, 1, 1, 1], 4)).toEqual([25, 25, 25, 25]);
  });
});
