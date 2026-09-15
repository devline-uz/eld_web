// Listen to one realtime event on the already-joined rooms, WITHOUT subscribing to a room.
//
// `user:{id}` is joined by the gateway on connect (web/tz.md §7.2). `useRoom('user:…')` would
// emit `unsubscribe` on unmount and silently drop the auto-joined room for every other screen
// (Reports' `report.ready`), so shell-level listeners — the bell's `notification.new` — attach
// here instead.
import { useEffect, useEffectEvent } from 'react';
import type { RealtimeEventName, RealtimeEventPayloads } from './events';
import { useRealtime } from './RealtimeProvider';

export function useRealtimeEvent<K extends RealtimeEventName>(
  event: K,
  handler: (payload: RealtimeEventPayloads[K]) => void,
): void {
  const { getSocket, connected } = useRealtime();
  const onEvent = useEffectEvent((payload: RealtimeEventPayloads[K]) => handler(payload));

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !connected) return;
    const listener = (payload: RealtimeEventPayloads[K]) => onEvent(payload);
    socket.on(event as string, listener);
    return () => {
      socket.off(event as string, listener);
    };
  }, [getSocket, connected, event]);
}
