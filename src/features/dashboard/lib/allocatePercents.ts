// owner: web-dashboard-fleet — W-01 `Duty status · now` donut (web/bugs.md WB-118).
// Kept out of `DutyDonut.tsx` so that file stays component-only (react-refresh/only-export-components).

/** Largest-remainder allocation (Hare-Niemeyer) so the displayed integer percentages always sum
 * to exactly 100 — independent per-segment `Math.round` can over- or under-shoot (WB-118). */
export function allocatePercents(counts: number[], total: number): number[] {
  if (total <= 0) return counts.map(() => 0);
  const raw = counts.map((count) => (count / total) * 100);
  const floors = raw.map(Math.floor);
  const remainder = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (let i = 0; i < remainder; i += 1) {
    const entry = order[i];
    if (!entry) break;
    result[entry.index] = (result[entry.index] ?? 0) + 1;
  }
  return result;
}
