// owner: web-hos-logs — ⭐ W-08 HOS Logs · Driver log, plus overlays 11.11 / 11.12 / 11.13.
//
// Every type below was read off the LIVE dev API (`http://localhost:3002/api`, 2026-09-12) and
// cross-checked against `backend/src/modules/logs/logs.service.ts` + `rods.ts`, not against
// `backend/tz.md`. Two things the openapi examples get wrong and the code gets right:
//   • `graph[]` segments carry `special: 'NONE' | 'PC' | 'YM'` (rods.ts `RodsSegment`) — the grid
//     needs it to draw personal conveyance / yard move as DASHED lines that do not move the row.
//   • `summary.dayLengthSec` is 82_800 / 86_400 / 90_000 on a DST day (§23). The grid keeps 24
//     columns and measures every coordinate against it.
//
// B-6 — `GET /violations` and `POST /violations/:id/resolve` shipped 2026-09-14. W-08 still reads
// its violation list from the `GET /logs/:driverId` payload; `Resolve` calls the real endpoint.
// Nothing client-side ever *computes* a violation.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from './client';
import { endpoints } from './endpoints';
import { qk, qkRoot } from './queryKeys';
import { typedCachePolicy } from './queryPolicy';

/* ------------------------------------------------------------------ shared vocabulary */

/** §395.8(b) duty statuses as the backend spells them. */
export type RodsDutyStatus = 'OFF' | 'SB' | 'D' | 'ON';
export type SpecialDrivingCategory = 'NONE' | 'PC' | 'YM';

export type ViolationType =
  | 'DRIVING_11'
  | 'SHIFT_14'
  | 'BREAK_30'
  | 'CYCLE_70'
  | 'CYCLE_60'
  | 'FORM_MANNER';
export type ViolationStatus = 'OPEN' | 'RESOLVED' | 'AUTO_CLEARED';

/** §395.8 record status: 1 active · 2 inactive—changed · 3 inactive—change requested · 4 rejected. */
export const RECORD_STATUS = {
  active: 1,
  superseded: 2,
  proposed: 3,
  rejected: 4,
} as const;

/** §395.8 record origin: 1 automatic · 2 driver · 3 carrier · 4 unidentified. */
export const RECORD_ORIGIN = {
  automatic: 1,
  driver: 2,
  carrier: 3,
  unidentified: 4,
} as const;

/* ------------------------------------------------------------------ GET /logs/:driverId */

export interface RodsGraphSegment {
  /** The recorded duty status. */
  status: RodsDutyStatus;
  /** What the segment COUNTS as: PC ⇒ OFF, YM ⇒ ON (§395.1(e), rods.ts). */
  effective: RodsDutyStatus;
  special: SpecialDrivingCategory;
  startAt: string;
  endAt: string;
  durationSec: number;
}

export interface RodsDaySummary {
  date: string;
  timezone: string;
  offDutySec: number;
  sleeperSec: number;
  drivingSec: number;
  onDutySec: number;
  totalDistanceMi: number;
  /** 82_800 / 86_400 / 90_000 — the DST-correct length of this RODS day (§23). */
  dayLengthSec: number;
  certified: boolean;
  certifiedAt: string | null;
  certificationCount: number;
  hasViolation: boolean;
  violationCount: number;
  hasUnassigned: boolean;
  hasEdits: boolean;
}

export interface HosViolation {
  id: string;
  driverId: string;
  dailyLogId: string | null;
  logDate: string;
  type: ViolationType;
  occurredAt: string;
  exceededBySec: number;
  detail: string;
  status: ViolationStatus;
  resolvedAt: string | null;
  resolvedById: string | null;
  resolutionNote: string | null;
}

export interface LogEventView {
  id: string;
  eventType: number;
  eventCode: number;
  eventSequenceId: number;
  eventDateTime: string;
  recordStatus: number;
  recordOrigin: number;
  status: RodsDutyStatus | null;
  locationName: string | null;
  totalVehicleMiles: number | null;
  /** ⛔ Not returned by `toEventView()` today — the `ENGINE HRS` column shows `—` (B-38). */
  totalEngineHours?: number | null;
  annotation: string | null;
  comment: string | null;
  supersedesId: string | null;
  editedById: string | null;
  editorType: 'DRIVER' | 'CARRIER' | 'SYSTEM' | null;
  editReason: string | null;
  vehicleId: string | null;
}

