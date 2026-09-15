// owner: web-dvir-safety — W-09 DVIR & Maintenance.
//
// `GET /dvir`, `GET /defects`, `GET /work-orders`, `GET /maintenance-schedules` all answer with
// the RAW Prisma rows (see web/backend-gaps.md WD-024 pattern) — `driverId`/`vehicleId` only, no
// name join, and `Defect` has no `assignedTo`/shop field at all (web/backend-gaps.md B-36). This
// module is the single place that (a) types the real response shapes and (b) does the
// client-side joins against `GET /vehicles` and `GET /drivers` (reference-cached, one extra list
// call, not one per row — the same pattern as `shared/api/vehicles.ts`).
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from './client';
import { endpoints } from './endpoints';
import { qk, qkRoot } from './queryKeys';
import { typedCachePolicy } from './queryPolicy';
import type { OffsetPage } from './types';
import { useDriversList } from './drivers';
import { useVehiclesPicker, type DriverRow, type VehicleRow } from './vehicles';

/* --------------------------------------------------------------------- raw shapes (Prisma) */

export type DvirType = 'PRE_TRIP' | 'POST_TRIP' | 'INTERMEDIATE';
export type DvirCondition = 'SATISFACTORY' | 'DEFECTS_FOUND';
export type RepairStatus = 'NOT_REQUIRED' | 'PENDING' | 'REPAIRED' | 'DEFERRED';
export type DefectSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL';
export type DefectStatus = 'OPEN' | 'IN_PROGRESS' | 'REPAIRED' | 'DEFERRED';
export type WorkOrderStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
export type WorkOrderPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type MaintenanceDueState = 'OK' | 'DUE_SOON' | 'OVERDUE';

