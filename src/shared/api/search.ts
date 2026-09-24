// owner: web-architect — 11.28 Command palette entity search (web/tz.md §11.28, §20 B-10).
//
// B-10 `GET /search?q=&limit=` shipped 2026-09-24 (backend `search.service.ts`, no permission key):
// shapes below match it field for field; `dutyStatus`/`openWarnings` are always `null` there (never
// fabricated, backend D-098) and `scope` is not sent. The old `GET /drivers?q=` + `GET /vehicles?q=`
// 404 fallback (WD-054) is retired — one call only (WD-093).
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { client } from './client';
import { endpoints } from './endpoints';
import { qk } from './queryKeys';

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

/** B-10 response (`GlobalSearchResult` in backend `search.service.ts`). */
export interface GlobalSearchResponse {
  q: string;
  drivers: SearchDriverHit[];
  vehicles: SearchVehicleHit[];
  /** Footer `Searching 69 units · 58 drivers · 1,284 logs` — NOT returned by the shipped API. */
  scope?: { units: number; drivers: number; logs: number };
}

export interface SearchScope {
  drivers: boolean;
  vehicles: boolean;
}

export const SEARCH_DEBOUNCE_MS = 250;
export const SEARCH_MIN_CHARS = 2;
export const SEARCH_RESULT_LIMIT = 5;

/**
 * One `GET /search` call (WD-093). The backend already searches only the sections the caller may
 * read (B-090) and answers `[]` for the rest; a section missing from the body is treated the same
 * way. The client scope is applied on top so a stale permission set can never widen the palette.
 * There is no `/drivers?q=` + `/vehicles?q=` fan-out any more — a failure surfaces as the
 * palette's error line.
 */
export async function fetchGlobalSearch(
  q: string,
  scope: SearchScope,
  signal?: AbortSignal,
): Promise<GlobalSearchResponse> {
  const res = await client.get<Partial<GlobalSearchResponse>>(endpoints.search.root, {
    params: { q, limit: SEARCH_RESULT_LIMIT },
    signal,
  });
  return {
    q: res.q ?? q,
    drivers: scope.drivers ? (res.drivers ?? []) : [],
    vehicles: scope.vehicles ? (res.vehicles ?? []) : [],
    ...(res.scope ? { scope: res.scope } : {}),
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