export interface RodsCertification {
  certified: boolean;
  certifiedAt: string | null;
  certifiedById: string | null;
  certifierType: string | null;
  certificationCount: number;
  signatureUrl: string | null;
  /** §9.2 — the log changed after the last signature. */
  recertificationRequired: boolean;
}

export interface LogDayResponse {
  driverId: string;
  date: string;
  timezone: string;
  summary: RodsDaySummary;
  graph: RodsGraphSegment[];
  events: LogEventView[];
  violations: HosViolation[];
  certification: RodsCertification;
}

export interface LogRangeResponse {
  driverId: string;
  from: string;
  to: string;
  days: RodsDaySummary[];
}

export interface LogEventsResponse {
  driverId: string;
  date: string;
  timezone: string;
  /** Includes superseded (2), proposed (3) and rejected (4) records — the audit trail. */
  events: LogEventView[];
}

export function useLogDay(driverId: string | undefined, date: string) {
  return useQuery({
    queryKey: qk.logDay(driverId ?? '', date),
    queryFn: ({ signal }) =>
      client.get<LogDayResponse>(endpoints.logs.day(driverId as string), { params: { date }, signal }),
    enabled: Boolean(driverId) && Boolean(date),
    ...typedCachePolicy<LogDayResponse>('hosDay'),
  });
}

export function useLogRange(driverId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: qk.logRange(driverId ?? '', from, to),
    // client.ts rule 9 — the request is aborted when the last observer unmounts (WB-048).
    queryFn: ({ signal }) =>
      client.get<LogRangeResponse>(endpoints.logs.range(driverId as string), {
        params: { from, to },
        signal,
      }),
    enabled: Boolean(driverId) && Boolean(from) && Boolean(to),
    ...typedCachePolicy<LogRangeResponse>('hosDay'),
  });
}

export function useLogEvents(driverId: string | undefined, date: string) {
  return useQuery({
    queryKey: qk.logEvents(driverId ?? '', date),
    queryFn: ({ signal }) =>
      client.get<LogEventsResponse>(endpoints.logs.events(driverId as string), {
        params: { date },
        signal,
      }),
    enabled: Boolean(driverId) && Boolean(date),
    ...typedCachePolicy<LogEventsResponse>('hosDay'),
  });
}

/* ------------------------------------------------------------------ 11.11 · edit requests */

export interface CreateEditRequestPayload {
  originalEventId: string;
  proposedStatus: RodsDutyStatus;
  proposedStart: string;
  proposedEnd?: string;
  location?: { lat: number; lon: number; name?: string };
  odometerMi?: number;
  engineHours?: number;
  /** 4–60 characters, §395 Appendix A. */
  reason: string;
}

export interface EditRequestResult {
  id: string;
  status: 'PENDING';
  driverId: string;
  originalEventId: string;
  proposedStatus: RodsDutyStatus;
  proposedStart: string;
  proposedEnd: string | null;
  reason: string;
  /** §395.30 — spelled out by the server: the log has NOT changed. */
  applied: false;
}

export function useCreateEditRequest(driverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEditRequestPayload) =>
      client.post<EditRequestResult>(endpoints.logs.createEditRequest(driverId), payload),
    onSuccess: () => {
      // A proposal is inert, but it becomes visible as recordStatus = 3 in the audit trail.
      void queryClient.invalidateQueries({ queryKey: qkRoot.logs });
    },
  });
}

/* ------------------------------------------------------------------ 11.12 · certification */

export interface CertifyResult {
  driverId: string;
  certified: Array<{
    date: string;
    certifiedAt: string;
    certifiedBy: string;
    onBehalf: boolean;
    signatureCount: number;
  }>;
}

/**
 * There is no `certification.*` realtime event (§7.4), so the caller invalidates by hand — that
 * is what this `onSuccess` is.
 */
export function useCertifyLogs(driverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dates: string[]) =>
      client.post<CertifyResult>(endpoints.logs.certify(driverId), { dates }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.logs });
    },
  });
}

/* ------------------------------------------------------------------ 11.13 · unassigned driving */

export interface UnidentifiedSegment {
  id: string;
  vehicleId: string;
  startAt: string;
  endAt: string;
  durationSec: number;
  distanceMi: number;
  startLocation: string | null;
  endLocation: string | null;
  status: 'PENDING' | 'ASSIGNED' | 'REJECTED' | 'ANNOTATED';
  assignedDriverId: string | null;
  assignedById: string | null;
  assignedAt: string | null;
  annotation: string | null;
  fromStoredEvents: boolean;
}

