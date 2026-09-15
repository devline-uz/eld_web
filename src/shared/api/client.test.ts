// web/tz.md §6.2 — one test per rule.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { fail, ok, url } from '@/mocks/envelope';
import { endpoints } from './endpoints';
import { ApiError, NetworkError } from './errors';
import {
  buildUrl,
  client,
  getAccessToken,
  REFRESH_SUBJECT_TYPE,
  refreshAccessToken,
  resetAuthBridge,
  setAccessToken,
  setAuthBridge,
  shouldToast,
} from './client';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
  vi.useRealTimers();
});
afterAll(() => server.close());

const VEHICLES = url(endpoints.vehicles.list);

describe('rule 1 · Bearer token, no cookies, rule 8 · X-Client-Version', () => {
  it('sends the token in the header and never uses credentials', async () => {
    const seen: Request[] = [];
    setAuthBridge({ getAccessToken: () => 'token-123' });
    server.use(
      http.get(VEHICLES, ({ request }) => {
        seen.push(request);
        return ok({ items: [], page: 1, limit: 25, total: 0, totalPages: 0 });
      }),
    );

    await client.get(endpoints.vehicles.list);

    expect(seen[0]?.headers.get('authorization')).toBe('Bearer token-123');
    expect(seen[0]?.headers.get('x-client-version')).toBeTruthy();
    expect(seen[0]?.credentials).toBe('omit');
    expect(seen[0]?.headers.get('cookie')).toBeNull();
  });

  it('omits the header for an anonymous call and never puts a token in the URL', async () => {
    setAuthBridge({ getAccessToken: () => 'token-123' });
    let authorization: string | null = 'unset';
    let requestUrl = '';
    server.use(
      http.post(url(endpoints.auth.signIn), ({ request }) => {
        authorization = request.headers.get('authorization');
        requestUrl = request.url;
        return ok({ accessToken: 'a', refreshToken: 'b', tokenType: 'Bearer' });
      }),
    );

    await client.post(endpoints.auth.signIn, { email: 'a@b.c' }, { anonymous: true });

    expect(authorization).toBeNull();
    expect(requestUrl).not.toContain('token');
  });
});

describe('rule 2 · single-flight refresh on 401 TOKEN_EXPIRED', () => {
  it('refreshes once for three parallel 401s and replays each request', async () => {
    let refreshes = 0;
    let accessToken = 'expired';
    setAuthBridge({
      getAccessToken: () => accessToken,
      getRefreshToken: () => 'refresh-1',
      onTokens: ({ accessToken: next }) => {
        accessToken = next;
      },
    });

    server.use(
      http.post(url(endpoints.auth.refresh), () => {
        refreshes += 1;
        return ok({ accessToken: 'fresh', refreshToken: 'refresh-2', expiresIn: 900 });
      }),
      http.get(VEHICLES, ({ request }) => {
        if (request.headers.get('authorization') !== 'Bearer fresh') {
          return fail(401, 'TOKEN_EXPIRED', 'Token expired.');
        }
        return ok({ items: [], page: 1, limit: 25, total: 0, totalPages: 0 });
      }),
    );

    const results = await Promise.all([
      client.get(endpoints.vehicles.list),
      client.get(endpoints.vehicles.list),
      client.get(endpoints.vehicles.list),
    ]);

    expect(refreshes).toBe(1);
    expect(results).toHaveLength(3);
  });

  it('does not refresh twice for the same request', async () => {
    let refreshes = 0;
    setAuthBridge({ getAccessToken: () => 'expired', getRefreshToken: () => 'r' });
    server.use(
      http.post(url(endpoints.auth.refresh), () => {
        refreshes += 1;
        return ok({ accessToken: 'still-bad' });
      }),
      http.get(VEHICLES, () => fail(401, 'TOKEN_EXPIRED', 'Token expired.')),
    );

    await expect(client.get(endpoints.vehicles.list)).rejects.toBeInstanceOf(ApiError);
    expect(refreshes).toBe(1);
  });

  it('leaves a 401 that is not TOKEN_EXPIRED alone', async () => {
    let refreshes = 0;
    server.use(
      http.post(url(endpoints.auth.refresh), () => {
        refreshes += 1;
        return ok({ accessToken: 'x' });
      }),
      http.get(VEHICLES, () => fail(401, 'UNAUTHORIZED', 'Missing bearer token.')),
    );

    await expect(client.get(endpoints.vehicles.list)).rejects.toMatchObject({ status: 401 });
    expect(refreshes).toBe(0);
  });
});

