// Coverage for the drivers.ts composition module — read hooks (incl. the B-1/B-2 gap shapes
// served from MSW) and every mutation (create/update/deactivate/import).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
} from './drivers';

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
