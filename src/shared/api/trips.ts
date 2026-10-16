// owner: web-dispatch-messaging — W-11 Dispatch & Trips + 11.10 Create trip.
//
// `GET /trips` returns the raw Prisma `Trip` row plus `stops` and a minimal `driver`/`vehicle`
// name join (B-36, shipped 2026-09-24 — `trips.repository.ts` `NAME_JOIN`). This module still
// joins against the session-wide `/drivers` and `/vehicles` lookups (`shared/api/lookups.ts`) for
// the full `DriverRow`/`VehicleRow` shape the board needs (home terminal, status, etc.) — the
// server join alone only carries `{ id, firstName, lastName }` / `{ id, unitNumber }`.
//
// `GET /trips/unassigned-loads` now includes `stops` (ordered by `sequence`) and the same
// `driver`/`vehicle` name join (B-36) — pickup/delivery/window and a pre-assigned unit render for
// real; `driver` is always `null` here by definition (`unassignedLoads()` filters `driverId: null`).
import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from './client';
import { endpoints } from './endpoints';
import { qk, qkRoot } from './queryKeys';
import { typedCachePolicy } from './queryPolicy';
import { FILTER_WINDOW, useDriverMap, useVehicleMap } from './lookups';
import { compactParams, pagePolicy, usePagedQuery, type PageQueryOptions } from './paging';
import type { DriverRow, VehicleRow } from './vehicles';
import { ApiError } from './errors';

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
 * An active trip that is running late (`isRunningLate`) is `Late`, even while it sits at the
 * pickup; otherwise `Loading` wins while the driver is stopped at the pickup, else `On time`
 * (web/decisions.md WD-029). `Draft` (B-73) is its own state: a draft is not dispatched, so it
 * never reaches the pickup/late branches below. */
export type TripDisplayStatus = 'On time' | 'Late' | 'Loading' | 'Delivered' | 'Cancelled' | 'Planned' | 'Draft' | 'Upcoming';

/** An ASSIGNED trip whose planned pickup is still ahead — dispatched, not started (QA FE-007). */
export function isUpcoming(trip: Pick<TripRow, 'status' | 'plannedStartAt'>, now: number = Date.now()): boolean {
  if (trip.status !== 'ASSIGNED' || !trip.plannedStartAt) return false;
  const start = Date.parse(trip.plannedStartAt);
  return Number.isFinite(start) && start > now;
}

function instant(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  return Number.isFinite(at) ? at : null;
}

/** QA LIVE-003 — an active (ASSIGNED / IN_PROGRESS) trip is late when the backend says so
 * (`onTime: false`), its ETA has passed, its ETA lands after the planned end, or the planned end
 * itself has passed while the trip is still not delivered. Before, only the first two counted —
 * `onTime` is never set while a trip is open and `etaAt` is rarely sent, so a trip a week past
 * its end still read `On time`. */
export function isRunningLate(
  trip: Pick<TripRow, 'status' | 'onTime' | 'etaAt'> & Partial<Pick<TripRow, 'plannedEndAt'>>,
  now: number = Date.now(),
): boolean {
  if (trip.status !== 'ASSIGNED' && trip.status !== 'IN_PROGRESS') return false;
  if (trip.onTime === false) return true;
  const eta = instant(trip.etaAt);
  const end = instant(trip.plannedEndAt);
  if (eta !== null && now > eta) return true;
  if (end !== null && now > end) return true;
  return eta !== null && end !== null && eta > end;
}

/** QA LIVE-003 — a `Scheduled` trip (DRAFT / PLANNED: not dispatched, so the driver cannot have
 * started it) whose planned start has already passed. Only flagged on the board — the status is
 * never changed for the dispatcher. */
export function isStartOverdue(trip: Pick<TripRow, 'status' | 'plannedStartAt'>, now: number = Date.now()): boolean {
  if (trip.status !== 'DRAFT' && trip.status !== 'PLANNED') return false;
  const start = instant(trip.plannedStartAt);
  return start !== null && start < now;
}

/** QA LIVE-003 — the on-time KPI's verdict for one DELIVERED trip: the backend's `onTime` when it
 * set one, else `completedAt` vs `plannedEndAt`; a delivery with neither counts as on time (as
 * before — nothing says it was late). */