describe('rule 3 · a failed refresh signs out', () => {
  it('calls signOut with `expired` when the refresh itself 401s', async () => {
    const onSignOut = vi.fn();
    setAuthBridge({ getAccessToken: () => 'expired', getRefreshToken: () => 'r', onSignOut });
    server.use(
      http.post(url(endpoints.auth.refresh), () =>
        fail(401, 'TOKEN_EXPIRED', 'Refresh token expired.'),
      ),
      http.get(VEHICLES, () => fail(401, 'TOKEN_EXPIRED', 'Token expired.')),
    );

    await expect(client.get(endpoints.vehicles.list)).rejects.toBeInstanceOf(ApiError);
    expect(onSignOut).toHaveBeenCalledWith('expired');
  });

  it('reports a revoked refresh token separately', async () => {
    const onSignOut = vi.fn();
    setAuthBridge({ getRefreshToken: () => 'r', onSignOut });
    server.use(
      http.post(url(endpoints.auth.refresh), () =>
        fail(403, 'REFRESH_TOKEN_REUSED', 'Refresh token reuse detected.'),
      ),
    );

    await expect(refreshAccessToken()).rejects.toBeInstanceOf(ApiError);
    expect(onSignOut).toHaveBeenCalledWith('revoked');
  });
});

describe('rule 5 · a plain 403 renders ForbiddenState with no toast', () => {
  it('marks the error as forbidden and silent', async () => {
    server.use(http.get(VEHICLES, () => fail(403, 'FORBIDDEN', 'Insufficient permissions.')));

    const error = (await client.get(endpoints.vehicles.list).catch((e) => e)) as ApiError;

    expect(error.isForbidden).toBe(true);
    expect(shouldToast(error)).toBe(false);
    expect(error.userMessage).toBe('You do not have access to this.');
  });
});

describe('rule 6 · 422 carries field errors for setError', () => {
  it('maps details onto fields, and strings or arrays alike', async () => {
    server.use(
      http.post(url(endpoints.vehicles.create), () =>
        fail(422, 'VALIDATION_FAILED', 'Validation failed.', {
          vin: 'A VIN is 17 characters and cannot contain I, O or Q.',
          unitNumber: ['A unit with this number already exists.'],
          nested: { ignored: true },
        }),
      ),
    );

    const error = (await client
      .post(endpoints.vehicles.create, { vin: 'x' })
      .catch((e) => e)) as ApiError;

    expect(error.fieldErrors).toEqual({
      vin: 'A VIN is 17 characters and cannot contain I, O or Q.',
      unitNumber: 'A unit with this number already exists.',
    });
    expect(shouldToast(error)).toBe(false);
  });

  it('reads a `fields` envelope and returns nothing for other statuses', async () => {
    const wrapped = new ApiError(422, { details: { fields: { email: 'Enter a valid email address.' } } });
    expect(wrapped.fieldErrors).toEqual({ email: 'Enter a valid email address.' });
    expect(new ApiError(500, { details: { email: 'nope' } }).fieldErrors).toEqual({});
  });
});

describe('rule 7 · retries', () => {
  it('retries a GET twice on 500 and then succeeds', async () => {
    vi.useFakeTimers();
    let attempts = 0;
    server.use(
      http.get(VEHICLES, () => {
        attempts += 1;
        if (attempts < 3) return fail(500, 'INTERNAL_ERROR', 'Boom.');
        return ok({ items: [], page: 1, limit: 25, total: 0, totalPages: 0 });
      }),
    );

    const promise = client.get(endpoints.vehicles.list);
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(promise).resolves.toBeTruthy();
    expect(attempts).toBe(3);
  });

  it('gives up after two retries', async () => {
    vi.useFakeTimers();
    let attempts = 0;
    server.use(
      http.get(VEHICLES, () => {
        attempts += 1;
        return fail(503, 'SERVICE_UNAVAILABLE', 'Down.');
      }),
    );

    const promise = client.get(endpoints.vehicles.list);
    const assertion = expect(promise).rejects.toMatchObject({ status: 503 });
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
    expect(attempts).toBe(3);
  });

  it('never retries a mutation', async () => {
    let attempts = 0;
    server.use(
      http.post(url(endpoints.vehicles.create), () => {
        attempts += 1;
        return fail(500, 'INTERNAL_ERROR', 'Boom.');
      }),
    );

    await expect(client.post(endpoints.vehicles.create, {})).rejects.toMatchObject({ status: 500 });
    expect(attempts).toBe(1);
  });

  it('retries a network failure on GET and surfaces NetworkError when it never recovers', async () => {
    vi.useFakeTimers();
    let attempts = 0;
    server.use(
      http.get(VEHICLES, () => {
        attempts += 1;
        return HttpResponse.error();
      }),
    );

    const promise = client.get(endpoints.vehicles.list);
    const assertion = expect(promise).rejects.toBeInstanceOf(NetworkError);
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
    expect(attempts).toBe(3);
  });
});

