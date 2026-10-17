// The fleet poll is the slim `?view=list` snapshot; the W-02 selected-unit card's full row comes
// from `GET /live/fleet/:vehicleId`, and only while a unit is selected.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { server } from '@/mocks/server';
import { LIVE_FLEET } from '@/mocks/handlers/fleet';
import { ok, url } from '@/mocks/envelope';
import { resetAuthBridge, setAccessToken, setAuthBridge } from './client';
import { endpoints } from './endpoints';
import { useLiveFleet, useLiveFleetUnit } from './liveFleet';
import { qk } from './queryKeys';

const DETAIL_ONLY = ['driverPhone', 'odometerMi', 'driveRemainingSec', 'shiftEndsAt', 'eldSerial'];

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, wrapper: Wrapper };
}

const requested: string[] = [];

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());
beforeEach(() => {
  requested.length = 0;
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
  server.events.on('request:start', ({ request }) => {
    const u = new URL(request.url);
    if (u.pathname.includes('/live/fleet')) requested.push(`${u.pathname.replace(/^\/api/, '')}${u.search}`);
  });
});
afterEach(() => {
  server.events.removeAllListeners();
  server.resetHandlers();
  resetAuthBridge();
});

describe('useLiveFleet', () => {
  it('asks for the slim `?view=list` rows — no detail-card-only field is on the wire', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useLiveFleet(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(requested).toEqual(['/live/fleet?view=list']);
    expect(result.current.data!.items).toHaveLength(LIVE_FLEET.items.length);
    for (const unit of result.current.data!.items) {
      for (const key of DETAIL_ONLY) expect(unit).not.toHaveProperty(key);
      expect(unit).toHaveProperty('bleState');
      expect(unit).toHaveProperty('locationLabel');
    }
  });
});

describe('useLiveFleetUnit', () => {
  it('is disabled (no request) without a selected unit', async () => {
    const { wrapper, queryClient } = setup();
    const { result } = renderHook(() => useLiveFleetUnit(null), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
    expect(requested).toEqual([]);
    expect(queryClient.getQueryCache().findAll({ queryKey: ['live'] }).every((q) => q.state.dataUpdatedAt === 0)).toBe(true);
  });

  it('fetches the full row for the selected unit, and stops when the selection is cleared', async () => {
    const { wrapper, queryClient } = setup();
    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useLiveFleetUnit(id), {
      wrapper,
      initialProps: { id: 'veh_2' as string | null },
    });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(requested).toEqual(['/live/fleet/veh_2']);
    expect(result.current.data).toEqual(LIVE_FLEET.items.find((u) => u.vehicleId === 'veh_2'));
    for (const key of DETAIL_ONLY) expect(result.current.data).toHaveProperty(key);

    rerender({ id: null });
    expect(result.current.fetchStatus).toBe('idle');
    await queryClient.refetchQueries({ queryKey: qk.liveFleetUnit('veh_2') });
    // The cleared selection has no observer left, so a refetch of every active query skips it.
    await queryClient.refetchQueries({ type: 'active' });
    expect(requested.filter((r) => r.startsWith('/live/fleet/'))).toHaveLength(2);
  });

  it('is refreshed by every `qk.liveFleet()` invalidation (unit edits, DVIR, work orders)', async () => {
    let detailCalls = 0;
    server.use(
      http.get(url(endpoints.live.unit(':vehicleId')), () => {
        detailCalls += 1;
        return ok(LIVE_FLEET.items[0]);
      }),
    );
    const { wrapper, queryClient } = setup();
    const { result } = renderHook(() => useLiveFleetUnit('veh_1'), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    await queryClient.invalidateQueries({ queryKey: qk.liveFleet() });
    await waitFor(() => expect(detailCalls).toBe(2));
  });
});
