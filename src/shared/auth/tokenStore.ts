// owner: web-auth-rbac — the one module that touches tokens (web/tz.md §6.8, §17).
//
//   accessToken  → memory only. It is never written to localStorage, never put in a URL.
//   refreshToken → localStorage under `obk.rt`, because the backend issues no cookie.
//   session snapshot → sessionStorage under `obk.session`: the last `GET /auth/me` payload plus
//                 the access-token expiry instant. Never a token (web/decisions.md WD-072).
//
// `shared/api/client.ts` reads the access token through `getAccessToken()` and asks for a
// refresh through the callback registered by <AuthProvider>; it never imports the raw values.

const REFRESH_TOKEN_STORAGE_KEY = 'obk.rt';
const SESSION_SNAPSHOT_STORAGE_KEY = 'obk.session';

/** Access-token lifetime (backend issues 15 min) and how early we renew it (§6.8). */
export const ACCESS_TOKEN_TTL_MS = 15 * 60_000;
export const REFRESH_LEAD_MS = 60_000;

let accessToken: string | null = null;
/** Epoch ms at which the current access token expires. */
let accessTokenExpiresAt = 0;

export function getAccessToken(): string | null {
  return accessToken;
}

export function getAccessTokenExpiry(): number {
  return accessTokenExpiresAt;
}

/**
 * `ttlMs` is the server's lifetime when it sent one (`expiresIn`, WB-083); a missing, non-finite
 * or non-positive value falls back to the documented 15 minutes rather than arming a timer that
 * fires immediately or never.
 */
export function setAccessToken(token: string | null, ttlMs?: number): void {
  const ttl = ttlMs !== undefined && Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : ACCESS_TOKEN_TTL_MS;
  accessToken = token;
  accessTokenExpiresAt = token ? Date.now() + ttl : 0;
}

/** Server `expiresIn` (seconds) → a lifetime in ms, or undefined when absent or unusable. */
export function ttlFromExpiresIn(expiresIn: unknown): number | undefined {
  return typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0
    ? expiresIn * 1_000
    : undefined;
}

export function getRefreshToken(): string | null {
  try {
    return window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setRefreshToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    /* private mode / storage disabled — the session simply does not survive a reload. */
  }
}

/**
 * What survives a reload so the app can render before `refresh → /auth/me` completes (WD-072).
 * `me` is the raw `GET /auth/me` payload; `accessTokenExpiresAt` is an epoch ms. No token is
 * ever part of it — the access token stays in memory and the refresh token in `obk.rt`.
 */
export interface SessionSnapshot {
  me: { id: string; role: string; permissions: Record<string, unknown> };
  accessTokenExpiresAt: number;
}

export function readSessionSnapshot(): SessionSnapshot | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_SNAPSHOT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionSnapshot> | null;
    const me = parsed?.me;
    if (
      !me ||
      typeof me !== 'object' ||
      typeof me.id !== 'string' ||
      typeof me.role !== 'string' ||
      !me.permissions ||
      typeof me.permissions !== 'object'
    ) {
      return null;
    }
    return {
      me,
      accessTokenExpiresAt:
        typeof parsed.accessTokenExpiresAt === 'number' ? parsed.accessTokenExpiresAt : 0,
    };
  } catch {
    return null;
  }
}

export function writeSessionSnapshot(snapshot: SessionSnapshot): void {
  try {
    // Defensive: whatever the caller passes, a token never reaches storage.
    const { accessToken: _a, refreshToken: _r, ...me } = snapshot.me as Record<string, unknown>;
    window.sessionStorage.setItem(
      SESSION_SNAPSHOT_STORAGE_KEY,
      JSON.stringify({ me, accessTokenExpiresAt: snapshot.accessTokenExpiresAt }),
    );
  } catch {
    /* storage disabled — the next reload simply waits for refresh → /auth/me again. */
  }
}

export function clearSessionSnapshot(): void {
  try {
    window.sessionStorage.removeItem(SESSION_SNAPSHOT_STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** Sign-out and every unrecoverable auth failure end here. */
export function clearTokens(): void {
  setAccessToken(null);
  setRefreshToken(null);
  clearSessionSnapshot();
}

/** What the three token-issuing endpoints return (`/auth/login`, `/google`, `/refresh`). */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
  /** Access-token lifetime in seconds, when the server sends it (WB-083). */
  expiresIn?: number;
}

export function storeTokenPair(pair: TokenPair): void {
  setAccessToken(pair.accessToken, ttlFromExpiresIn(pair.expiresIn));
  setRefreshToken(pair.refreshToken);
}
