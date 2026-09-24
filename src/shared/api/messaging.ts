// owner: web-dispatch-messaging — W-16 Messages.
//
// `GET /conversations` answers with the raw `Conversation` row (+ `participants`, each only
// `{ userId, driverId, lastReadAt, mutedUntil }` — see `messaging.repository.ts`). There is no
// driver name/avatar join, no `unreadCount` and no `lastMessage` preview on the wire
// (web/backend-gaps.md B-37). This module:
//   1. joins the driver participant against `GET /drivers` client-side (like `vehicles.ts`);
//   2. derives "unread" truthfully from the one real signal the backend does send — the calling
//      user's own `ConversationParticipant.lastReadAt` vs `conversation.lastMessageAt` — rather
//      than fabricating a message count the API cannot back up;
//   3. leaves the last-message body as "unavailable" (no extra per-conversation fetch) until
//      B-37 ships — see the empty preview line in `MessagesPage`, not a guess here.
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from './client';
import { endpoints } from './endpoints';
import { qk, qkRoot } from './queryKeys';
import { typedCachePolicy } from './queryPolicy';
import { useDriversLookup } from './lookups';
import type { OffsetPage } from './types';
import type { DriverRow } from './vehicles';

/** `SUPPORT` (B-90) — a support chat opened with `POST /support/chats`. */
export type ConversationType = 'DIRECT' | 'GROUP' | 'BROADCAST' | 'SUPPORT';

export interface ConversationParticipantRow {
  id: string;
  conversationId: string;
  userId: string | null;
  driverId: string | null;
  lastReadAt: string | null;
  mutedUntil: string | null;
}

export interface ConversationRow {
  id: string;
  type: ConversationType;
  title: string | null;
  lastMessageAt: string | null;
  createdById: string;
  createdAt: string;
  participants: ConversationParticipantRow[];
  /** B-37 (shipped 2026-09-24) — the newest message (preview line) and the caller's real unread count. */
  lastMessage?: MessageRow | null;
  unreadCount?: number;
}

export interface MessageRow {
  id: string;
  conversationId: string;
  senderUserId: string | null;
  senderDriverId: string | null;
  body: string;
  attachmentId: string | null;
  clientId: string | null;
  sentAt: string;
  deliveredAt: string | null;
  readAt: string | null;
  /** Client-only — never on the wire. Drives the optimistic bubble while `useSendMessage`'s
   * POST is in flight (`'sending'`) or has failed (`'failed'`, red border + `Retry` per
   * web/tz.md W-16). Absent for every real (server- or echo-confirmed) message. */
  status?: 'sending' | 'failed';
}

export interface ConversationListItem extends ConversationRow {
  /** The driver participant (DIRECT/BROADCAST) — `null` for a GROUP with no single driver. */
  driver: DriverRow | null;
  /** Truthful, not fabricated — see the module header. `false` when there is no `lastMessageAt`
   * yet or the caller's own participant record cannot be found. */
  unread: boolean;
}

function joinConversation(conversation: ConversationRow, driverById: Map<string, DriverRow>, currentUserId: string | undefined): ConversationListItem {
  const driverParticipant = conversation.participants.find((p) => p.driverId);
  const driver = driverParticipant?.driverId ? driverById.get(driverParticipant.driverId) ?? null : null;
  const mine = conversation.participants.find((p) => p.userId === currentUserId);
  const unread = Boolean(
    conversation.lastMessageAt && (!mine?.lastReadAt || new Date(conversation.lastMessageAt) > new Date(mine.lastReadAt)),
  );
  return { ...conversation, driver, unread };
}

