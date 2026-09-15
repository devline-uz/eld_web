// owner: web-auth-rbac — the five auth calls (web/tz.md §6.5, WD-012). MSW only: the live API
// throttles POST /auth/login to 5 requests per 60 s, so no test ever reaches it.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { fail, ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { ApiError, NetworkError } from '@/shared/api/errors';
import {
  fetchMe,
  loginWithGoogleIdToken,
  loginWithPassword,
  logoutSession,
  refreshTokens,
} from './authApi';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const PAIR = { accessToken: 'a1', refreshToken: 'r1', tokenType: 'Bearer' };

describe('POST /auth/login (dev only, Q-1)', () => {
  it('unwraps the envelope into a token pair', async () => {
    server.use(http.post(url(endpoints.auth.signIn), () => ok(PAIR)));
    const result = await loginWithPassword('sarah.chen@universal-logistics.example', 'Onebook2026');
    expect(result).toEqual(PAIR);
  });

  it('sends the credentials as JSON and never a cookie', async () => {
    const seen: Array<{ body: unknown; credentials: string; headers: Headers }> = [];
    server.use(
      http.post(url(endpoints.auth.signIn), async ({ request }) => {
        seen.push({
          body: await request.json(),
          credentials: request.credentials,
          headers: request.headers,
        });
        return ok(PAIR);
      }),
    );
    await loginWithPassword('a@b.example', 'pw');
    expect(seen[0]!.body).toEqual({ email: 'a@b.example', password: 'pw' });
    expect(seen[0]!.credentials).toBe('omit');
    expect(seen[0]!.headers.get('X-Client-Version')).toBeTruthy();
  });

  it('surfaces 401 INVALID_CREDENTIALS as an ApiError with its code', async () => {
    server.use(
      http.post(url(endpoints.auth.signIn), () =>
        fail(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.'),
      ),
    );
    const error = await loginWithPassword('a@b.example', 'nope').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect((error as ApiError).code).toBe('INVALID_CREDENTIALS');
  });

  it('surfaces the 429 throttle (5 per 60 s on the real backend)', async () => {
    server.use(
      http.post(url(endpoints.auth.signIn), () =>
        fail(429, 'RATE_LIMITED', 'Rate limit exceeded (5 requests per 60s).'),
      ),
    );
    const error = await loginWithPassword('a@b.example', 'pw').catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(429);
  });

  it('turns a dead network into NetworkError, not a raw TypeError', async () => {
    server.use(http.post(url(endpoints.auth.signIn), () => HttpResponse.error()));
    await expect(loginWithPassword('a@b.example', 'pw')).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('POST /auth/google (the only way in under production)', () => {
  it('exchanges a Firebase ID token for a session', async () => {
    const seen: unknown[] = [];
    server.use(
      http.post(url(endpoints.auth.google), async ({ request }) => {
        seen.push(await request.json());
        return ok(PAIR);
      }),
    );
    await expect(loginWithGoogleIdToken('google-id-token')).resolves.toEqual(PAIR);
    expect(seen[0]).toEqual({ idToken: 'google-id-token' });
  });

  it('403 USER_NOT_INVITED keeps its code (no auto-registration)', async () => {
    server.use(
      http.post(url(endpoints.auth.google), () =>
        fail(403, 'USER_NOT_INVITED', 'Google Sign-In never auto-registers.'),
      ),
    );
    const error = (await loginWithGoogleIdToken('t').catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(403);
    expect(error.code).toBe('USER_NOT_INVITED');
  });

  it('403 EMAIL_NOT_VERIFIED keeps its code', async () => {
    server.use(
      http.post(url(endpoints.auth.google), () =>
        fail(403, 'EMAIL_NOT_VERIFIED', 'Verify your email first.'),
      ),
    );
    const error = (await loginWithGoogleIdToken('t').catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe('EMAIL_NOT_VERIFIED');
  });
});

describe('POST /auth/refresh', () => {
  it('sends subjectType: "user" — the backend DTO requires it', async () => {
    const seen: unknown[] = [];
    server.use(
      http.post(url(endpoints.auth.refresh), async ({ request }) => {
        seen.push(await request.json());
        return ok(PAIR);
      }),
    );
    await expect(refreshTokens('r0')).resolves.toEqual(PAIR);
    expect(seen[0]).toEqual({ refreshToken: 'r0', subjectType: 'user' });
  });

  it('a reused refresh token is a 401 the caller must not retry', async () => {
    server.use(
      http.post(url(endpoints.auth.refresh), () =>
        fail(401, 'REFRESH_TOKEN_REUSED', 'This refresh token was already rotated.'),
      ),
    );
    const error = (await refreshTokens('r0').catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe('REFRESH_TOKEN_REUSED');
  });
});

describe('POST /auth/logout', () => {
  it('sends the refresh token with the bearer header', async () => {
    const seen: Array<{ body: unknown; auth: string | null }> = [];
    server.use(
      http.post(url(endpoints.auth.signOut), async ({ request }) => {
        seen.push({ body: await request.json(), auth: request.headers.get('authorization') });
        return ok({ success: true });
      }),
    );
    await logoutSession('r1', 'a1');
    expect(seen[0]!.body).toEqual({ refreshToken: 'r1' });
    expect(seen[0]!.auth).toBe('Bearer a1');
  });

  it('omits the header when there is no access token left', async () => {
    const seen: Array<string | null> = [];
    server.use(
      http.post(url(endpoints.auth.signOut), ({ request }) => {
        seen.push(request.headers.get('authorization'));
        return ok({ success: true });
      }),
    );
    await logoutSession('r1', null);
    expect(seen[0]).toBeNull();
  });
});

describe('GET /auth/me — the only permission source', () => {
  it('sends the bearer token and returns role + permissions', async () => {
    server.use(
      http.get(url(endpoints.auth.me), ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer a1');
        return ok({
          id: 'usr_1',
          type: 'user',
          role: 'DISPATCHER',
          permissions: { trips: 'FULL', hosEdit: 'NONE' },
        });
      }),
    );
    const me = await fetchMe('a1');
    expect(me.role).toBe('DISPATCHER');
    expect(me.permissions).toEqual({ trips: 'FULL', hosEdit: 'NONE' });
  });

  it('propagates a 403 as a plain forbidden ApiError', async () => {
    server.use(
      http.get(url(endpoints.auth.me), () => fail(403, 'FORBIDDEN', 'Insufficient permissions.')),
    );
    const error = (await fetchMe('a1').catch((e: unknown) => e)) as ApiError;
    expect(error.isForbidden).toBe(true);
  });

  it('honours an AbortSignal', async () => {
    server.use(http.get(url(endpoints.auth.me), () => ok({ id: 'usr_1' })));
    const controller = new AbortController();
    controller.abort();
    // An aborted request must never masquerade as a connectivity failure.
    await expect(fetchMe('a1', controller.signal)).rejects.not.toBeInstanceOf(NetworkError);
  });
});
