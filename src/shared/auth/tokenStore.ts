// owner: web-auth-rbac — the one module that touches tokens (web/tz.md §6.8, §17).
//
//   accessToken  → memory only. It is never written to localStorage, never put in a URL.
//   refreshToken → localStorage under `obk.rt`, because the backend issues no cookie.
//
// `shared/api/client.ts` reads the access token through `getAccessToken()` and asks for a
// refresh through the callback registered by <AuthProvider>; it never imports the raw values.

const REFRESH_TOKEN_STORAGE_KEY = 'obk.rt';

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

export function setAccessToken(token: string | null, ttlMs: number = ACCESS_TOKEN_TTL_MS): void {
  accessToken = token;
  accessTokenExpiresAt = token ? Date.now() + ttlMs : 0;
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

/** Sign-out and every unrecoverable auth failure end here. */
export function clearTokens(): void {
  setAccessToken(null);
  setRefreshToken(null);
}

/** What the three token-issuing endpoints return (`/auth/login`, `/google`, `/refresh`). */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
}

export function storeTokenPair(pair: TokenPair): void {
  setAccessToken(pair.accessToken);
  setRefreshToken(pair.refreshToken);
}
