// owner: web-architect — 11.27 Notifications panel (bell) data layer (web/tz.md §11.27, §7.3).
//
// `GET /notifications` (`?page&limit&unreadOnly&category`), `POST /notifications/read-all` and
// `POST /notifications/:id/read` — all personal, not gated by a permission key.
// B-56 (per-item read), B-57 (`category` + `counts`) and B-58 (human `body`, `objectType`/`objectId`,
// `severity`) shipped 2026-09-24. `counts` is still typed optional so an older API degrades to the
// `All`-only panel (WD-055) instead of crashing.
import { useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { client } from './client';
import { ApiError } from './errors';
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
  /** B-57 — null for kinds that belong to neither segment (backend D-096 mapping). */
  category?: NotificationCategory | null;
  /** Backend `NotificationKind` (e.g. `VIOLATION`). */
  kind?: string;
  /** B-58 — alert notifications only. */
  severity?: 'CRITICAL' | 'WARNING' | 'INFO' | null;
}

/** B-57 — segment counts for the panel tabs. */
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

function fetchPage(params: NotificationListParams, signal?: AbortSignal) {
  return client.get<NotificationsPage>(endpoints.notifications.list, { params, signal });
}

export function useNotifications(params: NotificationListParams) {
  return useQuery({
    queryKey: qk.notifications(params),
    queryFn: ({ signal }) => fetchPage(params, signal),
    ...typedCachePolicy<NotificationsPage>('list'),
  });
}

/** Bell dot + `N new`. */
export function useUnreadNotificationCount(enabled = true): number {
  const query = useQuery({
    queryKey: qk.notifications(UNREAD_COUNT_PARAMS),
    queryFn: ({ signal }) => fetchPage(UNREAD_COUNT_PARAMS, signal),
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

/** B-56 (shipped 2026-09-24) — `POST /notifications/:id/read`. The hook is deliberately
 * not optimistic: the item keeps `readAt: null` until the server stores one, so a failure leaves
 * nothing to roll back and the row never pretends to be read. A 404/405 means the route does not
 * exist on this backend — that is remembered for the session (WB-244) and the panel stops calling
 * it. Every failure is reported to `onFailure` (the panel turns it into one notice per session). */
let singleMarkReadUnavailable = false;

/** False once the live API has answered 404/405 for the single-item mark-read (B-56). */
export function isSingleMarkReadAvailable(): boolean {
  return !singleMarkReadUnavailable;
}

/** Test hook — forget a remembered 404/405. */
export function resetSingleMarkReadAvailability(): void {
  singleMarkReadUnavailable = false;
}

export interface MarkNotificationReadOptions {
  /** Hook-level, so it still runs after the panel closed on navigation. */
  onFailure?: (error: unknown) => void;
}

export function useMarkNotificationRead({ onFailure }: MarkNotificationReadOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      client.post<{ id: string; readAt: string }>(endpoints.notificationItem.markRead(id)),
    onSuccess: (result, id) => applyNotificationRead(queryClient, id, result?.readAt ?? new Date().toISOString()),
    onError: (error) => {
      if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
        singleMarkReadUnavailable = true;
      }
      onFailure?.(error);
    },
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
    ...(str(incoming.kind) ? { kind: str(incoming.kind) as string } : {}),
    severity: (str(incoming.severity) as NotificationItem['severity']) ?? null,
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

/** Where clicking a notification goes (§11.27). Keys are the backend's PascalCase `objectType`
 * (`deriveObjectRef` in notification-kind.ts + the audit-style writers), lower-cased. `null` = no destination; the caller still has to
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
  maintenanceschedule: () => '/dvir',
  // `alert.edit_request` — objectId is the ELD event id of the pending edit, not a route param.
  eldevent: () => '/hos-logs',
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

/* ------------------------------------------------------------------ B-87 notification channels */

/** `alertRules` READ (GET) / FULL (PATCH). Org-level channel toggles. A disabled channel suppresses delivery for every alert rule. Q-2: there
 * is no SMS channel here, ever. */
export interface NotificationChannels {
  email: { enabled: boolean };
  webhook: { enabled: boolean; url?: string | null };
}

export function useNotificationChannels(enabled = true) {
  return useQuery({
    queryKey: qk.notificationChannels,
    queryFn: ({ signal }) => client.get<NotificationChannels>(endpoints.notificationChannels.root, { signal }),
    enabled,
    ...typedCachePolicy<NotificationChannels>('reference'),
  });
}

export function useUpdateNotificationChannels() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: { email?: { enabled: boolean }; webhook?: { enabled: boolean; url?: string } }) =>
      client.patch<NotificationChannels>(endpoints.notificationChannels.root, dto),
    onSuccess: (data) => queryClient.setQueryData(qk.notificationChannels, data),
  });
}
