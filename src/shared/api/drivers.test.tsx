// Coverage for the drivers.ts composition module — read hooks (incl. the B-1/B-2 gap shapes
// served from MSW) and every mutation (create/update/deactivate/import).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import {
  useDriversList,
  useDriver,
  useDriverRoster,
  useDriverHos,
  useCreateDriver,
  useUpdateDriver,
  useDeactivateDriver,
  useImportDrivers,
  useDriverRosterCounts,
  useDriverRosterWindow,
} from './drivers';
import { STALE } from './cache';

function wrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
});
afterAll(() => server.close());

beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
});

describe('FE-21 useDriverRosterWindow', () => {
  it('uses the live policy (10 s stale + poll), not the 10-min reference cache, for the On/Off duty tabs', async () => {
    server.use(http.get(url(endpoints.drivers.roster), () => ok({ items: [], page: 1, limit: 200, total: 0, totalPages: 1 })));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useDriverRosterWindow({}), {
      wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const query = queryClient.getQueryCache().getAll()[0]!;
    const options = query.options as { staleTime?: number; refetchInterval?: unknown };
    expect(options.staleTime).toBe(STALE.live);
    expect(options.refetchInterval).toBeTypeOf('function');
  });
});

describe('UI-015 useDriverRosterCounts', () => {
  it('the unfiltered header reads the roster summary (global), not the loaded rows', async () => {
    server.use(
      http.get(url(endpoints.drivers.roster), () =>
        ok({ items: [], page: 1, limit: 200, total: 0, totalPages: 1, summary: { total: 115, withActiveViolations: 7 } }),
      ),
    );
    const { result } = renderHook(() => useDriverRosterCounts(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.all).toBe(115);
    expect(result.current.violations).toBe(7);
  });

  it('a filtered count ignores the global summary', async () => {
    server.use(
      http.get(url(endpoints.drivers.roster), () =>
        ok({ items: [], page: 1, limit: 200, total: 3, totalPages: 1, summary: { total: 115, withActiveViolations: 7 } }),
      ),
    );
    const { result } = renderHook(() => useDriverRosterCounts({ q: 'smith' }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.all).toBe(3);
    expect(result.current.violations).toBe(0);
  });
});

describe('read hooks', () => {
  it('useDriversList reads GET /drivers', async () => {
    const { result } = renderHook(() => useDriversList({ limit: 10 }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toBeDefined();
  });

  it('useDriver reads GET /drivers/:id', async () => {
    const { result } = renderHook(() => useDriver('drv_1'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.username).toBeDefined();
  });

  it('useDriverRoster reads the B-1 gap shape from MSW', async () => {
    const { result } = renderHook(() => useDriverRoster({ page: 1, limit: 10 }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items.length).toBeGreaterThan(0);
    expect(result.current.data?.items[0]?.hos).toBeDefined();
  });

  it('useDriverHos reads the B-2 gap shape from MSW', async () => {
    const { result } = renderHook(() => useDriverHos('drv_1'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.driveRemainingSec).toBeDefined();
  });
});

describe('mutations', () => {
  it('useCreateDriver posts to POST /drivers (Q-3 — the driver account is born here)', async () => {
    server.use(http.post(url(endpoints.drivers.create), () => ok({ id: 'drv_new', username: 'newdriver', status: 'ACTIVE' })));
    const { result } = renderHook(() => useCreateDriver(), { wrapper: wrapper() });
    result.current.mutate({
      firstName: 'New',
      lastName: 'Driver',
      username: 'newdriver',
      password: 'password1',
      email: 'new.driver@example.com',
      cdlNumber: 'X1',
      cdlState: 'OH',
      homeTerminalName: 'Columbus, OH',
      homeTerminalTimezone: 'America/New_York',
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('useCreateDriver surfaces a 409 conflict for a duplicate username', async () => {
    server.use(
      http.post(url(endpoints.drivers.create), () =>
        new Response(
          JSON.stringify({ statusCode: 409, code: 'CONFLICT', message: 'A driver with this username already exists.', traceId: 't', timestamp: new Date().toISOString() }),
          { status: 409 },
        ),
      ),
    );
    const { result } = renderHook(() => useCreateDriver(), { wrapper: wrapper() });
    result.current.mutate({
      firstName: 'New',
      lastName: 'Driver',
      username: 'jsmith',
      password: 'password1',
      email: 'dup@example.com',
      cdlNumber: 'X1',
      cdlState: 'OH',
      homeTerminalName: 'Columbus, OH',
      homeTerminalTimezone: 'America/New_York',
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('useCreateDriver with a unit also invalidates the vehicles queries (the unit gains a driver)', async () => {
    server.use(http.post(url(endpoints.drivers.create), () => ok({ id: 'drv_new', username: 'newdriver', status: 'ACTIVE' })));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useCreateDriver(), { wrapper: Wrapper });
    const base = {
      firstName: 'New',
      lastName: 'Driver',
      username: 'newdriver',
      email: 'new.driver@example.com',
      cdlNumber: 'X1',
      cdlState: 'OH',
      homeTerminalName: 'Columbus, OH',
      homeTerminalTimezone: 'America/New_York',
    };

    result.current.mutate(base);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate.mock.calls.map(([f]) => f?.queryKey)).toEqual([['drivers']]);

    invalidate.mockClear();
    result.current.mutate({ ...base, assignedVehicleId: 'veh_3' });
    await waitFor(() => expect(invalidate.mock.calls.map(([f]) => f?.queryKey)).toEqual([['drivers'], ['vehicles']]));
  });

  it('useUpdateDriver patches PATCH /drivers/:id', async () => {
    server.use(http.patch(url(endpoints.drivers.update(':id')), () => ok({ id: 'drv_1', username: 'jsmith', status: 'ACTIVE' })));
    const { result } = renderHook(() => useUpdateDriver('drv_1'), { wrapper: wrapper() });
    result.current.mutate({ phone: '+1 555 000 1111' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('useDeactivateDriver patches status to INACTIVE', async () => {
    server.use(http.patch(url(endpoints.drivers.update(':id')), () => ok({ id: 'drv_1', username: 'jsmith', status: 'INACTIVE' })));
    const { result } = renderHook(() => useDeactivateDriver(), { wrapper: wrapper() });
    result.current.mutate('drv_1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.status).toBe('INACTIVE');
  });

  it('useImportDrivers posts to POST /drivers/import', async () => {
    server.use(http.post(url(endpoints.drivers.import), () => ok({ imported: 22, updated: 0, failed: [] })));
    const { result } = renderHook(() => useImportDrivers(), { wrapper: wrapper() });
    result.current.mutate({ drivers: [{ username: 'newdriver' }] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.imported).toBe(22);
  });
});
