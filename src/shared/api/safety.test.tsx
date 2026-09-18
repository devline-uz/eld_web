// Same class as WB-038 (`shared/api/paging.ts:91,109`, `shared/api/vehicles.ts`) — a transient
// failure on a client-side join query (`/drivers`, `/vehicles`) must not blank a table that has
// perfectly good primary data. Covers `useSafetyEventsList` and `useScorecard`.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { useSafetyEventsList, useScorecard } from './safety';

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

const failJoin = () => HttpResponse.json({ statusCode: 500, code: 'INTERNAL', message: 'boom' }, { status: 500 });

describe('useSafetyEventsList — join-failure isolation', () => {
  it('does not blank the table when /drivers or /vehicles fails but /safety/events has good data', async () => {
    server.use(
      http.get(url(endpoints.safety.events), () =>
        ok({
          items: [{ id: 'evt_1', driverId: 'drv_1', vehicleId: 'veh_1', type: 'HARSH_BRAKING', occurredAt: '2026-09-18T00:00:00.000Z', severity: 4, status: 'NEW' }],
          page: 1,
          limit: 25,
          total: 1,
          totalPages: 1,
        }),
      ),
      http.get(url(endpoints.drivers.list), failJoin),
      http.get(url(endpoints.vehicles.list), failJoin),
    );

    const { result } = renderHook(() => useSafetyEventsList({ page: 1, limit: 25 }), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.isError).toBe(false);
    // The join degrades to a dash rather than the row disappearing or the page erroring.
    expect(result.current.rows[0]?.driver).toBeNull();
    expect(result.current.rows[0]?.vehicle).toBeNull();
  });

  it('still reports isError when the primary /safety/events query itself fails with no cached data', async () => {
    server.use(http.get(url(endpoints.safety.events), failJoin));

    const { result } = renderHook(() => useSafetyEventsList({ page: 1, limit: 25 }), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useScorecard — join-failure isolation', () => {
  it('does not blank the scorecard when /drivers fails but /safety/scorecard has good data', async () => {
    server.use(
      http.get(url(endpoints.safety.scorecard), () =>
        ok({
          items: [{ id: 'sc_1', driverId: 'drv_1', periodStart: '2026-09-01', periodEnd: '2026-09-18', score: 91, harshCount: 1, speedingCount: 0, milesDriven: 1200, violationCount: 0, rank: 1 }],
          periodStart: '2026-09-01',
          periodEnd: '2026-09-18',
        }),
      ),
      http.get(url(endpoints.drivers.list), failJoin),
    );

    const { result } = renderHook(() => useScorecard(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.isError).toBe(false);
    expect(result.current.rows[0]?.driver).toBeNull();
  });

  it('still reports isError when the primary /safety/scorecard query itself fails with no cached data', async () => {
    server.use(http.get(url(endpoints.safety.scorecard), failJoin));

    const { result } = renderHook(() => useScorecard(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
