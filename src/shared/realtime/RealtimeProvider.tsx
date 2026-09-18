// owner: web-realtime — socket.io connection to VITE_WS_URL + VITE_WS_NAMESPACE, rooms,
// reconnect resync, offline banner, 200 ms throttled setQueryData patches (web/tz.md §7).
//
// Namespace is `/realtime` (not `/ws`); the token rides in the handshake `auth` object, never a
// query string (§7.2). The backend has no `resume`/`seq` and no token renewal endpoint of its
// own — on `reconnect` we invalidate every query TanStack currently has mounted (which, by
// `invalidateQueries()`'s default `refetchType: 'active'`, is exactly "every query of the
// current screen" — inactive ones are just marked stale for next mount). On a proactive token
// refresh we reassign `socket.auth` and cycle the connection per §7.2.
//
// The live socket and its connection status live in a small external store (one per provider
// instance, created once via `useState`'s lazy initializer) read through `useSyncExternalStore`,
// not React state/refs directly — every mutation happens inside a socket/DOM event callback, per
// the project's react-hooks/set-state-in-effect and react-hooks/refs rules; nothing calls
// `setState` synchronously inside an effect body, and nothing dereferences a ref during render.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from '@/shared/api/client';
import { useAuth } from '@/shared/auth/AuthProvider';
import { registerSocketDisconnect } from '@/shared/auth/authEvents';
// Imported from their own modules, not the `@/shared/ui` barrel — pulling the whole barrel in
// here would drag every shared/ui component into this module's test coverage graph (WB-xxx).
import { OfflineBanner } from '@/shared/ui/OfflineBanner';
import { TOAST_COPY } from '@/shared/ui/copy';
import { useToast } from '@/shared/ui/Toast';

// No literal fallback here (house/no-url-literal) — VITE_WS_URL / VITE_WS_NAMESPACE are set in
// every real environment (.env.development, .env.example); an unset value is a config bug, not
// something a hard-coded string should paper over.
const WS_URL: string = import.meta.env.VITE_WS_URL;
const WS_NAMESPACE: string = import.meta.env.VITE_WS_NAMESPACE;

/** §7.2 — a rejected token disconnects the socket; the server never auto-accepts a retry with the
 * same bad token, so this is the one `disconnect` reason that must not be retried. */
const SERVER_REJECTED_REASON = 'io server disconnect';

/** The reason socket.io reports for our own `socket.disconnect()` (the token cycle, WB-119). */
const CLIENT_DISCONNECT_REASON = 'io client disconnect';

/** How often we compare the in-memory access token against the one the socket handshook with.
 * There is no token-change event exposed by shared/auth, so polling is the documented seam. */
const TOKEN_WATCH_MS = 5_000;

/** How often the "cached N minutes ago" banner copy re-renders while offline. */
const OFFLINE_TICK_MS = 30_000;

/** WS is only treated as "down" (for the offline banner) after this many failed reconnect
 * attempts — a single dropped frame must not flash the banner (§13.4: "WS down plus two failed
 * requests"). */
const WS_DOWN_AFTER_ATTEMPTS = 2;

interface RealtimeState {
  connected: boolean;
  online: boolean;
  failedAttempts: number;
  offlineSince: number | null;
  cachedMinutesAgo: number;
  isOffline: boolean;
}

function isOfflineFor(s: Pick<RealtimeState, 'online' | 'connected' | 'failedAttempts'>): boolean {
  return !s.online || (!s.connected && s.failedAttempts >= WS_DOWN_AFTER_ATTEMPTS);
}

/**
 * A websocket is an external system by definition — this store keeps its live instance and
 * derived connection state outside React, and notifies subscribers only from event callbacks
 * (connect/disconnect/online/offline/interval), never synchronously from an effect body.
 */
function createRealtimeStore() {
  let socket: Socket | null = null;
  let state: RealtimeState = {
    connected: false,
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    failedAttempts: 0,
    offlineSince: null,
    cachedMinutesAgo: 0,
    isOffline: false,
  };
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) listener();
  };

  const recomputeMinutesAgo = () => {
    state = {
      ...state,
      cachedMinutesAgo: state.offlineSince
        ? Math.max(0, Math.floor((Date.now() - state.offlineSince) / 60_000))
        : 0,
    };
    emit();
  };

  const startTicking = () => {
    if (tickTimer) return;
    tickTimer = setInterval(recomputeMinutesAgo, OFFLINE_TICK_MS);
  };
  const stopTicking = () => {
    if (!tickTimer) return;
    clearInterval(tickTimer);
    tickTimer = null;
  };

  /** The only way connection-related fields change; computes the offline transition itself. */
  function patch(delta: Partial<Pick<RealtimeState, 'connected' | 'online' | 'failedAttempts'>>): void {
    const next: RealtimeState = { ...state, ...delta };
    const wasOffline = state.isOffline;
    const nowOffline = isOfflineFor(next);
    next.isOffline = nowOffline;
    if (nowOffline && !wasOffline) {
      next.offlineSince = Date.now();
      next.cachedMinutesAgo = 0;
      startTicking();
    } else if (!nowOffline && wasOffline) {
      next.offlineSince = null;
      next.cachedMinutesAgo = 0;
      stopTicking();
    }
    state = next;
    emit();
  }

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: (): RealtimeState => state,
    getSocket: (): Socket | null => socket,
    setSocket(next: Socket | null): void {
      socket = next;
    },
    incrementFailedAttempts(): void {
      patch({ failedAttempts: state.failedAttempts + 1 });
    },
    patch,
    dispose(): void {
      stopTicking();
      listeners.clear();
    },
  };
}

