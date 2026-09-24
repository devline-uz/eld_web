// owner: web-vehicles-drivers — W-03 Vehicles, W-04 Unit profile, W-05 Unit histories.
//
// `GET /vehicles` and `GET /vehicles/:id` are real endpoints but answer with the RAW Prisma
// `Vehicle` row (see web/backend-gaps.md "Contract deviations"): the field is `odometerMi`, not
// `odometerMiles`, and there is no `assignedDriverId` or device join. This module is the single
// place that (a) types the real response shape, and (b) joins one server page against the
// session-wide `/drivers` and `/devices` lookups (`shared/api/lookups.ts`, gap B-35) — fetched
// once per session, never per page and never per row (WD-073).
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from './client';
import { endpoints } from './endpoints';
import { qk, qkRoot } from './queryKeys';
import { typedCachePolicy } from './queryPolicy';
import { useDevicesLookup, useDriversLookup, useVehiclesLookup, vehiclesLookupQuery } from './lookups';
import { compactParams, pagePolicy, usePagedQuery, type PageQueryOptions } from './paging';
import type { OffsetPage } from './types';

/** The real, raw `Vehicle` row (backend/prisma/schema.prisma `model Vehicle`). */
export interface VehicleRow {
  id: string;
  unitNumber: string;
  vin: string;
  make: string | null;
  model: string | null;
  year: number | null;
  licensePlate: string | null;
  plateState: string | null;
  fuelType: string;
  sleeperBerth: boolean;
  odometerMi: number;
  deviceOdometerMi: number | null;
  odometerOffsetMi: number;
  odometerCalibratedAt: string | null;
  engineHours: string | number;
  busType: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_SERVICE' | string;
  notes: string | null;
  activatedAt: string | null;
  createdAt: string;
}

/** The real, raw `Driver` row minus `passwordHash` (backend `DriverView`). */
export interface DriverRow {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  cdlNumber: string;
  cdlState: string;
  status: 'ACTIVE' | 'INACTIVE' | string;
  homeTerminalName: string;
  homeTerminalTimezone: string;
  fleetManagerId: string | null;
  assignedVehicleId: string | null;
  allowPersonalConveyance: boolean;
  allowYardMove: boolean;
  adverseDrivingEnabled: boolean;
  shortHaulException: boolean;
  splitSleeperEnabled: boolean;
  eldExempt: boolean;
  eldExemptReason: string | null;
  appVersion: string | null;
  appPlatform: string | null;
  registeredAt: string;
}

export interface DeviceRow {
  id: string;
  serial: string;
  model: string;
  status: string;
  vehicleId: string | null;
  bleState: 'CONNECTED' | 'DISCONNECTED' | string;
  firmwareVersion: string | null;
  firmwareOutdated: boolean;
  lastHeartbeatAt: string | null;
}

/** True odometer per web/tz.md §4.3: device + offset once a device reading exists. */
export function totalVehicleMiles(v: Pick<VehicleRow, 'odometerMi' | 'deviceOdometerMi' | 'odometerOffsetMi'>): number {
  if (v.deviceOdometerMi == null) return v.odometerMi;
  return v.deviceOdometerMi + v.odometerOffsetMi;
}

/** Row as the Vehicles table needs it — vehicle fields plus the client-joined driver/device. */
export interface VehicleTableRow extends VehicleRow {
  driver: DriverRow | null;
  eldSerial: string | null;
  eldDeviceStatus: string | null;
  eldDeviceModel: string | null;
  firmwareOutdated: boolean;
}

/** Lightweight vehicle list for pickers (Assign driver's unit dropdown, Add driver's "Assigned
 * unit" field) — the session-wide `reference` lookup (`shared/api/lookups.ts`), shared instead of
 * every picker re-fetching. */
export function useVehiclesPicker() {
  return useVehiclesLookup();
}

/** W-03 server-page params — exactly what `VehicleListQueryDto` accepts (page/limit/sort/q/status). */
export interface VehiclesPageParams {
  [key: string]: string | number | boolean | undefined;
  page: number;
  limit: number;
  q?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_SERVICE';
  sort?: string;
}

export const VEHICLES_DEFAULT_PAGE: VehiclesPageParams = { page: 1, limit: 10 };