export function deliveredOnTime(trip: Pick<TripRow, 'onTime' | 'completedAt' | 'plannedEndAt'>): boolean {
  if (trip.onTime !== null && trip.onTime !== undefined) return trip.onTime;
  const done = instant(trip.completedAt);
  const end = instant(trip.plannedEndAt);
  return done === null || end === null || done <= end;
}

export function computeDisplayStatus(
  trip: Pick<TripRow, 'status' | 'onTime' | 'etaAt' | 'stops'> & Partial<Pick<TripRow, 'plannedStartAt' | 'plannedEndAt'>>,
  now: number = Date.now(),
): TripDisplayStatus {
  if (trip.status === 'DELIVERED') return 'Delivered';
  if (trip.status === 'CANCELLED') return 'Cancelled';
  if (trip.status === 'DRAFT') return 'Draft';
  if (trip.status === 'PLANNED') return 'Planned';
  if (isUpcoming({ status: trip.status, plannedStartAt: trip.plannedStartAt ?? null }, now)) return 'Upcoming';
  if (isRunningLate(trip, now)) return 'Late';
  const pickup = trip.stops.find((s) => s.type === 'PICKUP');
  if (pickup && pickup.arrivedAt && !pickup.departedAt) return 'Loading';
  return 'On time';
}

export interface TripTableRow extends TripRow {
  driver: DriverRow | null;
  vehicle: VehicleRow | null;
  pickup: TripStopRow | null;
  delivery: TripStopRow | null;
  displayStatus: TripDisplayStatus;
  /** QA LIVE-003 — DRAFT / PLANNED and the planned start has passed (`isStartOverdue`). */
  startOverdue: boolean;
}

/** CODE-051 — a trip's route endpoints: the first PICKUP and the LAST DELIVERY by `sequence`. A
 * multi-pickup / multi-drop trip ends at its final drop — the first DELIVERY is just one of the
 * stops along the way (it used to be drawn as the end, and the later drops were dropped). */
export function tripRouteEnds<T extends Pick<TripStopRow, 'type' | 'sequence'>>(
  stops: readonly T[],
): { pickup: T | null; delivery: T | null } {
  const ordered = [...stops].sort((a, b) => a.sequence - b.sequence);
  let delivery: T | null = null;
  for (const stop of ordered) if (stop.type === 'DELIVERY') delivery = stop;
  return { pickup: ordered.find((s) => s.type === 'PICKUP') ?? null, delivery };
}

