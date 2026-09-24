// WB-249 — the sidebar `Units` count on its own: `Sidebar.tsx` mounts it on every screen, and
// importing it from `vehicles.ts` hoisted the whole W-03 vehicles module (and `lookups.ts`) into
// the initial chunk. `vehicles.ts` re-exports it, so feature imports are unchanged.
import { client } from './client';
import { endpoints } from './endpoints';
import { qk } from './queryKeys';
import { compactParams, pagePolicy, type PageQueryOptions } from './paging';
import type { VehicleRow } from './vehicles';

/** `total` of a status slice via `limit: 1` — the same keys the Dashboard KPI tiles use. */
export const vehiclesCountQuery = (status?: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_SERVICE'): PageQueryOptions<VehicleRow> => ({
  queryKey: qk.vehicles(compactParams({ status, limit: 1 })),
  queryFn: ({ signal }) => client.list<VehicleRow>(endpoints.vehicles.list, compactParams({ status, limit: 1 }), { signal }),
  ...pagePolicy('list'),
});