export interface AttachmentRow {
  id: string;
  key: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface DvirRow {
  id: string;
  driverId: string;
  vehicleId: string;
  trailerId: string | null;
  type: DvirType;
  submittedAt: string;
  odometerMi: number;
  latitude: number | string | null;
  longitude: number | string | null;
  locationName: string | null;
  vehicleCondition: DvirCondition;
  driverSignatureUrl: string;
  notes: string | null;
  mechanicName: string | null;
  mechanicSignedAt: string | null;
  mechanicNote: string | null;
  repairStatus: RepairStatus;
  nextDriverReviewedAt: string | null;
  createdAt: string;
}

export interface DvirDetail extends DvirRow {
  defects: DefectRow[];
  photos: AttachmentRow[];
}

export interface DefectRow {
  id: string;
  dvirId: string;
  vehicleId: string;
  category: string;
  part: 'TRUCK' | 'TRAILER';
  severity: DefectSeverity;
  description: string;
  status: DefectStatus;
  outOfService: boolean;
  workOrderId: string | null;
  resolvedAt: string | null;
  resolvedById: string | null;
  resolutionNote: string | null;
  createdAt: string;
  photos?: AttachmentRow[];
}

export interface WorkOrderRow {
  id: string;
  number: string;
  vehicleId: string;
  title: string;
  description: string | null;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  vendor: string | null;
  costUsd: string | number | null;
  odometerMi: number | null;
  openedById: string;
  openedAt: string;
  dueAt: string | null;
  closedAt: string | null;
}

export interface MaintenanceDue {
  state: MaintenanceDueState;
  nextDueMi: number | null;
  nextDueAt: string | null;
  milesRemaining: number | null;
  daysRemaining: number | null;
}

export interface MaintenanceScheduleRow {
  id: string;
  vehicleId: string;
  name: string;
  intervalMi: number | null;
  intervalDays: number | null;
  lastServiceMi: number | null;
  lastServiceAt: string | null;
  nextDueMi: number | null;
  nextDueAt: string | null;
  enabled: boolean;
  due: MaintenanceDue;
}

/* --------------------------------------------------------------------- client-joined rows */

export interface DvirTableRow extends DvirRow {
  driver: DriverRow | null;
  vehicle: VehicleRow | null;
  defects: DefectRow[];
}

export interface DefectTableRow extends DefectRow {
  vehicle: VehicleRow | null;
}

export interface WorkOrderTableRow extends WorkOrderRow {
  vehicle: VehicleRow | null;
}

export interface ScheduleTableRow extends MaintenanceScheduleRow {
  vehicle: VehicleRow | null;
}

function driverMap(drivers: DriverRow[]): Map<string, DriverRow> {
  return new Map(drivers.map((d) => [d.id, d]));
}
function vehicleMap(vehicles: VehicleRow[]): Map<string, VehicleRow> {
  return new Map(vehicles.map((v) => [v.id, v]));
}

/* --------------------------------------------------------------------- DVIRs */

export interface DvirListParams {
  [key: string]: string | number | boolean | undefined;
  page?: number;
  limit?: number;
  sort?: string;
  vehicleId?: string;
  driverId?: string;
  repairStatus?: RepairStatus;
}

/** W-09 `DVIRs` tab. One `/dvir` page call + one full `/defects` list (`reference`-cached) to
 * resolve the DEFECTS column without a per-row fan-out, plus the shared driver/vehicle joins. */
export function useDvirsList(params: DvirListParams) {
  const dvirQuery = useQuery({
    queryKey: qk.dvirs(params),
    queryFn: () => client.list<DvirRow>(endpoints.dvir.list, params),
    ...typedCachePolicy<OffsetPage<DvirRow>>('list'),
  });
  const defectsQuery = useQuery({
    queryKey: qk.defects({ limit: 500 }),
    queryFn: () => client.list<DefectRow>(endpoints.defects.list, { limit: 500 }),
    ...typedCachePolicy<OffsetPage<DefectRow>>('list'),
  });
  const driversQuery = useDriversList({ limit: 500 });
  const vehiclesQuery = useVehiclesPicker();

  const rows = useMemo((): DvirTableRow[] => {
    const drivers = driverMap(driversQuery.data?.items ?? []);
    const vehicles = vehicleMap(vehiclesQuery.data?.items ?? []);
    const defectsByDvir = new Map<string, DefectRow[]>();
    for (const defect of defectsQuery.data?.items ?? []) {
      const list = defectsByDvir.get(defect.dvirId) ?? [];
      list.push(defect);
      defectsByDvir.set(defect.dvirId, list);
    }
    return (dvirQuery.data?.items ?? []).map((d) => ({
      ...d,
      driver: drivers.get(d.driverId) ?? null,
      vehicle: vehicles.get(d.vehicleId) ?? null,
      defects: defectsByDvir.get(d.id) ?? [],
    }));
  }, [dvirQuery.data, defectsQuery.data, driversQuery.data, vehiclesQuery.data]);

  return {
    rows,
    page: dvirQuery.data,
    isLoading: dvirQuery.isLoading || driversQuery.isLoading || vehiclesQuery.isLoading,
    isError: dvirQuery.isError || driversQuery.isError || vehiclesQuery.isError,
    refetch: dvirQuery.refetch,
  };
}

export function useDvir(id: string | undefined) {
  const dvirQuery = useQuery({
    queryKey: qk.dvir(id ?? ''),
    queryFn: () => client.get<DvirDetail>(endpoints.dvir.detail(id as string)),
    enabled: Boolean(id),
    ...typedCachePolicy<DvirDetail>('reference'),
  });
  const driversQuery = useDriversList({ limit: 500 });
  const vehiclesQuery = useVehiclesPicker();

  const driver = useMemo(
    () => driversQuery.data?.items.find((d) => d.id === dvirQuery.data?.driverId) ?? null,
    [driversQuery.data, dvirQuery.data],
  );
  const vehicle = useMemo(
    () => vehiclesQuery.data?.items.find((v) => v.id === dvirQuery.data?.vehicleId) ?? null,
    [vehiclesQuery.data, dvirQuery.data],
  );

  return { ...dvirQuery, driver, vehicle };
}

export function useMechanicSignoff(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { mechanicName: string; mechanicNote?: string; repairStatus: RepairStatus }) =>
      client.post(endpoints.dvir.mechanicSignoff(id), payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.dvir(id) });
      void queryClient.invalidateQueries({ queryKey: qkRoot.dvir });
      void queryClient.invalidateQueries({ queryKey: qkRoot.defects });
    },
  });
}

/* --------------------------------------------------------------------- Defects */

export interface DefectListParams {
  [key: string]: string | number | boolean | undefined;
  page?: number;
  limit?: number;
  sort?: string;
  vehicleId?: string;
  status?: DefectStatus;
  severity?: DefectSeverity;
  outOfService?: boolean;
}

export function useDefectsList(params: DefectListParams) {
  const defectsQuery = useQuery({
    queryKey: qk.defects(params),
    queryFn: () => client.list<DefectRow>(endpoints.defects.list, params),
    ...typedCachePolicy<OffsetPage<DefectRow>>('list'),
  });
  const vehiclesQuery = useVehiclesPicker();

  const rows = useMemo((): DefectTableRow[] => {
    const vehicles = vehicleMap(vehiclesQuery.data?.items ?? []);
    return (defectsQuery.data?.items ?? []).map((d) => ({ ...d, vehicle: vehicles.get(d.vehicleId) ?? null }));
  }, [defectsQuery.data, vehiclesQuery.data]);

  return {
    rows,
    page: defectsQuery.data,
    isLoading: defectsQuery.isLoading || vehiclesQuery.isLoading,
    isError: defectsQuery.isError || vehiclesQuery.isError,
    refetch: defectsQuery.refetch,
  };
}

export function useDefect(id: string | undefined) {
  return useQuery({
    queryKey: qk.defect(id ?? ''),
    queryFn: () => client.get<DefectRow>(endpoints.defects.detail(id as string)),
    enabled: Boolean(id),
    ...typedCachePolicy<DefectRow>('reference'),
  });
}

