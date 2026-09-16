// owner: web-vehicles-drivers — W-03 Vehicles, 11.23 Filters (web/tz.md §11.23).
//
// The backend `GET /vehicles` only accepts `page`/`limit`/`sort`/`q`/`status` — none of the
// group filters the drawer draws (ELD device, make, year range, home terminal, defects,
// firmware) exist as server query params (backend/src/modules/vehicles/vehicles.controller.ts).
// The page is server-paged (WD-073); only while one of these groups (or the UNASSIGNED segment)
// is active does it switch to the reference-cached fleet window and run the filter in memory.
// Recorded as a gap (web/backend-gaps.md B-54).
import type { VehicleTableRow } from '@/shared/api/vehicles';

export const VEHICLE_STATUS_OPTIONS = ['DRIVING', 'IDLE', 'OFF_DUTY', 'ELD_OFFLINE', 'INACTIVE'] as const;
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

export function matchesVehicleFilters(
  row: VehicleTableRow,
  duty: string | undefined,
  filters: VehicleFilters,
): boolean {
  if (filters.status.length) {
    const status = effectiveVehicleStatus(row, duty);
    if (!status || !filters.status.includes(status)) return false;
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
