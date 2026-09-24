// owner: web-dispatch-messaging — W-11 Dispatch & Trips + 11.10 Create trip.
//
// `GET /trips` returns the raw Prisma `Trip` row (plus its `stops`, always included by the
// repository) — there is no driver/vehicle name join (web/backend-gaps.md B-36). This module is
// the single place that (a) types the real response and (b) joins one server page against the
// session-wide `/drivers` and `/vehicles` lookups (`shared/api/lookups.ts`) — fetched once per
// session, never per page and never per row (WD-073).
//
// `GET /trips/unassigned-loads` does NOT include `stops` (`trips.repository.ts`
// `unassignedLoads()` has no `include`) — pickup/delivery/window render as unavailable for that
// list until the backend adds the join (same B-36).
import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from './client';
import { endpoints } from './endpoints';
import { qk, qkRoot } from './queryKeys';
import { typedCachePolicy } from './queryPolicy';
import { FILTER_WINDOW, useDriverMap, useVehicleMap } from './lookups';
import { compactParams, pagePolicy, usePagedQuery, type PageQueryOptions } from './paging';
import type { DriverRow, VehicleRow } from './vehicles';

/** `DRAFT` (B-73, shipped 2026-09-24) — saved, not dispatched; publish = PATCH `{ status: 'PLANNED' }`. */
export type TripStatus = 'DRAFT' | 'PLANNED' | 'ASSIGNED' | 'IN_PROGRESS' | 'DELIVERED' | 'CANCELLED';
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
  /** B-73 / B-92 (shipped 2026-09-24). Decimals serialise as strings; render as is, never round. */
  distanceMi?: number | string | null;
  rateUsd?: number | string | null;
  customer?: string | null;
  estimatedDriveSec?: number | null;
  /** B-36 (shipped) — minimal name joins on list / unassigned-loads / detail. */
  driver?: { id: string; firstName: string; lastName: string } | null;
  vehicle?: { id: string; unitNumber: string } | null;
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

/** W-11 server-page params — exactly `TripListQueryDto` (page/limit/sort/q/status/driverId). */
export interface TripsPageParams {
  [key: string]: string | number | boolean | undefined;
  page: number;
  limit: number;
  status?: TripStatus;
  q?: string;
  driverId?: string;
  sort?: string;
}

/** One `GET /trips` page — shared by the board, the counters and the sidebar prefetch (WD-073). */
export const tripsPageQuery = (params: TripsPageParams): PageQueryOptions<TripRow> => ({
  queryKey: qk.trips(compactParams(params)),
  queryFn: ({ signal }) => client.list<TripRow>(endpoints.trips.list, compactParams(params), { signal }),
  ...pagePolicy('list'),
});

/** The `Active` segment is ASSIGNED ∪ IN_PROGRESS; `status` takes one value (B-59), so the two
 * slices are fetched side by side. Both are bounded working sets (a dispatch board, not history)
 * — 200 rows each is the API maximum and far above any real active count. */
export const TRIPS_ACTIVE_STATUSES = ['ASSIGNED', 'IN_PROGRESS'] as const satisfies readonly TripStatus[];
export const ACTIVE_SLICE_LIMIT = 200;
export const tripsActiveSliceQuery = (status: (typeof TRIPS_ACTIVE_STATUSES)[number]) =>
  tripsPageQuery({ page: 1, limit: ACTIVE_SLICE_LIMIT, status });

/** `total` of one lifecycle status via `limit: 1`. */
export const tripsCountQuery = (status: TripStatus) => tripsPageQuery({ page: 1, limit: 1, status });

/** The on-time KPI window: the newest `KPI_WINDOW` deliveries (`plannedStartAt` desc, the API's
 * default sort). There is no aggregate endpoint (B-59); the card says which window it covers. */
export const KPI_WINDOW = 100;
export const tripsKpiQuery = () => tripsPageQuery({ page: 1, limit: KPI_WINDOW, status: 'DELIVERED' });

/** Every ASSIGNED / IN_PROGRESS trip, joined — the Messages thread header's "current trip". */
export function useActiveTrips() {
  const { map: driverById } = useDriverMap();
  const { map: vehicleById } = useVehicleMap();
  const assignedQuery = useQuery(tripsActiveSliceQuery('ASSIGNED'));
  const inProgressQuery = useQuery(tripsActiveSliceQuery('IN_PROGRESS'));
  const rows = useMemo(
    () =>
      joinTrips(
        [...(assignedQuery.data?.items ?? []), ...(inProgressQuery.data?.items ?? [])].sort(byPlannedStartDesc),
        driverById,
        vehicleById,
      ),
    [assignedQuery.data, inProgressQuery.data, driverById, vehicleById],
  );
  return { rows, isLoading: assignedQuery.isLoading || inProgressQuery.isLoading };
}

