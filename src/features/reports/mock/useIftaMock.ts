// owner: web-reports-transfer — W-12 IFTA DEMO DATA wiring (easy to remove, see below).
//
// Drop-in wrappers around the hooks `IftaReportPage` reads. Each one calls the real hook first and
// only swaps in `./iftaMockData.ts` when the API has nothing to show: the request failed, or it
// answered an empty list. Real data always wins.
//
// Switch — `VITE_DEMO_FALLBACK` (see `@/shared/lib/mockMode`). Production builds are always off:
// each export below is then the real hook itself and this demo data is tree-shaken out of the bundle.
// With the switch off the page shows its own error / empty states.
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
import { DEMO_FALLBACK_ENABLED, shouldUseDemoRows } from '@/shared/lib/mockMode';
import { buildIftaMockSummary, MOCK_IFTA_JURISDICTIONS, MOCK_VEHICLE_GROUPS } from './iftaMockData';

/** CODE-086 — demo rows only on an empty successful answer (or `always`); errors stay visible. */
const shouldMock = shouldUseDemoRows;

/** KPI row + `Miles by jurisdiction` — the demo summary honours quarter, jurisdiction and group. */
function useIftaSummaryDemo(filters: IftaFilters) {
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
function useIftaJurisdictionsDemo() {
  const real = useIftaJurisdictionsApi();
  const mock = shouldMock(real, real.data?.length ?? 0);
  if (!mock) return real;
  return { ...real, data: MOCK_IFTA_JURISDICTIONS, isLoading: false, isError: false, error: null } as const;
}

/** `Vehicle group` menu — the demo fleet's groups when the carrier has none (or the read failed). */
function useVehicleGroupsDemo() {
  const real = useVehicleGroupsApi();
  const mock = shouldMock(real, real.data?.length ?? 0);
  if (!mock) return real;
  return { ...real, data: MOCK_VEHICLE_GROUPS, isLoading: false, isError: false, error: null } as const;
}

// Production: `DEMO_FALLBACK_ENABLED` is the literal `false`, so these are the real hooks.
export const useIftaSummary: typeof useIftaSummaryDemo = DEMO_FALLBACK_ENABLED ? useIftaSummaryDemo : useIftaSummaryApi;
export const useIftaJurisdictions: typeof useIftaJurisdictionsDemo = DEMO_FALLBACK_ENABLED
  ? useIftaJurisdictionsDemo
  : useIftaJurisdictionsApi;
export const useVehicleGroups: typeof useVehicleGroupsDemo = DEMO_FALLBACK_ENABLED ? useVehicleGroupsDemo : useVehicleGroupsApi;
