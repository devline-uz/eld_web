// owner: web-auth-rbac — FE-23: the §17 idle timeout across browser tabs.
//
// Every tab shares one refresh token (`localStorage` `obk.rt`), so the idle clock has to be shared
// too: activity in any tab keeps every tab signed in, and only a session idle in *all* tabs ends.
// The last activity instant is written to `localStorage` (throttled); the `storage` event carries
// it — and an explicit / idle sign-out — to the other tabs.

const ACTIVITY_STORAGE_KEY = 'obk.activity';
const SIGN_OUT_STORAGE_KEY = 'obk.signout';
/** Activity is written at most this often — the 30 min clock does not need finer resolution. */
const ACTIVITY_WRITE_THROTTLE_MS = 5_000;

let lastWritten = 0;

/** Records activity in this tab for every tab. */
export function markSharedActivity(now: number = Date.now()): void {
  if (now - lastWritten < ACTIVITY_WRITE_THROTTLE_MS && now >= lastWritten) return;
  lastWritten = now;
  try {
    window.localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now));
  } catch {
    /* storage disabled — the clock stays per tab, as before. */
  }
}

/** The newest activity any tab recorded, or 0. A value in the future (clock change) is ignored. */
export function readSharedActivity(now: number = Date.now()): number {
  try {
    const value = Number(window.localStorage.getItem(ACTIVITY_STORAGE_KEY));
    return Number.isFinite(value) && value > 0 && value <= now ? value : 0;
  } catch {
    return 0;
  }
}

/** Tells the other tabs this tab ended the shared session (they end theirs without a logout call). */
export function broadcastSignOut(reason: 'expired' | 'idle' | null): void {
  try {
    window.localStorage.setItem(SIGN_OUT_STORAGE_KEY, JSON.stringify({ reason, at: Date.now() }));
  } catch {
    /* storage disabled — the other tabs find out at their next refresh. */
  }
}

/** `storage` listener for the two shared keys; returns the unsubscribe. */
export function subscribeSharedSession(handlers: {
  onActivity?: (at: number) => void;
  onSignOut?: (reason: 'expired' | 'idle' | null) => void;
}): () => void {
  const listener = (event: StorageEvent) => {
    if (event.key === ACTIVITY_STORAGE_KEY && event.newValue) {
      const at = Number(event.newValue);
      if (Number.isFinite(at)) handlers.onActivity?.(at);
    } else if (event.key === SIGN_OUT_STORAGE_KEY && event.newValue) {
      let reason: 'expired' | 'idle' | null = null;
      try {
        const parsed = JSON.parse(event.newValue) as { reason?: unknown };
        if (parsed.reason === 'expired' || parsed.reason === 'idle') reason = parsed.reason;
      } catch {
        /* malformed — still a sign-out */
      }
      handlers.onSignOut?.(reason);
    }
  };
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}

/** Test seam — forget the throttle between tests. */
export function resetSharedActivityThrottle(): void {
  lastWritten = 0;
}

export const SHARED_SESSION_KEYS = { activity: ACTIVITY_STORAGE_KEY, signOut: SIGN_OUT_STORAGE_KEY } as const;