describe('rule 9 · AbortController', () => {
  it('rejects when the caller aborts', async () => {
    const controller = new AbortController();
    server.use(
      http.get(VEHICLES, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return ok({ items: [] });
      }),
    );

    const promise = client.get(endpoints.vehicles.list, { signal: controller.signal });
    controller.abort();

    await expect(promise).rejects.toThrow();
  });

  it('aborts during the retry backoff instead of waiting it out', async () => {
    const controller = new AbortController();
    server.use(http.get(VEHICLES, () => fail(500, 'INTERNAL_ERROR', 'Boom.')));

    const promise = client.get(endpoints.vehicles.list, { signal: controller.signal });
    const assertion = expect(promise).rejects.toThrow();
    setTimeout(() => controller.abort(), 10);
    await assertion;
  });
});

describe('envelope, URLs and uploads', () => {
  it('unwraps { data, traceId, timestamp } and leaves a bare body alone', async () => {
    server.use(
      http.get(VEHICLES, () => ok({ items: [{ id: 'veh_1' }] })),
      http.get(url(endpoints.carrier.root), () => HttpResponse.json({ id: 'carrier' })),
    );

    await expect(client.get(endpoints.vehicles.list)).resolves.toEqual({ items: [{ id: 'veh_1' }] });
    await expect(client.get(endpoints.carrier.root)).resolves.toEqual({ id: 'carrier' });
  });

  it('serialises list query parameters and drops empty ones', () => {
    expect(
      buildUrl('/vehicles', { page: 1, limit: 25, sort: 'unitNumber:asc', q: '', status: null }),
    ).toContain('/vehicles?page=1&limit=25&sort=unitNumber%3Aasc');
    expect(buildUrl('/vehicles', { status: ['ACTIVE', 'IDLE'] })).toContain(
      'status=ACTIVE&status=IDLE',
    );
    expect(buildUrl('/vehicles')).toMatch(/\/vehicles$/);
    expect(buildUrl('/vehicles', {})).toMatch(/\/vehicles$/);
  });

  it('supports PUT, PATCH, DELETE, multipart upload and blob download', async () => {
    server.use(
      http.put(url(endpoints.integrations.update('samsara')), () => ok({ ok: true })),
      http.patch(url(endpoints.vehicles.update('veh_1')), () => ok({ id: 'veh_1' })),
      http.delete(url(endpoints.vehicles.remove('veh_1')), () => new HttpResponse(null, { status: 204 })),
      http.post(url(endpoints.vehicles.import), () => ok({ imported: 38 })),
      http.get(url(endpoints.reports.download('rep_1')), () => HttpResponse.text('csv,data')),
      http.get(url(endpoints.transfers.download('trf_1')), () =>
        fail(404, 'NOT_FOUND', 'Transfer not found.'),
      ),
    );

    await expect(client.put(endpoints.integrations.update('samsara'), {})).resolves.toEqual({ ok: true });
    await expect(client.patch(endpoints.vehicles.update('veh_1'), {})).resolves.toEqual({ id: 'veh_1' });
    await expect(client.delete(endpoints.vehicles.remove('veh_1'))).resolves.toBeNull();

    const form = new FormData();
    form.append('file', new File(['a,b'], 'units.csv', { type: 'text/csv' }));
    await expect(client.upload(endpoints.vehicles.import, form)).resolves.toEqual({ imported: 38 });

    await expect(client.blob(endpoints.reports.download('rep_1'))).resolves.toBeInstanceOf(Blob);
    await expect(client.blob(endpoints.transfers.download('trf_1'))).rejects.toBeInstanceOf(ApiError);
  });

  it('treats a non-JSON error body as a plain message', async () => {
    server.use(http.get(VEHICLES, () => new HttpResponse('gateway down', { status: 502 })));
    vi.useFakeTimers();
    const promise = client.get(endpoints.vehicles.list);
    const assertion = expect(promise).rejects.toMatchObject({ status: 502, message: 'gateway down' });
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
  });
});

