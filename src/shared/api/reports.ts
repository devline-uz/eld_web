// owner: web-reports-transfer — W-12…W-15 Reports and overlay 11.14 Send logs to a safety official.
//
// Every shape below was read off `backend/src/modules/{reports,transfers}` and the LIVE dev API
// (`http://localhost:3002/api`, 2026-09-12), not off the openapi examples, which are wrong twice:
//   • `GET /reports` returns the raw Prisma `Report` row (`requestedById`, `params`, `fileSizeBytes`…).
//   • `GET /transfers` returns the raw Prisma `DataTransfer` row — `outputFileComment`,
//     `rangeStart`/`rangeEnd`, `requestedById`, `createdAt` — not `comment`/`periodFrom`/`sentById`.
//
// Generation is asynchronous (§15): every "generate" call answers `202 { reportId, status }` and the
// row is followed with the named `reportStatus` policy (3 s, stops at READY/FAILED) until the worker
// finishes; `report.ready` on `user:{id}` short-circuits the wait.
//
// Transfers are followed with the named `transferStatus` policy (5 s, stops at the backend's final
// statuses). web/bugs.md WB-028 fixed that set in cache.ts; the local workaround was removed.
import { useMemo } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TRANSFER_TERMINAL_STATUSES } from './cache';
import { client } from './client';
import { endpoints } from './endpoints';
import type { ApiError } from './errors';
import { qk, qkRoot } from './queryKeys';
import { typedCachePolicy } from './queryPolicy';
import type { OffsetPage } from './types';
import { useDriversList } from './drivers';
import type { DefectRow, DvirRow } from './dvir';
import type { DriverRow, VehicleRow } from './vehicles';
import { useLogRange, type UnidentifiedListResponse } from './hosLogs';

/* ------------------------------------------------------------------ reports */

/** `ReportType` as the backend enum spells it. `RODS` / `IDLE_FUEL` are B-14 (shipped 2026-09-24). */
export type ReportType = 'IFTA' | 'ACTIVITY' | 'DVIR' | 'FMCSA_PACK' | 'UNIDENTIFIED' | 'SAFETY' | 'RODS' | 'IDLE_FUEL';
/** Accepted by `POST /reports/generate` / schedules (`GENERATABLE_REPORT_TYPES`, backend reports.dto.ts). */
export type GeneratableReportType = 'IFTA' | 'ACTIVITY' | 'DVIR' | 'FMCSA_PACK' | 'RODS' | 'IDLE_FUEL';

/** B-48 — formats the server accepts per type (`REPORT_TYPE_FORMATS`); anything else is a 422. */
export const REPORT_TYPE_FORMATS: Record<GeneratableReportType, readonly ReportFormat[]> = {
  IFTA: ['CSV', 'PDF'],
  ACTIVITY: ['CSV', 'PDF'],
  DVIR: ['CSV', 'PDF'],
  FMCSA_PACK: ['PDF'],
  RODS: ['PDF'],
  IDLE_FUEL: ['PDF'],
};

/** B-48 — FMCSA pack sections (`FMCSA_PACK_SECTIONS`). Omit `include` for the full pack. */
export type FmcsaPackSection = 'RODS' | 'UNIDENTIFIED' | 'EDITS' | 'ELD_ID' | 'DVIR' | 'MALFUNCTIONS';

/** B-48 — a schedule's `params.window`: resolved to a concrete from/to on every run. */
export type ReportWindow = 'PREVIOUS_WEEK' | 'PREVIOUS_MONTH' | 'PREVIOUS_QUARTER';
export type ReportStatus = 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED';
export type ReportFormat = 'CSV' | 'PDF' | 'XLSX';

export interface ReportRow {
  id: string;
  type: ReportType;
  format: ReportFormat;
  params: Record<string, unknown>;
  status: ReportStatus;
  fileKey: string | null;
  fileSizeBytes: number | null;
  rowCount: number | null;
  error: string | null;
  requestedById: string;
  requestedAt: string;
  completedAt: string | null;
  expiresAt: string | null;
}