/** One `GET /vehicles` page — shared by the W-03 table and the sidebar prefetch (WD-073). */
export const vehiclesPageQuery = (params: VehiclesPageParams): PageQueryOptions<VehicleRow> => ({
  queryKey: qk.vehicles(compactParams(params)),
  queryFn: ({ signal }) => client.list<VehicleRow>(endpoints.vehicles.list, compactParams(params), { signal }),
  ...pagePolicy('list'),
});

/** `total` of a status slice via `limit: 1` — the same keys the Dashboard KPI tiles use. */
export const vehiclesCountQuery = (status?: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_SERVICE'): PageQueryOptions<VehicleRow> => ({
  queryKey: qk.vehicles(compactParams({ status, limit: 1 })),
  queryFn: ({ signal }) => client.list<VehicleRow>(endpoints.vehicles.list, compactParams({ status, limit: 1 }), { signal }),
  ...pagePolicy('list'),
});

export function joinVehicles(vehicles: VehicleRow[], drivers: DriverRow[], devices: DeviceRow[]): VehicleTableRow[] {
  const driverByVehicle = new Map(drivers.filter((d) => d.assignedVehicleId).map((d) => [d.assignedVehicleId as string, d]));
  const deviceByVehicle = new Map(devices.filter((d) => d.vehicleId).map((d) => [d.vehicleId as string, d]));
  return vehicles.map((v) => {
    const device = deviceByVehicle.get(v.id) ?? null;
    return {
      ...v,
      driver: driverByVehicle.get(v.id) ?? null,
      eldSerial: device?.serial ?? null,
      eldDeviceStatus: device?.status ?? null,
      eldDeviceModel: device?.model ?? null,
      firmwareOutdated: device?.firmwareOutdated ?? false,
    };
  });
}

export interface VehiclesListInput {
  /** Server page — `page`, `limit`, `q`, `status`. */
  params: VehiclesPageParams;
  /** True while a client-only 11.23 group or the UNASSIGNED segment is active (B-54): the newest
   * `FILTER_WINDOW` units are loaded once and filtered in memory instead of one server page. */
  useWindow: boolean;
  /** Runs against the joined window rows only. */
  filter: (rows: VehicleTableRow[]) => VehicleTableRow[];
}

/** W-03 Vehicles table — one `/vehicles` page per render plus the session-wide `/drivers` and
 * `/devices` lookups (reference-cached, fetched once, never per page) for the DRIVER and
 * ELD SERIAL columns (WD-073). */
export function useVehiclesList({ params, useWindow, filter }: VehiclesListInput) {
  const driversQuery = useDriversLookup();
  const devicesQuery = useDevicesLookup();
  const drivers = driversQuery.data?.items;
  const devices = devicesQuery.data?.items;

  const paged = usePagedQuery<VehicleRow>({
    server: vehiclesPageQuery(params),
    window: vehiclesLookupQuery(),
    useWindow,
    page: params.page,
    limit: params.limit,
    filter: (rows) => filter(joinVehicles(rows, drivers ?? [], devices ?? [])).map((r) => r as VehicleRow),
  });

  const rows = useMemo(
    () => joinVehicles(paged.items, drivers ?? [], devices ?? []),
    [paged.items, drivers, devices],
  );
  /** The whole fleet (window mode only) — feeds the drawer's option lists. */
  const fleetRows = useMemo(
    () => joinVehicles(paged.windowRows, drivers ?? [], devices ?? []),
    [paged.windowRows, drivers, devices],
  );

  return {
    rows,
    total: paged.total,
    totalPages: paged.totalPages,
    page: paged.page,
    mode: paged.mode,
    isLoading: paged.isLoading,
    isFetching: paged.isFetching,
    // WB-038 — a transient failure of the supporting `/drivers` or `/devices` lookup (used only
    // to join the DRIVER / ELD SERIAL columns) must not blank a table that has good rows. Only
    // the primary list going without any data at all is a real error state; the joins degrade
    // to `Unassigned` / `Not assigned` already.
    isError: paged.isError,
    error: paged.error ?? driversQuery.error ?? devicesQuery.error,
    refetch: paged.refetch,
    fleetRows,
    driversLookup: driversQuery,
    devicesLookup: devicesQuery,
  };
}