function joinTrip(trip: TripRow, driverById: Map<string, DriverRow>, vehicleById: Map<string, VehicleRow>): TripTableRow {
  const stops = [...(trip.stops ?? [])].sort((a, b) => a.sequence - b.sequence);
  const { pickup, delivery } = tripRouteEnds(stops);
  return {
    ...trip,
    stops,
    driver: trip.driverId ? driverById.get(trip.driverId) ?? null : null,
    vehicle: trip.vehicleId ? vehicleById.get(trip.vehicleId) ?? null : null,
    pickup,
    delivery,
    displayStatus: computeDisplayStatus(trip),
    startOverdue: isStartOverdue(trip),
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

/** The `Active` segment is ASSIGNED ∪ IN_PROGRESS, and `Scheduled` is DRAFT ∪ PLANNED (B-73);
 * `status` takes one value (B-59), so each pair is fetched side by side. Every slice is a bounded
 * working set (a dispatch board, not history). CODE-048 — a slice used to stop at one 200-row API
 * page while the tab counter showed the full `total`, so rows past 200 silently vanished;
 * `client.list` now walks the 200-row pages (in parallel) up to this cap, and the board counts the
 * rows it actually holds (`truncated` says when the cap was hit). */
export const TRIPS_ACTIVE_STATUSES = ['ASSIGNED', 'IN_PROGRESS'] as const satisfies readonly TripStatus[];
export const ACTIVE_SLICE_LIMIT = 2000;
export const tripsActiveSliceQuery = (status: TripStatus) =>
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
/** `SCHEDULED` is `DRAFT ∪ PLANNED` (B-73) — a draft is a saved-not-dispatched trip, same tab as a
 * dispatched-but-not-started one; it publishes in place via `usePublishTrip`. */
export const SCHEDULED_STATUSES = ['DRAFT', 'PLANNED'] as const satisfies readonly TripStatus[];

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
  /** Free text — sent as `q` in server mode (the API matches number, shipping document, driver
   * name and stop city — F3-10); the same fields are matched in memory for the active set and the
   * window. */
  search: string;
  /** True while a client-only 11.23 group is active (B-59). */
  useWindow: boolean;
  /** Runs against joined rows — the whole active set, or the newest `FILTER_WINDOW` rows of a
   * history segment. */
  filter: (rows: TripTableRow[]) => TripTableRow[];
  /** CODE-047 — what the `Completed` segment lists: `DELIVERED` by default; `CANCELLED` (alone or
   * with `DELIVERED`) when the status filter asks for cancelled trips, which no segment showed. */
  completedStatuses?: readonly TripStatus[];
}

const DEFAULT_COMPLETED_STATUSES: readonly TripStatus[] = ['DELIVERED'];

/** W-11 board (WD-073): Active = two bounded slices (exact, filtered in memory); Scheduled is the
 * same pattern over `DRAFT ∪ PLANNED` (B-73 — the status param takes one value, B-59); Completed =
 * one server page per render; driver/unit names from the session-wide lookups. */
export function useTripsBoard({ segment, page, limit, search, useWindow, filter, completedStatuses }: TripsBoardInput) {
  const { map: driverById, query: driversQuery } = useDriverMap();
  const { map: vehicleById, query: vehiclesQuery } = useVehicleMap();

  const assignedQuery = useQuery(tripsActiveSliceQuery('ASSIGNED'));
  const inProgressQuery = useQuery(tripsActiveSliceQuery('IN_PROGRESS'));
  const draftQuery = useQuery(tripsActiveSliceQuery('DRAFT'));
  const plannedQuery = useQuery(tripsActiveSliceQuery('PLANNED'));
  const kpiQuery = useQuery(tripsKpiQuery());

  const needle = search.trim().toLowerCase();
  const matchesSearch = useCallback(
    (t: TripTableRow) => {
      if (!needle) return true;
      const driverName = t.driver ? `${t.driver.firstName} ${t.driver.lastName}` : '';
      // F3-10 — the same fields the server `q` matches (number, shipping document, driver name,
      // stop city/address), so a search finds the same trips on every tab.
      return [
        t.number,
        t.shippingDocument,
        driverName,
        t.pickup?.name,
        t.pickup?.address,
        t.delivery?.name,
        t.delivery?.address,
      ].some((field) => (field ?? '').toLowerCase().includes(needle));
    },
    [needle],
  );

  // QA FE-007 — an ASSIGNED trip whose pickup is still in the future has not started: it is
  // `Scheduled`, not `Active`. Split by `plannedStartAt` against the time the slice was fetched
  // (re-evaluated on every refetch, so a trip moves to Active within one poll of its start).
  const futureAssigned = useMemo(
    () => (assignedQuery.data?.items ?? []).filter((t) => isUpcoming(t, assignedQuery.dataUpdatedAt)),
    [assignedQuery.data, assignedQuery.dataUpdatedAt],
  );
  const futureIds = useMemo(() => new Set(futureAssigned.map((t) => t.id)), [futureAssigned]);

  const activeRows = useMemo(
    () =>
      joinTrips(
        [
          ...(assignedQuery.data?.items ?? []).filter((t) => !futureIds.has(t.id)),
          ...(inProgressQuery.data?.items ?? []),
        ].sort(byPlannedStartDesc),
        driverById,
        vehicleById,
      ),
    [assignedQuery.data, inProgressQuery.data, futureIds, driverById, vehicleById],
  );

  const scheduledRows = useMemo(
    () =>
      joinTrips(
        [...(draftQuery.data?.items ?? []), ...(plannedQuery.data?.items ?? []), ...futureAssigned].sort(byPlannedStartDesc),
        driverById,
        vehicleById,
      ),
    [draftQuery.data, plannedQuery.data, futureAssigned, driverById, vehicleById],
  );

  // `status` takes one value (B-59): two statuses read the newest `FILTER_WINDOW` trips of any
  // status and keep only those two in memory.
  const historyStatuses = completedStatuses?.length ? completedStatuses : DEFAULT_COMPLETED_STATUSES;
  const historyStatus = historyStatuses.length === 1 ? historyStatuses[0] : undefined;
  const history = usePagedQuery<TripRow>({
    server: tripsPageQuery({ page, limit, status: historyStatus, q: needle || undefined }),
    window: tripsPageQuery({ page: 1, limit: FILTER_WINDOW, status: historyStatus }),
    useWindow: useWindow || historyStatus === undefined,
    page,
    limit,
    enabled: segment === 'COMPLETED',
    filter: (rows) =>
      filter(joinTrips(rows, driverById, vehicleById).filter((t) => historyStatuses.includes(t.status) && matchesSearch(t))),
  });

  const activeFiltered = useMemo(() => filter(activeRows.filter(matchesSearch)), [activeRows, filter, matchesSearch]);
  const scheduledFiltered = useMemo(() => filter(scheduledRows.filter(matchesSearch)), [scheduledRows, filter, matchesSearch]);
  const historyRows = useMemo(() => joinTrips(history.items, driverById, vehicleById), [history.items, driverById, vehicleById]);

  let rows: TripTableRow[];
  let total: number;
  let totalPages: number;
  if (segment === 'ACTIVE' || segment === 'SCHEDULED') {
    const source = segment === 'ACTIVE' ? activeFiltered : scheduledFiltered;
    total = source.length;
    totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    rows = source.slice((safePage - 1) * limit, safePage * limit);
  } else {
    rows = historyRows;
    total = history.total;
    totalPages = history.totalPages;
  }

  const delivered = kpiQuery.data?.items ?? [];
  const onTimeDelivered = delivered.filter(deliveredOnTime).length;
  // CODE-048 — the counters count the rows the board holds, so a tab never promises rows it can't list.
  const activeTotal = activeRows.length;
  const scheduledTotal = scheduledRows.length;
  const sliceTruncated = [assignedQuery, inProgressQuery, draftQuery, plannedQuery].some(
    (q) => q.data !== undefined && q.data.items.length < q.data.total,
  );

  const isActiveLoading = assignedQuery.isLoading || inProgressQuery.isLoading;
  const isScheduledLoading = draftQuery.isLoading || plannedQuery.isLoading;
  return {
    rows,
    total,
    totalPages,
    /** Every active trip (joined) — the route panel and the drawer read from it. */
    activeRows,
    /** Every DRAFT ∪ PLANNED trip (joined) — the route panel reads from it too. */
    scheduledRows,
    /** CODE-048 — an Active/Scheduled slice holds more than `ACTIVE_SLICE_LIMIT` trips. */
    truncated: sliceTruncated,
    counts: {
      active: activeTotal,
      scheduled: scheduledTotal,
      completed: kpiQuery.data?.total ?? 0,
    },
    kpis: {
      /** `null` with no delivered trip yet — the card shows `—`, never `0%` (QA FE-007). */
      onTimePct: delivered.length > 0 ? Math.round((onTimeDelivered / delivered.length) * 100) : null,
      onTimeWindow: delivered.length,
      lateCount: activeRows.filter((t) => t.displayStatus === 'Late').length,
    },
    isLoading: segment === 'ACTIVE' ? isActiveLoading : segment === 'SCHEDULED' ? isScheduledLoading : history.isLoading,
    isKpiLoading: isActiveLoading || isScheduledLoading || kpiQuery.isLoading,
    isError:
      segment === 'ACTIVE'
        ? (assignedQuery.isError || inProgressQuery.isError) && !assignedQuery.data && !inProgressQuery.data
        : segment === 'SCHEDULED'
          ? (draftQuery.isError || plannedQuery.isError) && !draftQuery.data && !plannedQuery.data
          : history.isError,
    refetch: () => {
      if (segment === 'ACTIVE') {
        void assignedQuery.refetch();
        void inProgressQuery.refetch();
      } else if (segment === 'SCHEDULED') {
        void draftQuery.refetch();
        void plannedQuery.refetch();
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

/** `details.conflict` of a 409 `TRIP_SCHEDULE_CONFLICT` — the other trip already holding the unit, driver or trailer. */
export interface TripScheduleConflict {
  /** Which resource is double-booked; a response without `resource` is a unit (older backend). */
  resource: 'vehicle' | 'driver' | 'trailer';
  tripId: string;
  number: string;
  unitNumber: string | null;
  driverName: string | null;
  trailerNumber: string | null;
  /** ISO instants of the range the other trip occupies; `end: null` = no planned end. */
  start: string;
  end: string | null;
}

/** The conflicting trip from `POST /trips`, `PATCH /trips/:id` or `POST /trips/:id/assign`
 * refusing to double-book a unit; `null` for any other error. */
export function tripScheduleConflict(error: unknown): TripScheduleConflict | null {
  if (!(error instanceof ApiError) || error.code !== 'TRIP_SCHEDULE_CONFLICT') return null;
  const c = error.details.conflict as Partial<TripScheduleConflict> | undefined;
  if (!c || typeof c.number !== 'string' || typeof c.start !== 'string') return null;
  const raw = (c as { resource?: unknown }).resource;
  return {
    resource: raw === 'driver' || raw === 'trailer' ? raw : 'vehicle',
    tripId: String(c.tripId ?? ''),
    number: c.number,
    unitNumber: typeof c.unitNumber === 'string' ? c.unitNumber : null,
    driverName: typeof c.driverName === 'string' ? c.driverName : null,
    trailerNumber: typeof c.trailerNumber === 'string' ? c.trailerNumber : null,
    start: c.start,
    end: typeof c.end === 'string' ? c.end : null,
  };
}

/** `POST /trips` refusing a duplicate trip / load ID: 409 `CONFLICT`. Current backend keys it
 * `details.number`; an older build sends no `details` at all — on create that bare `CONFLICT` can
 * only be the number, so both are treated as this case. */
export function isTripNumberTaken(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 409 || error.code !== 'CONFLICT') return false;
  const fields = Object.keys(error.fieldErrors);
  return fields.length === 0 || fields.includes('number');
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

/** CODE-055 — `skipped`: loads left unassigned (no driver free at that time; `noStart` of them have
 * no planned start). `failed`: loads another error stopped, each with its reason. There is no
 * HOS-hours check. `noStart` / `failed` are optional for an older backend. */
export interface AutoAssignResult {
  assigned: Array<{ tripId: string; driverId: string }>;
  skipped: number;
  noStart?: number;
  failed?: Array<{ tripId: string; number: string; reason: string }>;
}

/** CODE-055 — the toast for an auto-assign run: what happened, never an invented reason. */
export function autoAssignSummary(result: AutoAssignResult): { kind: 'success' | 'warning'; title: string; description?: string } {
  const assigned = result.assigned.length;
  const failed = result.failed ?? [];
  const noStart = result.noStart ?? 0;
  const parts = [`${assigned} ${assigned === 1 ? 'load' : 'loads'} assigned`];
  if (result.skipped > 0) {
    const reasons = [
      result.skipped - noStart > 0 ? `${result.skipped - noStart} with no driver free at that time` : null,
      noStart > 0 ? `${noStart} without a planned start` : null,
    ].filter(Boolean);
    parts.push(`${result.skipped} left unassigned (${reasons.join(', ')})`);
  }
  if (failed.length > 0) parts.push(`${failed.length} failed`);
  return {
    kind: failed.length > 0 || (assigned === 0 && result.skipped > 0) ? 'warning' : 'success',
    title: parts.join(' · '),
    description: failed.length > 0 ? failed.map((f) => `${f.number}: ${f.reason}`).slice(0, 3).join(' ') : undefined,
  };
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

/** `UpdateTripDto` — every field `PATCH /trips/:id` accepts (none of them nullable, so a number
 * or date can be changed but never cleared). `status` follows backend `ALLOWED_TRANSITIONS`
 * (DRAFT → PLANNED | CANCELLED); an illegal transition is 409 `CONFLICT`. Any non-status edit of
 * a DELIVERED / CANCELLED trip is 409 `TRIP_NOT_EDITABLE`. Driver / unit / trailer only change
 * through `POST /trips/:id/assign`; stops and `number` are not editable. */
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
  /** LIVE-003 — only with `status: 'DELIVERED'`: the actual delivery time (default now). */
  completedAt?: string;
}

export function useUpdateTrip(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateTripPayload) => client.patch<TripRow>(endpoints.trips.update(tripId), payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.trips });
    },
    // A 404 (deleted elsewhere) or 409 `TRIP_NOT_EDITABLE` (delivered / cancelled since the board
    // loaded) means the cached row is stale — refetch so the board stops offering the edit.
    onError: (error) => {
      if (isTripNotFound(error) || isTripNotEditable(error) || isTripChangedConcurrently(error)) void queryClient.invalidateQueries({ queryKey: qkRoot.trips });
    },
  });
}

