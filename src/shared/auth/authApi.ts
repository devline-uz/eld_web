// owner: web-auth-rbac — the raw auth calls (web/tz.md §6.5).
//
// These five endpoints deliberately do NOT go through `shared/api/client.ts`: the client's job
// is to refresh a 401 and replay it, and the refresh call itself must never be caught by that
// machinery (rules 2 and 3 of §6.2 would recurse). Everything else in the app uses the client.
// Every path still comes from `shared/api/endpoints.ts` — no URL is written here.
import { API_BASE_URL, endpoints } from '@/shared/api/endpoints';
import { ApiError, NetworkError } from '@/shared/api/errors';
import type { TokenPair } from './tokenStore';

const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? 'dev';

interface RequestOptions {
  body?: unknown;
  accessToken?: string | null;
  signal?: AbortSignal;
  method?: 'GET' | 'POST' | 'DELETE' | 'PATCH';
}

async function authRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = API_BASE_URL + path;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Client-Version': APP_VERSION,
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
      credentials: 'omit',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (cause) {
    // An unmount-cancelled request is not a connectivity problem (§6.2 rule 9): rethrow it as
    // it came. Some runtimes surface the abort as a plain TypeError, so the signal is checked
    // as well as the error name.
    if ((cause as Error)?.name === 'AbortError' || options.signal?.aborted) throw cause;
    throw new NetworkError();
  }

  const payload = (await response.json().catch(() => null)) as {
    data?: unknown;
    code?: string;
    message?: string;
    traceId?: string;
  } | null;

  if (!response.ok) {
    throw new ApiError(response.status, payload ?? {});
  }
  return (payload?.data ?? payload) as T;
}

/** Dev build only (Q-1). In production the backend refuses with 403 PASSWORD_LOGIN_DISABLED (B-25). */
export function loginWithPassword(email: string, password: string): Promise<TokenPair> {
  return authRequest<TokenPair>(endpoints.auth.signIn, { body: { email, password } });
}

/** The only way in under `production` (Q-1). Never auto-registers: 403 USER_NOT_INVITED. */
export function loginWithGoogleIdToken(idToken: string): Promise<TokenPair> {
  return authRequest<TokenPair>(endpoints.auth.google, { body: { idToken } });
}

/** Rotating refresh — the backend requires `subjectType`; the web panel is always a user. */
export function refreshTokens(refreshToken: string): Promise<TokenPair> {
  return authRequest<TokenPair>(endpoints.auth.refresh, {
    body: { refreshToken, subjectType: 'user' },
  });
}

export function logoutSession(refreshToken: string, accessToken: string | null): Promise<unknown> {
  return authRequest(endpoints.auth.signOut, { body: { refreshToken }, accessToken });
}

/**
 * ⭐ The only source of permissions. The JWT is never decoded, even though it carries `per`.
 * The live response is `{ id, type, role, permissions }` — no name, email or
 * carrier (see web/backend-gaps.md B-34), so the display fields fall back to the id.
 */
export interface MeResponse {
  id: string;
  type: 'user' | 'driver';
  role: string;
  permissions: Record<string, unknown>;
  email?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
  carrierName?: string;
  homeTerminalTimezone?: string;
}

export function fetchMe(accessToken: string, signal?: AbortSignal): Promise<MeResponse> {
  return authRequest<MeResponse>(endpoints.auth.me, { accessToken, signal });
}