/** The raw ASSIGNED ∪ IN_PROGRESS rows without the driver/vehicle name join — the W-02 `Trips`
 * map layer only needs stops and `vehicleId`, so it skips the `/drivers` + `/vehicles` lookups.
 * Shares its cache entries with `useActiveTrips()` and the W-11 board (same query keys). */
export function useActiveTripRows({ enabled = true }: { enabled?: boolean } = {}) {
  const assignedQuery = useQuery({ ...tripsActiveSliceQuery('ASSIGNED'), enabled });
  const inProgressQuery = useQuery({ ...tripsActiveSliceQuery('IN_PROGRESS'), enabled });
  const rows = useMemo(
    () => [...(assignedQuery.data?.items ?? []), ...(inProgressQuery.data?.items ?? [])],
    [assignedQuery.data, inProgressQuery.data],
  );
  return { rows, isLoading: assignedQuery.isLoading || inProgressQuery.isLoading };
}

export type TripSegment = 'ACTIVE'| 'SCHEDULED' | 'COMPLETED' | 'UNASSIGNED';
const SEGMENT_STATUS: Record<Exclude<TripSegment, 'ACTIVE' | 'UNASSIGNED'>, TripStatus> = {
  SCHEDULED: 'PLANNED',
  COMPLETED: 'DELIVERED',
};

export function joinTrips(trips: TripRow[], driverById: Map<string, DriverRow>, vehicleById: Map<string, VehicleRow>): TripTableRow[] {
  return trips.map((t) => joinTrip(t, driverById, vehicleById));
}

function byPlannedStartDesc(a: TripRow, b: TripRow): number {
  return (b.plannedStartAt ?? b.createdAt).localeCompare(a.plannedStartAt ?? a.createdAt);
}

export interface TripsBoardInput {
  segment: TripSegment;
  page: number;
  limit: number;
  /** Free text — sent as `q` (number / shipping document) in server mode; matched against
   * number, driver name and pickup/delivery names in memory for the active set and the window. */
  search: string;
  /** True while a client-only 11.23 group is active (B-59). */
  useWindow: boolean;
  /** Runs against joined rows — the whole active set, or the newest `FILTER_WINDOW` rows of a
   * history segment. */
  filter: (rows: TripTableRow[]) => TripTableRow[];
}

/** W-11 board (WD-073): Active = two bounded slices (exact, filtered in memory); Scheduled and
 * Completed = one server page per render; driver/unit names from the session-wide lookups. */
