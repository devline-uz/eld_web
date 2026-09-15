// owner: web-vehicles-drivers — W-03 Vehicles, W-04 Unit profile, W-05 Unit histories.
//
// `GET /vehicles` and `GET /vehicles/:id` are real endpoints but answer with the RAW Prisma
// `Vehicle` row (see web/backend-gaps.md "Contract deviations"): the field is `odometerMi`, not
// `odometerMiles`, and there is no `assignedDriverId` or device join. This module is the single
// place that (a) types the real response shape, and (b) does the client-side join against
// `GET /drivers` (for the assigned driver) and `GET /devices` (for the paired ELD serial, gap
// B-35) — ONE extra list call per screen render, never per row.
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from './client';
import { endpoints } from './endpoints';
import { qk, qkRoot } from './queryKeys';
import { typedCachePolicy } from './queryPolicy';
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

export interface VehicleListParams {
  [key: string]: string | number | boolean | undefined;
  page?: number;
  limit?: number;
  sort?: string;
  q?: string;
  status?: string;
}

/** Row as the Vehicles table needs it — vehicle fields plus the client-joined driver/device. */
export interface VehicleTableRow extends VehicleRow {
  driver: DriverRow | null;
  eldSerial: string | null;
  eldDeviceStatus: string | null;
  eldDeviceModel: string | null;
  firmwareOutdated: boolean;
}

function joinVehicles(vehicles: VehicleRow[], drivers: DriverRow[], devices: DeviceRow[]): VehicleTableRow[] {
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

/** Lightweight vehicle list for pickers (Assign driver's unit dropdown, Add driver's "Assigned
 * unit" field) — one `reference`-cached call, shared instead of every picker re-fetching. */
export function useVehiclesPicker() {
  return useQuery({
    queryKey: qk.vehicles({ limit: 500 }),
    queryFn: () => client.list<VehicleRow>(endpoints.vehicles.list, { limit: 500 }),
    ...typedCachePolicy<OffsetPage<VehicleRow>>('reference'),
  });
}

/** W-03 Vehicles table. One `/vehicles` page call + one full `/drivers` + `/devices` list
 * (cached, `reference` policy) to resolve the DRIVER and ELD SERIAL columns client-side. */
export function useVehiclesList(params: VehicleListParams) {
  const vehiclesQuery = useQuery({
    queryKey: qk.vehicles(params),
    queryFn: () => client.list<VehicleRow>(endpoints.vehicles.list, params),
    ...typedCachePolicy<OffsetPage<VehicleRow>>('list'),
  });
  const driversQuery = useQuery({
    queryKey: qk.drivers({ limit: 500 }),
    queryFn: () => client.list<DriverRow>(endpoints.drivers.list, { limit: 500 }),
    ...typedCachePolicy<OffsetPage<DriverRow>>('reference'),
  });
  const devicesQuery = useQuery({
    queryKey: qk.devices({ limit: 500 }),
    queryFn: () => client.list<DeviceRow>(endpoints.devices.list, { limit: 500 }),
    ...typedCachePolicy<OffsetPage<DeviceRow>>('reference'),
  });

  const rows = useMemo(
    () => joinVehicles(vehiclesQuery.data?.items ?? [], driversQuery.data?.items ?? [], devicesQuery.data?.items ?? []),
    [vehiclesQuery.data, driversQuery.data, devicesQuery.data],
  );

  return {
    rows,
    page: vehiclesQuery.data,
    isLoading: vehiclesQuery.isLoading,
    // WB-038 — a transient failure of the supporting `/drivers` or `/devices` lookup (used only
    // to join the DRIVER / ELD SERIAL columns) used to blank the whole table even while
    // `vehiclesQuery` still held good cached rows. Only the primary list going without any data
    // at all is a real error state; the joins degrade to `Unassigned` / `Not assigned` already.
    isError: vehiclesQuery.isError && !vehiclesQuery.data,
    error: vehiclesQuery.error ?? driversQuery.error ?? devicesQuery.error,
    refetch: vehiclesQuery.refetch,
  };
}

export function useVehicle(id: string | undefined) {
  return useQuery({
    queryKey: qk.vehicle(id ?? ''),
    queryFn: () => client.get<VehicleRow>(endpoints.vehicles.detail(id as string)),
    enabled: Boolean(id),
    ...typedCachePolicy<VehicleRow>('reference'),
  });
}

/** The driver currently assigned to a unit — B-35 style client join against `/drivers`. */
export function useVehicleAssignedDriver(vehicleId: string | undefined) {
  return useQuery({
    queryKey: qk.vehicleAssignedDriver(vehicleId ?? ''),
    queryFn: async () => {
      const page = await client.list<DriverRow>(endpoints.drivers.list, { limit: 500 });
      return page.items.find((d) => d.assignedVehicleId === vehicleId) ?? null;
    },
    enabled: Boolean(vehicleId),
    ...typedCachePolicy<DriverRow | null>('reference'),
  });
}

/** ⛔ GAP B-35 — no `GET /devices?vehicleId=` filter; list once and find client-side. */
export function useVehicleDevice(vehicleId: string | undefined) {
  return useQuery({
    queryKey: qk.vehicleDevice(vehicleId ?? ''),
    queryFn: async () => {
      const page = await client.list<DeviceRow>(endpoints.devices.list, { limit: 500 });
      return page.items.find((d) => d.vehicleId === vehicleId) ?? null;
    },
    enabled: Boolean(vehicleId),
    ...typedCachePolicy<DeviceRow | null>('reference'),
  });
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
    queryFn: () => client.get<{ items: DtcItem[] }>(endpoints.vehicles.dtc(vehicleId as string)),
    enabled: Boolean(vehicleId),
    ...typedCachePolicy<{ items: DtcItem[] }>('list'),
  });
}

/** ⛔ GAP B-5 — `GET /vehicles/:id/activities` does not exist; MSW answers the §20 shape. */
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
    queryFn: () => client.get<{ items: VehicleActivityItem[] }>(endpoints.vehicles.activities(vehicleId as string)),
    enabled: Boolean(vehicleId),
    ...typedCachePolicy<{ items: VehicleActivityItem[] }>('list'),
  });
}

/** ⛔ GAP B-4 — `GET /vehicles/:id/histories?date=` does not exist; W-05 does not ship for real
 * without it (web/tz.md §10 W-05). MSW answers the documented segment shape so the screen can be
 * built and reviewed; it is not wired to a client-side telemetry fan-out (60k points, rejected
 * by tz.md itself). */
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
  firstMovementAt: string;
  lastMovementAt: string;
  engineOnSec: number;
  engineOffSec: number;
  longestDrive: { label: string; durationSec: number };
  longestStop: { label: string; durationSec: number };
  maxSpeedMph: number;
  maxSpeedAt: string;
  segments: RouteSegment[];
}

export function useVehicleHistories(vehicleId: string | undefined, date: string) {
  return useQuery({
    queryKey: qk.vehicleHistories(vehicleId ?? '', date),
    queryFn: () => client.get<VehicleHistoriesResponse>(endpoints.vehicles.histories(vehicleId as string), { params: { date } }),
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
    mutationFn: (payload: { driverId: string; effectiveAt?: string }) =>
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
  failed: Array<{ index: number; error: string }>;
}

export function useImportVehicles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { vehicles: Array<Record<string, unknown>> }) =>
      client.post<ImportSummary>(endpoints.vehicles.import, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.vehicles });
    },
  });
}
