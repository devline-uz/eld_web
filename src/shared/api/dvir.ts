// owner: web-dvir-safety — W-09 DVIR & Maintenance.
//
// `GET /dvir`, `GET /defects`, `GET /work-orders`, `GET /maintenance-schedules` all answer with
// the RAW Prisma rows (see web/backend-gaps.md WD-024 pattern) — `driverId`/`vehicleId` only, no
// name join, and `Defect` has no `assignedTo`/shop field at all (web/backend-gaps.md B-36). This
// module is the single place that (a) types the real response shapes and (b) joins one server
// page (or one bounded window) against the session-wide `/vehicles` and `/drivers` lookups
// (`shared/api/lookups.ts`) — fetched once per session, never per page, never per row (WD-073).
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from './client';
import { endpoints } from './endpoints';
import { qk, qkRoot } from './queryKeys';
import { typedCachePolicy } from './queryPolicy';
import { FILTER_WINDOW, useDriverMap, useVehicleMap } from './lookups';
import { compactParams, pagePolicy, usePagedQuery, type PageQueryOptions } from './paging';
import type { DriverRow, VehicleRow } from './vehicles';

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
  /** False when the DVIR reported defects but none sit inside the loaded defects window (B-66):
   * the DEFECTS column then shows `—` (unknown), never `None`. */
  defectsKnown: boolean;
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


/* --------------------------------------------------------------------- DVIRs */

/** Exactly `DvirListQueryDto` (page/limit/sort/vehicleId/driverId/repairStatus). */
export interface DvirsPageParams {
  [key: string]: string | number | boolean | undefined;
  page: number;
  limit: number;
  sort?: string;
  vehicleId?: string;
  driverId?: string;
  repairStatus?: RepairStatus;
}

export const dvirsPageQuery = (params: DvirsPageParams): PageQueryOptions<DvirRow> => ({
  queryKey: qk.dvirs(compactParams(params)),
  queryFn: () => client.list<DvirRow>(endpoints.dvir.list, compactParams(params)),
  ...pagePolicy('list'),
});

/** The newest DVIRs (`submittedAt` desc is the API default). One request serves the "Recent
 * DVIRs · Last 48 hours" list, the `DVIRs today` KPI and the 11.23 filter window (B-60). The
 * API has no date-range param, so a day with more than `RECENT_DVIR_WINDOW` submissions is
 * counted as `RECENT_DVIR_WINDOW+` (B-66). */
export const RECENT_DVIR_WINDOW = 200;
export const recentDvirsQuery = () => dvirsPageQuery({ page: 1, limit: RECENT_DVIR_WINDOW });

/** The newest defects (`createdAt` desc) — joined onto the recent DVIRs by `dvirId`; `/dvir`
 * does not embed its defects and `/defects` has no `dvirId` param (B-66). */
export const RECENT_DEFECT_WINDOW = 200;
export const recentDefectsQuery = () => defectsPageQuery({ page: 1, limit: RECENT_DEFECT_WINDOW });

export function joinDvirs(
  dvirs: DvirRow[],
  drivers: Map<string, DriverRow>,
  vehicles: Map<string, VehicleRow>,
  defects: DefectRow[],
): DvirTableRow[] {
  const defectsByDvir = new Map<string, DefectRow[]>();
  for (const defect of defects) {
    const list = defectsByDvir.get(defect.dvirId) ?? [];
    list.push(defect);
    defectsByDvir.set(defect.dvirId, list);
  }
  return dvirs.map((d) => {
    const own = defectsByDvir.get(d.id) ?? [];
    return {
      ...d,
      driver: drivers.get(d.driverId) ?? null,
      vehicle: vehicles.get(d.vehicleId) ?? null,
      defects: own,
      defectsKnown: d.vehicleCondition === 'SATISFACTORY' || own.length > 0,
    };
  });
}

/** W-09 `DVIRs` tab (WD-073): the newest `RECENT_DVIR_WINDOW` DVIRs, joined with the session-wide
 * driver/vehicle lookups and the newest defects. Filtering (48 h, search, 11.23 groups) is the
 * page's — it runs on this bounded window, never on a fetch-everything set. */