export interface UnidentifiedListResponse {
  items: UnidentifiedSegment[];
  total: number;
  page: number;
  limit?: number;
  totalPages?: number;
}

export interface UnidentifiedListParams {
  [key: string]: string | number | undefined;
  status?: 'PENDING' | 'ASSIGNED' | 'REJECTED' | 'ANNOTATED' | 'ALL';
  vehicleId?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export function useUnidentifiedSegments(params: UnidentifiedListParams, enabled = true) {
  return useQuery({
    queryKey: qk.unidentified(params),
    queryFn: ({ signal }) =>
      client.get<UnidentifiedListResponse>(endpoints.unidentified.list, { params, signal }),
    enabled,
    ...typedCachePolicy<UnidentifiedListResponse>('list'),
  });
}

export type UnidentifiedAction =
  | { kind: 'assign'; id: string; driverId: string; annotation: string }
  | { kind: 'annotate'; id: string; annotation: string }
  | { kind: 'reject'; id: string; reason: string };

/**
 * WB-063 — the actions are posted one by one, so a refusal part-way leaves the earlier ones already
 * written server-side. The hook rethrows the refusal wrapped with the ids that DID succeed, so the
 * modal can say so and never re-post them.
 */
export class UnidentifiedBatchError extends Error {
  constructor(
    readonly error: unknown,
    readonly succeededIds: string[],
    readonly failedId: string,
  ) {
    super(error instanceof Error ? error.message : 'Unidentified segment action failed');
    this.name = 'UnidentifiedBatchError';
  }
}

function postUnidentifiedAction(action: UnidentifiedAction): Promise<UnidentifiedSegment> {
  if (action.kind === 'assign') {
    return client.post<UnidentifiedSegment>(endpoints.unidentified.assign(action.id), {
      driverId: action.driverId,
      annotation: action.annotation,
    });
  }
  if (action.kind === 'annotate') {
    return client.post<UnidentifiedSegment>(endpoints.unidentified.annotate(action.id), {
      annotation: action.annotation,
    });
  }
  return client.post<UnidentifiedSegment>(endpoints.unidentified.reject(action.id), {
    reason: action.reason,
  });
}

/**
 * ⭐ After an assignment `recordOrigin` STAYS 1 (§7.4 / §23). Nothing in the UI may call the
 * result "driver entered" — the `ORIGIN` column keeps saying `ELD · automatic`.
 */
export function useResolveUnidentified() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (actions: UnidentifiedAction[]) => {
      const results: UnidentifiedSegment[] = [];
      for (const [index, action] of actions.entries()) {
        try {
          results.push(await postUnidentifiedAction(action));
        } catch (error) {
          throw new UnidentifiedBatchError(
            error,
            actions.slice(0, index).map((done) => done.id),
            action.id,
          );
        }
      }
      return results;
    },
    // WB-063 — settled, not success: after a partial batch the list must drop what was written.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.unidentified });
      void queryClient.invalidateQueries({ queryKey: qkRoot.logs });
    },
  });
}

/* ------------------------------------------------------------------ B-6 · violations */

/**
 * B-6 `POST /violations/:id/resolve` — `hosEdit` FULL, `resolutionNote` 4-60 chars; 404 unknown,
 * 409 `CONFLICT` when the violation is no longer OPEN. Backend `violations.service.ts#resolve`.
 */
export interface ResolveViolationResult {
  id: string;
  status: 'RESOLVED';
  resolvedAt: string;
  resolutionNote: string;
}

/** `driverId`/`date` name the log day to refresh; W-01 passes none for an unassigned row. */
export function useResolveViolation(driverId?: string, date?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolutionNote }: { id: string; resolutionNote: string }) =>
      client.post<ResolveViolationResult>(endpoints.violations.resolve(id), { resolutionNote }),
    onSuccess: () => {
      if (driverId && date) {
        void queryClient.invalidateQueries({ queryKey: qk.logDay(driverId, date) });
      }
      // The fleet list (W-01, default status=OPEN) must drop the row, and its KPI recount.
      void queryClient.invalidateQueries({ queryKey: qk.violations() });
      void queryClient.invalidateQueries({ queryKey: qk.dashboardSummary });
    },
  });
}
