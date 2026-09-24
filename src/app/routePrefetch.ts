// Route warm-up (WD-073, perf plan item 4) — hovering / focusing a sidebar link (a) starts the
// lazy route chunk download and (b) prefetches that screen's primary list query with the exact
// key + fn the page itself uses, so the click lands on a warm cache. Every loader below is the
// same `import()` the router's `React.lazy` boundary uses (router.tsx imports this table), so a
// chunk is never duplicated. Prefetching is fire-and-forget; a failure is simply ignored.
import type { QueryClient } from '@tanstack/react-query';

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

const warmedChunks = new Set<string>();

/** Idempotent per route for the chunk; the query prefetch is bounded by each query's staleTime. */
export function warmRoute(to: string, queryClient: QueryClient): Promise<void> {
  const loader = (ROUTE_LOADERS as Record<string, (() => Promise<unknown>) | undefined>)[to];
  if (loader && !warmedChunks.has(to)) {
    warmedChunks.add(to);
    loader().catch(() => warmedChunks.delete(to));
  }
  // WB-249 — the prefetch table (and the query modules behind it) is its own lazy chunk.
  return import('./routeQueries')
    .then(({ ROUTE_QUERIES }) => ROUTE_QUERIES[to]?.(queryClient))
    .catch(() => undefined);
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
        void warmRoute(to, queryClient);
      }, WARM_DEBOUNCE_MS);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = undefined;
    },
  };
}
