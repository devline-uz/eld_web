import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fail, server, url } from '@/mocks/server';
import { resetShellGapState } from '@/mocks/handlers/shellGaps';
import { endpoints } from './endpoints';
import {
  UNREAD_COUNT_PARAMS,
  applyNotificationNew,
  applyNotificationRead,
  isSingleMarkReadAvailable,
  notificationTarget,
  resetSingleMarkReadAvailability,
  toNotificationItem,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
  type NotificationsPage,
} from './notifications';
import { qk } from './queryKeys';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetShellGapState();
  resetSingleMarkReadAvailability();
});
afterAll(() => server.close());

const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const page = (items: NotificationsPage['items'], extra: Partial<NotificationsPage> = {}): NotificationsPage => ({
  items,
  page: 1,
  limit: 25,
  total: items.length,
  totalPages: 1,
  ...extra,
});

const item = (id: string, readAt: string | null = null) => ({ id, type: 'x', title: id, body: '', readAt });

describe('notification cache patches', () => {
  it('prepends a realtime notification, bumps totals and counts, skips duplicates', () => {
    const client = newClient();
    client.setQueryData(qk.notifications({ limit: 25 }), page([item('a')], { counts: { all: 1, violations: 0, maintenance: 0 } }));
    client.setQueryData(qk.notifications(UNREAD_COUNT_PARAMS), page([item('a')], { limit: 1, total: 3 }));
    client.setQueryData(qk.notifications({ limit: 25, category: 'VIOLATIONS' }), page([]));

    applyNotificationNew(client, { id: 'b', type: 'hos_violation', title: 'HOS violation', category: 'VIOLATIONS' });
    applyNotificationNew(client, { id: 'b', type: 'hos_violation', title: 'HOS violation' });

    const list = client.getQueryData<NotificationsPage>(qk.notifications({ limit: 25 }));
    expect(list?.items.map((i) => i.id)).toEqual(['b', 'a']);
    expect(list?.total).toBe(2);
    expect(list?.counts).toEqual({ all: 2, violations: 1, maintenance: 0 });
    const unread = client.getQueryData<NotificationsPage>(qk.notifications(UNREAD_COUNT_PARAMS));
    expect(unread?.total).toBe(4);
    expect(unread?.items).toHaveLength(1);
    expect(client.getQueryState(qk.notifications({ limit: 25, category: 'VIOLATIONS' }))?.isInvalidated).toBe(true);
  });

  it('marks one item read everywhere and removes it from unread-only pages', () => {
    const client = newClient();
    client.setQueryData(qk.notifications({ limit: 25 }), page([item('a'), item('b')]));
    client.setQueryData(qk.notifications(UNREAD_COUNT_PARAMS), page([item('a')], { total: 2 }));
    client.setQueryData(qk.notifications({ limit: 100 }), undefined);

    applyNotificationRead(client, 'a', '2026-09-13T10:00:00Z');

    expect(client.getQueryData<NotificationsPage>(qk.notifications({ limit: 25 }))?.items[0]?.readAt).toBe('2026-09-13T10:00:00Z');
    const unread = client.getQueryData<NotificationsPage>(qk.notifications(UNREAD_COUNT_PARAMS));
    expect(unread?.total).toBe(1);
    expect(unread?.items).toEqual([]);
  });

  it('normalises a raw socket payload', () => {
    const normalised = toNotificationItem({ id: 'n', type: 't', title: 'T', objectType: 'Vehicle', objectId: 'v1', readAt: 5 });
    expect(normalised).toMatchObject({ body: '', objectType: 'Vehicle', objectId: 'v1', readAt: null, category: null });
    expect(normalised.createdAt).toEqual(expect.any(String));
  });

  it('resolves deep links by object type', () => {
    expect(notificationTarget({ objectType: 'Vehicle', objectId: 'v1' })).toBe('/vehicles/v1');
    expect(notificationTarget({ objectType: 'driver', objectId: null })).toBe('/drivers');
    expect(notificationTarget({ objectType: 'Work_Order', objectId: 'w' })).toBe('/dvir');
    expect(notificationTarget({ objectType: 'Unknown', objectId: 'x' })).toBeNull();
    const cases: Array<[string, string]> = [
      ['Vehicle', '/vehicles'],
      ['Trip', '/trips'],
      ['SafetyEvent', '/safety'],
      ['Dvir', '/dvir'],
      ['DvirReport', '/dvir'],
      ['Defect', '/dvir'],
      ['Report', '/reports'],
      ['DataTransfer', '/reports/fmcsa'],
      ['Conversation', '/messages'],
      ['HosViolation', '/hos-logs'],
      ['UnidentifiedSegment', '/hos-logs'],
      ['Device', '/settings/devices'],
    ];
    for (const [objectType, to] of cases) {
      expect(notificationTarget({ objectType, objectId: null })).toBe(to);
    }
    expect(notificationTarget({ objectType: 'Driver', objectId: 'd1' })).toBe('/drivers/d1');
    expect(notificationTarget({ objectType: null, objectId: 'x' })).toBeNull();
  });
});