/** Statuses whose fields `PATCH /trips/:id` refuses to change (409 `TRIP_NOT_EDITABLE`). */
export const TRIP_LOCKED_STATUSES = ['DELIVERED', 'CANCELLED'] as const satisfies readonly TripStatus[];
export const isTripEditable = (trip: Pick<TripRow, 'status'>): boolean =>
  !(TRIP_LOCKED_STATUSES as readonly TripStatus[]).includes(trip.status);
/** `DELETE /trips/:id` refuses a trip the driver is running (409 `TRIP_IN_PROGRESS`). */
export const isTripDeletable = (trip: Pick<TripRow, 'status'>): boolean => trip.status !== 'IN_PROGRESS';

/** 409 `TRIP_NOT_EDITABLE` — `PATCH /trips/:id` on a DELIVERED / CANCELLED trip. */
export function isTripNotEditable(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'TRIP_NOT_EDITABLE';
}

/** FE-14 — 409 `CONFLICT` with `details: { status }` (backend CODE-024 `tripStatusChanged`): the
 * driver app or another dispatcher moved the trip's status between the read and the write. The
 * `status` in `details` is the trip's new status, not a form field. */
export function isTripChangedConcurrently(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 409 && error.code === 'CONFLICT' && typeof error.details.status === 'string';
}

