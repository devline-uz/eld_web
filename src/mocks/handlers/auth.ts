// Phase 1 — sign-in, refresh, /auth/me (web/tz.md §6.5–6.7).
import { http } from 'msw';
import { endpoints } from '@/shared/api/endpoints';
import { fixture } from '../fixtures.generated';
import { fail, ok, url } from '../envelope';

export const authHandlers = [
  http.post(url(endpoints.auth.signIn), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { password?: string };
    if (body.password === 'wrong') {
      return fail(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
    }
    return ok(fixture('POST /api/auth/login'));
  }),

  http.post(url(endpoints.auth.refresh), () => ok(fixture('POST /api/auth/refresh'))),
  http.post(url(endpoints.auth.signOut), () => ok(fixture('POST /api/auth/logout'))),
  http.post(url(endpoints.auth.google), () => ok(fixture('POST /api/auth/google'))),

  http.get(url(endpoints.auth.me), ({ request }) => {
    if (!request.headers.get('authorization')) {
      return fail(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    return ok(fixture('GET /api/auth/me'));
  }),

  http.get(url(endpoints.me.profile), () => ok(fixture('GET /api/me/profile'))),
  http.get(url(endpoints.me.sessions), () => ok(fixture('GET /api/me/sessions'))),
  // W-26 (web-auth-rbac) — real endpoints, echoed.
  http.patch(url(endpoints.me.profile), async ({ request }) =>
    ok({
      ...(fixture('GET /api/me/profile') as Record<string, unknown>),
      ...((await request.json().catch(() => ({}))) as Record<string, unknown>),
    }),
  ),
  http.delete(url(endpoints.me.session(':id')), () => ok({ success: true })),
  http.get(url(endpoints.carrier.root), () => ok(fixture('GET /api/carrier'))),
  http.get(url(endpoints.roles.list), () => ok(fixture('GET /api/roles'))),
];
