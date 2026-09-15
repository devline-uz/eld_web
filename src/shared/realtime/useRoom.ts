// owner: web-realtime — room subscription on mount / unsubscribe on unmount (web/tz.md §7.5).
//
// `socket.emit('subscribe', room, cb)` → `{ ok }` (backend/src/modules/realtime/realtime.gateway.ts
// `onSubscribe`); a rejected room (bad name, or the authorizer says no) resolves `{ ok: false }`
// and is surfaced as `joined: false` rather than thrown — a screen that lacks the room simply
// gets no live updates, it does not crash.
import { useEffect, useEffectEvent, useState } from 'react';
import { useRealtime } from './RealtimeProvider';
import { REALTIME_EVENTS, type RealtimeEventName, type RealtimeEventPayloads, type RoomName } from './events';

export type RoomHandlers = {
  [K in RealtimeEventName]?: (payload: RealtimeEventPayloads[K]) => void;
};

export interface UseRoomResult {
  /** True once the `subscribe` ack came back `{ ok: true }`. */
  joined: boolean;
}

/**
 * Subscribes to `room` on mount, unsubscribes on unmount (or on `room` change). Never call this
 * with a static top-level room like `fleet` and leave it mounted globally — it is meant to track
 * the lifetime of the screen that needs it.
 */
export function useRoom(room: RoomName | null, handlers: RoomHandlers = {}): UseRoomResult {
  const { getSocket, connected } = useRealtime();
  const [joined, setJoined] = useState(false);

  const dispatch = useEffectEvent((event: RealtimeEventName, payload: unknown) => {
    handlers[event]?.(payload as never);
  });

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !connected || !room) return;

    let cancelled = false;
    socket.emit('subscribe', room, (ack: { ok: boolean } | undefined) => {
      if (!cancelled) setJoined(Boolean(ack?.ok));
    });

    const listeners = REALTIME_EVENTS.map((event) => {
      const listener = (payload: unknown) => dispatch(event, payload);
      socket.on(event, listener);
      return [event, listener] as const;
    });

    return () => {
      cancelled = true;
      for (const [event, listener] of listeners) socket.off(event, listener);
      socket.emit('unsubscribe', room);
      setJoined(false);
    };
  }, [getSocket, connected, room]);

  return { joined };
}