export interface ReportQueued {
  reportId: string;
  status: ReportStatus;
}

export interface ReportDownload {
  downloadUrl: string;
  expiresAt: string;
  fileName: string;
}

export interface ReportListParams {
  [key: string]: string | number | undefined;
  page?: number;
  limit?: number;
  type?: GeneratableReportType;
  status?: ReportStatus;
}

export const isReportPending = (status: ReportStatus | undefined): boolean =>
  status === 'QUEUED' || status === 'RUNNING';

/** `Recently generated` — report list, 60 s stale (§6.4 "audit log, report list"). */
export function useReportsList(params: ReportListParams) {
  return useQuery({
    queryKey: qk.reports(params),
    queryFn: ({ signal }) => client.list<ReportRow>(endpoints.reports.list, params, { signal }),
    ...typedCachePolicy<OffsetPage<ReportRow>>('slowList'),
  });
}

/** One report job, polled at 3 s while QUEUED/RUNNING and never again once READY/FAILED. */
export function useReport(id: string | null | undefined) {
  return useQuery({
    queryKey: qk.report(id ?? ''),
    queryFn: ({ signal }) => client.get<ReportRow>(endpoints.reports.detail(id as string), { signal }),
    enabled: Boolean(id),
    ...typedCachePolicy<ReportRow>('reportStatus'),
  });
}

export type GenerateReportInput =
  | { type: 'IFTA'; format: ReportFormat; params: { quarter: string; vehicleId?: string } }
  | { type: 'ACTIVITY'; format: ReportFormat; params: { from: string; to: string; driverId?: string } }
  | { type: 'DVIR'; format: ReportFormat; params: { from: string; to: string; vehicleId?: string } }
  | {
      type: 'FMCSA_PACK';
      format: ReportFormat;
      params: { from: string; to: string; driverId?: string; vehicleId?: string; include?: FmcsaPackSection[] };
    }
  /** B-14 — printable log sheets; PDF only, range ≤ 62 days. */
  | { type: 'RODS'; format: 'PDF'; params: { from: string; to: string; driverId?: string } }
  /** B-14 — idle time / fuel waste from telemetry; PDF only. */
  | { type: 'IDLE_FUEL'; format: 'PDF'; params: { from: string; to: string; driverId?: string; vehicleId?: string } };

/** `POST /reports/generate` — `reports` FULL. The server decides which formats exist (422 otherwise). */
export function useGenerateReport() {
  const queryClient = useQueryClient();
  return useMutation<ReportQueued, ApiError, GenerateReportInput>({
    mutationFn: (input) => client.post<ReportQueued>(endpoints.reports.generate, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qkRoot.reports }),
  });
}

/**
 * The `GET /reports/{ifta,activity,dvir,fmcsa-pack}` shortcuts queue a job with READ permission
 * (`reports` READ; the pack needs `reportsTransfer` READ) — this is what `Export CSV` uses, so the
 * read-only roles keep their export (§12.2).
 */
export type QueueShortcutInput =
  | { kind: 'ifta'; params: { quarter: string } }
  | { kind: 'activity'; params: { from: string; to: string; driverId?: string } }
  | { kind: 'dvir'; params: { from: string; to: string; vehicleId?: string } }
  | {
      kind: 'fmcsaPack';
      /** B-48 — `vehicleId` narrows WHICH drivers are in the pack; `include` limits the sections
       * (sent as repeated `include=` params). */
      params: { from: string; to: string; driverId?: string; vehicleId?: string; include?: FmcsaPackSection[] };
    };

export function useQueueReport() {
  const queryClient = useQueryClient();
  return useMutation<ReportQueued, ApiError, QueueShortcutInput>({
    mutationFn: ({ kind, params }) => client.get<ReportQueued>(endpoints.reports[kind], { params }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qkRoot.reports }),
  });
}

/** One-shot read for the `report.ready` handler (the event carries no size). */
export function fetchReport(id: string): Promise<ReportRow> {
  return client.get<ReportRow>(endpoints.reports.detail(id));
}

