// owner: web-dispatch-messaging — W-11 Dispatch & Trips + 11.10 Create trip.
//
// `GET /trips` returns the raw Prisma `Trip` row (plus its `stops`, always included by the
// repository) — there is no driver/vehicle name join (web/backend-gaps.md B-36). This module is
// the single place that (a) types the real response and (b) joins it against `GET /drivers` and
// `GET /vehicles` client-side, exactly like `shared/api/vehicles.ts`'s `joinVehicles` — one extra
// reference-cached list call, never per row.
//
// `GET /trips/unassigned-loads` does NOT include `stops` (`trips.repository.ts`
// `unassignedLoads()` has no `include`) — pickup/delivery/window render as unavailable for that
// list until the backend adds the join (same B-36).
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from './client';
import { endpoints } from './endpoints';
import { qk, qkRoot } from './queryKeys';
import { typedCachePolicy } from './queryPolicy';
import type { OffsetPage } from './types';
import type { DriverRow, VehicleRow } from './vehicles';

export type TripStatus = 'PLANNED' | 'ASSIGNED' | 'IN_PROGRESS' | 'DELIVERED' | 'CANCELLED';
export type StopType = 'PICKUP' | 'DELIVERY' | 'FUEL' | 'REST' | 'CHECKPOINT';
export type StopStatus = 'PENDING' | 'ARRIVED' | 'COMPLETED' | 'SKIPPED';

export interface TripStopRow {
  id: string;
  tripId: string;
  sequence: number;
  type: StopType;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  scheduledAt: string | null;
  arrivedAt: string | null;
  departedAt: string | null;
  status: StopStatus;
  note: string | null;
}

/** The real, raw `Trip` row (backend/prisma/schema.prisma `model Trip`). */
export interface TripRow {
  id: string;
  number: string;
  driverId: string | null;
  vehicleId: string | null;
  trailerId: string | null;
  status: TripStatus;
  shippingDocument: string | null;
  commodity: string | null;
  weightLbs: number | null;
  pieces: number | null;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  etaAt: string | null;
  onTime: boolean | null;
  notes: string | null;
  createdById: string;
  createdAt: string;
  stops: TripStopRow[];
}

/** The design's STATUS column — computed, not a `Trip.status` value (web/tz.md §10 W-11).
 * `Loading` wins while the driver is stopped at the pickup; otherwise `onTime` (or a passed
 * `etaAt`) decides `Late` vs `On time` (web/decisions.md WD-029). */
export type TripDisplayStatus = 'On time' | 'Late' | 'Loading' | 'Delivered' | 'Cancelled' | 'Planned';

export function computeDisplayStatus(trip: Pick<TripRow, 'status' | 'onTime' | 'etaAt' | 'stops'>): TripDisplayStatus {
  if (trip.status === 'DELIVERED') return 'Delivered';
  if (trip.status === 'CANCELLED') return 'Cancelled';
  if (trip.status === 'PLANNED') return 'Planned';
  const pickup = trip.stops.find((s) => s.type === 'PICKUP');
  if (pickup && pickup.arrivedAt && !pickup.departedAt) return 'Loading';
  if (trip.onTime === false) return 'Late';
  if (trip.etaAt && Date.now() > new Date(trip.etaAt).getTime()) return 'Late';
  return 'On time';
}

export interface TripTableRow extends TripRow {
  driver: DriverRow | null;
  vehicle: VehicleRow | null;
  pickup: TripStopRow | null;
  delivery: TripStopRow | null;
  displayStatus: TripDisplayStatus;
}

function joinTrip(trip: TripRow, driverById: Map<string, DriverRow>, vehicleById: Map<string, VehicleRow>): TripTableRow {
  const stops = [...(trip.stops ?? [])].sort((a, b) => a.sequence - b.sequence);
  return {
    ...trip,
    stops,
    driver: trip.driverId ? driverById.get(trip.driverId) ?? null : null,
    vehicle: trip.vehicleId ? vehicleById.get(trip.vehicleId) ?? null : null,
    pickup: stops.find((s) => s.type === 'PICKUP') ?? null,
    delivery: stops.find((s) => s.type === 'DELIVERY') ?? null,
    displayStatus: computeDisplayStatus(trip),
  };
}