/** 409 `TRIP_IN_PROGRESS` — `DELETE /trips/:id` on a trip the driver is running. */
export function isTripInProgress(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'TRIP_IN_PROGRESS';
}

/** 404 from `/trips/:id` — the trip was already deleted (or never existed). */
export function isTripNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** `DELETE /trips/:id` — a hard delete (204, no body). `onDeleted` lets the board drop its
 * selection when the removed trip was the one on the route panel. */
export function useDeleteTrip({ onDeleted }: { onDeleted?: (tripId: string) => void } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tripId: string) => client.delete<null>(endpoints.trips.remove(tripId)),
    onSuccess: (_data, tripId) => {
      queryClient.removeQueries({ queryKey: qk.trip(tripId) });
      // `qkRoot.trips` also covers the unassigned-loads list (`['trips', 'unassigned-loads']`).
      void queryClient.invalidateQueries({ queryKey: qkRoot.trips });
      onDeleted?.(tripId);
    },
    onError: (error, tripId) => {
      // 404 — already gone: refresh the board and drop it like a successful delete would.
      // 409 `TRIP_IN_PROGRESS` — the driver started it since the board loaded: refresh its status.
      if (isTripNotFound(error)) {
        queryClient.removeQueries({ queryKey: qk.trip(tripId) });
        void queryClient.invalidateQueries({ queryKey: qkRoot.trips });
        onDeleted?.(tripId);
      } else if (isTripInProgress(error)) void queryClient.invalidateQueries({ queryKey: qkRoot.trips });
    },
  });
}

