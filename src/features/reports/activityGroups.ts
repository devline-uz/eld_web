// owner: web-reports-transfer — W-13 `Group by ▾` (B-46 vehicle-group half still open).
//
// `GET /reports/activity/summary` rows are per driver and carry nothing else to group on: no unit
// (a driver's current truck is not the truck of every day in the range), no per-day split, and no
// vehicle-group model on the backend. The one extra dimension the page already reads is the
// driver's home terminal (the `All terminals ▾` options), so the menu offers the drawn default
// `Group by driver` plus a client-side `Group by terminal` roll-up of the same RODS totals.
import type { ActivitySummaryItem } from '@/shared/api/reports';

export type ActivityGroupBy = 'driver' | 'terminal';

export const ACTIVITY_GROUP_OPTIONS: { value: ActivityGroupBy; label: string }[] = [
  { value: 'driver', label: 'Group by driver' },
  { value: 'terminal', label: 'Group by terminal' },
];

/** `?group=` — anything but `terminal` (absent, stale, hand-typed) is the drawn default. */
export function parseGroupBy(raw: string | null): ActivityGroupBy {
  return raw === 'terminal' ? 'terminal' : 'driver';
}

export const NO_TERMINAL_LABEL = 'No home terminal';

export interface TerminalGroup {
  /** `null` = the driver has no home terminal (or is not in the drivers read). */
  terminal: string | null;
  drivers: number;
  days: number;
  offSec: number;
  sbSec: number;
  drivingSec: number;
  onSec: number;
  distanceMi: number;
  violations: number;
  certifiedDays: number;
}

/** Sums the RODS engine's per-driver totals per home terminal — A→Z, the no-terminal group last. */
export function groupByTerminal(items: ActivitySummaryItem[], terminalOf: Map<string, string>): TerminalGroup[] {
  const groups = new Map<string | null, TerminalGroup>();
  for (const item of items) {
    const terminal = terminalOf.get(item.driverId) || null;
    const group = groups.get(terminal) ?? {
      terminal,
      drivers: 0,
      days: 0,
      offSec: 0,
      sbSec: 0,
      drivingSec: 0,
      onSec: 0,
      distanceMi: 0,
      violations: 0,
      certifiedDays: 0,
    };
    group.drivers += 1;
    group.days += item.days;
    group.offSec += item.offSec;
    group.sbSec += item.sbSec;
    group.drivingSec += item.drivingSec;
    group.onSec += item.onSec;
    group.distanceMi += item.distanceMi;
    group.violations += item.violations;
    group.certifiedDays += item.certifiedDays;
    groups.set(terminal, group);
  }
  return [...groups.values()].sort((a, b) =>
    a.terminal === null ? 1 : b.terminal === null ? -1 : a.terminal.localeCompare(b.terminal),
  );
}
