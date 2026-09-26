// owner: web-vehicles-drivers — W-06 Drivers, W-07 Driver profile.
//
// `GET /drivers` and `GET /drivers/:id` are real and return the full raw `Driver` row (minus
// `passwordHash`) — richer than `shared/api/types.ts` documents (see web/backend-gaps.md
// "Contract deviations"). That is enough for the CRUD screens, but W-06's roster needs live HOS
// clocks, duty status, unit and open-violation count per driver, and NONE of that exists on
// `Driver` — `GET /drivers/roster` (B-1, shipped 2026-09-14) is the only sane source (58 drivers,
// not 58 requests). Types below were checked against backend `driver-roster.service.ts`.
import { useMemo } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
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
  /** B-31 shipped — `null` when the driver has no email on file, else the real verified state. */
  emailVerified: boolean | null;
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

/** One B-2 query — shared by `useDriverHos` and `useDriversHosClocks` so both read and write the
 * same `qk.driverHos(id)` entry under the same `hosDay` policy. */
const driverHosQuery = (driverId: string) => ({
  queryKey: qk.driverHos(driverId),
  queryFn: ({ signal }: { signal: AbortSignal }) => client.get<DriverHosResponse>(endpoints.drivers.hos(driverId), { signal }),
  ...typedCachePolicy<DriverHosResponse>('hosDay'),
});

export function useDriverHos(driverId: string | undefined) {
  return useQuery({ ...driverHosQuery(driverId ?? ''), enabled: Boolean(driverId) });
}

/** One picker row's HOS cell: still loading, unavailable (error / no data → `—`), or the clocks. */
export type DriverHosCell =
  | { state: 'loading' }
  | { state: 'missing' }
  | { state: 'ready'; driveRemainingSec: number; cycleRemainingSec: number };

/**
 * HOS clocks for the driver rows a picker renders (`ids`, already bounded by the list `limit`).
 *
 * Bulk source first: `GET /drivers/roster` (B-1) returns the engine clocks for a whole page of
 * drivers in one request. `window` must describe the same page the rows came from (same `q`,
 * `limit`, and the `GET /drivers` default order `registeredAt:desc`) so the two windows line up;
 * rows are joined by driver id. A rendered id the roster page does not contain (a sort tie at the
 * page edge, or a data change between the two reads) falls back to `GET /drivers/:id/hos` (B-2)
 * for that id only. A roster failure leaves every cell `missing` — no 25-request fan-out.
 */
export function useDriversHosClocks(
  ids: readonly string[],
  window: Pick<DriverRosterParams, 'q' | 'limit'>,
): Map<string, DriverHosCell> {
  const roster = useDriverRoster({ ...window, sort: 'registeredAt:desc' }, { enabled: ids.length > 0 });
  const rosterById = useMemo(() => new Map((roster.data?.items ?? []).map((row) => [row.driver.id, row.hos])), [roster.data]);
  const uncovered = roster.isSuccess ? ids.filter((id) => !rosterById.has(id)) : [];
  const fallback = useQueries({ queries: uncovered.map((id) => driverHosQuery(id)) });

  const cells = new Map<string, DriverHosCell>();
  for (const id of ids) {
    if (roster.isPending) {
      cells.set(id, { state: 'loading' });
      continue;
    }
    if (roster.isError) {
      cells.set(id, { state: 'missing' });
      continue;
    }
    const hos = rosterById.get(id) ?? fallback[uncovered.indexOf(id)]?.data;
    const pending = !rosterById.has(id) && fallback[uncovered.indexOf(id)]?.isPending;
    if (pending) cells.set(id, { state: 'loading' });
    else if (hos) cells.set(id, { state: 'ready', driveRemainingSec: hos.driveRemainingSec, cycleRemainingSec: hos.cycleRemainingSec });
    else cells.set(id, { state: 'missing' });
  }
  return cells;
}

/* ---------------------------------------------------------------------- mutations */

export interface CreateDriverPayload {
  firstName: string;
  lastName: string;
  username: string;
  /** Optional since B-82: with `sendInvitation: true` the driver sets it from the emailed code. */
  password?: string;
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
  /** B-82 (shipped) — emails the driver an app invitation (one-time code). Q-2: email only. */
  sendInvitation?: boolean;
}

export function useCreateDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDriverPayload) => client.post<DriverRow>(endpoints.drivers.create, payload),
    onSuccess: (_driver, payload) => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.drivers });
      // A create with a unit changes that unit too: only `drivers` used to be invalidated, so every
      // `vehicles`-keyed query (W-03 page/window, W-04 unit detail, counters) kept the old
      // "Unassigned" state until its own stale time ran out.
      if (payload.assignedVehicleId) {
        void queryClient.invalidateQueries({ queryKey: qkRoot.vehicles });
      }
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
  skipped?: number;
  failed: Array<{ index: number; error: string }>;
}

