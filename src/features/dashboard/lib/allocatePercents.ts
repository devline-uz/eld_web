// owner: web-dashboard-fleet — W-01 `Duty status · now` donut (web/bugs.md WB-118).
// Kept out of `DutyDonut.tsx` so that file stays component-only (react-refresh/only-export-components).

/** Largest-remainder allocation (Hare-Niemeyer) so the displayed integer percentages sum to
 * exactly 100 — independent per-segment `Math.round` can over- or under-shoot (WB-118).
 *
 * Equal counts always get equal percentages (QA FE-010): the leftover points go to whole groups of
 * equal counts, never to part of a group. When no whole-group split can reach 100 (e.g. thirds),
 * each segment is rounded on its own instead — equal stays equal, the sum lands within a point
 * or two of 100. */
export function allocatePercents(counts: number[], total: number): number[] {
  if (total <= 0) return counts.map(() => 0);
  const raw = counts.map((count) => (count / total) * 100);
  const result = raw.map(Math.floor);
  const remainder = 100 - result.reduce((sum, value) => sum + value, 0);

  if (remainder === 0) return result;

  // One group per distinct count: same count → same fractional part → same treatment.
  const groups = new Map<number, number[]>();
  counts.forEach((count, index) => groups.set(count, [...(groups.get(count) ?? []), index]));
  const candidates = [...groups.values()]
    .map((indexes) => ({ indexes, frac: raw[indexes[0]!]! - result[indexes[0]!]! }))
    .filter((group) => group.frac > 0);

  // The set of whole groups whose sizes add up to exactly the leftover points, preferring the
  // largest total remainder. At most one group per duty status (≤ 9), so trying every subset is cheap.
  let best: { mask: number; score: number } | null = null;
  for (let mask = 1; mask < 1 << candidates.length; mask += 1) {
    let size = 0;
    let score = 0;
    candidates.forEach((group, i) => {
      if (mask & (1 << i)) {
        size += group.indexes.length;
        score += group.frac * group.indexes.length;
      }
    });
    if (size === remainder && (!best || score > best.score)) best = { mask, score };
  }
  if (!best) return raw.map(Math.round);
  candidates.forEach((group, i) => {
    if (best.mask & (1 << i)) for (const index of group.indexes) result[index] = result[index]! + 1;
  });
  return result;
}