export function useResolveDefect(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { status: 'REPAIRED' | 'DEFERRED'; resolutionNote?: string }) =>
      client.patch<DefectRow>(endpoints.defects.resolve(id), payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.defects });
      void queryClient.invalidateQueries({ queryKey: qk.defect(id) });
      void queryClient.invalidateQueries({ queryKey: qkRoot.vehicles });
      void queryClient.invalidateQueries({ queryKey: qkRoot.dvir });
    },
  });
}

export function useLinkDefectWorkOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workOrderId: string | null) =>
      client.patch<DefectRow>(endpoints.defects.workOrder(id), { workOrderId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.defects });
      void queryClient.invalidateQueries({ queryKey: qkRoot.workOrders });
    },
  });
}

/* --------------------------------------------------------------------- Work orders */

export interface WorkOrderListParams {
  [key: string]: string | number | boolean | undefined;
  page?: number;
  limit?: number;
  sort?: string;
  q?: string;
  vehicleId?: string;
  status?: WorkOrderStatus;
  priority?: WorkOrderPriority;
}

export function useWorkOrdersList(params: WorkOrderListParams) {
  const woQuery = useQuery({
    queryKey: qk.workOrders(params),
    queryFn: () => client.list<WorkOrderRow>(endpoints.workOrders.list, params),
    ...typedCachePolicy<OffsetPage<WorkOrderRow>>('list'),
  });
  const vehiclesQuery = useVehiclesPicker();

  const rows = useMemo((): WorkOrderTableRow[] => {
    const vehicles = vehicleMap(vehiclesQuery.data?.items ?? []);
    return (woQuery.data?.items ?? []).map((w) => ({ ...w, vehicle: vehicles.get(w.vehicleId) ?? null }));
  }, [woQuery.data, vehiclesQuery.data]);

  return {
    rows,
    page: woQuery.data,
    isLoading: woQuery.isLoading || vehiclesQuery.isLoading,
    isError: woQuery.isError || vehiclesQuery.isError,
    refetch: woQuery.refetch,
  };
}

export interface CreateWorkOrderPayload {
  vehicleId: string;
  title: string;
  description?: string;
  priority: WorkOrderPriority;
  vendor?: string;
  costUsd?: number;
  odometerMi?: number;
  dueAt?: string;
  defectIds?: string[];
}

export function useCreateWorkOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateWorkOrderPayload) => client.post<WorkOrderRow>(endpoints.workOrders.create, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.workOrders });
      void queryClient.invalidateQueries({ queryKey: qkRoot.defects });
      void queryClient.invalidateQueries({ queryKey: qkRoot.vehicles });
    },
  });
}

export function useCloseWorkOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => client.post<WorkOrderRow>(endpoints.workOrders.close(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.workOrders });
    },
  });
}

export function useCancelWorkOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => client.post<WorkOrderRow>(endpoints.workOrders.cancel(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.workOrders });
    },
  });
}

/* --------------------------------------------------------------------- Maintenance schedules */

export interface ScheduleListParams {
  [key: string]: string | number | boolean | undefined;
  page?: number;
  limit?: number;
  vehicleId?: string;
  enabled?: boolean;
  dueOnly?: boolean;
}

export function useSchedulesList(params: ScheduleListParams) {
  const scheduleQuery = useQuery({
    queryKey: qk.schedules(params),
    queryFn: () => client.list<MaintenanceScheduleRow>(endpoints.maintenanceSchedules.list, params),
    ...typedCachePolicy<OffsetPage<MaintenanceScheduleRow>>('list'),
  });
  const vehiclesQuery = useVehiclesPicker();

  const rows = useMemo((): ScheduleTableRow[] => {
    const vehicles = vehicleMap(vehiclesQuery.data?.items ?? []);
    return (scheduleQuery.data?.items ?? []).map((s) => ({ ...s, vehicle: vehicles.get(s.vehicleId) ?? null }));
  }, [scheduleQuery.data, vehiclesQuery.data]);

  return {
    rows,
    page: scheduleQuery.data,
    isLoading: scheduleQuery.isLoading || vehiclesQuery.isLoading,
    isError: scheduleQuery.isError || vehiclesQuery.isError,
    refetch: scheduleQuery.refetch,
  };
}

export function useCompleteSchedule(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { serviceOdometerMi?: number; serviceAt?: string }) =>
      client.post<MaintenanceScheduleRow>(endpoints.maintenanceSchedules.complete(id), payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.schedules() });
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.delete(endpoints.maintenanceSchedules.remove(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.schedules() });
    },
  });
}

export interface CreateSchedulePayload {
  vehicleId: string;
  name: string;
  intervalMi?: number;
  intervalDays?: number;
  lastServiceMi?: number;
  lastServiceAt?: string;
  enabled?: boolean;
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSchedulePayload) =>
      client.post<MaintenanceScheduleRow>(endpoints.maintenanceSchedules.create, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.schedules() });
    },
  });
}
