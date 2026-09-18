// owner: web-vehicles-drivers — W-06 Drivers, W-07 Driver profile.
//
// `GET /drivers` and `GET /drivers/:id` are real and return the full raw `Driver` row (minus
// `passwordHash`) — richer than `shared/api/types.ts` documents (see web/backend-gaps.md
// "Contract deviations"). That is enough for the CRUD screens, but W-06's roster needs live HOS
// clocks, duty status, unit and open-violation count per driver, and NONE of that exists on
// `Driver` — `GET /drivers/roster` (B-1, shipped 2026-09-14) is the only sane source (58 drivers,
// not 58 requests). Types below were checked against backend `driver-roster.service.ts`.
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from './client';
import { endpoints } from './endpoints';
import { FILTER_WINDOW } from './lookups';
import { pagePolicy, type PageQueryOptions } from './paging';
import { qk, qkRoot } from './queryKeys';
import { typedCachePolicy } from './queryPolicy';
import type { OffsetPage } from './types';
import type { DriverRow } from './vehicles';

export type { DriverRow } from './vehicles';

export interface DriverListParams {
  [key: string]: string | number | boolean | undefined;
  page?: number;
  limit?: number;
  sort?: string;
  q?: string;
  status?: string;
}

export function useDriversList(params: DriverListParams) {
  return useQuery({
    queryKey: qk.drivers(params),
    queryFn: ({ signal }) => client.list<DriverRow>(endpoints.drivers.list, params, { signal }),
    ...typedCachePolicy<OffsetPage<DriverRow>>('list'),
  });
}

export function useDriver(id: string | undefined) {
  return useQuery({
    queryKey: qk.driver(id ?? ''),
    queryFn: ({ signal }) => client.get<DriverRow>(endpoints.drivers.detail(id as string), { signal }),
    enabled: Boolean(id),
    ...typedCachePolicy<DriverRow>('reference'),
  });
}

/** B-1 `GET /drivers/roster` — backend `DriverRosterEntry` (`driver-roster.service.ts`), field for
 * field. The page is server-paginated, so filters the backend understands must go to the server. */
export interface DriverRosterEntry {
  driver: Pick<
    DriverRow,
    | 'id'
    | 'username'
    | 'firstName'
    | 'lastName'
    | 'homeTerminalName'
    | 'appVersion'
    | 'email'
    // 11.23 "exemptions" filter group (web/tz.md §11.23) needs the same exception flags
    // `GET /drivers` already returns on the raw `Driver` row — a roster projection is the
    // reasonable place for them too, since B-1 does not pin the driver sub-shape further.
    | 'eldExempt'
    | 'allowPersonalConveyance'
    | 'allowYardMove'
    | 'shortHaulException'
    | 'splitSleeperEnabled'
  >;
  dutyStatus: 'DRIVING' | 'ON_DUTY' | 'SLEEPER' | 'OFF_DUTY';
  unit: { id: string; unitNumber: string } | null;
  hos: { driveRemainingSec: number; shiftRemainingSec: number; cycleRemainingSec: number };
  openViolations: number;
  emailVerified: boolean | null; // ⛔ GAP B-31 — no verification state exists yet; always null today.
}

export interface DriverRosterResponse {
  items: DriverRosterEntry[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Server-side roster filters (B-1 + B-55): `terminal` exact name, `exempt` = `eldExempt`. */
export interface DriverRosterParams extends DriverListParams {
  terminal?: string;
  hasOpenViolation?: 'true' | 'false';
  exempt?: 'true' | 'false';
}

export function useDriverRoster(params: DriverRosterParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.driverRoster(params),
    queryFn: ({ signal }) => client.get<DriverRosterResponse>(endpoints.drivers.roster, { params, signal }),
    ...typedCachePolicy<DriverRosterResponse>('live'),
    enabled: options.enabled ?? true,
  });
}

/**
 * The bounded newest-first roster window (`FILTER_WINDOW` rows) — same trade-off
 * `vehiclesLookupQuery` documents for W-03/B-54. Used only while a client-only 11.23 group (the
 * duty-status `status` field, or an exemption other than `eldExempt`) or the ON_DUTY/OFF_DUTY
 * segment tab is active: none of those have a server param on `GET /drivers/roster` (extends
 * B-55, web/backend-gaps.md). `q`/`terminal`/`hasOpenViolation`/`exempt` still narrow the window
 * fetch itself since B-55 already ships real support for them — only the remaining groups run in
 * memory against the window. Matches outside the window are not shown, as recorded per gap.
 */
export const driverRosterWindowQuery = (
  serverFilters: Omit<DriverRosterParams, 'page' | 'limit'>,
): PageQueryOptions<DriverRosterEntry> => ({
  queryKey: qk.driverRoster({ ...serverFilters, limit: FILTER_WINDOW }),
  queryFn: ({ signal }) => client.list<DriverRosterEntry>(endpoints.drivers.roster, { ...serverFilters, limit: FILTER_WINDOW }, { signal }),
  ...pagePolicy('reference'),
});

