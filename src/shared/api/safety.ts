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
import { useDriversList } from './drivers';
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

export interface DriverScoreRow {
  id: string;
  driverId: string;
  periodStart: string;
  periodEnd: string;
  score: number;
  harshCount: number;
  speedingCount: number;
  milesDriven: number;
  violationCount: number;
  rank: number | null;
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
    queryFn: () => client.list<SafetyEventRow>(endpoints.safety.events, params),
    ...typedCachePolicy<OffsetPage<SafetyEventRow>>('list'),
  });
  const driversQuery = useDriversList({ limit: 500 });
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
    isError: eventsQuery.isError || driversQuery.isError || vehiclesQuery.isError,
    refetch: eventsQuery.refetch,
  };
}

export interface ScorecardParams {
  [key: string]: string | undefined;
  periodStart?: string;
  periodEnd?: string;
}

export interface ScorecardResponse {
  items: DriverScoreRow[];
  periodStart: string;
  periodEnd: string;
}

export function useScorecard(params: ScorecardParams = {}) {
  const scorecardQuery = useQuery({
    queryKey: qk.scorecard(params),
    queryFn: () => client.get<ScorecardResponse>(endpoints.safety.scorecard, { params }),
    ...typedCachePolicy<ScorecardResponse>('list'),
  });
  const driversQuery = useDriversList({ limit: 500 });

  const rows = useMemo((): ScorecardTableRow[] => {
    const drivers = new Map((driversQuery.data?.items ?? []).map((d) => [d.id, d]));
    return (scorecardQuery.data?.items ?? [])
      .map((s) => ({ ...s, driver: drivers.get(s.driverId) ?? null }))
      .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  }, [scorecardQuery.data, driversQuery.data]);

  return {
    rows,
    periodStart: scorecardQuery.data?.periodStart,
    periodEnd: scorecardQuery.data?.periodEnd,
    isLoading: scorecardQuery.isLoading || driversQuery.isLoading,
    isError: scorecardQuery.isError || driversQuery.isError,
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
    mutationFn: (payload: { eventId: string; note?: string }) =>
      client.post<SafetyEventRow>(endpoints.safety.coaching, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.safety });
    },
  });
}
