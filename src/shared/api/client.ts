// owner: web-api-client — fetch wrapper implementing all nine web/tz.md §6.2 rules:
// 1 credentials:'omit' + Bearer · 2 single-flight refresh on 401 TOKEN_EXPIRED + replay ·
// 3 refresh 401 → signOut → /sign-in?reason=expired · 4 (retired, web/decisions.md WD-067) ·
// 5 plain 403 → <ForbiddenState>, no toast · 6 422 → field errors ·
// 7 5xx/network → GET retries twice (1 s, 3 s) · 8 X-Client-Version · 9 AbortController.
// Plus WD-072: a request with no access token but a refresh token in hand awaits the
// single-flight refresh instead of going out unauthenticated.
//
// The access token lives in a module variable only; the refresh token never leaves shared/auth
// (localStorage `obk.rt`) — web/tz.md §17. Neither ever appears in a URL.
import { API_BASE_URL, endpoints } from './endpoints';
import { ApiError, NetworkError } from './errors';
import type { ApiEnvelope, OffsetPage } from './types';

const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? 'dev';

/** Refresh this many ms before the access token expires (§17 proactive refresh). */
export const PROACTIVE_REFRESH_LEAD_MS = 60_000;

/**
 * `ListQueryDto` caps `limit` at 200 (web/tz.md §6.1) — `limit=500` is a 422 on the live API while
 * MSW happily accepts it (web/bugs.md WB-030). `buildUrl` clamps every request to this; a caller that
 * genuinely needs more rows uses `client.list()`, which pages instead of truncating.
 */
export const MAX_PAGE_LIMIT = 200;

/**
 * `RefreshTokenDto` (backend/src/modules/auth/dto/auth.dto.ts) requires both `refreshToken`
 * (min 1) and `subjectType`. The web panel is always a `user` — drivers refresh from the mobile
 * app — and `shared/auth/authApi.ts` sends the same pair (web/bugs.md WB-014).
 */
export const REFRESH_SUBJECT_TYPE = 'user' as const;
const RETRY_DELAYS_MS = [1_000, 3_000];

/* ------------------------------------------------------------------ auth bridge */

/**
 * The contract between `shared/api` and `shared/auth`. `shared/auth` calls `setAuthBridge` once;
 * until it does, the defaults below keep the client usable in tests and at boot.
 */
export interface AuthBridge {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  /** Called after a successful refresh so shared/auth can persist the rotated refresh token. */
  onTokens: (tokens: { accessToken: string; refreshToken?: string; expiresAt?: number }) => void;
  /** §6.2 rule 3 — refresh failed; drop everything and land on /sign-in?reason=expired. */
  onSignOut: (reason: 'expired' | 'revoked') => void;
  /**
   * A refresh that was already on the wire when the session ended (`cancelRefresh()`) came back
   * with a freshly rotated pair. It is never persisted; shared/auth revokes it server-side so no
   * live refresh token outlives a sign-out (web/bugs.md WB-079).
   */
  onTokensDiscarded?: (tokens: { accessToken: string; refreshToken?: string }) => void;
}

let accessToken: string | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

const defaultBridge: AuthBridge = {
  getAccessToken: () => accessToken,
  getRefreshToken: () => null,
  onTokens: ({ accessToken: token }) => {
    accessToken = token;
  },
  onSignOut: () => {
    accessToken = null;
    if (typeof window !== 'undefined') window.location.assign('/sign-in?reason=expired');
  },
  onTokensDiscarded: () => undefined,
};

let bridge: AuthBridge = { ...defaultBridge };

export function setAuthBridge(next: Partial<AuthBridge>): void {
  bridge = { ...defaultBridge, ...next };
}

export function resetAuthBridge(): void {
  bridge = { ...defaultBridge };
  accessToken = null;
  cancelRefresh();
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
}

/** In-memory access token (§17). `expiresAt` schedules the proactive refresh 60 s early. */
export function setAccessToken(token: string | null, expiresAt?: number): void {
  accessToken = token;
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  if (!token || !expiresAt) return;
  const delay = expiresAt - Date.now() - PROACTIVE_REFRESH_LEAD_MS;
  refreshTimer = setTimeout(
    () => {
      void refreshAccessToken().catch(() => undefined);
    },
    Math.max(delay, 0),
  );
}

export function getAccessToken(): string | null {
  return bridge.getAccessToken();
}

/* ------------------------------------------------------------------ url helpers */

