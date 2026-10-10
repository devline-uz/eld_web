// owner: web-dvir-safety — W-09 DEMO DATA wiring (easy to remove, see below).
//
// Drop-in wrappers around the `@/shared/api/dvir` hooks the DVIR page uses. Each one calls the
// real hook first and only swaps in `./dvirMockData.ts` rows when the API has nothing to show:
// the request failed, or it answered an empty list. Real data always wins.
//
// Switch — `VITE_DVIR_MOCK` in `eld_web/.env`:
//   (unset)    on as a fallback in `vite dev`, off in production builds
//   `fallback` on as a fallback in any build
//   `always`   ignore the API and always show the demo rows
//   `off`      never show demo rows
// Vitest (`MODE === 'test'`) is always `off`, so the page's own tests see the real hooks.
//
// To remove the demo entirely: delete `src/features/dvir/mock/` and change the imports in
// `DvirPage.tsx` and `components/DvirDrawer.tsx` back to `@/shared/api/dvir` / `@/shared/api/lookups`.
//
// Writes (resolve, assign, close, complete, sign-off …) still go to the real API; on a demo row
// they answer an error toast because the id does not exist on the server.
import { useMemo } from 'react';
import {
  useDueSchedules as useDueSchedulesApi,
  useDvir as useDvirApi,
  useOpenDefects as useOpenDefectsApi,
  useRecentDvirs as useRecentDvirsApi,
  useSchedulesList as useSchedulesListApi,
  useWorkOrdersList as useWorkOrdersListApi,
  recentDvirsCutoffMs,
  type DvirDetail,
  type OpenDefectsInput,
  type SchedulesInput,
  type WorkOrderListParams,
} from '@/shared/api/dvir';
import { useVehiclesLookup as useVehiclesLookupApi } from '@/shared/api/lookups';
import type { DriverRow, VehicleRow } from '@/shared/api/vehicles';
import { resolveMockMode, type MockMode } from '@/shared/lib/mockMode';
import { buildDvirMockData, MOCK_ID_PREFIX, type DvirMockData } from './dvirMockData';

export const DVIR_MOCK_MODE: MockMode = resolveMockMode(import.meta.env.VITE_DVIR_MOCK);

let cached: DvirMockData | null = null;
/** Built once per page load, so ids and timestamps stay stable across renders. */
function mockData(): DvirMockData {
  cached ??= buildDvirMockData();
  return cached;
}

/** Use demo rows for one section? Never while the real request is still in flight. */
function shouldMock(real: { isLoading: boolean; isError: boolean }, realCount: number): boolean {
  if (DVIR_MOCK_MODE === 'off') return false;
  if (DVIR_MOCK_MODE === 'always') return true;
  if (real.isLoading) return false;
  return real.isError || realCount === 0;
}

function pageOf<T>(rows: T[], page: number, limit: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / limit));
  const shown = Math.min(Math.max(1, page), totalPages);
  return { rows: rows.slice((shown - 1) * limit, shown * limit), total: rows.length, totalPages };
}

function includesNeedle(needle: string, ...text: (string | null | undefined)[]): boolean {
  return !needle || text.some((t) => (t ?? '').toLowerCase().includes(needle));
}

const noop = () => undefined;

/* --------------------------------------------------------------------- hooks */

export function useRecentDvirs() {
  const real = useRecentDvirsApi();
  const mock = shouldMock(real, real.rows.length);
  const rows = useMemo(() => {
    if (!mock) return null;
    const cutoff = recentDvirsCutoffMs();
    return mockData().dvirs.filter((d) => new Date(d.submittedAt).getTime() >= cutoff);
  }, [mock]);
  if (!rows) return real;
  return { ...real, rows, page: undefined, windowFull: false, isLoading: false, isError: false, error: null };
}

export function useOpenDefects(input: OpenDefectsInput) {
  const real = useOpenDefectsApi(input);
  const mock = shouldMock(real, real.total);
  const { page, limit, search } = input;
  const part = useMemo(() => {
    if (!mock) return null;
    const needle = search.trim().toLowerCase();
    const open = mockData().defects.filter((d) => d.status === 'OPEN' || d.status === 'IN_PROGRESS');
    const matched = open.filter((d) => includesNeedle(needle, d.vehicle?.unitNumber, d.category, d.description));
    return { ...pageOf(matched, page, limit), criticalCount: open.filter((d) => d.severity === 'CRITICAL').length };
  }, [mock, page, limit, search]);
  if (!part) return real;
  return { ...real, ...part, isLoading: false, isError: false };
}

export function useWorkOrdersList(params: WorkOrderListParams) {
  const real = useWorkOrdersListApi(params);
  const mock = shouldMock(real, real.total);
  const { page = 1, limit = 10, q } = params;
  const part = useMemo(() => {
    if (!mock) return null;
    const needle = (q ?? '').trim().toLowerCase();
    const matched = mockData().workOrders.filter((w) => includesNeedle(needle, w.number, w.title, w.vendor, w.vehicle?.unitNumber));
    return pageOf(matched, page, limit);
  }, [mock, page, limit, q]);
  if (!part) return real;
  return { ...real, ...part, page: undefined, isLoading: false, isError: false, error: null };
}

export function useSchedulesList(input: SchedulesInput) {
  const real = useSchedulesListApi(input);
  const mock = shouldMock(real, real.total);
  const { page, limit, search } = input;
  const part = useMemo(() => {
    if (!mock) return null;
    const needle = search.trim().toLowerCase();
    const matched = mockData().schedules.filter((s) => includesNeedle(needle, s.vehicle?.unitNumber, s.name));
    return pageOf(matched, page, limit);
  }, [mock, page, limit, search]);
  if (!part) return real;
  return { ...real, ...part, isLoading: false, isError: false };
}

export function useDueSchedules() {
  const real = useDueSchedulesApi();
  const mock = shouldMock(real, real.rows.length);
  const rows = useMemo(() => (mock ? mockData().schedules.filter((s) => s.due.state !== 'OK') : null), [mock]);
  if (!rows) return real;
  return { ...real, rows, isLoading: false, isError: false };
}

/** The `Vehicles out of service` KPI — demo units only when the real lookup has none at all. */
export function useVehiclesLookup(): { data: { items: VehicleRow[] } | undefined; isLoading: boolean } {
  const real = useVehiclesLookupApi();
  const realItems = real.data?.items;
  const mock = shouldMock({ isLoading: real.isLoading, isError: real.isError }, realItems?.length ?? 0);
  return useMemo(
    () => (mock ? { data: { items: mockData().vehicles }, isLoading: false } : { data: real.data, isLoading: real.isLoading }),
    [mock, real.data, real.isLoading],
  );
}

/** 11.15 drawer — a demo DVIR id is answered locally; any other id goes to `GET /dvir/:id`. */
export function useDvir(id: string | undefined): {
  data: DvirDetail | undefined;
  driver: DriverRow | null;
  vehicle: VehicleRow | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => unknown;
} {
  const isMockId = Boolean(id?.startsWith(MOCK_ID_PREFIX));
  const real = useDvirApi(isMockId ? undefined : id);
  if (!isMockId || !id) return real;
  const detail = mockData().dvirDetails.get(id);
  const row = mockData().dvirs.find((d) => d.id === id);
  return {
    data: detail,
    driver: row?.driver ?? null,
    vehicle: row?.vehicle ?? null,
    isLoading: false,
    isError: !detail,
    refetch: noop,
  };
}
