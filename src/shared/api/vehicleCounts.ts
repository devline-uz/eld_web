// WB-249 — the sidebar `Units` count on its own: `Sidebar.tsx` mounts it on every screen, and
// importing it from `vehicles.ts` hoisted the whole W-03 vehicles module (and `lookups.ts`) into
// the initial chunk. `vehicles.ts` re-exports it, so feature imports are unchanged.
import { client } from './client';
import { endpoints } from './endpoints';
import { qk } from './queryKeys';
import { compactParams, pagePolicy, type PageQueryOptions } from './paging';
import { withoutDeletedVehicles } from './deletedVehicles';
import type { VehicleRow } from './vehicles';

/** UI-004 — `GET /vehicles` `statusCounts`: record-status counts over the whole fleet (list
 * filters ignored, soft-deleted excluded). Optional: an older backend omits it. */
export interface VehicleStatusCounts {
  ACTIVE: number;
  INACTIVE: number;
  OUT_OF_SERVICE: number;
  total: number;
}

/** Read `statusCounts` off a `GET /vehicles` page (absent on a backend that predates UI-004). */
export function statusCountsOf(page: unknown): VehicleStatusCounts | undefined {
  return (page as { statusCounts?: VehicleStatusCounts } | undefined)?.statusCounts;
}

/** `total` of a status slice via `limit: 1` — the same keys the Dashboard KPI tiles use. */
export const vehiclesCountQuery = (status?: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_SERVICE'): PageQueryOptions<VehicleRow> => ({
  queryKey: qk.vehicles(compactParams({ status, limit: 1 })),
  queryFn: async ({ signal, client: queryClient }) =>
    withoutDeletedVehicles(await client.list<VehicleRow>(endpoints.vehicles.list, compactParams({ status, limit: 1 }), { signal }), queryClient),
  ...pagePolicy('list'),
});