export type QueryValue = string | number | boolean | null | undefined | Array<string | number>;

/** `?page&limit&sort=field:asc|desc&q=` — empty values are dropped, arrays repeat the key. */
/** Dev-time assertion plus a clamp: no request ever leaves with `limit > 200` (WB-030). */
function clampLimit(value: QueryValue): QueryValue {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= MAX_PAGE_LIMIT) return value;
  if (import.meta.env.DEV) {
    console.warn(
      `limit=${n} exceeds the API maximum of ${MAX_PAGE_LIMIT} and was clamped — use client.list() to page (web/bugs.md WB-030).`,
    );
  }
  return MAX_PAGE_LIMIT;
}

export function buildUrl(path: string, params?: Record<string, QueryValue>): string {
  const base = `${API_BASE_URL}${path}`;
  if (!params) return base;
  const search = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    const value = key === 'limit' ? clampLimit(raw) : raw;
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => search.append(key, String(v)));
    else search.append(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

/* ------------------------------------------------------------------ core request */

export interface RequestOptions {
  params?: Record<string, QueryValue>;
  /** §6.2 rule 9 — TanStack Query passes its own signal straight through. */
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Skip the Authorization header (sign-in, refresh). */
  anonymous?: boolean;
  /** Multipart upload; the browser sets the boundary itself. */
  formData?: FormData;
}

interface InternalOptions extends RequestOptions {
  method: string;
  path: string;
  body?: unknown;
  /** Guards rule 2: a replayed request never refreshes again. */
  retriedAfterRefresh?: boolean;
  /**
   * Return the raw `Response` instead of unwrapping the JSON envelope, so a binary download goes
   * through the one request pipeline (rules 2, 7, 9) instead of its own (web/bugs.md WB-086).
   */
  raw?: boolean;
}

const isJson = (res: Response) =>
  (res.headers.get('content-type') ?? '').includes('application/json');

async function readBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  if (!isJson(res)) return await res.text();
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** §6.1 — unwrap `{ data, traceId, timestamp }`; anything else is returned untouched. */
function unwrap<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'data' in body && 'traceId' in body) {
    return (body as ApiEnvelope<T>).data;
  }
  return body as T;
}

function toApiError(status: number, body: unknown): ApiError {
  if (body && typeof body === 'object') return new ApiError(status, body as never);
  return new ApiError(status, { message: typeof body === 'string' ? body : undefined });
}

