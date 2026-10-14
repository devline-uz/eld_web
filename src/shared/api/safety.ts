// owner: web-dvir-safety — W-10 Safety.
//
// `GET /safety/events` and `GET /safety/scorecard` answer with the raw `SafetyEvent`/
// `DriverScore` rows — `driverId`/`vehicleId` only, no name join (web/backend-gaps.md pattern
// used across W-09/W-03). This module does the client-side join against `GET /drivers` and
// `GET /vehicles` (reference-cached), the same one-extra-list-call pattern as `shared/api/dvir.ts`.
//
// ⛔ Coaching is modelled per-`SafetyEvent` on the backend (`POST /safety/coaching { eventId,
// note }`), not per-driver — the design's "Assign coaching" button next to the scorecard has no
// direct driver-level endpoint. `AssignCoachingModal` lets the user pick one of that driver's
// open events (web/decisions.md WD-034).
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from './client';
import { endpoints } from './endpoints';
import { qk, qkRoot } from './queryKeys';
import { typedCachePolicy } from './queryPolicy';
import type { OffsetPage } from './types';
import { useDriversLookup } from './lookups';
import { useVehiclesPicker, type DriverRow, type VehicleRow } from './vehicles';

export type SafetyEventType = 'HARSH_BRAKING' | 'HARSH_ACCEL' | 'HARSH_TURN' | 'SPEEDING' | 'SEATBELT';
export type CoachingStatus = 'NEW' | 'REVIEWED' | 'COACHED' | 'DISMISSED';

export interface SafetyEventRow {
  id: string;
  driverId: string | null;
  vehicleId: string;
  type: SafetyEventType;
  occurredAt: string;
  severity: number;
  speedMph: number | null;
  speedLimitMph: number | null;
  gForce: string | number | null;
  latitude: number | string | null;
  longitude: number | string | null;
  locationName: string | null;
  durationSec: number | null;
  status: CoachingStatus;
  coachedById: string | null;
  coachedAt: string | null;
  coachingNote: string | null;
}

/** Phase 1 scorecard (backend D-133, 2026-10-11) — one row per driver for the latest nightly
 * rolling-30-day period. `scored: false` (< `minMiles` driven) ⇒ `score`/`rank` are null and the
 * row reads "Not enough miles". `rank` #1 = best; ties are broken server-side (more miles, then
 * name). `previousScore`/`trend` (B-44) are null when either period is unscored. */
export interface DriverScoreRow {
  id: string;
  driverId: string;
  /** `YYYY-MM-DD` calendar dates (inclusive), each driver's home-terminal day. */
  periodStart: string;
  periodEnd: string;
  score: number | null;
  /** Absent on pre-Phase-1 payloads — treated as `score != null`. */
  scored?: boolean;
  harshCount: number;
  speedingCount: number;
  seatbeltCount?: number;
  milesDriven: number;
  violationCount: number;
  rank: number | null;
  previousScore?: number | null;
  trend?: number | null;
  computedAt?: string;
}

/** Server-computed fleet aggregate — mile-weighted mean of scored drivers + trend vs the
 * previous 30-day period. Never recomputed client-side. */
export interface ScorecardFleet {
  score: number | null;
  previousScore: number | null;
  trend: number | null;
  scoredDrivers: number;
  unscoredDrivers: number;
  belowThresholdCount: number;
  milesDriven: number;
}

/** True when the row has a score (≥ `minMiles` driven in the period). */
export function isScored(row: Pick<DriverScoreRow, 'score' | 'scored'>): row is DriverScoreRow & { score: number } {
  return row.scored !== false && row.score != null;
}

export interface SafetyEventTableRow extends SafetyEventRow {
  driver: DriverRow | null;
  vehicle: VehicleRow | null;
}

export interface ScorecardTableRow extends DriverScoreRow {
  driver: DriverRow | null;
}

export interface SafetyEventListParams {
  [key: string]: string | number | boolean | undefined;
  page?: number;
  limit?: number;
  driverId?: string;
  vehicleId?: string;
  type?: SafetyEventType;
  status?: CoachingStatus;
  from?: string;
  to?: string;
}

export function useSafetyEventsList(params: SafetyEventListParams) {
  const eventsQuery = useQuery({
    queryKey: qk.safetyEvents(params),
    queryFn: ({ signal }) => client.list<SafetyEventRow>(endpoints.safety.events, params, { signal }),
    ...typedCachePolicy<OffsetPage<SafetyEventRow>>('list'),
  });
  // The session-wide `reference` lookup, never the `list` policy on the same key (WB-087).
  const driversQuery = useDriversLookup();
  const vehiclesQuery = useVehiclesPicker();

  const rows = useMemo((): SafetyEventTableRow[] => {
    const drivers = new Map((driversQuery.data?.items ?? []).map((d) => [d.id, d]));
    const vehicles = new Map((vehiclesQuery.data?.items ?? []).map((v) => [v.id, v]));
    return (eventsQuery.data?.items ?? []).map((e) => ({
      ...e,
      driver: e.driverId ? drivers.get(e.driverId) ?? null : null,
      vehicle: vehicles.get(e.vehicleId) ?? null,
    }));
  }, [eventsQuery.data, driversQuery.data, vehiclesQuery.data]);

  return {
    rows,
    page: eventsQuery.data,
    isLoading: eventsQuery.isLoading || driversQuery.isLoading || vehiclesQuery.isLoading,
    // Same class as WB-038 (`paging.ts:91,109`) — the primary query drives the error state, and
    // only when it has no cached data to fall back on. A transient `/drivers` or `/vehicles`
    // join failure must not blank the events table when the primary rows are good; DRIVER/UNIT
    // columns degrade to `—` via `driver`/`vehicle` staying `null` in the join above.
    isError: eventsQuery.isError && !eventsQuery.data,
    refetch: eventsQuery.refetch,
  };
}

