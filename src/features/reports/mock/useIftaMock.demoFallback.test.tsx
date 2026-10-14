// `VITE_DEMO_FALLBACK=fallback` (dev only — production builds force it off): the IFTA hooks swap in
// demo rows when the API answers empty (never on a failure — CODE-086). The flag-off side (real error / empty states) is
// covered by `IftaReportPage.test.tsx` and `@/shared/lib/mockMode.test.ts`.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { fail, ok, url } from '@/mocks/envelope';
import { iftaSummaryFixture } from '@/mocks/handlers/reports';
import { endpoints } from '@/shared/api/endpoints';
import { resetAuthBridge, setAccessToken, setAuthBridge } from '@/shared/api/client';
import { DEMO_FALLBACK_MODE } from '@/shared/lib/mockMode';
import { useIftaSummary, useVehicleGroups } from './useIftaMock';

// Before any import evaluates `DEMO_FALLBACK_MODE`.
vi.hoisted(() => {
  vi.stubEnv('VITE_DEMO_FALLBACK', 'fallback');
});

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const FILTERS = { quarter: '2026-Q3' };
const EMPTY_SUMMARY = { ...iftaSummaryFixture, rows: [], totals: { totalMiles: 0, taxableMiles: 0, fuelGal: null, mpg: null, taxDueUsd: null } };

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
});
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
});
afterAll(() => server.close());

describe('IFTA demo fallback — flag on', () => {
  it('resolves the stubbed flag', () => {
    expect(DEMO_FALLBACK_MODE).toBe('fallback');
  });

  it('shows demo jurisdiction rows when the summary is empty', async () => {
    server.use(http.get(url(endpoints.reports.iftaSummary), () => ok(EMPTY_SUMMARY)));
    const { result } = renderHook(() => useIftaSummary(FILTERS), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data?.rows.length ?? 0).toBeGreaterThan(0));
    expect(result.current.isError).toBe(false);
  });

  it('CODE-086: keeps the real error (no demo rows) when the summary fails', async () => {
    server.use(http.get(url(endpoints.reports.iftaSummary), () => fail(409, 'IFTA_SUMMARY_UNAVAILABLE', 'IFTA summary failed.')));
    const { result } = renderHook(() => useIftaSummary(FILTERS), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data?.rows.length ?? 0).toBe(0);
  });

  it('keeps real rows when the API has them', async () => {
    server.use(http.get(url(endpoints.reports.iftaSummary), () => ok(iftaSummaryFixture)));
    const { result } = renderHook(() => useIftaSummary(FILTERS), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.rows).toEqual(iftaSummaryFixture.rows);
  });

  it('lists the demo vehicle groups when the carrier has none', async () => {
    server.use(http.get(url(endpoints.vehicleGroups.list), () => ok({ items: [], page: 1, limit: 200, total: 0, totalPages: 1 })));
    const { result } = renderHook(() => useVehicleGroups(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data?.length ?? 0).toBeGreaterThan(0));
    expect(result.current.data?.map((g) => g.name)).toContain('Southeast Regional');
  });
});
