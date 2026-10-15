// FE-03 — saving a new carrier timezone must re-read `/auth/me` (the source of
// `useCarrierTimezone()`) and the dashboard summary, so every page switches zone without a reload.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ok, url } from '@/mocks/envelope';
import { server } from '@/mocks/server';
import { resetAuthBridge, setAccessToken, setAuthBridge } from './client';
import { endpoints } from './endpoints';
import { qk } from './queryKeys';
import { useUpdateCarrier } from './settingsAdmin';

const refreshUser = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('@/shared/auth/AuthProvider', () => ({ useOptionalAuth: () => ({ refreshUser }) }));

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
});
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
  refreshUser.mockClear();
});
afterAll(() => server.close());

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  queryClient.setQueryData(qk.dashboardSummary, { timezone: 'America/New_York' });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return { queryClient, ...renderHook(() => useUpdateCarrier(), { wrapper }) };
}

describe('useUpdateCarrier — FE-03', () => {
  it('refreshes the session and invalidates the dashboard summary after a timezone change', async () => {
    server.use(http.patch(url(endpoints.carrier.root), () => ok({ id: 'carrier', timezone: 'America/Denver' })));
    const { result, queryClient } = setup();
    await act(async () => {
      await result.current.mutateAsync({ timezone: 'America/Denver' });
    });
    await waitFor(() => expect(refreshUser).toHaveBeenCalledTimes(1));
    expect(queryClient.getQueryState(qk.dashboardSummary)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryData(qk.carrier)).toMatchObject({ timezone: 'America/Denver' });
  });

  it('does not re-read the session when the timezone is not part of the save', async () => {
    server.use(http.patch(url(endpoints.carrier.root), () => ok({ id: 'carrier', name: 'X' })));
    const { result } = setup();
    await act(async () => {
      await result.current.mutateAsync({ name: 'X' });
    });
    expect(refreshUser).not.toHaveBeenCalled();
  });
});
