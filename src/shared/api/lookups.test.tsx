// WB-087 — `qk.drivers({ limit: 500 })` is the session-wide driver lookup (WD-073). Every hook that
// joins against it must observe it with the one `reference` policy; a second observer with the
// `list` policy (60 s stale, refetch on focus) would win for everyone sharing the cache entry.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { resetAuthBridge, setAccessToken, setAuthBridge } from './client';
import { cachePolicy } from './cache';
import { LOOKUP_LIMIT, useDriverMap, useDriversLookup } from './lookups';
import { useConversationsList } from './messaging';
import { qk } from './queryKeys';
import { useSafetyEventsList, useScorecard } from './safety';

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

describe('driver lookup — one key, one cache policy (WB-087)', () => {
  it('every observer of qk.drivers({ limit: 500 }) uses the reference policy', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }
    renderHook(
      () => {
        useDriversLookup();
        useDriverMap();
        useSafetyEventsList({ page: 1, limit: 25 });
        useScorecard();
        useConversationsList('usr_1');
      },
      { wrapper: Wrapper },
    );
    const query = queryClient.getQueryCache().find({ queryKey: qk.drivers({ limit: LOOKUP_LIMIT }), exact: true });
    await waitFor(() => expect(query?.observers.length).toBe(5));
    const reference = cachePolicy('reference');
    for (const observer of query?.observers ?? []) {
      expect(observer.options.staleTime).toBe(reference.staleTime);
      expect(observer.options.refetchOnWindowFocus === true).toBe(reference.refetchOnWindowFocus === true);
    }
    // And the `list` policy is genuinely different, so the assertion above has teeth.
    expect(cachePolicy('list').staleTime).not.toBe(reference.staleTime);
  });
});