describe('§17 token handling', () => {
  beforeEach(() => vi.useRealTimers());

  it('keeps the access token in memory and refreshes 60 s before expiry', async () => {
    vi.useFakeTimers();
    let refreshes = 0;
    server.use(
      http.post(url(endpoints.auth.refresh), () => {
        refreshes += 1;
        return ok({ accessToken: 'fresh', expiresIn: 900 });
      }),
    );

    setAuthBridge({ getRefreshToken: () => 'refresh-1' });
    setAccessToken('token-abc', Date.now() + 120_000);
    await vi.advanceTimersByTimeAsync(59_000);
    expect(refreshes).toBe(0);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(refreshes).toBe(1);

    setAccessToken(null);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(refreshes).toBe(1);
  });

  it('never writes a token to localStorage from the api layer', () => {
    setAccessToken('token-abc');
    expect(localStorage.getItem('obk.rt')).toBeNull();
    expect(Object.keys(localStorage)).toHaveLength(0);
  });
});

describe('edge cases the screens still depend on', () => {
  it('survives a malformed JSON body without masking the status', async () => {
    server.use(
      http.get(VEHICLES, () =>
        HttpResponse.text('{"data": broken', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    await expect(client.get(endpoints.vehicles.list)).resolves.toBeNull();
  });

  it('rejects immediately when the signal is already aborted before a retry backoff', async () => {
    const controller = new AbortController();
    server.use(
      http.get(VEHICLES, () => {
        controller.abort();
        return fail(500, 'INTERNAL_ERROR', 'Boom.');
      }),
    );

    await expect(
      client.get(endpoints.vehicles.list, { signal: controller.signal }),
    ).rejects.toThrow();
  });

  it('reads the access token back through the bridge', () => {
    setAuthBridge({ getAccessToken: () => 'token-xyz' });
    expect(getAccessToken()).toBe('token-xyz');
    resetAuthBridge();
    expect(getAccessToken()).toBeNull();
  });

  it('toasts anything that is not an ApiError', () => {
    expect(shouldToast(new Error('offline'))).toBe(true);
    expect(shouldToast(new ApiError(500, { code: 'INTERNAL_ERROR' }))).toBe(true);
  });

  it('falls back to the default bridge: sign-out is a hard redirect', async () => {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, assign },
    });

    try {
      resetAuthBridge();
      let refreshCalls = 0;
      server.use(
        http.post(url(endpoints.auth.refresh), () => {
          refreshCalls += 1;
          return fail(401, 'TOKEN_EXPIRED', 'Expired.');
        }),
      );

      await expect(refreshAccessToken()).rejects.toBeInstanceOf(ApiError);
      expect(assign).toHaveBeenCalledWith('/sign-in?reason=expired');
      // No refresh token, so the pointless 422 round trip is never made.
      expect(refreshCalls).toBe(0);
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });
});


describe('POST /auth/refresh body matches RefreshTokenDto (WB-014)', () => {
  it('sends both refreshToken and subjectType — the DTO requires each of them', async () => {
    const bodies: unknown[] = [];
    let token = 'expired';
    setAuthBridge({
      getAccessToken: () => token,
      getRefreshToken: () => 'refresh-1',
      onTokens: ({ accessToken }) => {
        token = accessToken;
      },
    });
    server.use(
      http.post(url(endpoints.auth.refresh), async ({ request }) => {
        bodies.push(await request.json());
        return ok({ accessToken: 'fresh', refreshToken: 'refresh-2' });
      }),
      http.get(VEHICLES, ({ request }) =>
        request.headers.get('authorization') === 'Bearer fresh'
          ? ok({ items: [], page: 1, limit: 25, total: 0, totalPages: 0 })
          : fail(401, 'TOKEN_EXPIRED', 'Token expired.'),
      ),
    );

    await client.get(endpoints.vehicles.list);

    // Identical to the shape pinned by shared/auth/authApi.test.ts — the two must not drift.
    expect(bodies).toEqual([{ refreshToken: 'refresh-1', subjectType: 'user' }]);
    expect(REFRESH_SUBJECT_TYPE).toBe('user');
  });

  it('signs out without a request when there is no refresh token to send', async () => {
    let refreshCalls = 0;
    const onSignOut = vi.fn();
    setAuthBridge({ getRefreshToken: () => null, onSignOut });
    server.use(
      http.post(url(endpoints.auth.refresh), () => {
        refreshCalls += 1;
        return ok({ accessToken: 'fresh' });
      }),
    );

    await expect(refreshAccessToken()).rejects.toMatchObject({
      status: 401,
      code: 'TOKEN_EXPIRED',
    });
    expect(refreshCalls).toBe(0);
    expect(onSignOut).toHaveBeenCalledWith('expired');
  });
});

describe('limit is capped at 200 and larger reads page (WB-030)', () => {
  it('clamps limit above 200 in every URL and warns in development', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      expect(buildUrl('/vehicles', { limit: 500 })).toContain('limit=200');
      expect(buildUrl('/vehicles', { limit: '500' })).toContain('limit=200');
      expect(warn).toHaveBeenCalledTimes(2);
      expect(warn.mock.calls[0]?.[0]).toContain('WB-030');

      warn.mockClear();
      expect(buildUrl('/vehicles', { limit: 200 })).toContain('limit=200');
      expect(buildUrl('/vehicles', { limit: 25 })).toContain('limit=25');
      expect(buildUrl('/vehicles', { limit: 'all' })).toContain('limit=all');
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  /** A server that really paginates `rows` by `?page&limit`, recording every request. */
  function pagedServer(rows: number) {
    const seen: Array<{ page: string | null; limit: string | null }> = [];
    server.use(
      http.get(VEHICLES, ({ request }) => {
        const params = new URL(request.url).searchParams;
        seen.push({ page: params.get('page'), limit: params.get('limit') });
        const page = Number(params.get('page') ?? 1);
        const limit = Number(params.get('limit') ?? 25);
        const start = (page - 1) * limit;
        const items = Array.from({ length: Math.max(0, Math.min(limit, rows - start)) }, (_, i) => ({
          id: `row-${start + i}`,
        }));
        return ok({ items, page, limit, total: rows, totalPages: Math.max(1, Math.ceil(rows / limit)) });
      }),
    );
    return seen;
  }

  it('is one untouched request when limit fits', async () => {
    const seen = pagedServer(69);
    const page = await client.list<{ id: string }>(endpoints.vehicles.list, { limit: 25, status: 'ACTIVE' });
    expect(seen).toEqual([{ page: null, limit: '25' }]);
    expect(page).toMatchObject({ page: 1, limit: 25, total: 69, totalPages: 3 });
    expect(page.items).toHaveLength(25);
  });

  it('is one request when no limit is given', async () => {
    const seen = pagedServer(3);
    await client.list(endpoints.vehicles.list);
    expect(seen).toHaveLength(1);
  });

  it('pages through every row a limit of 500 asks for — the 300-unit fleet is not truncated', async () => {
    const seen = pagedServer(300);
    const page = await client.list<{ id: string }>(endpoints.vehicles.list, { limit: 500 });

    expect(seen).toEqual([
      { page: '1', limit: '200' },
      { page: '2', limit: '200' },
    ]);
    expect(page.items).toHaveLength(300);
    expect(page.items[0]?.id).toBe('row-0');
    expect(page.items[299]?.id).toBe('row-299');
    expect(page).toMatchObject({ page: 1, limit: 500, total: 300, totalPages: 1 });
  });

  it('stops as soon as it has the rows it was asked for', async () => {
    const seen = pagedServer(1000);
    const page = await client.list<{ id: string }>(endpoints.vehicles.list, { limit: 300 });
    expect(seen).toHaveLength(2);
    expect(page.items).toHaveLength(300);
    expect(page.totalPages).toBe(4);
  });

  it('starts from the offset a later page implies', async () => {
    pagedServer(1000);
    const page = await client.list<{ id: string }>(endpoints.vehicles.list, { limit: 300, page: 2 });
    expect(page.items).toHaveLength(300);
    expect(page.items[0]?.id).toBe('row-300');
    expect(page.items[299]?.id).toBe('row-599');
    expect(page.page).toBe(2);
  });

  it('stops on an empty page even if the server over-reports totalPages', async () => {
    let calls = 0;
    server.use(
      http.get(VEHICLES, () => {
        calls += 1;
        return ok({ items: calls === 1 ? [{ id: 'only' }] : [], page: calls, limit: 200, total: 999, totalPages: 9 });
      }),
    );
    const page = await client.list<{ id: string }>(endpoints.vehicles.list, { limit: 500 });
    expect(calls).toBe(2);
    expect(page.items).toEqual([{ id: 'only' }]);
  });
});