describe('notification hooks (MSW)', () => {
  it('loads a page and the unread counter, then marks all read', async () => {
    const client = newClient();
    const { result } = renderHook(
      () => ({ list: useNotifications({ limit: 25 }), unread: useUnreadNotificationCount(), markAll: useMarkAllNotificationsRead() }),
      { wrapper: wrapperFor(client) },
    );
    await waitFor(() => expect(result.current.list.data?.items).toHaveLength(6), { timeout: 5000 });
    await waitFor(() => expect(result.current.unread).toBe(4), { timeout: 5000 });
    await act(() => result.current.markAll.mutateAsync());
    await waitFor(() => expect(result.current.unread).toBe(0), { timeout: 5000 });
  });

  it('marks a single item read through the B-56 handler', async () => {
    const client = newClient();
    const { result } = renderHook(() => ({ list: useNotifications({ limit: 25 }), markOne: useMarkNotificationRead() }), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(result.current.list.data).toBeDefined(), { timeout: 5000 });
    await act(() => result.current.markOne.mutateAsync('ntf_1'));
    await waitFor(() => expect(result.current.list.data?.items.find((i) => i.id === 'ntf_1')?.readAt).toEqual(expect.any(String)));
  });

  it('leaves the item unread when the gap endpoint is missing (live API)', async () => {
    server.use(http.post(url(endpoints.notificationItem.markRead(':id')), () => fail(404, 'NOT_FOUND', 'Cannot POST')));
    const client = newClient();
    const { result } = renderHook(() => ({ list: useNotifications({ limit: 25 }), markOne: useMarkNotificationRead() }), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(result.current.list.data).toBeDefined(), { timeout: 5000 });
    act(() => result.current.markOne.mutate('ntf_1'));
    await waitFor(() => expect(result.current.markOne.isError).toBe(true));
    expect(result.current.list.data?.items.find((i) => i.id === 'ntf_1')?.readAt).toBeNull();
  });

  // WB-244 — a 404/405 is remembered for the session; other failures are not; every failure
  // reaches `onFailure`.
  it.each([404, 405])('remembers a %i as "route missing" and reports the failure', async (status) => {
    server.use(http.post(url(endpoints.notificationItem.markRead(':id')), () => fail(status, 'NOT_FOUND', 'Cannot POST')));
    const onFailure = vi.fn();
    const { result } = renderHook(() => useMarkNotificationRead({ onFailure }), { wrapper: wrapperFor(newClient()) });
    expect(isSingleMarkReadAvailable()).toBe(true);
    act(() => result.current.mutate('ntf_1'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isSingleMarkReadAvailable()).toBe(false);
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it('a 500 is reported but does not mark the route missing', async () => {
    server.use(http.post(url(endpoints.notificationItem.markRead(':id')), () => fail(500, 'INTERNAL', 'boom')));
    const onFailure = vi.fn();
    const { result } = renderHook(() => useMarkNotificationRead({ onFailure }), { wrapper: wrapperFor(newClient()) });
    act(() => result.current.mutate('ntf_1'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isSingleMarkReadAvailable()).toBe(true);
    expect(onFailure).toHaveBeenCalledTimes(1);
  });
});
