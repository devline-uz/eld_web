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

  // Sign-in "Forgot password?" — like the API (CODE-081) every address gets the same 200, whether
  // or not an account uses it. The mock code is always `123456`; `000000` is a wrong code and
  // `111111` an expired one.
  http.post(url(endpoints.auth.passwordResetCode), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { email?: string };
    const email = (body.email ?? '').trim().toLowerCase();
    return ok({ ...(fixture('POST /api/auth/password/reset-code') as Record<string, unknown>), email });
  }),
  http.post(url(endpoints.auth.passwordResetCodeConfirm), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { code?: string; newPassword?: string };
    if ((body.newPassword ?? '').length < 8) {
      return fail(422, 'VALIDATION_FAILED', 'Request validation failed.', {
        issues: [{ path: 'newPassword', code: 'too_small', message: 'Password must be at least 8 characters.' }],
      });
    }
    if (body.code === '111111') {
      const message = 'This code has expired or was already used. Request a new code.';
      return fail(422, 'RESET_CODE_EXPIRED', message, { code: message });
    }
    if (body.code !== '123456') {
      const message = 'Incorrect code. 4 attempts left.';
      return fail(422, 'RESET_CODE_INVALID', message, { code: message, attemptsRemaining: 4 });
    }
    return ok(fixture('POST /api/auth/password/reset-code/confirm'));
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