/** Segment counters `All · Active · Inactive · Unassigned` without loading the fleet: three
 * `limit: 1` totals (cached 60 s, shared with the Dashboard tiles) plus the drivers lookup —
 * a unit is "unassigned" when no driver row points at it, exactly the DRIVER column's rule. */
export function useVehicleCounts() {
  const all = useQuery(vehiclesCountQuery());
  const active = useQuery(vehiclesCountQuery('ACTIVE'));
  const inactive = useQuery(vehiclesCountQuery('INACTIVE'));
  const drivers = useDriversLookup();
  const assigned = useMemo(
    () => new Set((drivers.data?.items ?? []).map((d) => d.assignedVehicleId).filter(Boolean)).size,
    [drivers.data],
  );
  const total = all.data?.total ?? 0;
  return {
    all: total,
    active: active.data?.total ?? 0,
    inactive: inactive.data?.total ?? 0,
    unassigned: drivers.data ? Math.max(0, total - assigned) : 0,
    isLoading: all.isLoading || active.isLoading || inactive.isLoading,
  };
}

export function useVehicle(id: string | undefined) {
  return useQuery({
    queryKey: qk.vehicle(id ?? ''),
    queryFn: ({ signal }) => client.get<VehicleRow>(endpoints.vehicles.detail(id as string), { signal }),
    enabled: Boolean(id),
    ...typedCachePolicy<VehicleRow>('reference'),
  });
}

/** The driver currently assigned to a unit — B-35 style client join, read from the session-wide
 * `/drivers` lookup (no extra request when Vehicles / Trips / DVIR already loaded it). */
export function useVehicleAssignedDriver(vehicleId: string | undefined) {
  const query = useDriversLookup(Boolean(vehicleId));
  const data = useMemo(
    () => (query.data ? (query.data.items.find((d) => d.assignedVehicleId === vehicleId) ?? null) : undefined),
    [query.data, vehicleId],
  );
  return { ...query, data };
}

/** Session-wide `/devices` lookup join. B-35 shipped `GET /devices?vehicleId=` — a screen that only
 * needs one unit's device should prefer `useDevicesForVehicle` (below), which asks the server. */
export function useVehicleDevice(vehicleId: string | undefined) {
  const query = useDevicesLookup(Boolean(vehicleId));
  const data = useMemo(
    () => (query.data ? (query.data.items.find((d) => d.vehicleId === vehicleId) ?? null) : undefined),
    [query.data, vehicleId],
  );
  return { ...query, data };
}

export interface DtcItem {
  id: string;
  vehicleId: string;
  spn: number;
  fmi: number;
  occurrence: number;
  source: string;
  description: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  clearedAt: string | null;
}

export function useVehicleDtc(vehicleId: string | undefined) {
  return useQuery({
    queryKey: qk.vehicleDtc(vehicleId ?? ''),
    queryFn: ({ signal }) => client.get<{ items: DtcItem[] }>(endpoints.vehicles.dtc(vehicleId as string), { signal }),
    enabled: Boolean(vehicleId),
    ...typedCachePolicy<{ items: DtcItem[] }>('list'),
  });
}

/** B-5 (shipped 2026-09-24) — `VehicleActivityItem` in backend `vehicles.service.ts`: audit trail +
 * DVIR submissions for the unit. */
export interface VehicleActivityItem {
  id: string;
  occurredAt: string;
  activity: string;
  driverName: string | null;
  source: string;
  details: string;
}

export function useVehicleActivities(vehicleId: string | undefined) {
  return useQuery({
    queryKey: qk.vehicleActivities(vehicleId ?? ''),
    queryFn: ({ signal }) => client.get<{ items: VehicleActivityItem[] }>(endpoints.vehicles.activities(vehicleId as string), { signal }),
    enabled: Boolean(vehicleId),
    ...typedCachePolicy<{ items: VehicleActivityItem[] }>('list'),
  });
}

/** B-4 (shipped 2026-09-24) — server-side DRIVE/STOP/IDLE segmentation of one day
 * (`backend/src/modules/vehicles/lib/vehicle-histories.ts`). Never a client-side telemetry fan-out. */
export interface RouteSegment {
  marker: string;
  type: 'DRIVE' | 'STOP' | 'IDLE';
  startAt: string;
  endAt: string;
  durationSec: number;
  location: string;
  distanceMi: number | null;
  odometerMi: number;
  driverName: string;
  lat: number;
  lon: number;
}

