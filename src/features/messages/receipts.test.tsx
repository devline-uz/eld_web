import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import * as RealtimeProviderModule from '@/shared/realtime/RealtimeProvider';
import { qk } from '@/shared/api/queryKeys';
import { applyMessageRead, type ConversationRow, type MessageRow } from '@/shared/api/messaging';
import type { OffsetPage } from '@/shared/api/types';
import { MessageTicks } from './components/MessageTicks';
import { TYPING_EMIT_THROTTLE_MS, TYPING_IDLE_MS, TYPING_VISIBLE_MS, useRemoteTyping, useTypingEmitter } from './useTyping';

const msg = (over: Partial<MessageRow>): MessageRow => ({
  id: 'm',
  conversationId: 'c1',
  senderUserId: 'usr_1',
  senderDriverId: null,
  body: 'x',
  attachmentId: null,
  clientId: null,
  sentAt: '2026-09-12T10:00:00.000Z',
  deliveredAt: null,
  readAt: null,
  ...over,
});

describe('MessageTicks', () => {
  it('sent: one grey tick', () => {
    render(<MessageTicks message={{ deliveredAt: null, readAt: null }} />);
    const el = screen.getByRole('img', { name: 'Sent' });
    expect(el).toHaveAttribute('data-tick', 'sent');
    expect(el).toHaveClass('text-text-muted');
  });
  it('delivered: grey double tick', () => {
    render(<MessageTicks message={{ deliveredAt: '2026-09-12T10:01:00.000Z', readAt: null }} />);
    const el = screen.getByRole('img', { name: /^Delivered / });
    expect(el).toHaveAttribute('data-tick', 'delivered');
    expect(el).toHaveClass('text-text-muted');
  });
  it('read: brand double tick with the read time in the tooltip', () => {
    render(<MessageTicks message={{ deliveredAt: '2026-09-12T10:01:00.000Z', readAt: '2026-09-12T10:02:00.000Z' }} />);
    const el = screen.getByRole('img', { name: /^Read / });
    expect(el).toHaveAttribute('data-tick', 'read');
    expect(el).toHaveClass('text-primary');
    expect(el.getAttribute('title')).toMatch(/^Read Sep 12/);
  });
});

describe('applyMessageRead', () => {
  function setup() {
    const qc = new QueryClient();
    const page: OffsetPage<MessageRow> = {
      items: [
        msg({ id: 'm1', sentAt: '2026-09-12T10:00:00.000Z' }),
        msg({ id: 'm2', sentAt: '2026-09-12T10:05:00.000Z' }),
        msg({ id: 'm3', sentAt: '2026-09-12T10:10:00.000Z' }),
        msg({ id: 'd1', senderUserId: null, senderDriverId: 'drv_1', sentAt: '2026-09-12T10:01:00.000Z' }),
        msg({ id: 'optimistic-x', sentAt: '2026-09-12T10:02:00.000Z', status: 'sending' }),
      ],
      page: 1,
      limit: 100,
      total: 5,
      totalPages: 1,
    };
    qc.setQueryData(qk.messages('c1'), page);
    const conv: ConversationRow = {
      id: 'c1',
      type: 'DIRECT',
      title: null,
      lastMessageAt: null,
      createdById: 'usr_1',
      createdAt: '2026-09-10T00:00:00.000Z',
      participants: [
        { id: 'p1', conversationId: 'c1', userId: 'usr_1', driverId: null, lastReadAt: null, mutedUntil: null },
        { id: 'p2', conversationId: 'c1', userId: null, driverId: 'drv_1', lastReadAt: null, mutedUntil: null },
      ],
      unreadCount: 2,
    };
    qc.setQueryData(qk.conversations(), { items: [conv] });
    const items = () => qc.getQueryData<OffsetPage<MessageRow>>(qk.messages('c1'))!.items;
    const conversation = () => qc.getQueryData<{ items: ConversationRow[] }>(qk.conversations())!.items[0]!;
    return { qc, items, conversation };
  }

  it('DRIVER read stamps staff messages up to lastReadMessageId and the driver lastReadAt', () => {
    const { qc, items, conversation } = setup();
    applyMessageRead(
      qc,
      { conversationId: 'c1', readerType: 'DRIVER', readerId: 'drv_1', lastReadMessageId: 'm2', readAt: '2026-09-12T10:20:00.000Z' },
      'usr_1',
    );
    const byId = Object.fromEntries(items().map((m) => [m.id, m]));
    expect(byId.m1!.readAt).toBe('2026-09-12T10:20:00.000Z');
    expect(byId.m1!.deliveredAt).toBe('2026-09-12T10:20:00.000Z');
    expect(byId.m2!.readAt).toBe('2026-09-12T10:20:00.000Z');
    expect(byId.m3!.readAt).toBeNull(); // newer than the anchor
    expect(byId.d1!.readAt).toBeNull(); // the driver's own message
    expect(byId['optimistic-x']!.readAt).toBeNull();
    expect(conversation().participants[1]!.lastReadAt).toBe('2026-09-12T10:20:00.000Z');
    expect(conversation().unreadCount).toBe(2); // a driver read does not touch the staff badge
  });

  it('falls back to readAt as the cutoff when lastReadMessageId is null', () => {
    const { qc, items } = setup();
    applyMessageRead(
      qc,
      { conversationId: 'c1', readerType: 'DRIVER', readerId: 'drv_1', lastReadMessageId: null, readAt: '2026-09-12T10:06:00.000Z' },
      'usr_1',
    );
    expect(items().find((m) => m.id === 'm2')!.readAt).not.toBeNull();
    expect(items().find((m) => m.id === 'm3')!.readAt).toBeNull();
  });

  it('is a no-op (same cache reference) when nothing changes', () => {
    const { qc, items } = setup();
    const payload = { conversationId: 'c1', readerType: 'DRIVER', readerId: 'drv_1', lastReadMessageId: 'm3', readAt: '2026-09-12T10:20:00.000Z' } as const;
    applyMessageRead(qc, payload, 'usr_1');
    const before = items();
    applyMessageRead(qc, payload, 'usr_1');
    expect(items()).toBe(before);
  });

  it('STAFF read by me clears the unread badge; by another staff only moves their lastReadAt', () => {
    const { qc, conversation } = setup();
    applyMessageRead(
      qc,
      { conversationId: 'c1', readerType: 'STAFF', readerId: 'usr_2', lastReadMessageId: null, readAt: '2026-09-12T10:20:00.000Z' },
      'usr_1',
    );
    expect(conversation().unreadCount).toBe(2);
    applyMessageRead(
      qc,
      { conversationId: 'c1', readerType: 'STAFF', readerId: 'usr_1', lastReadMessageId: null, readAt: '2026-09-12T10:21:00.000Z' },
      'usr_1',
    );
    expect(conversation().unreadCount).toBe(0);
  });
});

