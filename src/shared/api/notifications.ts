// owner: web-architect — 11.27 Notifications panel (bell) data layer (web/tz.md §11.27, §7.3).
//
// Real today: `GET /notifications` (`?page&limit&unreadOnly`) and `POST /notifications/read-all`
// — both personal, not gated by a permission key (backend NotificationsController).
// Missing (web/backend-gaps.md):
//   ⛔ B-56 `POST /notifications/:id/read` — clicking one item cannot set its `readAt`.
//   ⛔ B-57 `category` + `counts` — the `Violations` / `Maintenance` segments. When the response
//          carries no `counts` the panel renders only `All` (web/decisions.md WD-055).
import { useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { client } from './client';
import { endpoints } from './endpoints';
import { qk, qkRoot } from './queryKeys';
import { typedCachePolicy } from './queryPolicy';

export type NotificationCategory = 'VIOLATIONS' | 'MAINTENANCE';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  objectType?: string | null;
  objectId?: string | null;
  readAt: string | null;
  createdAt?: string;
  /** ⛔ GAP B-57 — absent on the live API. */
  category?: NotificationCategory | null;
}

/** ⛔ GAP B-57 — absent on the live API. */
export interface NotificationCounts {
  all: number;
  violations: number;
  maintenance: number;
}

export interface NotificationsPage {
  items: NotificationItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  counts?: NotificationCounts;
}

export interface NotificationListParams {
  [key: string]: string | number | boolean | undefined;
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  category?: NotificationCategory;
}

/** The panel's first page, and the size `View all notifications` expands to (≤ 200). */
export const NOTIFICATIONS_PAGE_SIZE = 25;
export const NOTIFICATIONS_EXPANDED_SIZE = 100;

/** The unread counter is the `total` of a one-row `unreadOnly` page — no count endpoint exists. */
export const UNREAD_COUNT_PARAMS: NotificationListParams = { unreadOnly: true, limit: 1 };

function fetchPage(params: NotificationListParams) {
  return client.get<NotificationsPage>(endpoints.notifications.list, { params });
}

export function useNotifications(params: NotificationListParams) {
  return useQuery({
    queryKey: qk.notifications(params),
    queryFn: () => fetchPage(params),
    ...typedCachePolicy<NotificationsPage>('list'),
  });
}

/** Bell dot + `N new`. */
export function useUnreadNotificationCount(enabled = true): number {
  const query = useQuery({
    queryKey: qk.notifications(UNREAD_COUNT_PARAMS),
    queryFn: () => fetchPage(UNREAD_COUNT_PARAMS),
    enabled,
    ...typedCachePolicy<NotificationsPage>('list'),
  });
  return query.data?.total ?? 0;
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => client.post<{ updated: number }>(endpoints.notifications.readAll),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qkRoot.notifications }),
  });
}

/** ⛔ GAP B-56 — served by MSW only. On the live API it fails and the item simply stays unread;
 * the panel never pretends a `readAt` was stored. */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      client.post<{ id: string; readAt: string }>(endpoints.notificationItem.markRead(id)),
    onSuccess: (result, id) => applyNotificationRead(queryClient, id, result?.readAt ?? new Date().toISOString()),
  });
}

function paramsOf(key: QueryKey): NotificationListParams {
  return ((key as readonly unknown[])[1] ?? {}) as NotificationListParams;
}

function cachedPages(queryClient: QueryClient) {
  return queryClient.getQueriesData<NotificationsPage>({ queryKey: qkRoot.notifications });
}

/** Shape of the `notification.new` payload's `notification` (a raw Prisma `Notification` row). */
export interface IncomingNotification {
  id: string;
  type: string;
  title: string;
  body?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export function toNotificationItem(incoming: IncomingNotification): NotificationItem {
  const str = (value: unknown) => (typeof value === 'string' ? value : null);
  return {
    id: incoming.id,
    type: incoming.type,
    title: incoming.title,
    body: incoming.body ?? '',
    objectType: str(incoming.objectType),
    objectId: str(incoming.objectId),
    readAt: str(incoming.readAt),
    createdAt: incoming.createdAt ?? new Date().toISOString(),
    category: (str(incoming.category) as NotificationCategory | null) ?? null,
  };
}

/**
 * `notification.new` over `user:{id}` — patch every cached panel page with `setQueryData` instead
 * of refetching the list (§16.3). Category-filtered pages cannot know whether the new item
 * belongs to them, so only those are invalidated.
 */
export function applyNotificationNew(queryClient: QueryClient, incoming: IncomingNotification): void {
  const item = toNotificationItem(incoming);
  for (const [key, data] of cachedPages(queryClient)) {
    if (!data) continue;
    const params = paramsOf(key);
    if (params.category) {
      void queryClient.invalidateQueries({ queryKey: key, exact: true });
      continue;
    }
    if (data.items.some((existing) => existing.id === item.id)) continue;
    const counts = data.counts
      ? {
          all: data.counts.all + 1,
          violations: data.counts.violations + (item.category === 'VIOLATIONS' ? 1 : 0),
          maintenance: data.counts.maintenance + (item.category === 'MAINTENANCE' ? 1 : 0),
        }
      : undefined;
    queryClient.setQueryData<NotificationsPage>(key, {
      ...data,
      items: [item, ...data.items].slice(0, Math.max(1, data.limit)),
      total: data.total + 1,
      ...(counts ? { counts } : {}),
    });
  }
}

/** A single item became read: stamp it everywhere, drop it from unread-only pages. */
export function applyNotificationRead(queryClient: QueryClient, id: string, readAt: string): void {
  for (const [key, data] of cachedPages(queryClient)) {
    if (!data) continue;
    if (paramsOf(key).unreadOnly) {
      queryClient.setQueryData<NotificationsPage>(key, {
        ...data,
        items: data.items.filter((item) => item.id !== id),
        total: Math.max(0, data.total - 1),
      });
      continue;
    }
    queryClient.setQueryData<NotificationsPage>(key, {
      ...data,
      items: data.items.map((item) => (item.id === id ? { ...item, readAt } : item)),
    });
  }
}

/** Where clicking a notification goes (§11.27). `null` = no destination; the caller still has to
 * check the route against the user's permissions before navigating. */
const TARGETS: Record<string, (id: string | null) => string> = {
  vehicle: (id) => (id ? `/vehicles/${id}` : '/vehicles'),
  driver: (id) => (id ? `/drivers/${id}` : '/drivers'),
  trip: () => '/trips',
  safetyevent: () => '/safety',
  dvir: () => '/dvir',
  dvirreport: () => '/dvir',
  defect: () => '/dvir',
  workorder: () => '/dvir',
  report: () => '/reports',
  datatransfer: () => '/reports/fmcsa',
  conversation: () => '/messages',
  hosviolation: () => '/hos-logs',
  unidentifiedsegment: () => '/hos-logs',
  device: () => '/settings/devices',
};

export function notificationTarget(item: Pick<NotificationItem, 'objectType' | 'objectId'>): string | null {
  if (!item.objectType) return null;
  const build = TARGETS[item.objectType.replace(/[^a-z]/gi, '').toLowerCase()];
  return build ? build(item.objectId ?? null) : null;
}