/** LIVE-003 — the dispatcher's lifecycle moves on the board: `Start trip` (ASSIGNED → IN_PROGRESS),
 * `Mark delivered` (IN_PROGRESS → DELIVERED, optionally with the actual `completedAt`) and
 * `Cancel trip`. All are `PATCH /trips/:id { status }` (backend `ALLOWED_TRANSITIONS`); a trip
 * whose status moved meanwhile (the driver app, another dispatcher) answers 409 and the board
 * refetches. */
export type TripLifecycleStatus = Extract<TripStatus, 'IN_PROGRESS' | 'DELIVERED' | 'CANCELLED'>;
export interface TripStatusActionInput {
  tripId: string;
  status: TripLifecycleStatus;
  completedAt?: string;
}

export function useTripStatusAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, status, completedAt }: TripStatusActionInput) =>
      client.patch<TripRow>(endpoints.trips.update(tripId), { status, ...(completedAt && { completedAt }) } satisfies UpdateTripPayload),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.trips });
    },
  });
}

/** Which lifecycle buttons a trip offers (the backend's allowed transitions, from the web). */
export const canStartTrip = (trip: Pick<TripRow, 'status'>): boolean => trip.status === 'ASSIGNED';
export const canDeliverTrip = (trip: Pick<TripRow, 'status'>): boolean => trip.status === 'IN_PROGRESS';
export const canCancelTrip = (trip: Pick<TripRow, 'status'>): boolean => isTripEditable(trip);

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
