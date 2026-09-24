// WD-073 — sidebar hover warms the route chunk and the screen's own primary query keys.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createRouteWarmer, ROUTE_LOADERS, WARM_DEBOUNCE_MS, warmRoute } from './routePrefetch';
import { vehiclesPageQuery, VEHICLES_DEFAULT_PAGE } from '@/shared/api/vehicles';
import { tripsActiveSliceQuery } from '@/shared/api/trips';
import { recentDvirsQuery } from '@/shared/api/dvir';
import { driversLookupQuery } from '@/shared/api/lookups';

function clientWithSpy() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const prefetch = vi.spyOn(queryClient, 'prefetchQuery').mockResolvedValue(undefined);
  return { queryClient, prefetch };
}

const keysOf = (prefetch: { mock: { calls: unknown[][] } }) =>
  prefetch.mock.calls.map((call) => JSON.stringify((call[0] as { queryKey: unknown }).queryKey));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('warmRoute', () => {
  it('prefetches exactly the keys the Vehicles page mounts with (page 1, default filters)', async () => {
    const { queryClient, prefetch } = clientWithSpy();
    await warmRoute('/vehicles', queryClient);
    const keys = keysOf(prefetch);
    expect(keys).toContain(JSON.stringify(vehiclesPageQuery(VEHICLES_DEFAULT_PAGE).queryKey));
    expect(keys).toContain(JSON.stringify(driversLookupQuery().queryKey));
  });

  it('prefetches both active trip slices for /trips and the recent-DVIR window for /dvir', async () => {
    const { queryClient, prefetch } = clientWithSpy();
    await warmRoute('/trips', queryClient);
    await warmRoute('/dvir', queryClient);
    const keys = keysOf(prefetch);
    expect(keys).toContain(JSON.stringify(tripsActiveSliceQuery('ASSIGNED').queryKey));
    expect(keys).toContain(JSON.stringify(tripsActiveSliceQuery('IN_PROGRESS').queryKey));
    expect(keys).toContain(JSON.stringify(recentDvirsQuery().queryKey));
  });

  it('is a no-op for a route without a loader and never throws', async () => {
    const { queryClient, prefetch } = clientWithSpy();
    await expect(warmRoute('/settings', queryClient)).resolves.toBeUndefined();
    expect(prefetch).not.toHaveBeenCalled();
  });

  it('every sidebar route in ROUTE_LOADERS is a lazy import function', () => {
    for (const loader of Object.values(ROUTE_LOADERS)) expect(typeof loader).toBe('function');
  });
});

describe('createRouteWarmer', () => {
  it('debounces: sweeping across three links fires only the one the pointer settles on', async () => {
    const { queryClient, prefetch } = clientWithSpy();
    const warmer = createRouteWarmer(queryClient);
    warmer.schedule('/vehicles');
    warmer.schedule('/trips');
    warmer.schedule('/dvir');
    vi.advanceTimersByTime(WARM_DEBOUNCE_MS - 1);
    expect(prefetch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    await vi.dynamicImportSettled();
    const keys = keysOf(prefetch);
    expect(keys).toContain(JSON.stringify(recentDvirsQuery().queryKey));
    expect(keys).not.toContain(JSON.stringify(vehiclesPageQuery(VEHICLES_DEFAULT_PAGE).queryKey));
  });

  it('cancel() before the debounce elapses fires nothing', async () => {
    const { queryClient, prefetch } = clientWithSpy();
    const warmer = createRouteWarmer(queryClient);
    warmer.schedule('/vehicles');
    warmer.cancel();
    vi.advanceTimersByTime(WARM_DEBOUNCE_MS * 2);
    await vi.dynamicImportSettled();
    expect(prefetch).not.toHaveBeenCalled();
  });
});