export interface ScorecardParams {
  [key: string]: string | undefined;
  periodStart?: string;
  periodEnd?: string;
}

export interface ScorecardResponse {
  /** Null until the nightly job has computed a period. */
  periodStart: string | null;
  periodEnd: string | null;
  computedAt?: string | null;
  minMiles?: number;
  fleet?: ScorecardFleet;
  /** Server order: ranked rows by rank, then "Not enough miles" rows by miles desc. */
  items: DriverScoreRow[];
}

export const SCORECARD_MIN_MILES_DEFAULT = 100;

const EMPTY_FLEET: ScorecardFleet = {
  score: null,
  previousScore: null,
  trend: null,
  scoredDrivers: 0,
  unscoredDrivers: 0,
  belowThresholdCount: 0,
  milesDriven: 0,
};

/** Ranked rows first (rank asc), unscored after — keeps the server order, only defends against
 * a payload that is not already sorted. Stable sort, so equal keys keep server order. */
export function sortScorecardRows<T extends DriverScoreRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ra = isScored(a) && a.rank != null ? a.rank : Number.POSITIVE_INFINITY;
    const rb = isScored(b) && b.rank != null ? b.rank : Number.POSITIVE_INFINITY;
    if (ra !== rb) return ra - rb;
    return 0;
  });
}

/** CODE-040 — `GET /safety/summary`: KPI counts over the rolling 30 days and the 30 days before. */
export interface SafetySummaryCounts {
  total: number;
  harsh: number;
  speeding: number;
  seatbelt: number;
  coached: number;
  pendingCoaching: number;
}
export interface SafetySummary {
  from: string;
  to: string;
  current: SafetySummaryCounts;
  previous: SafetySummaryCounts;
}

export function useSafetySummary(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.safetySummary(),
    queryFn: ({ signal }) => client.get<SafetySummary>(endpoints.safety.summary, { signal }),
    enabled: options.enabled ?? true,
    ...typedCachePolicy<SafetySummary>('list'),
  });
}

export function useScorecard(params: ScorecardParams = {}) {
  const scorecardQuery = useQuery({
    queryKey: qk.scorecard(params),
    queryFn: ({ signal }) => client.get<ScorecardResponse>(endpoints.safety.scorecard, { params, signal }),
    ...typedCachePolicy<ScorecardResponse>('list'),
  });
  // The session-wide `reference` lookup, never the `list` policy on the same key (WB-087).
  const driversQuery = useDriversLookup();

  const rows = useMemo((): ScorecardTableRow[] => {
    const drivers = new Map((driversQuery.data?.items ?? []).map((d) => [d.id, d]));
    return sortScorecardRows((scorecardQuery.data?.items ?? []).map((s) => ({ ...s, driver: drivers.get(s.driverId) ?? null })));
  }, [scorecardQuery.data, driversQuery.data]);

  return {
    rows,
    periodStart: scorecardQuery.data?.periodStart ?? null,
    periodEnd: scorecardQuery.data?.periodEnd ?? null,
    computedAt: scorecardQuery.data?.computedAt ?? null,
    minMiles: scorecardQuery.data?.minMiles ?? SCORECARD_MIN_MILES_DEFAULT,
    fleet: scorecardQuery.data?.fleet ?? EMPTY_FLEET,
    isLoading: scorecardQuery.isLoading || driversQuery.isLoading,
    // Same class as WB-038 — a transient `/drivers` join failure must not blank the scorecard
    // when the primary scorecard rows are good; DRIVER degrades to `—` via `driver` staying null.
    isError: scorecardQuery.isError && !scorecardQuery.data,
    refetch: scorecardQuery.refetch,
  };
}

export function useUpdateSafetyEvent(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { status: CoachingStatus; coachingNote?: string }) =>
      client.patch<SafetyEventRow>(endpoints.safety.event(id), payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.safety });
    },
  });
}

export function useAssignCoaching() {
  const queryClient = useQueryClient();
  return useMutation({
    /** B-43 (shipped) — pass `driverId` instead of `eventId` to coach at driver level (closes that
     * driver's most recent open event). Exactly one of the two. */
    mutationFn: (payload: ({ eventId: string; driverId?: never } | { driverId: string; eventId?: never }) & { note?: string }) =>
      client.post<SafetyEventRow>(endpoints.safety.coaching, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.safety });
    },
  });
}