/** W-11 board — the whole trip set, client-filtered into the ALL/ACTIVE/SCHEDULED/COMPLETED
 * segments and searched, exactly like W-03 Vehicles (web/decisions.md WD-024 precedent). */
export function useTripsList() {
  const tripsQuery = useQuery({
    queryKey: qk.trips({ limit: 500 }),
    queryFn: () => client.list<TripRow>(endpoints.trips.list, { limit: 500 }),
    ...typedCachePolicy<OffsetPage<TripRow>>('list'),
  });
  const driversQuery = useQuery({
    queryKey: qk.drivers({ limit: 500 }),
    queryFn: () => client.list<DriverRow>(endpoints.drivers.list, { limit: 500 }),
    ...typedCachePolicy<OffsetPage<DriverRow>>('reference'),
  });
  const vehiclesQuery = useQuery({
    queryKey: qk.vehicles({ limit: 500 }),
    queryFn: () => client.list<VehicleRow>(endpoints.vehicles.list, { limit: 500 }),
    ...typedCachePolicy<OffsetPage<VehicleRow>>('reference'),
  });

  const rows = useMemo(() => {
    const driverById = new Map((driversQuery.data?.items ?? []).map((d) => [d.id, d]));
    const vehicleById = new Map((vehiclesQuery.data?.items ?? []).map((v) => [v.id, v]));
    return (tripsQuery.data?.items ?? []).map((t) => joinTrip(t, driverById, vehicleById));
  }, [tripsQuery.data, driversQuery.data, vehiclesQuery.data]);

  return {
    rows,
    isLoading: tripsQuery.isLoading || driversQuery.isLoading || vehiclesQuery.isLoading,
    isError: tripsQuery.isError || driversQuery.isError || vehiclesQuery.isError,
    refetch: tripsQuery.refetch,
  };
}

/** `GET /trips/unassigned-loads` — no `stops` join (B-36); pickup/delivery/window render as
 * unavailable until it lands. */
export function useUnassignedLoads() {
  return useQuery({
    queryKey: qk.unassignedLoads(),
    queryFn: () => client.get<{ items: TripRow[] }>(endpoints.trips.unassignedLoads),
    ...typedCachePolicy<{ items: TripRow[] }>('list'),
  });
}

export function useTrip(id: string | undefined) {
  return useQuery({
    queryKey: qk.trip(id ?? ''),
    queryFn: () => client.get<TripRow>(endpoints.trips.detail(id as string)),
    enabled: Boolean(id),
    ...typedCachePolicy<TripRow>('reference'),
  });
}

/** B-31 — a driver's e-mail verification state has no home on `DriverRow` yet (it only exists on
 * the `GET /drivers/roster` gap shape, B-1, which Trips does not call). Until it ships, this is
 * the single place that decides whether `Assign trip` blocks: `null`/`undefined` (unknown) never
 * blocks, only an explicit `false` does — never guess a compliance gate from absent data. */
export function blocksAssignment(driver: { emailVerified?: boolean | null } | null | undefined): boolean {
  return driver?.emailVerified === false;
}

export interface CreateTripStopInput {
  sequence: number;
  type: StopType;
  name: string;
  address?: string;
  scheduledAt?: string;
  note?: string;
}

export interface CreateTripPayload {
  number: string;
  driverId?: string;
  vehicleId?: string;
  trailerId?: string;
  shippingDocument?: string;
  commodity?: string;
  weightLbs?: number;
  plannedStartAt?: string;
  plannedEndAt?: string;
  notes?: string;
  stops?: CreateTripStopInput[];
}

export function useCreateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTripPayload) => client.post<TripRow>(endpoints.trips.create, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.trips });
    },
  });
}

export interface AssignTripPayload {
  driverId: string;
  vehicleId?: string;
  trailerId?: string;
}

export function useAssignTrip(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AssignTripPayload) => client.post<TripRow>(endpoints.trips.assign(tripId), payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.trips });
    },
  });
}

export interface AutoAssignResult {
  assigned: Array<{ tripId: string; driverId: string }>;
  skipped: number;
}

export function useAutoAssignTrips() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => client.post<AutoAssignResult>(endpoints.trips.autoAssign, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.trips });
    },
  });
}