describe('typing', () => {
  const socket = { emit: vi.fn() };
  beforeEach(() => {
    vi.useFakeTimers();
    socket.emit.mockClear();
    vi.spyOn(RealtimeProviderModule, 'useRealtime').mockReturnValue({
      getSocket: () => socket as never,
      connected: true,
      isOffline: false,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  const typingCalls = () => socket.emit.mock.calls.filter((c) => c[0] === 'typing').map((c) => c[1]);

  it('emits true once per throttle window, false after 3 s idle', () => {
    const { result } = renderHook(() => useTypingEmitter('c1'));
    act(() => result.current.notifyInput(true));
    act(() => {
      vi.advanceTimersByTime(500);
      result.current.notifyInput(true);
      vi.advanceTimersByTime(500);
      result.current.notifyInput(true);
    });
    expect(typingCalls()).toEqual([{ conversationId: 'c1', isTyping: true }]);
    act(() => vi.advanceTimersByTime(TYPING_EMIT_THROTTLE_MS));
    act(() => result.current.notifyInput(true));
    expect(typingCalls()).toHaveLength(2);
    act(() => vi.advanceTimersByTime(TYPING_IDLE_MS));
    expect(typingCalls().at(-1)).toEqual({ conversationId: 'c1', isTyping: false });
    expect(typingCalls()).toHaveLength(3);
  });

  it('stop() (send / blur) emits false once; an empty draft also stops', () => {
    const { result } = renderHook(() => useTypingEmitter('c1'));
    act(() => result.current.notifyInput(true));
    act(() => result.current.stop());
    act(() => result.current.stop());
    expect(typingCalls()).toEqual([
      { conversationId: 'c1', isTyping: true },
      { conversationId: 'c1', isTyping: false },
    ]);
    act(() => result.current.notifyInput(true));
    act(() => result.current.notifyInput(false));
    expect(typingCalls().at(-1)).toEqual({ conversationId: 'c1', isTyping: false });
  });

  it('unmount while typing emits false', () => {
    const { result, unmount } = renderHook(() => useTypingEmitter('c1'));
    act(() => result.current.notifyInput(true));
    unmount();
    expect(typingCalls().at(-1)).toEqual({ conversationId: 'c1', isTyping: false });
  });

  it('remote indicator shows for a DRIVER, ignores STAFF, auto-hides after 5 s, refreshes on repeat', () => {
    const { result } = renderHook(() => useRemoteTyping());
    act(() => result.current.onTyping({ conversationId: 'c1', userType: 'STAFF', isTyping: true }));
    expect(result.current.typing.has('c1')).toBe(false);
    act(() => result.current.onTyping({ conversationId: 'c1', userType: 'DRIVER', isTyping: true }));
    expect(result.current.typing.has('c1')).toBe(true);
    act(() => vi.advanceTimersByTime(TYPING_VISIBLE_MS - 1000));
    act(() => result.current.onTyping({ conversationId: 'c1', userType: 'DRIVER', isTyping: true }));
    act(() => vi.advanceTimersByTime(TYPING_VISIBLE_MS - 1000));
    expect(result.current.typing.has('c1')).toBe(true);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.typing.has('c1')).toBe(false);
    act(() => result.current.onTyping({ conversationId: 'c1', userType: 'DRIVER', isTyping: true }));
    act(() => result.current.onTyping({ conversationId: 'c1', userType: 'DRIVER', isTyping: false }));
    expect(result.current.typing.has('c1')).toBe(false);
  });
});
