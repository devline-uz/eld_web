// owner: web-realtime — many-room subscription (the `useRoom` lifecycle, for a whole list).
//
// W-16 Messages needs `message.new` from every conversation the user is in, not only the open one
// — otherwise the sidebar (preview, order, unread dot/count) only changed on a page reload. The
// gateway pushes `message.new` to `conversation:{id}` only (messaging.service.ts), so the panel
// joins each listed conversation's room. Membership is diffed: a conversation added to (or dropped
// from) the list costs one `subscribe` / `unsubscribe`, never a leave-and-rejoin of every room
// (which would open a window where a push is missed).
import { useEffect, useEffectEvent, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { useRealtime } from './RealtimeProvider';
import { REALTIME_EVENTS, type RealtimeEventName, type RoomName } from './events';
import { isIdentityRoom, type RoomHandlers } from './useRoom';

/**
 * Keeps the socket subscribed to exactly `rooms` (identity rooms are skipped — they are joined on
 * connect and must never be left, WB-248) and dispatches `handlers` for events on any of them.
 * Socket.IO listeners are per socket, not per room, so one listener per handled event serves the
 * whole set; a handler that cares which room an event came from checks the payload.
 */
export function useRooms(rooms: readonly RoomName[], handlers: RoomHandlers = {}): void {
  const { getSocket, connected } = useRealtime();
  const roomsKey = [...new Set(rooms.filter((room) => !isIdentityRoom(room)))].sort().join(',');
  const eventsKey = REALTIME_EVENTS.filter((event) => typeof handlers[event] === 'function').join(',');
  /** Rooms this hook has asked the current socket to join. */
  const joined = useRef<{ socket: Socket | null; rooms: Set<string> }>({ socket: null, rooms: new Set() });

  const dispatch = useEffectEvent((event: RealtimeEventName, payload: unknown) => {
    handlers[event]?.(payload as never);
  });

  // Lifetime of the joined set: leave everything on unmount / socket change / disconnect (the
  // server drops a disconnected socket's rooms itself; the next `connected` re-joins them).
  useEffect(() => {
    const current = joined.current;
    return () => {
      const { socket, rooms: owned } = current;
      // Skip on a dropped socket: socket.io-client would buffer the emit and replay it on reconnect.
      if (socket && connected && socket.connected !== false) for (const room of owned) socket.emit('unsubscribe', room);
      current.socket = null;
      current.rooms = new Set();
    };
  }, [getSocket, connected]);

  // Diff the wanted set against what is joined — runs after the lifetime effect above.
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !connected) return;
    const current = joined.current;
    if (current.socket !== socket) {
      current.socket = socket;
      current.rooms = new Set();
    }
    const wanted = new Set(roomsKey ? roomsKey.split(',') : []);
    for (const room of current.rooms) {
      if (!wanted.has(room)) {
        socket.emit('unsubscribe', room);
        current.rooms.delete(room);
      }
    }
    for (const room of wanted) {
      if (!current.rooms.has(room)) {
        // A rejected room (`{ ok: false }`) simply gets no pushes — same contract as `useRoom`.
        socket.emit('subscribe', room, () => undefined);
        current.rooms.add(room);
      }
    }
  }, [getSocket, connected, roomsKey]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !connected || !eventsKey) return;

    const listeners = (eventsKey.split(',') as RealtimeEventName[]).map((event) => {
      const listener = (payload: unknown) => dispatch(event, payload);
      socket.on(event, listener);
      return [event, listener] as const;
    });

    return () => {
      for (const [event, listener] of listeners) socket.off(event, listener);
    };
  }, [getSocket, connected, eventsKey]);
}