/** B-69 (shipped) — `ImportDriversOptionsDto`. */
export interface ImportDriversOptions {
  duplicateStrategy?: 'SKIP' | 'UPDATE' | 'CREATE';
  defaultHomeTerminalName?: string;
  sendInvitations?: boolean;
  applyDefaultExemptions?: boolean;
}

export function useImportDrivers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { drivers: Array<Record<string, unknown>>; options?: ImportDriversOptions }) =>
      client.post<DriverImportSummary>(endpoints.drivers.import, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.drivers });
    },
  });
}

/* ---------------------------------------------------------------------- Phase 13 (2026-09-24) */

/** B-81 / B-29 — `emailedTo` is null when the driver has no email: then (and only when the backend
 * runs with `DEV_ECHO_SECRETS`, D-103) `code` is the one-time code the dispatcher reads out. Never
 * log, persist or put `code` in a URL; render it once, in the modal that asked for it. */
export interface DriverOneTimeCodeResult {
  emailedTo: string | null;
  code?: string;
}

/** `POST /drivers/:id/reset-password` — `drivers` FULL, audited. */
export function useResetDriverPassword() {
  return useMutation({
    mutationFn: (driverId: string) => client.post<DriverOneTimeCodeResult>(endpoints.drivers.resetPassword(driverId)),
  });
}

/** `POST /drivers/:id/send-verification` — emails a verification token to `Driver.email`. */
export function useSendDriverVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (driverId: string) => client.post<DriverOneTimeCodeResult>(endpoints.drivers.sendVerification(driverId)),
    onSuccess: (_result, driverId) => {
      void queryClient.invalidateQueries({ queryKey: qk.driver(driverId) });
    },
  });
}

/** `POST /drivers/:id/verify-email` `{ token }` — sets `emailVerifiedAt` (the `Verified` badge). */
export function useVerifyDriverEmail(driverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      client.post<{ id: string; email: string; emailVerifiedAt: string }>(endpoints.drivers.verifyEmail(driverId), { token }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.drivers });
    },
  });
}

/* ---- B-94 driver documents: metadata POST → presigned PUT of the bytes → list refetch */

export type DriverDocumentType = 'CDL' | 'MEDICAL_CARD' | 'MVR' | 'OTHER';
export const DRIVER_DOCUMENT_CONTENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp'] as const;
export type DriverDocumentContentType = (typeof DRIVER_DOCUMENT_CONTENT_TYPES)[number];

export interface DriverDocumentRow {
  id: string;
  type: DriverDocumentType;
  fileName: string;
  expiresAt: string | null;
  uploadedAt: string;
  /** Short-lived presigned GET — open it, never store or log it (§17). */
  url: string;
}

export function useDriverDocuments(driverId: string | undefined) {
  return useQuery({
    queryKey: qk.driverDocuments(driverId ?? ''),
    queryFn: ({ signal }) => client.get<DriverDocumentRow[]>(endpoints.drivers.documents(driverId as string), { signal }),
    enabled: Boolean(driverId),
    // The rows carry presigned URLs: always refetch on mount rather than serve a stale link.
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export interface UploadDriverDocumentInput {
  type: DriverDocumentType;
  file: File;
  expiresAt?: string;
}

/** PUTs the bytes straight to object storage. Not `client.ts`: the URL is foreign (MinIO/S3), it
 * must carry NO bearer token, and its signature binds `Content-Type` + exact length (backend B-091). */
export async function putToPresignedUrl(uploadUrl: string, file: Blob, contentType: string, signal?: AbortSignal): Promise<void> {
  const res = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': contentType }, credentials: 'omit', signal });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
}

/** The whole B-94 upload flow in one mutation: metadata → presigned PUT → invalidate. A failed PUT
 * leaves an empty row behind, so it is deleted before the error is rethrown. */
export function useUploadDriverDocument(driverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ type, file, expiresAt }: UploadDriverDocumentInput) => {
      const created = await client.post<DriverDocumentRow & { uploadUrl: string }>(endpoints.drivers.documents(driverId), {
        type,
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        ...(expiresAt ? { expiresAt } : {}),
      });
      try {
        await putToPresignedUrl(created.uploadUrl, file, file.type);
      } catch (error) {
        await client.delete(endpoints.drivers.document(driverId, created.id)).catch(() => undefined);
        throw error;
      }
      const { uploadUrl: _uploadUrl, ...row } = created;
      return row as DriverDocumentRow;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.driverDocuments(driverId) });
    },
  });
}

export function useDeleteDriverDocument(driverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) => client.delete<{ deleted: boolean }>(endpoints.drivers.document(driverId, docId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.driverDocuments(driverId) });
    },
  });
}
