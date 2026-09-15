// owner: web-auth-rbac — token lifecycle, GET /auth/me, Google sign-in (Q-1),
// idle timeout (web/tz.md §6.5–§6.9, §17).
//
//   accessToken  → memory only (tokenStore.ts); refreshToken → localStorage `obk.rt`.
//   permissions  → GET /auth/me and nothing else. The JWT is never decoded.
//   boot         → refresh → me → app, behind a full-page skeleton (§6.8).
//   idle         → 30 min, then a 60 s warning modal, then a full sign-out (§17).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setAccessToken as setClientAccessToken, setAuthBridge } from '@/shared/api/client';
import {
  fetchMe,
  loginWithGoogleIdToken,
  loginWithPassword,
  logoutSession,
  refreshTokens,
  type MeResponse,
} from './authApi';
import {
  disconnectSockets,
  registerSessionExpiredListener,
  registerTokenRefresher,
} from './authEvents';
import { AuthBootSkeleton } from './AuthBootSkeleton';
import { IdleWarningModal } from './IdleWarningModal';
import {
  NO_PERMISSIONS,
  isRole,
  toPermissionMap,
  type PermissionMap,
  type Role,
} from './permissions';
import {
  REFRESH_LEAD_MS,
  clearTokens,
  getAccessToken,
  getAccessTokenExpiry,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  storeTokenPair,
  type TokenPair,
} from './tokenStore';

/** §17 — 30 minutes idle, then a 60 second countdown before the session ends. */
export const IDLE_TIMEOUT_MS = 30 * 60_000;
export const IDLE_WARNING_MS = 60_000;

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  carrierName: string;
  homeTerminalTimezone: string;
}

/** What a sign-in attempt resolved to; the page routes on it. */
export type SignInOutcome = { status: 'authenticated' };

export interface AuthContextValue {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  isAuthenticated: boolean;
  user: AuthUser | null;
  permissions: PermissionMap;
  signOut: () => void;
  /** Dev build only (Q-1) — never rendered in a production bundle. */
  signInWithPassword: (email: string, password: string) => Promise<SignInOutcome>;
  signInWithGoogleToken: (idToken: string) => Promise<SignInOutcome>;
  /**
   * Why the last session ended, when it ended by itself (§6.2 rule 3, §17). W-00 renders the
   * matching banner; `<AuthProvider>` sits above the router, so it cannot navigate to
   * `/sign-in?reason=expired` itself (WD-015) — the reason travels in context instead.
   */
  sessionEndedReason?: 'expired' | 'idle' | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Shallow equality over the permission map — every key the server sent, both directions. */
export function samePermissions(a: PermissionMap, b: PermissionMap): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a as Record<string, unknown>)[key] !== (b as Record<string, unknown>)[key]) return false;
  }
  return true;
}

