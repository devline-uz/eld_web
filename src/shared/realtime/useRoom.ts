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
/**
 * `user:{id}` is the identity room the gateway joins on connect (web users never own a
 * `driver:{id}` identity). Emitting `unsubscribe` for it makes the gateway `leave` it, which
 * silenced the bell and `report.ready` for the rest of the session after one Reports screen
 * unmounted (web/bugs.md WB-248) — so for it we only attach listeners, never (un)subscribe.
 */
export function isIdentityRoom(room: RoomName): boolean {
  return room.startsWith('user:');
}

export function useRoom(room: RoomName | null, handlers: RoomHandlers = {}): UseRoomResult {
  const { getSocket, connected } = useRealtime();
  const [subscribed, setJoined] = useState(false);
  const identity = room !== null && isIdentityRoom(room);
  const joined = identity ? connected : subscribed;
  // Only the events this caller handles get a socket listener (WB-255) — a `{}` room (HOS Logs'
  // `violations`, Driver profile) attaches none, instead of all nine per mounted room. A string,
  // so a fresh `handlers` literal each render does not re-attach anything.
  const eventsKey = REALTIME_EVENTS.filter((event) => typeof handlers[event] === 'function').join(',');

  const dispatch = useEffectEvent((event: RealtimeEventName, payload: unknown) => {
    handlers[event]?.(payload as never);
  });

  // Room membership — independent of which events are listened to, so a handler set that changes
  // never costs an unsubscribe/subscribe round trip.
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !connected || !room || isIdentityRoom(room)) return;

    let cancelled = false;
    socket.emit('subscribe', room, (ack: { ok: boolean } | undefined) => {
      if (!cancelled) setJoined(Boolean(ack?.ok));
    });

    return () => {
      cancelled = true;
      socket.emit('unsubscribe', room);
      setJoined(false);
    };
  }, [getSocket, connected, room]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !connected || !room || !eventsKey) return;

    const listeners = (eventsKey.split(',') as RealtimeEventName[]).map((event) => {
      const listener = (payload: unknown) => dispatch(event, payload);
      socket.on(event, listener);
      return [event, listener] as const;
    });

    return () => {
      for (const [event, listener] of listeners) socket.off(event, listener);
    };
  }, [getSocket, connected, room, eventsKey]);

  return { joined };
}
