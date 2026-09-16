// Route warm-up (WD-073, perf plan item 4) — hovering / focusing a sidebar link (a) starts the
// lazy route chunk download and (b) prefetches that screen's primary list query with the exact
// key + fn the page itself uses, so the click lands on a warm cache. Every loader below is the
// same `import()` the router's `React.lazy` boundary uses (router.tsx imports this table), so a
// chunk is never duplicated. Prefetching is fire-and-forget; a failure is simply ignored.
import type { QueryClient } from '@tanstack/react-query';
import { qk } from '@/shared/api/queryKeys';
import { client } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { cachePolicy } from '@/shared/api/cache';
import { driversLookupQuery, devicesLookupQuery, vehiclesLookupQuery } from '@/shared/api/lookups';
import { vehiclesPageQuery, vehiclesCountQuery, VEHICLES_DEFAULT_PAGE } from '@/shared/api/vehicles';
import { tripsActiveSliceQuery, tripsCountQuery, tripsKpiQuery } from '@/shared/api/trips';
import { recentDvirsQuery, recentDefectsQuery, defectsPageQuery, dueSchedulesQuery } from '@/shared/api/dvir';

/** One `import()` per feature entry — shared by `router.tsx` (`lazy(...)`) and the sidebar. */
export const ROUTE_LOADERS = {
  '/': () => import('@/features/dashboard/DashboardPage'),
  '/live-fleet': () => import('@/features/live-fleet/LiveFleetPage'),
  '/vehicles': () => import('@/features/vehicles/VehiclesPage'),
  '/drivers': () => import('@/features/drivers/DriversPage'),
  '/trips': () => import('@/features/trips/TripsPage'),
  '/hos-logs': () => import('@/features/hos-logs/HosLogsPage'),
  '/dvir': () => import('@/features/dvir/DvirPage'),
  '/safety': () => import('@/features/safety/SafetyPage'),
  '/reports': () => import('@/features/reports/IftaReportPage'),
  '/messages': () => import('@/features/messages/MessagesPage'),
  '/support': () => import('@/features/support/SupportPage'),
} as const;

export type PrefetchableRoute = keyof typeof ROUTE_LOADERS;

const staleOf = (name: 'list' | 'reference' | 'live') => {
  const stale = cachePolicy(name).staleTime;
  return typeof stale === 'number' ? stale : undefined;
};

/** The primary list each screen fires on mount (page 1, default filters) — same keys as the page. */
const ROUTE_QUERIES: Partial<Record<PrefetchableRoute, (queryClient: QueryClient) => void>> = {
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
    void qc.prefetchQuery(tripsCountQuery('PLANNED'));
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

const warmedChunks = new Set<string>();

/** Idempotent per route for the chunk; the query prefetch is bounded by each query's staleTime. */
export function warmRoute(to: string, queryClient: QueryClient): void {
  const loader = (ROUTE_LOADERS as Record<string, (() => Promise<unknown>) | undefined>)[to];
  if (loader && !warmedChunks.has(to)) {
    warmedChunks.add(to);
    loader().catch(() => warmedChunks.delete(to));
  }
  ROUTE_QUERIES[to as PrefetchableRoute]?.(queryClient);
}

/** Hover intent — a pointer sweeping across the sidebar must not fire every screen's requests. */
export const WARM_DEBOUNCE_MS = 150;

export function createRouteWarmer(queryClient: QueryClient) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    schedule(to: string) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        warmRoute(to, queryClient);
      }, WARM_DEBOUNCE_MS);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = undefined;
    },
  };
}
