// shared/api/reports.ts — pack RODS counts without a per-driver fan-out (WB-048), cancellation on
// unmount (client.ts rule 9) and the transfer polling stop set (WB-028).
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Query } from '@tanstack/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { activitySummaryFixture, reportScreenHandlers } from '@/mocks/handlers/reports';
import { cachePolicy } from './cache';
import { resetAuthBridge, setAccessToken, setAuthBridge } from './client';
import { endpoints } from './endpoints';
import {
  TRANSFER_FINAL_STATUSES,
  isReportPending,
  useActivitySummary,
  usePackRodsCounts,
  type TransferRow,
  type TransferStatus,
} from './reports';

const RANGE_RE = /\/logs\/[^/]+\/range/;
const SUMMARY_RE = /\/reports\/activity\/summary/;
let seen: string[] = [];

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
  server.events.on('request:start', ({ request }) => {
    seen.push(request.url);
  });
});
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
  seen = [];
});
afterAll(() => server.close());

describe('usePackRodsCounts', () => {
  const setup = () => {
    setAuthBridge({ getAccessToken: () => 'test-token' });
    setAccessToken('test-token');
    server.use(...reportScreenHandlers);
  };

  it('all drivers: one summary request, days in range minus certified days per driver', async () => {
    setup();
    const { result } = renderHook(() => usePackRodsCounts('2026-09-01', '2026-09-12', null, 12), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.counts.drivers).toBe(2));
    // drv_1: 12 − 1 certified; drv_2: 12 − 0.
    expect(result.current.counts).toEqual({ dailyLogs: 2, drivers: 2, uncertified: 23, uncertifiedDrivers: 2 });
    expect(seen.filter((u) => SUMMARY_RE.test(u))).toHaveLength(1);
    expect(seen.filter((u) => RANGE_RE.test(u))).toHaveLength(0);
  });

  it('one driver: exactly that driver\'s range, exact counts, no summary', async () => {
    setup();
    const { result } = renderHook(() => usePackRodsCounts('2026-09-01', '2026-09-12', 'drv_1', 12), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.counts.drivers).toBe(1));
    expect(result.current.counts).toEqual({ dailyLogs: 3, drivers: 1, uncertified: 2, uncertifiedDrivers: 1 });
    expect(seen.filter((u) => RANGE_RE.test(u))).toEqual([expect.stringContaining('/logs/drv_1/range')]);
    expect(seen.filter((u) => SUMMARY_RE.test(u))).toHaveLength(0);
  });
});

describe('cancel on unmount (client.ts rule 9, WB-048)', () => {
  it('aborts the in-flight summary request when the last observer unmounts', async () => {
    setAuthBridge({ getAccessToken: () => 'test-token' });
    let received: Request | null = null;
    let aborted = false;
    server.use(
      http.get(url(endpoints.reports.activitySummary), async ({ request }) => {
        received = request;
        await new Promise<void>((resolve) => {
          request.signal.addEventListener('abort', () => {
            aborted = true;
            resolve();
          });
          setTimeout(resolve, 5_000);
        });
        return ok(activitySummaryFixture(new URL(request.url).searchParams));
      }),
    );
    const params = { from: '2026-09-01', to: '2026-09-12', page: 1, limit: 10 };
    const { unmount } = renderHook(() => useActivitySummary(params), { wrapper: wrapper() });
    await waitFor(() => expect(received).not.toBeNull());
    expect(aborted).toBe(false);
    unmount();
    await waitFor(() => expect(aborted).toBe(true));
  });

  it('the request completes normally while the observer stays mounted', async () => {
    setAuthBridge({ getAccessToken: () => 'test-token' });
    const params = { from: '2026-09-01', to: '2026-09-12', page: 1, limit: 10 };
    const { result } = renderHook(() => useActivitySummary(params), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data?.total).toBe(2));
  });
});

describe('isReportPending', () => {
  it('is true only for QUEUED and RUNNING', () => {
    expect(isReportPending('QUEUED')).toBe(true);
    expect(isReportPending('RUNNING')).toBe(true);
    expect(isReportPending('READY')).toBe(false);
    expect(isReportPending('FAILED')).toBe(false);
    expect(isReportPending(undefined)).toBe(false);
  });
});

describe('transfer polling — the shared transferStatus policy (WB-028 landed)', () => {
  const interval = cachePolicy('transferStatus').refetchInterval as (query: unknown) => number | false;
  const queryWith = (status?: TransferStatus) =>
    ({ state: { data: status ? ({ status } as TransferRow) : undefined } }) as unknown as Query<TransferRow>;

  afterEach(() => vi.restoreAllMocks());

  it('polls every 5 s while QUEUED or before the first answer', () => {
    expect(interval(queryWith('QUEUED'))).toBe(5_000);
    expect(interval(queryWith())).toBe(5_000);
  });

  it.each(['TEST_ONLY', 'SENT', 'ACCEPTED', 'REJECTED', 'FAILED'] as const)('stops at %s', (status) => {
    expect(TRANSFER_FINAL_STATUSES).toContain(status);
    expect(interval(queryWith(status))).toBe(false);
  });

  it('never polls from a background tab', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    expect(interval(queryWith('QUEUED'))).toBe(false);
  });
});
