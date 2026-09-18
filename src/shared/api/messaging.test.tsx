// shared/api/messaging.ts — join-failure isolation on W-16 (same class as WB-038) and the
// server-side `total` kept by `upsertMessage` (WB-093).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from './endpoints';
import { qk } from './queryKeys';
import { resetAuthBridge, setAccessToken, setAuthBridge } from './client';
import type { OffsetPage } from './types';
import { upsertMessage, useConversationsList, type ConversationRow, type MessageRow } from './messaging';

function wrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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

const fail = () => HttpResponse.json({ statusCode: 500, code: 'INTERNAL', message: 'boom' }, { status: 500 });

const conversation: ConversationRow = {
  id: 'cnv_1',
  type: 'DIRECT',
  title: null,
  lastMessageAt: '2026-09-18T10:00:00.000Z',
  createdById: 'usr_1',
  createdAt: '2026-09-18T09:00:00.000Z',
  participants: [
    { id: 'p_1', conversationId: 'cnv_1', userId: 'usr_1', driverId: null, lastReadAt: null, mutedUntil: null },
    { id: 'p_2', conversationId: 'cnv_1', userId: null, driverId: 'drv_1', lastReadAt: null, mutedUntil: null },
  ],
};

describe('useConversationsList — join-failure isolation', () => {
  it('keeps the list when /drivers fails; the driver join degrades to null', async () => {
    server.use(
      http.get(url(endpoints.conversations.list), () => ok({ items: [conversation] })),
      http.get(url(endpoints.drivers.list), fail),
    );
    const { result } = renderHook(() => useConversationsList('usr_1'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 10_000 });
    expect(result.current.isError).toBe(false);
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]?.driver).toBeNull();
    expect(result.current.items[0]?.unread).toBe(true);
  });

  it('still reports isError when /conversations itself fails with nothing cached', async () => {
    server.use(http.get(url(endpoints.conversations.list), fail));
    const { result } = renderHook(() => useConversationsList('usr_1'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 10_000 });
  });
});

describe('upsertMessage — keeps the server total (WB-093)', () => {
  const message = (id: string, clientId: string | null = null): MessageRow => ({
    id,
    conversationId: 'cnv_1',
    senderUserId: 'usr_1',
    senderDriverId: null,
    body: 'hi',
    attachmentId: null,
    clientId,
    sentAt: '2026-09-18T10:00:00.000Z',
    deliveredAt: null,
    readAt: null,
  });

  function seed() {
    const queryClient = new QueryClient();
    const page: OffsetPage<MessageRow> = { items: [message('m_1')], page: 1, limit: 100, total: 350, totalPages: 4 };
    queryClient.setQueryData(qk.messages('cnv_1'), page);
    const read = () => queryClient.getQueryData<OffsetPage<MessageRow>>(qk.messages('cnv_1'));
    return { queryClient, read };
  }

  it('adds one for a genuinely new message', () => {
    const { queryClient, read } = seed();
    upsertMessage(queryClient, 'cnv_1', message('m_2', 'c_2'));
    expect(read()?.total).toBe(351);
    expect(read()?.items).toHaveLength(2);
  });

  it('leaves total alone when the server echo replaces the optimistic placeholder', () => {
    const { queryClient, read } = seed();
    upsertMessage(queryClient, 'cnv_1', { ...message('tmp_c_2', 'c_2'), status: 'sending' });
    upsertMessage(queryClient, 'cnv_1', message('m_2', 'c_2'));
    upsertMessage(queryClient, 'cnv_1', message('m_2', 'c_2'));
    expect(read()?.total).toBe(351);
    expect(read()?.items.map((m) => m.id)).toEqual(['m_1', 'm_2']);
  });

  it('is a no-op on an uncached thread', () => {
    const queryClient = new QueryClient();
    upsertMessage(queryClient, 'cnv_1', message('m_1'));
    expect(queryClient.getQueryData(qk.messages('cnv_1'))).toBeUndefined();
  });
});