export function useTripsBoard({ segment, page, limit, search, useWindow, filter }: TripsBoardInput) {
  const { map: driverById, query: driversQuery } = useDriverMap();
  const { map: vehicleById, query: vehiclesQuery } = useVehicleMap();

  const assignedQuery = useQuery(tripsActiveSliceQuery('ASSIGNED'));
  const inProgressQuery = useQuery(tripsActiveSliceQuery('IN_PROGRESS'));
  const plannedCount = useQuery(tripsCountQuery('PLANNED'));
  const kpiQuery = useQuery(tripsKpiQuery());

  const needle = search.trim().toLowerCase();
  const matchesSearch = useCallback(
    (t: TripTableRow) => {
      if (!needle) return true;
      const driverName = t.driver ? `${t.driver.firstName} ${t.driver.lastName}` : '';
      return (
        t.number.toLowerCase().includes(needle) ||
        driverName.toLowerCase().includes(needle) ||
        (t.pickup?.name ?? '').toLowerCase().includes(needle) ||
        (t.delivery?.name ?? '').toLowerCase().includes(needle)
      );
    },
    [needle],
  );

  const activeRows = useMemo(
    () =>
      joinTrips(
        [...(assignedQuery.data?.items ?? []), ...(inProgressQuery.data?.items ?? [])].sort(byPlannedStartDesc),
        driverById,
        vehicleById,
      ),
    [assignedQuery.data, inProgressQuery.data, driverById, vehicleById],
  );

  const historyStatus = segment === 'SCHEDULED' || segment === 'COMPLETED' ? SEGMENT_STATUS[segment] : undefined;
  const history = usePagedQuery<TripRow>({
    server: tripsPageQuery({ page, limit, status: historyStatus, q: needle || undefined }),
    window: tripsPageQuery({ page: 1, limit: FILTER_WINDOW, status: historyStatus }),
    useWindow,
    page,
    limit,
    enabled: historyStatus !== undefined,
    filter: (rows) => filter(joinTrips(rows, driverById, vehicleById).filter(matchesSearch)),
  });

  const activeFiltered = useMemo(() => filter(activeRows.filter(matchesSearch)), [activeRows, filter, matchesSearch]);
  const historyRows = useMemo(() => joinTrips(history.items, driverById, vehicleById), [history.items, driverById, vehicleById]);

  let rows: TripTableRow[];
  let total: number;
  let totalPages: number;
  if (segment === 'ACTIVE') {
    total = activeFiltered.length;
    totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    rows = activeFiltered.slice((safePage - 1) * limit, safePage * limit);
  } else {
    rows = historyRows;
    total = history.total;
    totalPages = history.totalPages;
  }

  const delivered = kpiQuery.data?.items ?? [];
  const onTimeDelivered = delivered.filter((t) => t.onTime !== false).length;
  const activeTotal = (assignedQuery.data?.total ?? 0) + (inProgressQuery.data?.total ?? 0);

  const isActiveLoading = assignedQuery.isLoading || inProgressQuery.isLoading;
  return {
    rows,
    total,
    totalPages,
    /** Every active trip (joined) — the route panel and the drawer read from it. */
    activeRows,
    counts: {
      active: activeTotal,
      scheduled: plannedCount.data?.total ?? 0,
      completed: kpiQuery.data?.total ?? 0,
    },
    kpis: {
      onTimePct: delivered.length > 0 ? Math.round((onTimeDelivered / delivered.length) * 100) : 0,
      onTimeWindow: delivered.length,
      lateCount: activeRows.filter((t) => t.displayStatus === 'Late').length,
    },
    isLoading: segment === 'ACTIVE' ? isActiveLoading : history.isLoading,
    isKpiLoading: isActiveLoading || kpiQuery.isLoading || plannedCount.isLoading,
    isError: segment === 'ACTIVE' ? (assignedQuery.isError || inProgressQuery.isError) && !assignedQuery.data && !inProgressQuery.data : history.isError,
    refetch: () => {
      if (segment === 'ACTIVE') {
        void assignedQuery.refetch();
        void inProgressQuery.refetch();
      } else history.refetch();
    },
    driversLookup: driversQuery,
    vehiclesLookup: vehiclesQuery,
  };
}

/** `GET /trips/unassigned-loads` — no `stops` join (B-36); pickup/delivery/window render as
 * unavailable until it lands. */
export function useUnassignedLoads() {
  return useQuery({
    queryKey: qk.unassignedLoads(),
    queryFn: ({ signal }) => client.get<{ items: TripRow[] }>(endpoints.trips.unassignedLoads, { signal }),
    ...typedCachePolicy<{ items: TripRow[] }>('list'),
  });
}

export function useTrip(id: string | undefined) {
  return useQuery({
    queryKey: qk.trip(id ?? ''),
    queryFn: ({ signal }) => client.get<TripRow>(endpoints.trips.detail(id as string), { signal }),
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
  latitude?: number;
  longitude?: number;
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
  pieces?: number;
  /** B-73 / B-92 (shipped 2026-09-24). */
  distanceMi?: number;
  rateUsd?: number;
  customer?: string;
  estimatedDriveSec?: number;
  /** B-73 — saves as `DRAFT` even when `driverId` is set (never silently ASSIGNED, backend D-098). */
  draft?: boolean;
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
  /** B-74 — server default `true`: push the driver about the assignment. */
  notify?: boolean;
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

/* --------------------------------------------------------------------- Phase 13 (2026-09-24) */

/** `TripPatchDto` — every field `PATCH /trips/:id` accepts. `status` follows backend
 * `ALLOWED_TRANSITIONS` (DRAFT → PLANNED | CANCELLED; 422 otherwise). */
export interface UpdateTripPayload {
  status?: TripStatus;
  shippingDocument?: string;
  commodity?: string;
  weightLbs?: number;
  pieces?: number;
  plannedStartAt?: string;
  plannedEndAt?: string;
  etaAt?: string;
  notes?: string;
  distanceMi?: number;
  rateUsd?: number;
  customer?: string;
  estimatedDriveSec?: number;
}

export function useUpdateTrip(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateTripPayload) => client.patch<TripRow>(endpoints.trips.update(tripId), payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.trips });
    },
  });
}

/** B-73 — publishing a draft is `PATCH /trips/:id { status: 'PLANNED' }` (no dedicated route, D-098). */
export function usePublishTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tripId: string) => client.patch<TripRow>(endpoints.trips.update(tripId), { status: 'PLANNED' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.trips });
    },
  });
}
