// WB-249 — the per-route prefetch table, split out of `routePrefetch.ts` so the query modules it
// needs (`vehicles`, `trips`, `dvir`, `lookups`) stay out of the initial chunk: a module imported
// by the eager shell is hoisted into `index-*.js` with every export any lazy chunk uses. This file
// is reached only through the `import()` inside `warmRoute`, i.e. on the first sidebar hover.
import type { QueryClient } from '@tanstack/react-query';
import { qk } from '@/shared/api/queryKeys';
import { client } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { cachePolicy } from '@/shared/api/cache';
import { driversLookupQuery, devicesLookupQuery, vehiclesLookupQuery } from '@/shared/api/lookups';
import { vehiclesPageQuery, vehiclesCountQuery, VEHICLES_DEFAULT_PAGE } from '@/shared/api/vehicles';
import { tripsActiveSliceQuery, tripsKpiQuery } from '@/shared/api/trips';
import { recentDvirsQuery, recentDefectsQuery, defectsPageQuery, dueSchedulesQuery } from '@/shared/api/dvir';

const staleOf = (name: 'list' | 'reference' | 'live') => {
  const stale = cachePolicy(name).staleTime;
  return typeof stale === 'number' ? stale : undefined;
};

/** The primary list each screen fires on mount (page 1, default filters) — same keys as the page. */
export const ROUTE_QUERIES: Partial<Record<string, (queryClient: QueryClient) => void>> = {
  '/live-fleet': (qc) => {
    void qc.prefetchQuery({ queryKey: qk.liveFleet(), queryFn: () => client.get(endpoints.live.fleet), staleTime: staleOf('live') });
  },
  '/vehicles': (qc) => {
    void qc.prefetchQuery(vehiclesPageQuery(VEHICLES_DEFAULT_PAGE));
    void qc.prefetchQuery(vehiclesCountQuery());
    void qc.prefetchQuery(vehiclesCountQuery('ACTIVE'));
    void qc.prefetchQuery(vehiclesCountQuery('INACTIVE'));
    void qc.prefetchQuery(driversLookupQuery());
    void qc.prefetchQuery(devicesLookupQuery());
  },
  '/drivers': (qc) => {
    void qc.prefetchQuery({
      queryKey: qk.driverRoster({ page: 1, limit: 10 }),
      queryFn: () => client.get(endpoints.drivers.roster, { params: { page: 1, limit: 10 } }),
      staleTime: staleOf('live'),
    });
  },
  '/trips': (qc) => {
    void qc.prefetchQuery(tripsActiveSliceQuery('ASSIGNED'));
    void qc.prefetchQuery(tripsActiveSliceQuery('IN_PROGRESS'));
    void qc.prefetchQuery(tripsActiveSliceQuery('DRAFT'));
    void qc.prefetchQuery(tripsActiveSliceQuery('PLANNED'));
    void qc.prefetchQuery(tripsKpiQuery());
    void qc.prefetchQuery(driversLookupQuery());
    void qc.prefetchQuery(vehiclesLookupQuery());
  },
  '/dvir': (qc) => {
    void qc.prefetchQuery(recentDvirsQuery());
    void qc.prefetchQuery(recentDefectsQuery());
    void qc.prefetchQuery(defectsPageQuery({ page: 1, limit: 10, status: 'OPEN' }));
    void qc.prefetchQuery(dueSchedulesQuery());
    void qc.prefetchQuery(driversLookupQuery());
    void qc.prefetchQuery(vehiclesLookupQuery());
  },
};
