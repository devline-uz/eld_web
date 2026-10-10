// owner: web-reports-transfer — W-12 IFTA DEMO DATA wiring (easy to remove, see below).
//
// Drop-in wrappers around the hooks `IftaReportPage` reads. Each one calls the real hook first and
// only swaps in `./iftaMockData.ts` when the API has nothing to show: the request failed, or it
// answered an empty list. Real data always wins.
//
// Switch — `VITE_IFTA_MOCK` in `eld_web/.env` (same modes as `VITE_DVIR_MOCK`):
//   (unset)    on as a fallback in `vite dev`, off in production builds
//   `fallback` on as a fallback in any build
//   `always`   ignore the API and always show the demo rows
//   `off`      never show demo rows
// Vitest (`MODE === 'test'`) is always `off`, so the page's own tests see the real hooks.
//
// To remove the demo entirely: delete `src/features/reports/mock/` and change the imports in
// `IftaReportPage.tsx` back to `@/shared/api/reports` / `@/shared/api/vehicles`.
//
// Exports (CSV / PDF / Generate / Schedule) still go to the real API with the same filters.
import { useMemo } from 'react';
import {
  useIftaJurisdictions as useIftaJurisdictionsApi,
  useIftaSummary as useIftaSummaryApi,
  type IftaFilters,
} from '@/shared/api/reports';
import { useVehicleGroups as useVehicleGroupsApi } from '@/shared/api/vehicles';
import { resolveMockMode, type MockMode } from '@/shared/lib/mockMode';
import { buildIftaMockSummary, MOCK_IFTA_JURISDICTIONS, MOCK_VEHICLE_GROUPS } from './iftaMockData';

export const IFTA_MOCK_MODE: MockMode = resolveMockMode(import.meta.env.VITE_IFTA_MOCK);

/** Use demo data? Never while the real request is still in flight. */
function shouldMock(real: { isLoading: boolean; isError: boolean }, realCount: number): boolean {
  if (IFTA_MOCK_MODE === 'off') return false;
  if (IFTA_MOCK_MODE === 'always') return true;
  if (real.isLoading) return false;
  return real.isError || realCount === 0;
}

/** KPI row + `Miles by jurisdiction` — the demo summary honours quarter, jurisdiction and group. */
export function useIftaSummary(filters: IftaFilters) {
  const real = useIftaSummaryApi(filters);
  const mock = shouldMock(real, real.data?.rows.length ?? 0);
  const { quarter, jurisdiction, vehicleGroupId } = filters;
  const data = useMemo(
    () => (mock ? buildIftaMockSummary({ quarter, jurisdiction, vehicleGroupId }) : undefined),
    [mock, quarter, jurisdiction, vehicleGroupId],
  );
  if (!data) return real;
  return { ...real, data, isLoading: false, isError: false, error: null } as const;
}

/** `Jurisdiction` menu — the demo fleet's states when the server list is empty or failed. */
export function useIftaJurisdictions() {
  const real = useIftaJurisdictionsApi();
  const mock = shouldMock(real, real.data?.length ?? 0);
  if (!mock) return real;
  return { ...real, data: MOCK_IFTA_JURISDICTIONS, isLoading: false, isError: false, error: null } as const;
}

/** `Vehicle group` menu — the demo fleet's groups when the carrier has none (or the read failed). */
export function useVehicleGroups() {
  const real = useVehicleGroupsApi();
  const mock = shouldMock(real, real.data?.length ?? 0);
  if (!mock) return real;
  return { ...real, data: MOCK_VEHICLE_GROUPS, isLoading: false, isError: false, error: null } as const;
}