async function fetchOnce(options: InternalOptions): Promise<Response> {
  const { method, path, params, signal, headers, anonymous, body, formData } = options;
  const token = anonymous ? null : bridge.getAccessToken();

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    // §6.2 rule 8
    'X-Client-Version': APP_VERSION,
    ...headers,
  };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  if (body !== undefined && !formData) finalHeaders['Content-Type'] = 'application/json';

  try {
    return await fetch(buildUrl(path, params), {
      method,
      // §6.2 rule 1 — cookies are never used
      credentials: 'omit',
      headers: finalHeaders,
      signal,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch (error) {
    if (signal?.aborted || (error as Error)?.name === 'AbortError') throw error;
    throw new NetworkError();
  }
}

/* ------------------------------------------------------------------ rule 2: single-flight */

let refreshPromise: Promise<string> | null = null;
/**
 * Bumped by `cancelRefresh()`. A refresh remembers the generation it started in and, if the
 * session ended while it was on the wire, neither persists what it got back nor signs out a
 * second time (web/bugs.md WB-079).
 */
let refreshGeneration = 0;

/** The in-flight refresh outlived the session it belonged to; its result was discarded. */
export class RefreshCancelledError extends Error {
  constructor() {
    super('The session ended while the token refresh was in flight.');
    this.name = 'RefreshCancelledError';
  }
}

/**
 * Sign-out calls this before it clears the tokens: the in-flight refresh (proactive timer or a 401
 * replay) is detached, so its late response can never write a fresh refresh token back into
 * `obk.rt` after the user has signed out (web/bugs.md WB-079).
 */
export function cancelRefresh(): void {
  refreshGeneration += 1;
  refreshPromise = null;
}

/**
 * web/bugs.md WB-080 — a refresh that never reached a verdict: the request did not get through
 * (`NetworkError`), timed out, was throttled, or the server failed (5xx). The refresh token is
 * still good, so the session is kept and the refresh retried; only a real rejection
 * (401/403/4xx, e.g. `REFRESH_TOKEN_REUSED`) ends it (§6.2 rule 3).
 */
export function isTransientRefreshFailure(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  return error instanceof ApiError && isTransientStatus(error.status);
}

const isTransientStatus = (status: number) => status >= 500 || status === 408 || status === 429;

/** One refresh at a time; every parallel 401 awaits the same promise (§6.2 rule 2). */
export function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  const generation = refreshGeneration;
  const isCurrent = () => generation === refreshGeneration;

  const tracked: Promise<string> = (async () => {
    const refreshToken = bridge.getRefreshToken();

    // Without a refresh token the DTO can never be satisfied (`refreshToken` is min 1), so the
    // request would come back 422 and cost a round trip to learn what we already know: this
    // session is over. §6.2 rule 3's outcome, reached directly.
    if (!refreshToken) {
      bridge.onSignOut('expired');
      throw new ApiError(401, {
        code: 'TOKEN_EXPIRED',
        message: 'No refresh token is available.',
      });
    }

    // A `NetworkError` from here propagates untouched — it is not a verdict on the refresh token,
    // so it never reaches `onSignOut` (WB-080).
    const res = await fetchOnce({
      method: 'POST',
      path: endpoints.auth.refresh,
      anonymous: true,
      body: { refreshToken, subjectType: REFRESH_SUBJECT_TYPE },
    });
    const body = await readBody(res);

    if (!isCurrent()) {
      // Signed out while this was on the wire (WB-079): persist nothing, sign out nothing — but a
      // pair the server did rotate is handed back for revocation, never dropped live.
      if (res.ok) {
        const late = unwrap<{ accessToken?: string; refreshToken?: string }>(body);
        if (late?.accessToken) {
          bridge.onTokensDiscarded?.({
            accessToken: late.accessToken,
            refreshToken: late.refreshToken,
          });
        }
      }
      throw new RefreshCancelledError();
    }

    if (!res.ok) {
      const error = toApiError(res.status, body);
      // WB-080 — a 5xx/408/429 is the server failing to answer, not rejecting the token: keep it.
      if (isTransientStatus(res.status)) throw error;
      // §6.2 rule 3 — the refresh itself was rejected: sign out, land on /sign-in?reason=expired.
      bridge.onSignOut(res.status === 401 ? 'expired' : 'revoked');
      throw error;
    }

    const data = unwrap<{ accessToken: string; refreshToken?: string; expiresIn?: number }>(body);
    const expiresAt = data.expiresIn ? Date.now() + data.expiresIn * 1_000 : undefined;
    accessToken = data.accessToken;
    bridge.onTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt,
    });
    return data.accessToken;
  })().finally(() => {
    // Only clear our own slot: after `cancelRefresh()` a new session may already own it.
    if (refreshPromise === tracked) refreshPromise = null;
  });

  refreshPromise = tracked;
  return tracked;
}

/**
 * Boot-from-snapshot (web/decisions.md WD-072): right after a reload the refresh token is in
 * storage but the in-memory access token is still empty while `POST /auth/refresh` is in flight.
 * Instead of leaving unauthenticated and coming back as a 401 (+1 round trip, +1 refresh), the
 * request parks on the same single-flight promise and goes out the moment the token lands.
 * Resolves `true` when the request has already paid for a refresh (rule 2 must not run again).
 */
async function ensureAccessToken(options: InternalOptions): Promise<boolean> {
  if (options.anonymous || options.retriedAfterRefresh) return false;
  if (bridge.getAccessToken() || !bridge.getRefreshToken()) return false;
  await refreshAccessToken();
  return true;
}

/* ------------------------------------------------------------------ request pipeline */

