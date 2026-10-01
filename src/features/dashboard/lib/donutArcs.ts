import type { DutyStatus } from '@/shared/ui/Badge';

/** SVG user units — the same 180 box, 58/78 inner/outer radius and 1° gap Recharts drew. */
export const DONUT_SIZE = 180;
const INNER = 58;
const OUTER = 78;
export const DONUT_RADIUS = (INNER + OUTER) / 2;
export const DONUT_THICKNESS = OUTER - INNER;
export const CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
const GAP = CIRCUMFERENCE / 360;

export interface DonutArc {
  status: DutyStatus;
  count: number;
  /** Visible stroke length along the ring. */
  length: number;
  /** Distance along the ring (clockwise from 12 o'clock) where the arc starts. */
  offset: number;
}

/** Ring arcs for the non-zero counts, in legend order; a lone segment is a full ring (no gap). */
export function donutArcs(counted: { status: DutyStatus; count: number }[]): DonutArc[] {
  const total = counted.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return [];
  const present = counted.filter((s) => s.count > 0);
  const gap = present.length > 1 ? GAP : 0;
  let cursor = 0;
  return present.map((s) => {
    const share = (s.count / total) * CIRCUMFERENCE;
    const arc = { status: s.status, count: s.count, length: Math.max(share - gap, 0), offset: cursor };
    cursor += share;
    return arc;
  });
}
