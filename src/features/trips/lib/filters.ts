// owner: web-dispatch-messaging — W-11 Dispatch & Trips, 11.23 Filters (web/tz.md §11.23).
//
// `GET /trips` accepts `page`/`limit`/`sort`/`q`/`status`/`driverId` (`TripListQueryDto`,
// backend/src/modules/trips/dto/trips.dto.ts) — `status` there is the raw `Trip.status` enum
// (`PLANNED`/`ASSIGNED`/`IN_PROGRESS`/`DELIVERED`/`CANCELLED`), not the drawn STATUS column,
// which is the *computed* `displayStatus` (`On time`/`Late`/`Loading`/…, see
// `shared/api/trips.ts` `computeDisplayStatus`). The board is server-paged (WD-073): the Active
// segment is a bounded in-memory set (exact), while Scheduled/Completed switch to the newest
// `FILTER_WINDOW` rows only while one of these groups is active. UNIT (vehicleId) and the
// depart-date range have no server param at all — recorded as web/backend-gaps.md B-59.
import type { TripDisplayStatus, TripTableRow } from '@/shared/api/trips';
import { isRealCalendarDate } from './periodRange';

export const TRIP_STATUS_OPTIONS: TripDisplayStatus[] = ['On time', 'Late', 'Loading', 'Delivered', 'Cancelled', 'Planned'];

export interface TripFilters {
  status: TripDisplayStatus[];
  driverId: string[];
  vehicleId: string[];
  terminal: string | null;
  departFrom: string | null; // yyyy-mm-dd
  departTo: string | null; // yyyy-mm-dd
  noTrailerOnly: boolean;
}

export const EMPTY_TRIP_FILTERS: TripFilters = {
  status: [],
  driverId: [],
  vehicleId: [],
  terminal: null,
  departFrom: null,
  departTo: null,
  noTrailerOnly: false,
};

const PARAM = {
  status: 'fStatus',
  driverId: 'fDriver',
  vehicleId: 'fUnit',
  terminal: 'fTerminal',
  departFrom: 'fDepartFrom',
  departTo: 'fDepartTo',
  noTrailerOnly: 'fNoTrailer',
} as const;

/** A hand-edited or stale URL (`fDepartFrom=5000-13-45`) is dropped rather than filtering on it. */
function dateParam(value: string | null): string | null {
  return value && isRealCalendarDate(value) ? value : null;
}

export function parseTripFilters(params: URLSearchParams): TripFilters {
  return {
    status: (params.get(PARAM.status)?.split(',').filter(Boolean) ?? []) as TripDisplayStatus[],
    driverId: params.get(PARAM.driverId)?.split(',').filter(Boolean) ?? [],
    vehicleId: params.get(PARAM.vehicleId)?.split(',').filter(Boolean) ?? [],
    terminal: params.get(PARAM.terminal) || null,
    departFrom: dateParam(params.get(PARAM.departFrom)),
    departTo: dateParam(params.get(PARAM.departTo)),
    noTrailerOnly: params.get(PARAM.noTrailerOnly) === '1',
  };
}

/** Writes the filter set onto an existing `URLSearchParams`, removing keys that are unset. */
export function writeTripFilters(params: URLSearchParams, filters: TripFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  const setOrDelete = (key: string, value: string | null) => {
    if (value) next.set(key, value);
    else next.delete(key);
  };
  setOrDelete(PARAM.status, filters.status.join(',') || null);
  setOrDelete(PARAM.driverId, filters.driverId.join(',') || null);
  setOrDelete(PARAM.vehicleId, filters.vehicleId.join(',') || null);
  setOrDelete(PARAM.terminal, filters.terminal);
  setOrDelete(PARAM.departFrom, filters.departFrom);
  setOrDelete(PARAM.departTo, filters.departTo);
  setOrDelete(PARAM.noTrailerOnly, filters.noTrailerOnly ? '1' : null);
  next.delete('page');
  return next;
}

export function countActiveTripFilters(filters: TripFilters): number {
  let n = 0;
  if (filters.status.length) n += 1;
  if (filters.driverId.length) n += 1;
  if (filters.vehicleId.length) n += 1;
  if (filters.terminal) n += 1;
  if (filters.departFrom || filters.departTo) n += 1;
  if (filters.noTrailerOnly) n += 1;
  return n;
}

/** `startedAt` if the trip has actually departed, otherwise its planned start — the same value
 * the DEPART column renders. */
function departDate(row: Pick<TripTableRow, 'startedAt' | 'plannedStartAt'>): string | null {
  return row.startedAt ?? row.plannedStartAt;
}

export function matchesTripFilters(row: TripTableRow, filters: TripFilters): boolean {
  if (filters.status.length && !filters.status.includes(row.displayStatus)) return false;
  if (filters.driverId.length && (!row.driverId || !filters.driverId.includes(row.driverId))) return false;
  if (filters.vehicleId.length && (!row.vehicleId || !filters.vehicleId.includes(row.vehicleId))) return false;
  if (filters.terminal && row.driver?.homeTerminalName !== filters.terminal) return false;
  if (filters.departFrom || filters.departTo) {
    const depart = departDate(row);
    if (!depart) return false;
    const day = depart.slice(0, 10);
    if (filters.departFrom && day < filters.departFrom) return false;
    if (filters.departTo && day > filters.departTo) return false;
  }
  if (filters.noTrailerOnly && row.trailerId) return false;
  return true;
}