async function send<T>(options: InternalOptions): Promise<T> {
  const isGet = options.method === 'GET';
  let attempt = 0;
  if (await ensureAccessToken(options)) options = { ...options, retriedAfterRefresh: true };

  for (;;) {
    let res: Response;
    try {
      res = await fetchOnce(options);
    } catch (error) {
      // §6.2 rule 7 — network failure: GET retries twice, 1 s then 3 s. Never a mutation.
      if (error instanceof NetworkError && isGet && attempt < RETRY_DELAYS_MS.length) {
        await delay(RETRY_DELAYS_MS[attempt++] ?? 0, options.signal);
        continue;
      }
      throw error;
    }

    if (res.ok) return options.raw ? (res as T) : unwrap<T>(await readBody(res));

    const body = await readBody(res);
    const error = toApiError(res.status, body);

    // §6.2 rule 2 — expired access token: refresh once, then replay this exact request.
    if (res.status === 401 && error.code === 'TOKEN_EXPIRED' && !options.retriedAfterRefresh) {
      await refreshAccessToken();
      return await send<T>({ ...options, retriedAfterRefresh: true });
    }

    // §6.2 rule 7 — 5xx on a GET retries twice; 4xx never retries.
    if (res.status >= 500 && isGet && attempt < RETRY_DELAYS_MS.length) {
      await delay(RETRY_DELAYS_MS[attempt++] ?? 0, options.signal);
      continue;
    }

    // Rules 5 (plain 403) and 6 (422 field errors) are carried on the ApiError itself and
    // handled by the screen: <ForbiddenState> with no toast, or setError per field.
    throw error;
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    // Defensive: an `abort` that lands between the failed response and this backoff would
    // otherwise never fire the listener below (an already-aborted signal emits nothing) and the
    // request would hang for the full 3 s. Not reachable from the public API in a test — `fetch`
    // rejects first — which is why client.ts sits at 98.58% rather than 100%.
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/* ------------------------------------------------------------------ public surface */

export const client = {
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return send<T>({ ...options, method: 'GET', path });
  },
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return send<T>({ ...options, method: 'POST', path, body });
  },
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return send<T>({ ...options, method: 'PUT', path, body });
  },
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return send<T>({ ...options, method: 'PATCH', path, body });
  },
  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return send<T>({ ...options, method: 'DELETE', path });
  },
  /**
   * A list read that honours a `limit` above the API maximum by paging (WB-030). With `limit ≤ 200`
   * this is exactly one `GET` and the page comes back untouched. Above that it fetches the first
   * 200-row page (from the offset `page` implies), then every remaining page it still needs **in
   * parallel** (WD-073 — the old sequential walk cost one RTT per page), and returns one
   * `OffsetPage` expressed in the caller's own `limit`.
   */
  async list<T>(
    path: string,
    params: Record<string, QueryValue> = {},
    options?: Omit<RequestOptions, 'params'>,
  ): Promise<OffsetPage<T>> {
    const requested = Number(params.limit);
    if (!Number.isFinite(requested) || requested <= MAX_PAGE_LIMIT) {
      return send<OffsetPage<T>>({ ...options, method: 'GET', path, params });
    }

    const page = Math.max(1, Number(params.page) || 1);
    const offset = (page - 1) * requested;
    const firstApiPage = Math.floor(offset / MAX_PAGE_LIMIT) + 1;
    const skip = offset % MAX_PAGE_LIMIT;
    const fetchPage = (apiPage: number) =>
      send<OffsetPage<T>>({ ...options, method: 'GET', path, params: { ...params, page: apiPage, limit: MAX_PAGE_LIMIT } });

    const first = await fetchPage(firstApiPage);
    const items: T[] = first.items.slice(skip);
    const lastApiPage = Math.min(first.totalPages, firstApiPage + Math.ceil((requested + skip) / MAX_PAGE_LIMIT) - 1);
    if (items.length < requested && first.items.length > 0 && lastApiPage > firstApiPage) {
      const rest = await Promise.all(
        Array.from({ length: lastApiPage - firstApiPage }, (_, i) => fetchPage(firstApiPage + 1 + i)),
      );
      for (const chunk of rest) items.push(...chunk.items);
    }

    return {
      items: items.slice(0, requested),
      page,
      limit: requested,
      total: first.total,
      totalPages: Math.max(1, Math.ceil(first.total / requested)),
    };
  },
  /** Multipart upload (CSV import, DVIR photos). */
  upload<T>(path: string, formData: FormData, options?: RequestOptions): Promise<T> {
    return send<T>({ ...options, method: 'POST', path, formData });
  },
  /** Presigned download — the URL is never logged or cached (§17). */
  async blob(path: string, options?: RequestOptions): Promise<Blob> {
    // WB-086 — goes through `send` so an expired access token is refreshed single-flight and the
    // download replayed (rule 2), and a 5xx/network blip retries like any other GET (rule 7).
    const res = await send<Response>({ ...options, method: 'GET', path, raw: true });
    return await res.blob();
  },
};

/** §6.2 rule 5 / rule 6 — a 403 or a 422 is rendered in place, never toasted. */
export function shouldToast(error: unknown): boolean {
  if (error instanceof ApiError) return error.status !== 403 && error.status !== 422;
  return true;
}
