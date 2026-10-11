// `VITE_DEMO_FALLBACK=fallback` (dev only — production builds force it off): the DVIR & Maintenance
// hooks swap in demo rows when the API answers empty or fails. The flag-off side (real error / empty
// states) is covered by `DvirPage.test.tsx` and `@/shared/lib/mockMode.test.ts`.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { resetAuthBridge, setAccessToken, setAuthBridge } from '@/shared/api/client';
import { DEMO_FALLBACK_MODE } from '@/shared/lib/mockMode';
import { useWorkOrdersList } from './useDvirMock';

vi.hoisted(() => {
  vi.stubEnv('VITE_DEMO_FALLBACK', 'fallback');
});

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

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

describe('DVIR demo fallback — flag on', () => {
  it('resolves the stubbed flag', () => {
    expect(DEMO_FALLBACK_MODE).toBe('fallback');
  });

  it('shows demo work orders when the list is empty', async () => {
    server.use(http.get(url(endpoints.workOrders.list), () => ok({ items: [], page: 1, limit: 10, total: 0, totalPages: 1 })));
    const { result } = renderHook(() => useWorkOrdersList({ page: 1, limit: 10 }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.rows.length).toBeGreaterThan(0));
    expect(result.current.rows.map((w) => w.number)).toContain('WO-1043');
    expect(result.current.isError).toBe(false);
  });

  it('shows demo work orders instead of the error when the list fails', async () => {
    server.use(
      http.get(url(endpoints.workOrders.list), () =>
        HttpResponse.json({ statusCode: 404, code: 'NOT_FOUND', message: 'Not found' }, { status: 404 }),
      ),
    );
    const { result } = renderHook(() => useWorkOrdersList({ page: 1, limit: 10 }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.rows.length).toBeGreaterThan(0));
    expect(result.current.isError).toBe(false);
  });
});
