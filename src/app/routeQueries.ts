// WB-249 — the per-route prefetch table, split out of `routePrefetch.ts` so the query modules it
// needs (`vehicles`, `trips`, `dvir`, `lookups`) stay out of the initial chunk: a module imported
// by the eager shell is hoisted into `index-*.js` with every export any lazy chunk uses. This file
// is reached only through the `import()` inside `warmRoute`, i.e. on the first sidebar hover.
import type { QueryClient } from '@tanstack/react-query';
import { qk } from '@/shared/api/queryKeys';
import { client } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { cachePolicy } from '@/shared/api/cache';
import { fetchLiveFleet } from '@/shared/api/liveFleet';
import { driversLookupQuery, devicesLookupQuery, vehiclesLookupQuery } from '@/shared/api/lookups';
import { vehiclesPageQuery, vehiclesCountQuery, VEHICLES_DEFAULT_PAGE } from '@/shared/api/vehicles';
import { tripsActiveSliceQuery, tripsKpiQuery } from '@/shared/api/trips';
import { recentDvirsQuery, recentDefectsQuery, defectsPageQuery, dueSchedulesQuery } from '@/shared/api/dvir';
import type { PermissionKey } from '@/shared/auth/permissions';

/** READ check for the hovering user (CODE-085) — a prefetch the role can't read would only 403. */
export type CanRead = (key: PermissionKey) => boolean;

const staleOf = (name: 'list' | 'reference' | 'live') => {
  const stale = cachePolicy(name).staleTime;
  return typeof stale === 'number' ? stale : undefined;
};

/** The primary list each screen fires on mount (page 1, default filters) — same keys as the page. */
export const ROUTE_QUERIES: Partial<Record<string, (queryClient: QueryClient, can: CanRead) => void>> = {
  '/live-fleet': (qc) => {
    void qc.prefetchQuery({ queryKey: qk.liveFleet(), queryFn: () => fetchLiveFleet(), staleTime: staleOf('live') });
  },
  '/vehicles': (qc, can) => {
    void qc.prefetchQuery(vehiclesPageQuery(VEHICLES_DEFAULT_PAGE));
    // UI-004 — the unfiltered count page carries `statusCounts`; no per-status count requests.
    void qc.prefetchQuery(vehiclesCountQuery());
    if (can('drivers')) void qc.prefetchQuery(driversLookupQuery());
    // CODE-085 — DISPATCHER has `devices` NONE; the serial comes on the vehicle row instead.
    if (can('devices')) void qc.prefetchQuery(devicesLookupQuery());
  },
  '/drivers': (qc) => {
    void qc.prefetchQuery({
      queryKey: qk.driverRoster({ page: 1, limit: 10 }),
      queryFn: () => client.get(endpoints.drivers.roster, { params: { page: 1, limit: 10 } }),
      staleTime: staleOf('live'),
    });
  },
  '/trips': (qc, can) => {
    void qc.prefetchQuery(tripsActiveSliceQuery('ASSIGNED'));
    void qc.prefetchQuery(tripsActiveSliceQuery('IN_PROGRESS'));
    void qc.prefetchQuery(tripsActiveSliceQuery('DRAFT'));
    void qc.prefetchQuery(tripsActiveSliceQuery('PLANNED'));
    void qc.prefetchQuery(tripsKpiQuery());
    if (can('drivers')) void qc.prefetchQuery(driversLookupQuery());
    if (can('vehicles')) void qc.prefetchQuery(vehiclesLookupQuery());
  },
  '/dvir': (qc, can) => {
    if (!can('dvir')) return;
    void qc.prefetchQuery(recentDvirsQuery());
    void qc.prefetchQuery(recentDefectsQuery());
    void qc.prefetchQuery(defectsPageQuery({ page: 1, limit: 10, status: 'OPEN' }));
    if (can('maintenance')) void qc.prefetchQuery(dueSchedulesQuery());
    if (can('drivers')) void qc.prefetchQuery(driversLookupQuery());
    if (can('vehicles')) void qc.prefetchQuery(vehiclesLookupQuery());
  },
};
