// owner: web-vehicles-drivers — W-06 Drivers, 11.23 Filters (web/tz.md §11.23:
// "Drivers: status, terminal, violations, exemptions").
//
// `GET /drivers/roster` (B-1) ships real server params for `terminal` (exact name),
// `hasOpenViolation` and `exempt` (= `driver.eldExempt`) — B-55, shipped 2026-09-14
// (web/backend-gaps.md). `DriversPage` forwards those three straight to the server, and the
// VIOLATIONS segment tab reuses `hasOpenViolation` too. The `status` field here is duty status
// (DRIVING/ON_DUTY/SLEEPER/OFF_DUTY), not `Driver.status`, and the four exemption flags besides
// `eldExempt` still have no server param — extends B-55. While either is active, `DriversPage`
// switches to the reference-cached roster window (`useDriverRosterWindow`) instead of narrowing
// only the loaded server page (WB-103): `matchesDriverFilters` below then runs against the window.
import type { DriverRosterEntry } from '@/shared/api/drivers';

export const DRIVER_STATUS_OPTIONS = ['DRIVING', 'ON_DUTY', 'SLEEPER', 'OFF_DUTY'] as const;
export type DriverStatusFilter = (typeof DRIVER_STATUS_OPTIONS)[number];

export const DRIVER_EXEMPTION_OPTIONS = [
  'eldExempt',
  'allowPersonalConveyance',
  'allowYardMove',
  'shortHaulException',
  'splitSleeperEnabled',
] as const;
export type DriverExemptionFilter = (typeof DRIVER_EXEMPTION_OPTIONS)[number];

export interface DriverFilters {
  status: DriverStatusFilter[];
  terminal: string | null;
  violationsOnly: boolean;
  exemptions: DriverExemptionFilter[];
}

export const EMPTY_DRIVER_FILTERS: DriverFilters = {
  status: [],
  terminal: null,
  violationsOnly: false,
  exemptions: [],
};

const PARAM = {
  status: 'fStatus',
  terminal: 'fTerminal',
  violationsOnly: 'fViolations',
  exemptions: 'fExempt',
} as const;

export function parseDriverFilters(params: URLSearchParams): DriverFilters {
  return {
    status: (params.get(PARAM.status)?.split(',').filter(Boolean) ?? []) as DriverStatusFilter[],
    terminal: params.get(PARAM.terminal) || null,
    violationsOnly: params.get(PARAM.violationsOnly) === '1',
    exemptions: (params.get(PARAM.exemptions)?.split(',').filter(Boolean) ?? []) as DriverExemptionFilter[],
  };
}

export function writeDriverFilters(params: URLSearchParams, filters: DriverFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  const setOrDelete = (key: string, value: string | null) => {
    if (value) next.set(key, value);
    else next.delete(key);
  };
  setOrDelete(PARAM.status, filters.status.join(',') || null);
  setOrDelete(PARAM.terminal, filters.terminal);
  setOrDelete(PARAM.violationsOnly, filters.violationsOnly ? '1' : null);
  setOrDelete(PARAM.exemptions, filters.exemptions.join(',') || null);
  next.delete('page');
  return next;
}

export function countActiveDriverFilters(filters: DriverFilters): number {
  let n = 0;
  if (filters.status.length) n += 1;
  if (filters.terminal) n += 1;
  if (filters.violationsOnly) n += 1;
  if (filters.exemptions.length) n += 1;
  return n;
}

export function matchesDriverFilters(entry: DriverRosterEntry, filters: DriverFilters): boolean {
  if (filters.status.length && !filters.status.includes(entry.dutyStatus)) return false;
  if (filters.terminal && entry.driver.homeTerminalName !== filters.terminal) return false;
  if (filters.violationsOnly && entry.openViolations <= 0) return false;
  if (filters.exemptions.length && !filters.exemptions.every((key) => entry.driver[key])) return false;
  return true;
}
