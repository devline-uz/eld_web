// owner: web-dispatch-messaging — `typing` presence (backend D-146).
//
// Outgoing: while the staff user types, emit `typing { conversationId, isTyping: true }` at most
// once per TYPING_EMIT_THROTTLE_MS, and `false` on send / blur / TYPING_IDLE_MS of silence / thread
// change / unmount. The socket must already be in `conversation:{id}` (MessagesPage joins every
// listed conversation). Incoming: `useRemoteTyping` tracks which conversations have a DRIVER typing
// and auto-hides each after TYPING_VISIBLE_MS without a refresh.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRealtime } from '@/shared/realtime/RealtimeProvider';

export const TYPING_EMIT_THROTTLE_MS = 2000;
export const TYPING_IDLE_MS = 3000;
export const TYPING_VISIBLE_MS = 5000;

export function useTypingEmitter(conversationId: string | undefined) {
  const { getSocket, connected } = useRealtime();
  const state = useRef<{ typing: boolean; lastEmitAt: number; timer: ReturnType<typeof setTimeout> | null }>({
    typing: false,
    lastEmitAt: 0,
    timer: null,
  });

  const emit = useCallback(
    (id: string, isTyping: boolean) => {
      const socket = getSocket();
      if (socket && connected) socket.emit('typing', { conversationId: id, isTyping });
    },
    [getSocket, connected],
  );

  const stop = useCallback(() => {
    const s = state.current;
    if (s.timer) clearTimeout(s.timer);
    s.timer = null;
    if (s.typing && conversationId) emit(conversationId, false);
    s.typing = false;
    s.lastEmitAt = 0;
  }, [conversationId, emit]);

  /** Call on every composer change; an empty draft counts as "stopped". */
  const notifyInput = useCallback(
    (hasText: boolean) => {
      if (!conversationId) return;
      if (!hasText) return stop();
      const s = state.current;
      const now = Date.now();
      if (!s.typing || now - s.lastEmitAt >= TYPING_EMIT_THROTTLE_MS) {
        emit(conversationId, true);
        s.typing = true;
        s.lastEmitAt = now;
      }
      if (s.timer) clearTimeout(s.timer);
      s.timer = setTimeout(stop, TYPING_IDLE_MS);
    },
    [conversationId, emit, stop],
  );

  // Switching thread or leaving the page ends typing in the one we were in.
  useEffect(() => stop, [stop]);

  return { notifyInput, stop };
}

/** Which conversations currently have a DRIVER composing. */
export function useRemoteTyping() {
  const [typing, setTyping] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const clear = useCallback((conversationId: string) => {
    const t = timers.current.get(conversationId);
    if (t) clearTimeout(t);
    timers.current.delete(conversationId);
    setTyping((prev) => {
      if (!prev.has(conversationId)) return prev;
      const next = new Set(prev);
      next.delete(conversationId);
      return next;
    });
  }, []);

  const onTyping = useCallback(
    (event: { conversationId: string; userType: string; isTyping: boolean }) => {
      if (event.userType !== 'DRIVER') return;
      if (!event.isTyping) return clear(event.conversationId);
      const old = timers.current.get(event.conversationId);
      if (old) clearTimeout(old);
      timers.current.set(event.conversationId, setTimeout(() => clear(event.conversationId), TYPING_VISIBLE_MS));
      setTyping((prev) => (prev.has(event.conversationId) ? prev : new Set(prev).add(event.conversationId)));
    },
    [clear],
  );

  useEffect(() => {
    const live = timers.current;
    return () => {
      for (const t of live.values()) clearTimeout(t);
      live.clear();
    };
  }, []);

  return { typing, onTyping, clear };
}