/** A fresh 7-day presigned URL, fetched at click time — never cached, never logged (§17). */
export function fetchReportDownload(id: string): Promise<ReportDownload> {
  return client.get<ReportDownload>(endpoints.reports.download(id));
}

export interface ReportScheduleRow {
  id: string;
  reportType: GeneratableReportType;
  format: ReportFormat;
  params: Record<string, unknown>;
  cron: string;
  timezone: string;
  recipients: string[];
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export interface CreateScheduleInput {
  reportType: GeneratableReportType;
  format: ReportFormat;
  /** `{ window: ReportWindow }` (B-48) for a rolling period, or fixed `from`/`to`. */
  params: Record<string, unknown> & { window?: ReportWindow };
  cron: string;
  timezone: string;
  /** Q-2 — schedules deliver by email only; there is no SMS field on the DTO. */
  recipients: string[];
  enabled: boolean;
}

export function useCreateReportSchedule() {
  const queryClient = useQueryClient();
  return useMutation<ReportScheduleRow, ApiError, CreateScheduleInput>({
    mutationFn: (input) => client.post<ReportScheduleRow>(endpoints.reports.schedules, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.reportSchedules() }),
  });
}

/* ------------------------------------------------------------------ IFTA summary (B-46) */

// `GET /reports/ifta/summary?quarter=YYYY-Qn` — shape per web/backend-gaps.md B-46. Miles and
// gallons arrive imperial and pre-rounded; fuel / tax fields are `null` when the carrier has no
// fuel receipts or tax rates, and render as `—`, never `0`. `totals` mirrors one row without the
// jurisdiction (web/decisions.md WD-068).

export interface IftaKpis {
  totalMiles: number;
  taxableMiles: number;
  taxablePct: number | null;
  fuelGal: number | null;
  receiptCount: number | null;
  fleetMpg: number | null;
  fleetMpgPrev: number | null;
}

export interface IftaJurisdictionTotals {
  totalMiles: number;
  taxableMiles: number;
  fuelGal: number | null;
  mpg: number | null;
  taxDueUsd: number | null;
}

export interface IftaJurisdictionRow extends IftaJurisdictionTotals {
  jurisdiction: string;
}

export interface IftaSummary {
  quarter: string;
  unitCount: number;
  kpis: IftaKpis;
  rows: IftaJurisdictionRow[];
  totals: IftaJurisdictionTotals;
}

/** W-12 KPI row + `Miles by jurisdiction` — a report read, 60 s stale like the report list. */
export function useIftaSummary(quarter: string) {
  const params = { quarter };
  return useQuery({
    queryKey: qk.iftaSummary(params),
    queryFn: ({ signal }) => client.get<IftaSummary>(endpoints.reports.iftaSummary, { params, signal }),
    enabled: /^\d{4}-Q[1-4]$/.test(quarter),
    ...typedCachePolicy<IftaSummary>('slowList'),
  });
}

/* ------------------------------------------------------------------ transfers */

export type TransferMethod = 'WEB_SERVICES' | 'EMAIL';
export type TransferStatus = 'QUEUED' | 'TEST_ONLY' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'FAILED';
export type ErodsMode = 'TEST' | 'PRODUCTION';

/** Backend `TransferStatus` values after which nothing changes the row — the shared cache.ts set. */
export const TRANSFER_FINAL_STATUSES: readonly TransferStatus[] = TRANSFER_TERMINAL_STATUSES;

