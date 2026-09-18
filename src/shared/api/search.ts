// owner: web-architect — 11.28 Command palette entity search (web/tz.md §11.28, §20 B-10).
//
// ⛔ GAP B-10 `GET /search?q=` does not exist on the backend (live `404 NOT_FOUND`). The palette
// asks it first — MSW serves the shape below — and only on a 404 falls back to what §11.28
// documents for v1: `GET /drivers?q=` + `GET /vehicles?q=` in parallel. Any other failure is
// thrown and rendered as an in-panel error (web/decisions.md WD-054).
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { client } from './client';
import { endpoints } from './endpoints';
import { ApiError } from './errors';
import { qk } from './queryKeys';
import type { DriverRow, VehicleRow } from './vehicles';

export type SearchDutyStatus = 'DRIVING' | 'ON_DUTY' | 'SLEEPER' | 'OFF_DUTY';

export interface SearchDriverHit {
  id: string;
  name: string;
  unitNumber: string | null;
  dutyStatus: SearchDutyStatus | null;
  openViolations: number | null;
  openWarnings: number | null;
  homeTerminalName: string | null;
}

export interface SearchVehicleHit {
  id: string;
  unitNumber: string;
  make: string | null;
  model: string | null;
  vin: string;
  driverName: string | null;
}

/** B-10 proposed response (recorded in web/backend-gaps.md). */
export interface GlobalSearchResponse {
  q: string;
  drivers: SearchDriverHit[];
  vehicles: SearchVehicleHit[];
  /** Footer `Searching 69 units · 58 drivers · 1,284 logs`. */
  scope?: { units: number; drivers: number; logs: number };
}

export interface GlobalSearchResult extends GlobalSearchResponse {
  source: 'search' | 'fallback';
}

export interface SearchScope {
  drivers: boolean;
  vehicles: boolean;
}

export const SEARCH_DEBOUNCE_MS = 250;
export const SEARCH_MIN_CHARS = 2;
export const SEARCH_RESULT_LIMIT = 5;

function driverHit(row: DriverRow): SearchDriverHit {
  return {
    id: row.id,
    name: `${row.firstName} ${row.lastName}`.trim() || row.username,
    unitNumber: null,
    dutyStatus: null,
    openViolations: null,
    openWarnings: null,
    homeTerminalName: row.homeTerminalName ?? null,
  };
}

function vehicleHit(row: VehicleRow): SearchVehicleHit {
  return {
    id: row.id,
    unitNumber: row.unitNumber,
    make: row.make,
    model: row.model,
    vin: row.vin,
    driverName: null,
  };
}

export async function fetchGlobalSearch(
  q: string,
  scope: SearchScope,
  signal?: AbortSignal,
): Promise<GlobalSearchResult> {
  try {
    const res = await client.get<GlobalSearchResponse>(endpoints.search.root, {
      params: { q, limit: SEARCH_RESULT_LIMIT },
      signal,
    });
    return {
      ...res,
      drivers: scope.drivers ? (res.drivers ?? []) : [],
      vehicles: scope.vehicles ? (res.vehicles ?? []) : [],
      source: 'search',
    };
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
  }

  const listParams = { q, limit: SEARCH_RESULT_LIMIT };
  const [drivers, vehicles] = await Promise.all([
    scope.drivers ? client.list<DriverRow>(endpoints.drivers.list, listParams, { signal }) : null,
    scope.vehicles ? client.list<VehicleRow>(endpoints.vehicles.list, listParams, { signal }) : null,
  ]);
  return {
    q,
    drivers: (drivers?.items ?? []).map(driverHit),
    vehicles: (vehicles?.items ?? []).map(vehicleHit),
    source: 'fallback',
  };
}

export function useGlobalSearch(term: string, scope: SearchScope) {
  const q = term.trim();
  return useQuery({
    queryKey: qk.search(q, { drivers: scope.drivers, vehicles: scope.vehicles }),
    queryFn: ({ signal }) => fetchGlobalSearch(q, scope, signal),
    enabled: q.length >= SEARCH_MIN_CHARS && (scope.drivers || scope.vehicles),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