function toAuthUser(me: MeResponse, profile: Record<string, unknown> | null): AuthUser {
  const first = (profile?.firstName as string | undefined) ?? me.firstName ?? '';
  const last = (profile?.lastName as string | undefined) ?? me.lastName ?? '';
  const fullName = (me.fullName ?? `${first} ${last}`.trim()) || 'OneBook user';
  return {
    id: me.id,
    fullName,
    email: (profile?.email as string | undefined) ?? me.email ?? '',
    role: isRole(me.role) ? me.role : 'VIEWER',
    avatarUrl: (profile?.avatarUrl as string | null | undefined) ?? me.avatarUrl ?? null,
    carrierName: me.carrierName ?? '',
    homeTerminalTimezone: me.homeTerminalTimezone ?? 'America/Chicago',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<PermissionMap>(NO_PERMISSIONS);
  const [idleWarning, setIdleWarning] = useState(false);
  const [sessionEndedReason, setSessionEndedReason] = useState<'expired' | 'idle' | null>(null);

  const refreshInFlight = useRef<Promise<string | null> | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** GET /auth/me — the only permission source. `/me/profile` only decorates the display. */
  const loadSession = useCallback(async (token: string) => {
    const me = await fetchMe(token);
    // Keep the object identity when nothing changed: `AppRouter` rebuilds the whole router on a
    // new `permissions` reference, which would remount the current screen (web/bugs.md WB-034).
    const next = toPermissionMap(me.permissions);
    setPermissions((prev) => (samePermissions(prev, next) ? prev : next));
    setUser(toAuthUser(me, null));
    setStatus('authenticated');
    return me;
  }, []);

  const resetSession = useCallback(
    (reason: 'expired' | 'idle' | null = null) => {
      setSessionEndedReason(reason);
      clearTokens();
      setClientAccessToken(null);
      setUser(null);
      setPermissions(NO_PERMISSIONS);
      setIdleWarning(false);
      setStatus('unauthenticated');
      disconnectSockets();
      queryClient.clear();
    },
    [queryClient],
  );

  /**
   * §6.2 — `shared/api/client.ts` runs on a default bridge until `shared/auth` installs the real
   * one: without this the client would send no Authorization header and would hard-redirect on
   * its own. Registered in a layout effect so the very first query already carries a token.
   */
  const installBridge = useCallback((accessToken: string | null) => {
    setClientAccessToken(accessToken, accessToken ? getAccessTokenExpiry() : undefined);
  }, []);

  /** §6.2 rule 2 — a single in-flight refresh that every caller awaits. */
  const runRefresh = useCallback((): Promise<string | null> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const stored = getRefreshToken();
    if (!stored) return Promise.resolve(null);

    const promise = refreshTokens(stored)
      .then((pair: TokenPair) => {
        storeTokenPair(pair);
        installBridge(pair.accessToken);
        return pair.accessToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight.current = null;
      });
    refreshInFlight.current = promise;
    return promise;
  }, [installBridge]);

  const signOut = useCallback(
    (reason: 'expired' | 'idle' | null = null) => {
      const refreshToken = getRefreshToken();
      const accessToken = getAccessToken();
      if (refreshToken) void logoutSession(refreshToken, accessToken).catch(() => undefined);
      resetSession(reason);
    },
    [resetSession],
  );

  /* --- boot: refresh → me, behind the full-page skeleton (§6.8) ---------------------------- */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!getRefreshToken()) {
        if (!cancelled) setStatus('unauthenticated');
        return;
      }
      const token = await runRefresh();
      if (cancelled) return;
      if (!token) {
        resetSession('expired');
        return;
      }
      try {
        await loadSession(token);
      } catch {
        if (cancelled) return;
        resetSession();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSession, resetSession, runRefresh]);

  /* --- proactive refresh, 60 s before expiry (§6.8) ---------------------------------------- */
  useEffect(() => {
    if (status !== 'authenticated') return;
    const schedule = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      const delay = Math.max(getAccessTokenExpiry() - Date.now() - REFRESH_LEAD_MS, 5_000);
      refreshTimer.current = setTimeout(() => {
        void runRefresh().then((token) => {
          if (!token) resetSession('expired');
          else schedule();
        });
      }, delay);
    };
    schedule();
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [status, runRefresh, resetSession]);

  /* --- the seam shared/api/client.ts and shared/realtime plug into ------------------------- */
  useEffect(() => {
    setAuthBridge({
      getAccessToken,
      getRefreshToken,
      // A rotated pair from the client's own 401 refresh must land in the same two places.
      onTokens: ({ accessToken, refreshToken }) => {
        setAccessToken(accessToken);
        if (refreshToken) setRefreshToken(refreshToken);
      },
      // §6.2 rule 3 — refresh failed: full sign-out, RequireAuth lands on /sign-in (WD-015).
      onSignOut: () => resetSession('expired'),
    });
    registerTokenRefresher(runRefresh);
    registerSessionExpiredListener(() => resetSession());
    return () => {
      registerTokenRefresher(null);
      registerSessionExpiredListener(null);
    };
  }, [runRefresh, resetSession]);

  /* --- 30 min idle → 60 s warning → sign-out (§17) ----------------------------------------- */
  // While the warning is up the effect is torn down, so activity behind the modal does not reset
  // the clock; dismissing it (`Stay signed in`) re-runs the effect and arms a fresh 30 minutes.
  // Before this, the timer was only ever re-armed by activity, so a dismissed warning left the
  // session with no idle timer at all (web/bugs.md WB-036).
  useEffect(() => {
    if (status !== 'authenticated' || idleWarning) return;
    let idleTimer = setTimeout(() => setIdleWarning(true), IDLE_TIMEOUT_MS);
    const onActivity = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => setIdleWarning(true), IDLE_TIMEOUT_MS);
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const event of events) window.addEventListener(event, onActivity, { passive: true });
    return () => {
      clearTimeout(idleTimer);
      for (const event of events) window.removeEventListener(event, onActivity);
    };
  }, [status, idleWarning]);

  const completeSignIn = useCallback(
    async (pair: TokenPair): Promise<SignInOutcome> => {
      storeTokenPair(pair);
      installBridge(pair.accessToken);
      setSessionEndedReason(null);
      await loadSession(pair.accessToken);
      return { status: 'authenticated' };
    },
    [installBridge, loadSession],
  );

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<SignInOutcome> => {
      return completeSignIn(await loginWithPassword(email, password));
    },
    [completeSignIn],
  );

  const signInWithGoogleToken = useCallback(
    async (idToken: string): Promise<SignInOutcome> => {
      return completeSignIn(await loginWithGoogleIdToken(idToken));
    },
    [completeSignIn],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      isAuthenticated: status === 'authenticated',
      user,
      permissions,
      signOut,
      signInWithPassword,
      signInWithGoogleToken,
      sessionEndedReason,
    }),
    [
      status,
      user,
      permissions,
      signOut,
      signInWithPassword,
      signInWithGoogleToken,
      sessionEndedReason,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {/* §6.8 — the cold-load `refresh → GET /auth/me` round trip is a full-page skeleton. */}
      {status === 'loading' ? <AuthBootSkeleton /> : children}
      {idleWarning ? (
        <IdleWarningModal
          seconds={IDLE_WARNING_MS / 1000}
          onStay={() => setIdleWarning(false)}
          onSignOut={() => signOut('idle')}
        />
      ) : null}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
