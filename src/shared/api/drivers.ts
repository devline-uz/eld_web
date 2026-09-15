// owner: web-vehicles-drivers — W-06 Drivers, W-07 Driver profile.
//
// `GET /drivers` and `GET /drivers/:id` are real and return the full raw `Driver` row (minus
// `passwordHash`) — richer than `shared/api/types.ts` documents (see web/backend-gaps.md
// "Contract deviations"). That is enough for the CRUD screens, but W-06's roster needs live HOS
// clocks, duty status, unit and open-violation count per driver, and NONE of that exists on
// `Driver` — `GET /drivers/roster` (B-1, shipped 2026-09-14) is the only sane source (58 drivers,
// not 58 requests). Types below were checked against backend `driver-roster.service.ts`.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from './client';
import { endpoints } from './endpoints';
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
    queryFn: () => client.list<DriverRow>(endpoints.drivers.list, params),
    ...typedCachePolicy<OffsetPage<DriverRow>>('list'),
  });
}

export function useDriver(id: string | undefined) {
  return useQuery({
    queryKey: qk.driver(id ?? ''),
    queryFn: () => client.get<DriverRow>(endpoints.drivers.detail(id as string)),
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

export function useDriverRoster(params: DriverRosterParams) {
  return useQuery({
    queryKey: qk.driverRoster(params),
    queryFn: () => client.get<DriverRosterResponse>(endpoints.drivers.roster, { params }),
    ...typedCachePolicy<DriverRosterResponse>('live'),
  });
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
    queryFn: () => client.get<DriverHosResponse>(endpoints.drivers.hos(driverId as string)),
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
