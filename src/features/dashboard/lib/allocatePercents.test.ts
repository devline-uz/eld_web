// web/bugs.md WB-118 — donut segment percentages must sum to exactly 100, not float 33/33/33 or
// 34/33/34 from independent per-segment rounding.
import { describe, expect, it } from 'vitest';
import { allocatePercents } from './allocatePercents';

describe('allocatePercents (WB-118)', () => {
  it('FE-010: equal counts get equal percentages, even when that means not summing to 100', () => {
    // thirds cannot be split equally into 100 integer points — each rounds on its own
    expect(allocatePercents([1, 1, 1], 3)).toEqual([33, 33, 33]);
    expect(allocatePercents([1, 1, 1, 3], 6)).toEqual([17, 17, 17, 50]);
  });

  it('FE-010: gives the leftover points to a whole group of equal counts', () => {
    // 28.57 ×2 and 42.86: floors 28/28/42 = 98, the two equal segments take the 2 points together
    expect(allocatePercents([2, 2, 3], 7)).toEqual([29, 29, 42]);
    // 2/2/1/1/1 of 7: the equal pair (.57) takes both points; the three 14.29s stay equal
    expect(allocatePercents([2, 1, 2, 1, 1], 7)).toEqual([29, 14, 29, 14, 14]);
  });

  it('sums to exactly 100 across a range of random-ish splits', () => {
    const cases: Array<[number[], number]> = [
      [[7, 5, 3, 1], 16],
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