export interface VehicleHistoriesResponse {
  date: string;
  distanceMi: number;
  driveSegments: number;
  driveTimeSec: number;
  avgSpeedMph: number;
  stopCount: number;
  stopTimeSec: number;
  idleTimeSec: number;
  idleFuelWastedGal: number;
  /** Null on a day with no movement. */
  firstMovementAt: string | null;
  lastMovementAt: string | null;
  engineOnSec: number;
  engineOffSec: number;
  longestDrive: { label: string; durationSec: number };
  longestStop: { label: string; durationSec: number };
  maxSpeedMph: number;
  maxSpeedAt: string | null;
  segments: RouteSegment[];
}

export function useVehicleHistories(vehicleId: string | undefined, date: string) {
  return useQuery({
    queryKey: qk.vehicleHistories(vehicleId ?? '', date),
    queryFn: ({ signal }) => client.get<VehicleHistoriesResponse>(endpoints.vehicles.histories(vehicleId as string), { params: { date }, signal }),
    enabled: Boolean(vehicleId && date),
    ...typedCachePolicy<VehicleHistoriesResponse>('list'),
  });
}

/* ---------------------------------------------------------------------- mutations */

export interface CreateVehiclePayload {
  unitNumber: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  licensePlate?: string;
  plateState?: string;
  fuelType?: string;
  sleeperBerth?: boolean;
  odometerMi?: number;
  notes?: string;
  deviceId?: string;
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateVehiclePayload) => client.post<VehicleRow>(endpoints.vehicles.create, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.vehicles });
    },
  });
}

export function useUpdateVehicle(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CreateVehiclePayload> & { status?: string }) =>
      client.patch<VehicleRow>(endpoints.vehicles.update(id), payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.vehicles });
      void queryClient.invalidateQueries({ queryKey: qk.vehicle(id) });
    },
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.delete(endpoints.vehicles.remove(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.vehicles });
    },
  });
}

export function useAssignDriver(vehicleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    /** B-74 `notify` — push the driver about the assignment. B-13: allowed at `vehicles` FULL OR `trips` FULL. */
    mutationFn: (payload: { driverId: string; effectiveAt?: string; notify?: boolean }) =>
      client.post<VehicleRow>(endpoints.vehicles.assignDriver(vehicleId), payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.vehicles });
      void queryClient.invalidateQueries({ queryKey: qkRoot.drivers });
      void queryClient.invalidateQueries({ queryKey: qk.vehicle(vehicleId) });
    },
  });
}

export function useCalibrateOdometer(vehicleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { odometerMi: number }) =>
      client.post<VehicleRow>(endpoints.vehicles.calibrateOdometer(vehicleId), payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.vehicle(vehicleId) });
      void queryClient.invalidateQueries({ queryKey: qkRoot.vehicles });
    },
  });
}

export interface ImportSummary {
  imported: number;
  updated: number;
  /** B-69 — present when `options.duplicateStrategy` is `SKIP`. */
  skipped?: number;
  failed: Array<{ index: number; error: string }>;
}

/** B-69 (shipped) — `ImportVehiclesOptionsDto`. */
export interface ImportVehiclesOptions {
  duplicateStrategy?: 'UPDATE_BY_VIN' | 'SKIP' | 'CREATE';
  /** Backfills `notes` on rows that omit it (Vehicle has no terminal column, backend D-099). */
  defaultTerminal?: string;
  /** Pairs each row's `deviceSerial` to the created/updated unit. */
  pairDevices?: boolean;
  /** Emails the import result to the calling user (Q-2: email only). */
  emailSummary?: boolean;
}

export function useImportVehicles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { vehicles: Array<Record<string, unknown>>; options?: ImportVehiclesOptions }) =>
      client.post<ImportSummary>(endpoints.vehicles.import, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.vehicles });
    },
  });
}

/* ---------------------------------------------------------------------- Phase 13 (2026-09-24) */

