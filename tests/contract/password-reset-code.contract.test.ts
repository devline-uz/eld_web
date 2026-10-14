// Contract: sign-in "Forgot password?" (2026-10-12) — `POST /auth/password/reset-code` and
// `/confirm`, through the real authApi calls against the default MSW handlers, validated against
// backend/docs/openapi.json (success payloads and the documented error codes).
import { describe, expect, it } from 'vitest';
import type { ApiError } from '../../src/shared/api/errors';
import { confirmPasswordResetCode, requestPasswordResetCode } from '../../src/shared/auth/authApi';
import { assertMatchesOpenApi, operation } from './openapi';

const EMAIL = 'sarah.chen@universal-logistics.example';

function documentedErrorCodes(path: string): string[] {
  const op = operation('POST', path) as { responses?: Record<string, { content?: { 'application/json'?: { schema?: { example?: { code?: string } } } } }> } | null;
  return Object.values(op?.responses ?? {})
    .map((r) => r.content?.['application/json']?.schema?.example?.code)
    .filter((c): c is string => typeof c === 'string');
}

describe('/api/auth/password/reset-code', () => {
  it('POST returns the documented payload for a known account', async () => {
    const sent = await requestPasswordResetCode(EMAIL);
    assertMatchesOpenApi('POST', '/api/auth/password/reset-code', sent);
    expect(sent.email).toBe(EMAIL);
  });

  it('CODE-081 — POST answers an unknown email with the same documented 200 payload (no account enumeration)', async () => {
    const sent = await requestPasswordResetCode('nobody@example.com');
    assertMatchesOpenApi('POST', '/api/auth/password/reset-code', sent);
    expect(sent.email).toBe('nobody@example.com');
    const codes = documentedErrorCodes('/api/auth/password/reset-code');
    expect(codes).toEqual(expect.arrayContaining(['RATE_LIMITED', 'PASSWORD_LOGIN_DISABLED']));
    expect(codes).not.toContain('NOT_FOUND');
    expect(codes).not.toContain('EMAIL_CHANGE_ON_HOLD');
  });
});

describe('/api/auth/password/reset-code/confirm', () => {
  it('POST returns the documented payload for the right code', async () => {
    const done = await confirmPasswordResetCode({ email: EMAIL, code: '123456', newPassword: 'N3wPassword!' });
    assertMatchesOpenApi('POST', '/api/auth/password/reset-code/confirm', done);
  });

  it('POST is a documented 422 RESET_CODE_INVALID for a wrong code', async () => {
    const error = await confirmPasswordResetCode({ email: EMAIL, code: '000000', newPassword: 'N3wPassword!' }).catch(
      (e: unknown) => e,
    );
    expect((error as ApiError).status).toBe(422);
    expect((error as ApiError).code).toBe('RESET_CODE_INVALID');
    expect(documentedErrorCodes('/api/auth/password/reset-code/confirm')).toContain('RESET_CODE_INVALID');
  });
});
