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
import type { OffsetPage } from './types';
import type { DriverRow } from './vehicles';

export type ConversationType = 'DIRECT' | 'GROUP' | 'BROADCAST';

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
    queryFn: () => client.get<{ items: ConversationRow[] }>(endpoints.conversations.list),
    ...typedCachePolicy<{ items: ConversationRow[] }>('list'),
  });
  const driversQuery = useQuery({
    queryKey: qk.drivers({ limit: 500 }),
    queryFn: () => client.list<DriverRow>(endpoints.drivers.list, { limit: 500 }),
    ...typedCachePolicy<OffsetPage<DriverRow>>('reference'),
  });

  const items = useMemo(() => {
    const driverById = new Map((driversQuery.data?.items ?? []).map((d) => [d.id, d]));
    return (conversationsQuery.data?.items ?? [])
      .map((c) => joinConversation(c, driverById, currentUserId))
      .sort((a, b) => new Date(b.lastMessageAt ?? b.createdAt).getTime() - new Date(a.lastMessageAt ?? a.createdAt).getTime());
  }, [conversationsQuery.data, driversQuery.data, currentUserId]);

  return {
    items,
    isLoading: conversationsQuery.isLoading || driversQuery.isLoading,
    isError: conversationsQuery.isError || driversQuery.isError,
    refetch: conversationsQuery.refetch,
  };
}

/** The open thread — `staleTime: 0`, no polling; `message.new` on `conversation:{id}` is the only
 * thing that refreshes it (web/tz.md §16 rule 2). */
export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: qk.messages(conversationId ?? ''),
    queryFn: () => client.list<MessageRow>(endpoints.conversations.messages(conversationId as string), { limit: 100 }),
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
    return { ...prev, items: [...withoutDuplicate, message], total: withoutDuplicate.length + 1 };
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
    onSuccess: () => {
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