export interface TransferRow {
  id: string;
  driverId: string;
  method: TransferMethod;
  /** RODS day (date-only) in the driver's home-terminal zone. */
  rangeStart: string;
  rangeEnd: string;
  outputFileComment: string;
  fileName: string;
  fileSizeBytes: number;
  encrypted: boolean;
  status: TransferStatus;
  erodsMode: ErodsMode;
  referenceId: string | null;
  responseCode: string | null;
  responseBody: string | null;
  attempts: number;
  requestedById: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface TransferWarning {
  code: string;
  level: 'warning' | 'error';
  message: string;
  details?: Record<string, unknown>;
}

export interface CreateTransferResponse {
  transfer: TransferRow;
  warnings: TransferWarning[];
  counts: Record<string, number>;
}

export interface CreateTransferInput {
  driverId: string;
  method: TransferMethod;
  rangeStart: string;
  rangeEnd: string;
  outputFileComment: string;
  recipient?: string;
}

export interface TransferListParams {
  [key: string]: string | number | undefined;
  page?: number;
  limit?: number;
  driverId?: string;
}

export function useTransfersList(params: TransferListParams, enabled = true) {
  return useQuery({
    queryKey: qk.transfers(params),
    queryFn: ({ signal }) => client.list<TransferRow>(endpoints.transfers.list, params, { signal }),
    enabled,
    ...typedCachePolicy<OffsetPage<TransferRow>>('list'),
  });
}

/** One transfer, polled at 5 s until final (named `transferStatus` policy). */
export function useTransfer(id: string | null | undefined) {
  return useQuery({
    queryKey: qk.transfer(id ?? ''),
    queryFn: ({ signal }) => client.get<TransferRow>(endpoints.transfers.detail(id as string), { signal }),
    enabled: Boolean(id),
    ...typedCachePolicy<TransferRow>('transferStatus'),
  });
}

/**
 * `POST /transfers` — `reportsTransfer` FULL. Compliance write: no optimistic update, no retry.
 * Warnings (`UNCERTIFIED_LOGS`, `UNRESOLVED_UNIDENTIFIED`, `ACTIVE_MALFUNCTION`, `ERODS_TEST_MODE`)
 * come back on the 2xx body and are shown verbatim; refusals come back as 422 and are shown verbatim.
 */
export function useCreateTransfer() {
  const queryClient = useQueryClient();
  return useMutation<CreateTransferResponse, ApiError, CreateTransferInput>({
    mutationFn: (input) => client.post<CreateTransferResponse>(endpoints.transfers.create, input),
    onSuccess: (result) => {
      queryClient.setQueryData(qk.transfer(result.transfer.id), result.transfer);
      return queryClient.invalidateQueries({ queryKey: qkRoot.transfers });
    },
  });
}

/** The Appendix A CSV itself (not enveloped) — saved under its §4.8.2.2 file name. */
export function downloadTransferFile(id: string): Promise<Blob> {
  return client.blob(endpoints.transfers.download(id), { headers: { Accept: 'text/csv' } });
}

/* ------------------------------------------------------------------ carrier transfer config */

/** B-45 (shipped) — `GET /carrier/transfer-config`: gated `reports` READ, so FLEET_MANAGER (no
 * `carrierSettings`) reads it too. Prefer this over `useCarrierTransferConfig` for erodsMode/timezone. */
export function useTransferConfig(enabled = true) {
  return useQuery({
    queryKey: qk.carrierTransferConfig,
    queryFn: ({ signal }) => client.get<Required<Omit<CarrierTransferConfig, 'name'>>>(endpoints.carrier.transferConfig, { signal }),
    enabled,
    ...typedCachePolicy<Required<Omit<CarrierTransferConfig, 'name'>>>('reference'),
  });
}

export interface CarrierTransferConfig {
  name?: string;
  timezone?: string;
  eldIdentifier?: string;
  eldRegistrationId?: string | null;
  erodsMode?: ErodsMode;
}

/**
 * `GET /carrier` needs `carrierSettings` READ, which FLEET_MANAGER does not have (gap B-45), so the
 * query only runs for a role that can read it. Callers treat a missing `erodsMode` as TEST — the
 * banner is never hidden on a guess (web/decisions.md WD-038).
 */
export function useCarrierTransferConfig(enabled: boolean) {
  return useQuery({
    queryKey: qk.carrier,
    queryFn: ({ signal }) => client.get<CarrierTransferConfig>(endpoints.carrier.root, { signal }),
    enabled,
    ...typedCachePolicy<CarrierTransferConfig>('reference'),
  });
}

/* ------------------------------------------------------------------ W-13 activity summary (B-46) */

export interface ActivitySummaryKpis {
  drivingSec: number;
  /** Change vs the previous period of equal length; `null` when there is no prior data (rendered `—`). */
  drivingDeltaPct: number | null;
  onDutySec: number;
  distanceMi: number;
  violations: number;
  /** Signed count vs the previous period; `null` when there is no prior data (rendered `—`). */
  violationsDelta: number | null;
}

export interface ActivitySummaryItem {
  driverId: string;
  /** Backend format `Last, First` (SQL `lastName || ', ' || firstName`); the screen draws `First Last`. */
  name: string;
  /** Persisted RODS days (`DailyLog` rows) in the range — the drawn `DAYS` column. */
  days: number;
  offSec: number;
  sbSec: number;
  drivingSec: number;
  onSec: number;
  distanceMi: number;
  violations: number;
  /** Certified days among `days` (the drawn `CERTIFIED c / d` column). */
  certifiedDays: number;
}

/** `GET /reports/activity/summary` — web/backend-gaps.md B-46, enveloped like every endpoint. */
export interface ActivitySummary extends OffsetPage<ActivitySummaryItem> {
  kpis: ActivitySummaryKpis;
}

export interface ActivitySummaryParams {
  [key: string]: string | number | undefined;
  from: string;
  to: string;
  page: number;
  limit: number;
  /** Whitelisted `name|days|offSec|sbSec|drivingSec|onSec|distanceMi|violations|certifiedDays:asc|desc`. */
  sort?: string;
  terminal?: string;
  /** Without it the backend includes every driver status with a log in range. */
  status?: 'ACTIVE' | 'INACTIVE' | 'TERMINATED';
}

/**
 * W-13 KPIs + one page of per-driver duty totals in ONE request — the RODS engine's own totals,
 * aggregated server-side. Replaces the per-driver `GET /logs/:driverId/range` fan-out (web/bugs.md
 * WB-048, web/decisions.md WD-070 supersedes WD-039). 60 s stale like the other report reads.
 */
export function useActivitySummary(params: ActivitySummaryParams, enabled = true) {
  return useQuery({
    queryKey: qk.activitySummary(params),
    queryFn: ({ signal }) =>
      client.get<ActivitySummary>(endpoints.reports.activitySummary, { params, signal }),
    enabled: enabled && Boolean(params.from) && Boolean(params.to),
    placeholderData: keepPreviousData,
    ...typedCachePolicy<ActivitySummary>('slowList'),
  });
}

/* ------------------------------------------------------------------ W-15 pack RODS counts */

/** Fleet rows read for the pack KPIs — `client.list()` walks 200-row pages sequentially above 200. */
const PACK_FLEET_ROWS = 1_000;

export interface PackRodsCounts {
  /** One RODS per driver per day in the range — what the pack contains. */
  dailyLogs: number;
  drivers: number;
  /** Days not certified — `uncertifiedDayCount` = days in range − certified days (pre-send check). */
  uncertified: number;
  uncertifiedDrivers: number;
}

/**
 * W-15 `Daily logs included` / `Uncertified logs`, with no per-driver fan-out (WB-048, WD-070):
 * • one driver picked → that driver's `GET /logs/:driverId/range` (exactly one request, exact counts);
 * • all drivers → `GET /reports/activity/summary` (one request up to 200 drivers).
 * `rangeDays` is the inclusive day count of the range, computed by the caller in the carrier zone.
 */
export function usePackRodsCounts(from: string, to: string, driverId: string | null, rangeDays: number) {
  const single = useLogRange(driverId ?? undefined, from, to);
  // ACTIVE drivers, as `FmcsaPackGenerator` iterates; without `status` the backend returns every status.
  const fleetParams = { from, to, page: 1, limit: PACK_FLEET_ROWS, sort: 'name:asc', status: 'ACTIVE' };
  const fleet = useQuery({
    queryKey: qk.activitySummary(fleetParams),
    queryFn: ({ signal }) =>
      client.list<ActivitySummaryItem>(endpoints.reports.activitySummary, fleetParams, { signal }),
    enabled: !driverId && Boolean(from) && Boolean(to),
    ...typedCachePolicy<OffsetPage<ActivitySummaryItem>>('slowList'),
  });
  const source = driverId ? single : fleet;

  const counts = useMemo((): PackRodsCounts => {
    if (driverId) {
      const days = single.data?.days ?? [];
      // WB-095 — the same definition as the fleet branch and the backend's `uncertifiedDayCount`:
      // days in range − certified DailyLogs. A day with no persisted log is uncertified too, so
      // counting only persisted-but-uncertified logs said `0` while `POST /transfers` refused.
      const certifiedDays = days.filter((d) => d.certified).length;
      const uncertified = single.data ? Math.max(0, rangeDays - certifiedDays) : 0;
      return { dailyLogs: days.length, drivers: single.data ? 1 : 0, uncertified, uncertifiedDrivers: uncertified > 0 ? 1 : 0 };
    }
    const items = fleet.data?.items ?? [];
    // Exactly the backend pre-send count, `uncertifiedDayCount` = days in range − certified DailyLogs
    // (transfers/snapshot.ts): a day with no persisted log is uncertified too (WD-070).
    const perDriver = items.map((i) => Math.max(0, rangeDays - i.certifiedDays));
    return {
      // `days` = persisted DailyLog rows per driver (verified on the live API 2026-09-15).
      dailyLogs: items.reduce((acc, i) => acc + i.days, 0),
      drivers: items.length,
      uncertified: perDriver.reduce((acc, n) => acc + n, 0),
      uncertifiedDrivers: perDriver.filter((n) => n > 0).length,
    };
  }, [driverId, single.data, fleet.data, rangeDays]);

  const error = (source.error ?? null) as ApiError | null;
  return {
    counts,
    isLoading: source.isLoading,
    isError: Boolean(error),
    error,
    refetch: () => void source.refetch(),
  };
}

/* ------------------------------------------------------------------ W-14 DVIR report rows */

/** Rows read for the client-side joins (drivers, units, DVIRs, defects) — `client.list()` pages above 200. */
const JOIN_ROWS = 200;

/** Drivers for pickers, terminal options and joins. */
export function useReportDrivers() {
  return useDriversList({ limit: JOIN_ROWS });
}

export interface DvirReportRow extends DvirRow {
  driver: DriverRow | null;
  vehicle: VehicleRow | null;
  defects: DefectRow[];
}

/** Pages of 200 walked back per list before the window is declared incomplete (≈ 2 000 DVIRs). */
export const DVIR_REPORT_MAX_PAGES = 10;

interface WindowPage<T> extends OffsetPage<T> {
  /** `true` once the walk reached a row older than the window start or ran out of rows. */
  complete: boolean;
}

/**
 * Walks a newest-first list 200 rows at a time until the oldest row read is older than `sinceMs`,
 * the list ends, or `DVIR_REPORT_MAX_PAGES` is reached (then `complete: false`).
 */
async function walkBackTo<T>(
  path: string,
  params: Record<string, string | number>,
  timeOf: (row: T) => string,
  sinceMs: number,
  signal: AbortSignal,
): Promise<WindowPage<T>> {
  const items: T[] = [];
  let total = 0;
  for (let page = 1; page <= DVIR_REPORT_MAX_PAGES; page += 1) {
    const chunk = await client.list<T>(path, { ...params, page, limit: JOIN_ROWS }, { signal });
    items.push(...chunk.items);
    total = chunk.total;
    const oldest = chunk.items[chunk.items.length - 1];
    if (!oldest || page >= chunk.totalPages || Date.parse(timeOf(oldest)) < sinceMs) {
      return { items, total, page: 1, limit: items.length, totalPages: 1, complete: true };
    }
  }
  return { items, total, page: 1, limit: items.length, totalPages: 1, complete: false };
}

/**
 * ⛔ Gap B-47 — `GET /dvir` takes no `from`/`to`. The newest-first list is walked back page by page
 * until it passes `from` (one day of slack for any carrier zone), so a range is never judged on the
 * newest 200 alone (web/bugs.md WB-096); defects are walked back the same way for the join. Past
 * `DVIR_REPORT_MAX_PAGES` the result says so (`complete: false`) and the caller labels the counts
 * as a lower bound. The range itself is applied to `submittedAt` in the carrier zone by the caller.
 */
export function useDvirReportRows(vehicleId: string | undefined, from: string) {
  const sinceMs = Date.parse(`${from}T00:00:00Z`) - 86_400_000;
  const scope: Record<string, string> = vehicleId ? { vehicleId } : {};
  const dvirParams = { sort: 'submittedAt:desc', ...scope };
  const defectParams = { sort: 'createdAt:desc', ...scope };
  const dvirs = useQuery({
    queryKey: qk.dvirs({ ...dvirParams, reportSince: from }),
    queryFn: ({ signal }) =>
      walkBackTo<DvirRow>(endpoints.dvir.list, dvirParams, (r) => r.submittedAt, sinceMs, signal),
    enabled: Number.isFinite(sinceMs),
    ...typedCachePolicy<WindowPage<DvirRow>>('list'),
  });
  const defects = useQuery({
    queryKey: qk.defects({ ...defectParams, reportSince: from }),
    queryFn: ({ signal }) =>
      walkBackTo<DefectRow>(endpoints.defects.list, defectParams, (d) => d.createdAt, sinceMs, signal),
    enabled: Number.isFinite(sinceMs),
    ...typedCachePolicy<WindowPage<DefectRow>>('list'),
  });
  const drivers = useReportDrivers();
  const vehicles = useReportVehicles();

  const rows = useMemo((): DvirReportRow[] => {
    const driverById = new Map((drivers.data?.items ?? []).map((d) => [d.id, d]));
    const vehicleById = new Map((vehicles.data?.items ?? []).map((v) => [v.id, v]));
    const defectsByDvir = new Map<string, DefectRow[]>();
    for (const defect of defects.data?.items ?? []) {
      defectsByDvir.set(defect.dvirId, [...(defectsByDvir.get(defect.dvirId) ?? []), defect]);
    }
    return (dvirs.data?.items ?? []).map((d) => ({
      ...d,
      driver: driverById.get(d.driverId) ?? null,
      vehicle: vehicleById.get(d.vehicleId) ?? null,
      defects: defectsByDvir.get(d.id) ?? [],
    }));
  }, [dvirs.data, defects.data, drivers.data, vehicles.data]);

  const error = (dvirs.error ?? defects.error ?? null) as ApiError | null;
  return {
    rows,
    total: dvirs.data?.total ?? 0,
    /** `false` when the walk stopped at `DVIR_REPORT_MAX_PAGES` before reaching `from`. */
    complete: (dvirs.data?.complete ?? true) && (defects.data?.complete ?? true),
    isLoading: dvirs.isLoading || defects.isLoading || drivers.isLoading || vehicles.isLoading,
    isError: Boolean(error),
    error,
    refetch: () => {
      void dvirs.refetch();
      void defects.refetch();
    },
  };
}

/** Units for the `All units ▾` filters and the `· 69 units` subtitle. */
export function useReportVehicles() {
  const params = { limit: JOIN_ROWS };
  return useQuery({
    queryKey: qk.vehicles(params),
    queryFn: ({ signal }) => client.list<VehicleRow>(endpoints.vehicles.list, params, { signal }),
    ...typedCachePolicy<OffsetPage<VehicleRow>>('reference'),
  });
}

/** `Unassigned segments` — PENDING unidentified driving touching the range. */
export function usePendingUnassignedCount(from: string, to: string, enabled = true) {
  const params = { status: 'PENDING', from, to, limit: 1 } as const;
  return useQuery({
    queryKey: qk.unidentified(params),
    queryFn: ({ signal }) =>
      client.get<UnidentifiedListResponse>(endpoints.unidentified.list, { params, signal }),
    enabled: enabled && Boolean(from) && Boolean(to),
    ...typedCachePolicy<UnidentifiedListResponse>('list'),
  });
}
