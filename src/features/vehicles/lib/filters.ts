// owner: web-vehicles-drivers — W-03 Vehicles, 11.23 Filters (web/tz.md §11.23).
//
// The backend `GET /vehicles` only accepts `page`/`limit`/`sort`/`q`/`status` — none of the
// group filters the drawer draws (ELD device, make, year range, home terminal, defects,
// firmware) exist as server query params (backend/src/modules/vehicles/vehicles.controller.ts).
// The page is server-paged (WD-073); only while one of these groups (or the UNASSIGNED segment)
// is active does it switch to the reference-cached fleet window and run the filter in memory.
// Recorded as a gap (web/backend-gaps.md B-54).
import type { VehicleTableRow } from '@/shared/api/vehicles';

/** QA UI-019 — `ACTIVE` (no live duty) and `OUT_OF_SERVICE` are statuses the table shows too. */
export const VEHICLE_STATUS_OPTIONS = ['ACTIVE', 'DRIVING', 'IDLE', 'OFF_DUTY', 'ELD_OFFLINE', 'OUT_OF_SERVICE', 'INACTIVE'] as const;
export type VehicleStatusFilter = (typeof VEHICLE_STATUS_OPTIONS)[number];

export interface VehicleFilters {
  status: VehicleStatusFilter[];
  eldDevice: string[]; // device model names, plus the literal 'UNASSIGNED'
  make: string[];
  yearFrom: number | null;
  yearTo: number | null;
  terminal: string | null;
  openDefectsOnly: boolean;
  firmwareOutdatedOnly: boolean;
}

export const EMPTY_VEHICLE_FILTERS: VehicleFilters = {
  status: [],
  eldDevice: [],
  make: [],
  yearFrom: null,
  yearTo: null,
  terminal: null,
  openDefectsOnly: false,
  firmwareOutdatedOnly: false,
};

/** Order-insensitive comparison of two de-duplicated option lists. */
function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && new Set([...a, ...b]).size === new Set(a).size;
}

/** True when two filter sets select the same thing — the drawer's "has the draft changed?" test
 * (WB — the drawer never told `FilterDrawer` it was dirty, so edited filters were dropped on
 * close without the 11.30 confirm). Group order is irrelevant: toggling an option off and back on
 * is not an edit. */
export function sameVehicleFilters(a: VehicleFilters, b: VehicleFilters): boolean {
  return (
    sameList(a.status, b.status) &&
    sameList(a.eldDevice, b.eldDevice) &&
    sameList(a.make, b.make) &&
    a.yearFrom === b.yearFrom &&
    a.yearTo === b.yearTo &&
    a.terminal === b.terminal &&
    a.openDefectsOnly === b.openDefectsOnly &&
    a.firmwareOutdatedOnly === b.firmwareOutdatedOnly
  );
}

const PARAM = {
  status: 'fStatus',
  eldDevice: 'fDevice',
  make: 'fMake',
  yearFrom: 'fYearFrom',
  yearTo: 'fYearTo',
  terminal: 'fTerminal',
  openDefectsOnly: 'fDefects',
  firmwareOutdatedOnly: 'fFirmware',
} as const;

export function parseVehicleFilters(params: URLSearchParams): VehicleFilters {
  return {
    status: (params.get(PARAM.status)?.split(',').filter(Boolean) ?? []) as VehicleStatusFilter[],
    eldDevice: params.get(PARAM.eldDevice)?.split(',').filter(Boolean) ?? [],
    make: params.get(PARAM.make)?.split(',').filter(Boolean) ?? [],
    yearFrom: params.get(PARAM.yearFrom) ? Number(params.get(PARAM.yearFrom)) : null,
    yearTo: params.get(PARAM.yearTo) ? Number(params.get(PARAM.yearTo)) : null,
    terminal: params.get(PARAM.terminal) || null,
    openDefectsOnly: params.get(PARAM.openDefectsOnly) === '1',
    firmwareOutdatedOnly: params.get(PARAM.firmwareOutdatedOnly) === '1',
  };
}

/** Writes the filter set onto an existing `URLSearchParams`, removing keys that are unset. */
export function writeVehicleFilters(params: URLSearchParams, filters: VehicleFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  const setOrDelete = (key: string, value: string | null) => {
    if (value) next.set(key, value);
    else next.delete(key);
  };
  setOrDelete(PARAM.status, filters.status.join(',') || null);
  setOrDelete(PARAM.eldDevice, filters.eldDevice.join(',') || null);
  setOrDelete(PARAM.make, filters.make.join(',') || null);
  setOrDelete(PARAM.yearFrom, filters.yearFrom != null ? String(filters.yearFrom) : null);
  setOrDelete(PARAM.yearTo, filters.yearTo != null ? String(filters.yearTo) : null);
  setOrDelete(PARAM.terminal, filters.terminal);
  setOrDelete(PARAM.openDefectsOnly, filters.openDefectsOnly ? '1' : null);
  setOrDelete(PARAM.firmwareOutdatedOnly, filters.firmwareOutdatedOnly ? '1' : null);
  next.delete('page');
  return next;
}