type RealtimeStore = ReturnType<typeof createRealtimeStore>;

interface RealtimeContextValue {
  getSocket: () => Socket | null;
  connected: boolean;
  isOffline: boolean;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  getSocket: () => null,
  connected: false,
  isOffline: false,
});

/** Feature code should prefer `useRoom()`; this is the lower-level escape hatch (there is no
 * current caller — `getSocket()` is only ever read inside an effect, never during render). */
export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext);
}

/** §13.4 — the tooltip text every disabled write control shows while offline. */
export const OFFLINE_TOOLTIP = 'You are offline';

/** Feature agents disable a write button with this, per §13.4 ("no offline queue"). */
export function useIsOffline(): boolean {
  return useContext(RealtimeContext).isOffline;
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, signOut } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [store] = useState<RealtimeStore>(createRealtimeStore);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);

  useEffect(() => () => store.dispose(), [store]);

  /**
   * web/bugs.md WB-119 — set by the token watcher right before it cycles the socket onto a rotated
   * access token. That `disconnect → connect` is ours and routine (every ~14 min): nothing was
   * missed, so it must not invalidate every query nor toast `Reconnected`. Cleared by the next
   * `connect`, and by any failure in between — once the cycle fails, the connect that eventually
   * follows is a genuine reconnect again.
   */
  const tokenCycle = useRef(false);

  /* --- connect once per authenticated session -------------------------------------------- */
  useEffect(() => {
    if (!isAuthenticated) return;
    const token = getAccessToken();
    if (!token) return;

    const socket = io(`${WS_URL}${WS_NAMESPACE}`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 30_000,
      randomizationFactor: 0.5,
    });
    store.setSocket(socket);

    let everConnected = false;

    socket.on('connect', () => {
      store.patch({ connected: true, failedAttempts: 0 });
      const rotatedToken = tokenCycle.current;
      tokenCycle.current = false;
      if (everConnected && !rotatedToken) {
        // §7.2 — no resume/seq: invalidate every currently-mounted query instead.
        void queryClient.invalidateQueries();
        toast({ kind: 'success', ...TOAST_COPY.reconnected });
      }
      everConnected = true;
    });

    socket.on('disconnect', (reason: string) => {
      store.patch({ connected: false });
      // Only our own `socket.disconnect()` belongs to a token cycle; anything else is a real drop.
      if (reason !== CLIENT_DISCONNECT_REASON) tokenCycle.current = false;
      if (reason === SERVER_REJECTED_REASON) {
        // A rejected/expired token — this is a sign-out path, not a retry loop.
        signOut();
      }
    });

    socket.on('connect_error', () => {
      tokenCycle.current = false;
      store.incrementFailedAttempts();
    });

    const unregister = registerSocketDisconnect(() => socket.disconnect());

    return () => {
      unregister();
      socket.removeAllListeners();
      socket.disconnect();
      store.setSocket(null);
      store.patch({ connected: false });
      tokenCycle.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reconnect is handled by the token watcher below, not by re-running this effect
  }, [isAuthenticated, store]);

  /* --- token refresh: reassign socket.auth, then cycle the connection (§7.2) ------------- */
  useEffect(() => {
    if (!isAuthenticated) return;
    let lastToken = getAccessToken();
    const timer = setInterval(() => {
      const current = getAccessToken();
      const socket = store.getSocket();
      if (!socket || !current || current === lastToken) return;
      lastToken = current;
      socket.auth = { token: current };
      // WB-119 — mark the cycle as ours before it starts; the `connect` it produces is not a
      // reconnect after an outage.
      tokenCycle.current = true;
      socket.disconnect().connect();
    }, TOKEN_WATCH_MS);
    return () => clearInterval(timer);
  }, [isAuthenticated, store]);

  /* --- browser online/offline ------------------------------------------------------------- */
  useEffect(() => {
    const onOnline = () => store.patch({ online: true });
    const onOffline = () => store.patch({ online: false });
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [store]);

  const handleRetry = useCallback(() => {
    store.getSocket()?.connect();
  }, [store]);

  return (
    <RealtimeContext.Provider
      value={{ getSocket: store.getSocket, connected: state.connected, isOffline: state.isOffline }}
    >
      {children}
      {state.isOffline ? (
        <OfflineBanner cachedMinutesAgo={state.cachedMinutesAgo} onRetry={handleRetry} />
      ) : null}
    </RealtimeContext.Provider>
  );
}