export function useDriverRosterWindow(serverFilters: Omit<DriverRosterParams, 'page' | 'limit'>, enabled = true) {
  return useQuery({ ...driverRosterWindowQuery(serverFilters), enabled });
}

/** Rows the segment counters read in one pass; `client.list` walks the API's 200-row maximum. */
export const ROSTER_COUNT_LIMIT = 500;

export interface DriverRosterCounts {
  all: number;
  onDuty: number;
  offDuty: number;
  violations: number;
  isLoading: boolean;
}

/**
 * `All · On duty · Off duty · Violations` over the **whole** roster (the server filters in
 * `params` still apply), not over the page the table happens to be showing — W-06 used to count
 * the 10 loaded rows and render `All 10` next to a `115 drivers` headline.
 *
 * `useVehicleCounts`' trick — one `limit: 1` request per slice, read `total` — cannot answer this
 * one: B-1/B-55 give `GET /drivers/roster` only `page`, `limit`, `sort`, `q`, `status`
 * (`Driver.status`, not duty), `terminal`, `hasOpenViolation` and `exempt`. There is no duty-status
 * param and no `counts` block, so `On duty`/`Off duty` have to be counted client-side; one paged
 * read then answers all four from a single consistent snapshot (`all` = `onDuty` + `offDuty`)
 * instead of mixing four differently-timed requests.
 *
 * ⛔ Past `ROSTER_COUNT_LIMIT` drivers the duty split and the violation count describe the loaded
 * window while `all` stays the server's `total` (same trade-off as `FILTER_WINDOW` in
 * `shared/api/lookups.ts`). A `dutyStatus` query param — or a `counts` block on B-1 — is what
 * would make it exact for a roster that big.
 */
export function useDriverRosterCounts(params: DriverRosterParams = {}): DriverRosterCounts {
  const countParams: DriverRosterParams = { ...params, page: 1, limit: ROSTER_COUNT_LIMIT };
  const query = useQuery({
    queryKey: qk.driverRoster(countParams),
    queryFn: ({ signal }) => client.list<DriverRosterEntry>(endpoints.drivers.roster, countParams, { signal }),
    ...typedCachePolicy<OffsetPage<DriverRosterEntry>>('live'),
  });
  return useMemo(() => {
    const items = query.data?.items ?? [];
    const offDuty = items.filter((r) => r.dutyStatus === 'OFF_DUTY').length;
    return {
      all: query.data?.total ?? items.length,
      onDuty: items.length - offDuty,
      offDuty,
      violations: items.filter((r) => r.openViolations > 0).length,
      isLoading: query.isLoading,
    };
  }, [query.data, query.isLoading]);
}

/** B-2 `GET /drivers/:id/hos` — backend `DriverHosClocks` (`driver-roster.service.ts`). */
export interface DriverHosResponse {
  driveRemainingSec: number;
  shiftRemainingSec: number;
  cycleRemainingSec: number;
  breakInSec: number;
  onDutySince: string | null;
  cycleLimitSec: number;
  shiftLimitSec: number;
  driveLimitSec: number;
  breakLimitSec: number;
  dutyStatus: DriverRosterEntry['dutyStatus'];
  statusSince: string;
  computedAt: string;
}

export function useDriverHos(driverId: string | undefined) {
  return useQuery({
    queryKey: qk.driverHos(driverId ?? ''),
    queryFn: ({ signal }) => client.get<DriverHosResponse>(endpoints.drivers.hos(driverId as string), { signal }),
    enabled: Boolean(driverId),
    ...typedCachePolicy<DriverHosResponse>('hosDay'),
  });
}

/* ---------------------------------------------------------------------- mutations */

export interface CreateDriverPayload {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  email: string;
  phone?: string;
  cdlNumber: string;
  cdlState: string;
  homeTerminalName: string;
  homeTerminalTimezone: string;
  fleetManagerId?: string;
  assignedVehicleId?: string;
  allowPersonalConveyance?: boolean;
  allowYardMove?: boolean;
  adverseDrivingEnabled?: boolean;
  shortHaulException?: boolean;
  splitSleeperEnabled?: boolean;
  eldExempt?: boolean;
  eldExemptReason?: string;
}

export function useCreateDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDriverPayload) => client.post<DriverRow>(endpoints.drivers.create, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.drivers });
    },
  });
}

export function useUpdateDriver(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CreateDriverPayload> & { status?: string }) =>
      client.patch<DriverRow>(endpoints.drivers.update(id), payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.drivers });
      void queryClient.invalidateQueries({ queryKey: qk.driver(id) });
    },
  });
}

export function useDeactivateDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.patch<DriverRow>(endpoints.drivers.update(id), { status: 'INACTIVE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.drivers });
    },
  });
}

export interface DriverImportSummary {
  imported: number;
  updated: number;
  failed: Array<{ index: number; error: string }>;
}

export function useImportDrivers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { drivers: Array<Record<string, unknown>> }) =>
      client.post<DriverImportSummary>(endpoints.drivers.import, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.drivers });
    },
  });
}