/** One `TelemetryPoint` row (Prisma). Decimal columns serialise as strings. */
export interface TelemetryPointRow {
  time: string;
  vehicleId: string;
  driverId: string | null;
  latitude: number | string;
  longitude: number | string;
  speedMph: number | null;
  headingDeg: number | null;
  odometerMi: number | null;
  engineHours: number | string | null;
  idleHours: number | string | null;
  engineOn: boolean | null;
  rpm: number | null;
  fuelPct: number | null;
  defPct: number | null;
  fuelEconomyMpg: number | string | null;
  coolantTempC: number | null;
  oilTempC: number | null;
  voltage: number | string | null;
  dtcCount: number | null;
  [key: string]: unknown;
}

export interface VehicleTelemetryParams {
  [key: string]: string | number | undefined;
  from?: string;
  to?: string;
  /** 1…2000, backend default 500. The W-04 status card needs `limit: 1`. */
  limit?: number;
}

/** `GET /vehicles/:id/telemetry` — newest first. `vehicles` READ. */
export function useVehicleTelemetry(vehicleId: string | undefined, params: VehicleTelemetryParams = { limit: 1 }) {
  return useQuery({
    queryKey: qk.vehicleTelemetry(vehicleId ?? '', params),
    queryFn: ({ signal }) =>
      client.get<{ items: TelemetryPointRow[] }>(endpoints.vehicles.telemetry(vehicleId as string), { params, signal }),
    enabled: Boolean(vehicleId),
    ...typedCachePolicy<{ items: TelemetryPointRow[] }>('live'),
  });
}

export type VehicleStatus = 'ACTIVE' | 'INACTIVE' | 'OUT_OF_SERVICE';

export interface BulkStatusResult {
  updated: string[];
  /** Each id is checked against the OOS hard rule on its own; a refused one lands here. */
  failed: Array<{ id: string; error: string }>;
}

/** B-71 — `PATCH /vehicles/bulk-status`, `vehicles` FULL. Partial success is a 200: read `failed`. */
export function useBulkVehicleStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { ids: string[]; status: VehicleStatus }) =>
      client.patch<BulkStatusResult>(endpoints.vehicles.bulkStatus, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.vehicles });
    },
  });
}

/** B-35 — `GET /devices?vehicleId=`: the device(s) paired to one unit, asked of the server. */
export interface VehicleDeviceRow {
  id: string;
  serial: string;
  model: 'PT30' | 'PT40';
  status: string;
  vehicleId: string | null;
  bleState: string;
  firmwareVersion: string | null;
  firmwareOutdated: boolean;
  lastHeartbeatAt: string | null;
}

export function useDevicesForVehicle(vehicleId: string | undefined, enabled = true) {
  const params = compactParams({ vehicleId, limit: 5 });
  return useQuery({
    queryKey: qk.devices(params),
    queryFn: ({ signal }) => client.list<VehicleDeviceRow>(endpoints.devices.list, params, { signal }),
    enabled: enabled && Boolean(vehicleId),
    ...typedCachePolicy<OffsetPage<VehicleDeviceRow>>('list'),
  });
}

/* ---- B-7 co-driver pairings (team driving) */

export interface CoDriverPairingRow {
  id: string;
  primaryDriverId: string;
  coDriverId: string;
  vehicleId: string;
  startedAt: string;
  endedAt: string | null;
}

export interface CoDriverPairingParams {
  [key: string]: string | number | boolean | undefined;
  vehicleId?: string;
  driverId?: string;
  active?: boolean;
  page?: number;
  limit?: number;
}

/** `GET /co-driver-pairings` — offset page. W-04 co-driver row: `{ vehicleId, active: true, limit: 1 }`. */
export function useCoDriverPairings(params: CoDriverPairingParams, enabled = true) {
  const clean = compactParams(params);
  return useQuery({
    queryKey: qk.coDriverPairings(clean),
    queryFn: ({ signal }) => client.list<CoDriverPairingRow>(endpoints.coDriverPairings.list, clean, { signal }),
    enabled,
    ...typedCachePolicy<OffsetPage<CoDriverPairingRow>>('list'),
  });
}

export function useCreateCoDriverPairing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { primaryDriverId: string; coDriverId: string; vehicleId: string; startedAt?: string }) =>
      client.post<CoDriverPairingRow>(endpoints.coDriverPairings.create, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.coDriverPairings });
    },
  });
}

export function useEndCoDriverPairing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.post<{ id: string; endedAt: string }>(endpoints.coDriverPairings.end(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.coDriverPairings });
    },
  });
}