/** W-16 left panel — one `/conversations` call + the cached `/drivers` reference list. */
export function useConversationsList(currentUserId: string | undefined) {
  const conversationsQuery = useQuery({
    queryKey: qk.conversations(),
    queryFn: ({ signal }) => client.get<{ items: ConversationRow[] }>(endpoints.conversations.list, { signal }),
    ...typedCachePolicy<{ items: ConversationRow[] }>('list'),
  });
  // The session-wide `reference` lookup (WB-087) — one key, one policy, shared with every screen.
  const driversQuery = useDriversLookup();

  const items = useMemo(() => {
    const driverById = new Map((driversQuery.data?.items ?? []).map((d) => [d.id, d]));
    return (conversationsQuery.data?.items ?? [])
      .map((c) => joinConversation(c, driverById, currentUserId))
      .sort((a, b) => new Date(b.lastMessageAt ?? b.createdAt).getTime() - new Date(a.lastMessageAt ?? a.createdAt).getTime());
  }, [conversationsQuery.data, driversQuery.data, currentUserId]);

  return {
    items,
    isLoading: conversationsQuery.isLoading || driversQuery.isLoading,
    // Same class as WB-038 (`paging.ts:91,109`) and `safety.ts` — only the primary query drives the
    // error state, and only when it has nothing cached. A transient `/drivers` join failure leaves
    // `driver` null and the row falls back to its title / `Conversation` instead of blanking W-16.
    isError: conversationsQuery.isError && !conversationsQuery.data,
    refetch: conversationsQuery.refetch,
  };
}

/** The open thread — `staleTime: 0`, no polling; `message.new` on `conversation:{id}` is the only
 * thing that refreshes it (web/tz.md §16 rule 2). */
export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: qk.messages(conversationId ?? ''),
    queryFn: ({ signal }) => client.list<MessageRow>(endpoints.conversations.messages(conversationId as string), { limit: 100 }, { signal }),
    enabled: Boolean(conversationId),
    ...typedCachePolicy<OffsetPage<MessageRow>>('conversation'),
  });
}

export interface SendMessagePayload {
  body: string;
  clientId: string;
  attachmentId?: string;
}

/** Optimistic append with a `clientId` for idempotency (web/tz.md §16 rule 2) — a real
 * `message.new` echo carrying the same `clientId` is de-duplicated, not appended twice. */
export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SendMessagePayload) => client.post<MessageRow>(endpoints.conversations.sendMessage(conversationId), payload),
    onSuccess: (message) => {
      upsertMessage(queryClient, conversationId, message);
      bumpConversation(queryClient, conversationId, message.sentAt);
    },
  });
}

/** Appends (or replaces the optimistic placeholder for) a message, de-duplicated by `id` and by
 * `clientId` — the same rule the `message.new` handler in `MessagesPage` uses. */
export function upsertMessage(
  queryClient: ReturnType<typeof useQueryClient>,
  conversationId: string,
  message: MessageRow,
): void {
  queryClient.setQueryData<OffsetPage<MessageRow> | undefined>(qk.messages(conversationId), (prev) => {
    if (!prev) return prev;
    const withoutDuplicate = prev.items.filter(
      (m) => m.id !== message.id && !(message.clientId && m.clientId === message.clientId),
    );
    // Keep the server's count (WB-093): only a genuinely new message adds one; replacing the
    // optimistic placeholder or de-duplicating an echo leaves `total` as it was.
    const isNew = withoutDuplicate.length === prev.items.length;
    return { ...prev, items: [...withoutDuplicate, message], total: prev.total + (isNew ? 1 : 0) };
  });
}

/** Marks one optimistic message `'sending'` or `'failed'` in place, matched by `clientId` — used
 * on `useSendMessage` failure (and on retry) so the bubble never looks delivered when it is not
 * (web/tz.md W-16: red border + `Retry`; never silently dropped or left indistinguishable). */
export function setMessageStatus(
  queryClient: ReturnType<typeof useQueryClient>,
  conversationId: string,
  clientId: string,
  status: MessageRow['status'],
): void {
  queryClient.setQueryData<OffsetPage<MessageRow> | undefined>(qk.messages(conversationId), (prev) => {
    if (!prev) return prev;
    return { ...prev, items: prev.items.map((m) => (m.clientId === clientId ? { ...m, status } : m)) };
  });
}

