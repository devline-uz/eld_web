// owner: web-dvir-safety — W-10 Safety, DEMO/MOCK ONLY.
//
// A mirror of the backend's Phase 1 driver-score formula (eld_backend
// `modules/safety/lib/harsh-detect.ts` `computeDriverScore`, decisions.md D-133), used ONLY to make
// the MSW handlers and the dev demo fallback produce numbers that follow the real rules. The page
// itself never scores, ranks or averages — it renders what `GET /safety/scorecard` returns.
//
//   milesK    = miles / 1000
//   deduction = Σ harsh × 2 × severityFactor (sev 4–5 ×4, 3 ×2, 1–2 ×1)
//             + speeding × 1.5 + seatbelt × 3 + HOS violations × 5
//   score     = clamp(round(100 − deduction / milesK), 0, 100);  miles < 100 ⇒ no score
//   rank      = #1 best; ties → more miles first, then name
//   fleet     = mile-weighted mean of scored drivers; trend = current − previous

export const SCORE_MIN_MILES = 100;

export interface ScoreCounts {
  milesDriven: number;
  /** One severity (1–5) per harsh braking / acceleration / turn event. */
  harshSeverities: number[];
  speedingCount: number;
  seatbeltCount: number;
  violationCount: number;
}

export function severityFactor(severity: number): number {
  if (severity >= 4) return 4;
  if (severity === 3) return 2;
  return 1;
}

/** Null when the driver drove fewer than `SCORE_MIN_MILES` in the period. */
export function demoDriverScore(c: ScoreCounts): number | null {
  if (c.milesDriven < SCORE_MIN_MILES) return null;
  const milesK = c.milesDriven / 1000;
  const harsh = c.harshSeverities.reduce((sum, s) => sum + 2 * severityFactor(s), 0);
  const deduction = harsh + c.speedingCount * 1.5 + c.seatbeltCount * 3 + c.violationCount * 5;
  return Math.max(0, Math.min(100, Math.round(100 - deduction / milesK)));
}

interface RankInput {
  score: number | null;
  milesDriven: number;
  name: string;
}

/** Ranked (scored) rows first by rank, then unscored rows by miles desc; returns each row's rank. */
export function rankDemoRows<T extends RankInput>(rows: T[]): (T & { rank: number | null })[] {
  const scored = rows
    .filter((r) => r.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.milesDriven - a.milesDriven || a.name.localeCompare(b.name))
    .map((r, i) => ({ ...r, rank: i + 1 }));
  const unscored = rows
    .filter((r) => r.score == null)
    .sort((a, b) => b.milesDriven - a.milesDriven || a.name.localeCompare(b.name))
    .map((r) => ({ ...r, rank: null }));
  return [...scored, ...unscored];
}

/** Mile-weighted mean of the scored rows, rounded; null when none is scored. */
export function mileWeightedScore(rows: { score: number | null; milesDriven: number }[]): number | null {
  let miles = 0;
  let weighted = 0;
  for (const r of rows) {
    if (r.score == null) continue;
    miles += r.milesDriven;
    weighted += r.score * r.milesDriven;
  }
  return miles > 0 ? Math.round(weighted / miles) : null;
}

export interface DemoFleet {
  score: number | null;
  previousScore: number | null;
  trend: number | null;
  scoredDrivers: number;
  unscoredDrivers: number;
  belowThresholdCount: number;
  milesDriven: number;
}

/** Fleet summary in the backend `fleet` shape. `previous` are the previous period's rows. */
export function demoFleet(
  current: { score: number | null; milesDriven: number }[],
  previous: { score: number | null; milesDriven: number }[],
): DemoFleet {
  const score = mileWeightedScore(current);
  const previousScore = mileWeightedScore(previous);
  const scored = current.filter((r) => r.score != null);
  return {
    score,
    previousScore,
    trend: score != null && previousScore != null ? score - previousScore : null,
    scoredDrivers: scored.length,
    unscoredDrivers: current.length - scored.length,
    belowThresholdCount: scored.filter((r) => (r.score ?? 0) < 70).length,
    milesDriven: current.reduce((sum, r) => sum + r.milesDriven, 0),
  };
}