export function useRecentDvirs() {
  const dvirQuery = useQuery(recentDvirsQuery());
  const defectsQuery = useQuery(recentDefectsQuery());
  const { map: drivers, query: driversQuery } = useDriverMap();
  const { map: vehicles, query: vehiclesQuery } = useVehicleMap();

  const rows = useMemo(
    (): DvirTableRow[] => joinDvirs(dvirQuery.data?.items ?? [], drivers, vehicles, defectsQuery.data?.items ?? []),
    [dvirQuery.data, defectsQuery.data, drivers, vehicles],
  );

  return {
    rows,
    page: dvirQuery.data,
    /** True when the window is full — a "today" count may then be a floor (B-66). */
    windowFull: (dvirQuery.data?.items.length ?? 0) >= RECENT_DVIR_WINDOW,
    isLoading: dvirQuery.isLoading,
    isError: dvirQuery.isError && !dvirQuery.data,
    error: dvirQuery.error ?? driversQuery.error ?? vehiclesQuery.error,
    refetch: () => void dvirQuery.refetch(),
  };
}

export function useDvir(id: string | undefined) {
  const dvirQuery = useQuery({
    queryKey: qk.dvir(id ?? ''),
    queryFn: () => client.get<DvirDetail>(endpoints.dvir.detail(id as string)),
    enabled: Boolean(id),
    ...typedCachePolicy<DvirDetail>('reference'),
  });
  const { map: drivers } = useDriverMap();
  const { map: vehicles } = useVehicleMap();
  const driver = dvirQuery.data ? drivers.get(dvirQuery.data.driverId) ?? null : null;
  const vehicle = dvirQuery.data ? vehicles.get(dvirQuery.data.vehicleId) ?? null : null;

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

export const defectsPageQuery = (params: DefectListParams): PageQueryOptions<DefectRow> => ({
  queryKey: qk.defects(compactParams(params)),
  queryFn: () => client.list<DefectRow>(endpoints.defects.list, compactParams(params)),
  ...pagePolicy('list'),
});

function useJoinedDefects(items: DefectRow[]) {
  const { map: vehicles, query } = useVehicleMap();
  const rows = useMemo(
    (): DefectTableRow[] => items.map((d) => ({ ...d, vehicle: vehicles.get(d.vehicleId) ?? null })),
    [items, vehicles],
  );
  return { rows, vehiclesQuery: query };
}

/** A parameterised defects list (modals: "defects on this unit") — vehicle join from the lookup. */
export function useDefectsList(params: DefectListParams) {
  const defectsQuery = useQuery(defectsPageQuery(params));
  const { rows, vehiclesQuery } = useJoinedDefects(defectsQuery.data?.items ?? []);
  return {
    rows,
    page: defectsQuery.data,
    isLoading: defectsQuery.isLoading,
    isError: defectsQuery.isError && !defectsQuery.data,
    error: defectsQuery.error ?? vehiclesQuery.error,
    refetch: defectsQuery.refetch,
  };
}

export interface OpenDefectsInput {
  page: number;
  limit: number;
  /** Free text (unit / component / description) — `/defects` has no `q` (B-66), so a search
   * switches to the bounded newest-first window and matches in memory. */
  search: string;
}

/** W-09 "Open defects" table — one `status=OPEN` server page per render, plus the CRITICAL
 * count (`limit: 1`) for the KPI chip and the section subtitle. */
export function useOpenDefects({ page, limit, search }: OpenDefectsInput) {
  const { map: vehicles } = useVehicleMap();
  const needle = search.trim().toLowerCase();
  const paged = usePagedQuery<DefectRow>({
    server: defectsPageQuery({ page, limit, status: 'OPEN' }),
    window: defectsPageQuery({ page: 1, limit: FILTER_WINDOW, status: 'OPEN' }),
    useWindow: needle.length > 0,
    page,
    limit,
    filter: (rows) =>
      rows.filter((d) =>
        [vehicles.get(d.vehicleId)?.unitNumber, d.category, d.description].some((t) => (t ?? '').toLowerCase().includes(needle)),
      ),
  });
  const critical = useQuery(defectsPageQuery({ page: 1, limit: 1, status: 'OPEN', severity: 'CRITICAL' }));
  const { rows } = useJoinedDefects(paged.items);
  return {
    rows,
    total: paged.total,
    totalPages: paged.totalPages,
    criticalCount: critical.data?.total ?? 0,
    isLoading: paged.isLoading,
    isError: paged.isError,
    refetch: paged.refetch,
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

export const workOrdersPageQuery = (params: WorkOrderListParams): PageQueryOptions<WorkOrderRow> => ({
  queryKey: qk.workOrders(compactParams(params)),
  queryFn: () => client.list<WorkOrderRow>(endpoints.workOrders.list, compactParams(params)),
  ...pagePolicy('list'),
});

/** One `GET /work-orders` page (`q`, `status`, `priority`, `vehicleId` are real params). */
export function useWorkOrdersList(params: WorkOrderListParams) {
  const woQuery = useQuery(workOrdersPageQuery(params));
  const { map: vehicles, query: vehiclesQuery } = useVehicleMap();

  const rows = useMemo(
    (): WorkOrderTableRow[] => (woQuery.data?.items ?? []).map((w) => ({ ...w, vehicle: vehicles.get(w.vehicleId) ?? null })),
    [woQuery.data, vehicles],
  );

  return {
    rows,
    page: woQuery.data,
    total: woQuery.data?.total ?? 0,
    totalPages: woQuery.data?.totalPages ?? 1,
    isLoading: woQuery.isLoading,
    isError: woQuery.isError && !woQuery.data,
    error: woQuery.error ?? vehiclesQuery.error,
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

export const schedulesPageQuery = (params: ScheduleListParams): PageQueryOptions<MaintenanceScheduleRow> => ({
  queryKey: qk.schedules(compactParams(params)),
  queryFn: () => client.list<MaintenanceScheduleRow>(endpoints.maintenanceSchedules.list, compactParams(params)),
  ...pagePolicy('list'),
});

function useJoinedSchedules(items: MaintenanceScheduleRow[]) {
  const { map: vehicles } = useVehicleMap();
  return useMemo(
    (): ScheduleTableRow[] => items.map((s) => ({ ...s, vehicle: vehicles.get(s.vehicleId) ?? null })),
    [items, vehicles],
  );
}

export interface SchedulesInput {
  page: number;
  limit: number;
  /** No `q` on `/maintenance-schedules` (B-66) — a search uses the bounded window. */
  search: string;
}

/** W-09 `Schedules` tab — one server page per render. */
export function useSchedulesList({ page, limit, search }: SchedulesInput) {
  const { map: vehicles } = useVehicleMap();
  const needle = search.trim().toLowerCase();
  const paged = usePagedQuery<MaintenanceScheduleRow>({
    server: schedulesPageQuery({ page, limit }),
    window: schedulesPageQuery({ page: 1, limit: FILTER_WINDOW }),
    useWindow: needle.length > 0,
    page,
    limit,
    filter: (rows) =>
      rows.filter((s) => [vehicles.get(s.vehicleId)?.unitNumber, s.name].some((t) => (t ?? '').toLowerCase().includes(needle))),
  });
  const rows = useJoinedSchedules(paged.items);
  return { rows, total: paged.total, totalPages: paged.totalPages, isLoading: paged.isLoading, isError: paged.isError, refetch: paged.refetch };
}

/** Every schedule currently DUE_SOON or OVERDUE (`dueOnly=true`, a real param) — the
 * `Overdue services` KPI and the "Upcoming maintenance" panel share this one bounded read. */
export const DUE_WINDOW = 500;
export const dueSchedulesQuery = () => schedulesPageQuery({ page: 1, limit: DUE_WINDOW, dueOnly: true });

export function useDueSchedules() {
  const query = useQuery(dueSchedulesQuery());
  const rows = useJoinedSchedules(query.data?.items ?? []);
  return { rows, isLoading: query.isLoading, isError: query.isError && !query.data, refetch: () => void query.refetch() };
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
