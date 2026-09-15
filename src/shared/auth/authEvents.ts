// owner: web-auth-rbac — the seam between <AuthProvider> and the modules that must react to an
// auth event but cannot import React state: `shared/api/client.ts` (401 refresh, rules 2 and 3)
// and `shared/realtime` (disconnect on sign-out, §17).
//
// Usage from shared/api/client.ts:
//   import { getAccessToken } from '@/shared/auth/tokenStore';
//   import { refreshAccessToken, notifySessionExpired }
//     from '@/shared/auth/authEvents';
// Usage from shared/realtime:
//   registerSocketDisconnect(() => socket.disconnect());

type Listener = () => void;

let refresher: (() => Promise<string | null>) | null = null;
let sessionExpiredListener: Listener | null = null;
const socketDisconnects = new Set<Listener>();

/** <AuthProvider> installs the single-flight refresh it already owns. */
export function registerTokenRefresher(fn: (() => Promise<string | null>) | null): void {
  refresher = fn;
}

/**
 * §6.2 rule 2 — one `POST /auth/refresh`, shared by every parallel 401. Resolves with the new
 * access token, or `null` when the session is gone (the caller then stops and signs out).
 */
export function refreshAccessToken(): Promise<string | null> {
  return refresher ? refresher() : Promise.resolve(null);
}

export function registerSessionExpiredListener(fn: Listener | null): void {
  sessionExpiredListener = fn;
}

/** §6.2 rule 3 — refresh itself failed: full sign-out, /sign-in?reason=expired. */
export function notifySessionExpired(): void {
  sessionExpiredListener?.();
}

/** §17 — sign-out disconnects the socket. Returns an unregister function. */
export function registerSocketDisconnect(fn: Listener): () => void {
  socketDisconnects.add(fn);
  return () => socketDisconnects.delete(fn);
}

export function disconnectSockets(): void {
  for (const fn of socketDisconnects) fn();
}