export function countActiveVehicleFilters(filters: VehicleFilters): number {
  let n = 0;
  if (filters.status.length) n += 1;
  if (filters.eldDevice.length) n += 1;
  if (filters.make.length) n += 1;
  if (filters.yearFrom != null || filters.yearTo != null) n += 1;
  if (filters.terminal) n += 1;
  if (filters.openDefectsOnly) n += 1;
  if (filters.firmwareOutdatedOnly) n += 1;
  return n;
}

/** The same effective status the STATUS column renders — Driving/Idle/Off-duty/ELD offline come
 * from live duty; Inactive comes from the vehicle row itself. Units with no live duty data and
 * units that are OUT_OF_SERVICE never match a status filter, matching the five options 11.23
 * actually draws. */
export function effectiveVehicleStatus(row: VehicleTableRow, duty: string | undefined): VehicleStatusFilter | null {
  if (row.status === 'INACTIVE') return 'INACTIVE';
  if (duty === 'DRIVING' || duty === 'IDLE' || duty === 'OFF_DUTY' || duty === 'ELD_OFFLINE') return duty;
  return null;
}

/** The status the W-03 STATUS column draws for a row — the filter matches what the user sees:
 * Out of service first, then Inactive, then the live duty, else plain Active (QA UI-019). */
export function badgeVehicleStatus(row: VehicleTableRow, duty: string | undefined): VehicleStatusFilter {
  if (row.status === 'OUT_OF_SERVICE') return 'OUT_OF_SERVICE';
  return effectiveVehicleStatus(row, duty) ?? 'ACTIVE';
}

/** Columns `GET /vehicles?sort=` accepts (`vehicles.service.ts` SORTABLE_FIELDS), by table column
 * id. `makeModel` sorts by make. Year/driver/ELD/odometer have no server sort (UI-007). */
export const VEHICLE_SORT_FIELDS: Readonly<Record<string, 'unitNumber' | 'status' | 'make' | 'vin'>> = {
  unitNumber: 'unitNumber',
  status: 'status',
  makeModel: 'make',
  vin: 'vin',
};

export interface VehicleSort {
  /** Table column id (a key of `VEHICLE_SORT_FIELDS`). */
  id: string;
  desc: boolean;
}

/** `?sort=unitNumber:desc` (column id) → the sort; anything unknown is ignored. */
export function parseVehicleSort(raw: string | null): VehicleSort | null {
  const [id, dir] = (raw ?? '').split(':');
  return id && id in VEHICLE_SORT_FIELDS && (dir === 'asc' || dir === 'desc') ? { id, desc: dir === 'desc' } : null;
}

/** The API's `sort` param for a column sort (`makeModel` → `make:asc`). */
export function vehicleSortParam(sort: VehicleSort | null): string | undefined {
  return sort ? `${VEHICLE_SORT_FIELDS[sort.id]}:${sort.desc ? 'desc' : 'asc'}` : undefined;
}

/** The same order applied in memory — window mode (11.23 drawer filters) has no server page. */
export function sortVehicleRows<T extends VehicleTableRow>(rows: T[], sort: VehicleSort | null): T[] {
  if (!sort) return rows;
  const field = VEHICLE_SORT_FIELDS[sort.id]!;
  const dir = sort.desc ? -1 : 1;
  return [...rows].sort((a, b) => dir * String(a[field] ?? '').localeCompare(String(b[field] ?? ''), undefined, { numeric: true }));
}

export function matchesVehicleFilters(
  row: VehicleTableRow,
  duty: string | undefined,
  filters: VehicleFilters,
): boolean {
  if (filters.status.length) {
    const status = badgeVehicleStatus(row, duty);
    if (!filters.status.includes(status)) return false;
  }
  if (filters.eldDevice.length) {
    const token = row.eldSerial ? (row.eldDeviceModel ?? row.eldSerial) : 'UNASSIGNED';
    if (!filters.eldDevice.includes(token)) return false;
  }
  if (filters.make.length && !filters.make.includes(row.make ?? '')) return false;
  if (filters.yearFrom != null && (row.year ?? 0) < filters.yearFrom) return false;
  if (filters.yearTo != null && (row.year ?? 0) > filters.yearTo) return false;
  if (filters.terminal && row.driver?.homeTerminalName !== filters.terminal) return false;
  if (filters.openDefectsOnly && row.status !== 'OUT_OF_SERVICE') return false;
  if (filters.firmwareOutdatedOnly && !row.firmwareOutdated) return false;
  return true;
}