/** WB-117 — there is no `POST /conversations/:id/read` (or similar) on the wire; see
 * `web/backend-gaps.md` B-67. Rather than render an "Unread" badge/segment that can never clear
 * for the rest of the session (the previous behaviour), this patches the caller's own
 * `ConversationParticipant.lastReadAt` in the local cache the moment the conversation is opened —
 * an honest record of what the panel actually knows (the user did just view these messages), not
 * a fabricated server value. It does not persist: a refresh, another tab, or the backend's own
 * copy of `lastReadAt` still shows the conversation unread until B-67 ships a real write path. */
export function markConversationRead(
  queryClient: ReturnType<typeof useQueryClient>,
  conversationId: string,
  currentUserId: string | undefined,
): void {
  if (!currentUserId) return;
  queryClient.setQueryData<{ items: ConversationRow[] } | undefined>(qk.conversations(), (prev) => {
    if (!prev) return prev;
    const readAt = new Date().toISOString();
    return {
      items: prev.items.map((c) =>
        c.id === conversationId
          ? { ...c, participants: c.participants.map((p) => (p.userId === currentUserId ? { ...p, lastReadAt: readAt } : p)) }
          : c,
      ),
    };
  });
}

/** Patches the conversation-list cache in place (never a full `invalidateQueries`) so the
 * sidebar reorders and its `lastMessageAt` updates without a round trip (web/tz.md §16 rule 3). */
export function bumpConversation(queryClient: ReturnType<typeof useQueryClient>, conversationId: string, lastMessageAt: string): void {
  queryClient.setQueryData<{ items: ConversationRow[] } | undefined>(qk.conversations(), (prev) => {
    if (!prev) return prev;
    return { items: prev.items.map((c) => (c.id === conversationId ? { ...c, lastMessageAt } : c)) };
  });
}

export interface CreateConversationPayload {
  type?: ConversationType;
  title?: string;
  driverIds?: string[];
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateConversationPayload) => client.post<ConversationRow>(endpoints.conversations.create, payload),
    onSuccess: (conversation) => {
      // Put the server's own row into the list right away so the caller can select it without
      // waiting for the refetch below (which then replaces it with the canonical list).
      queryClient.setQueryData<{ items: ConversationRow[] } | undefined>(qk.conversations(), (prev) => {
        if (!prev || prev.items.some((c) => c.id === conversation.id)) return prev;
        return { items: [{ ...conversation, participants: conversation.participants ?? [] }, ...prev.items] };
      });
      void queryClient.invalidateQueries({ queryKey: qkRoot.conversations });
    },
  });
}

export interface BroadcastPayload {
  title?: string;
  body: string;
  driverIds: string[];
}

export interface BroadcastResult {
  sent: number;
  deliveries: Array<{ conversationId: string; messageId: string; driverId: string }>;
}

export function useBroadcastMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BroadcastPayload) => client.post<BroadcastResult>(endpoints.conversations.broadcast, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.conversations });
    },
  });
}

/* ------------------------------------------------------------------ B-67 persisted read */

/** `POST /conversations/:id/read` — persists the caller's `lastReadAt` (B-67, shipped 2026-09-24).
 * Applies the local `markConversationRead` patch first so the dot clears instantly, then writes it. */
export function useMarkConversationRead(currentUserId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      client.post<{ conversationId: string; lastReadAt: string }>(endpoints.conversations.read(conversationId)),
    onMutate: (conversationId) => markConversationRead(queryClient, conversationId, currentUserId),
    onSuccess: (_result, conversationId) => {
      queryClient.setQueryData<{ items: ConversationRow[] } | undefined>(qk.conversations(), (prev) =>
        prev ? { items: prev.items.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)) } : prev,
      );
    },
  });
}
