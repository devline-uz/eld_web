// Contract: sign-in "Forgot password?" (2026-10-12) — `POST /auth/password/reset-code` and
// `/confirm`, through the real authApi calls against the default MSW handlers, validated against
// backend/docs/openapi.json (success payloads and the documented error codes).
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../src/shared/api/errors';
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

  it('POST is a documented 404 NOT_FOUND for an unknown email', async () => {
    const error = await requestPasswordResetCode('nobody@example.com').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).code).toBe('NOT_FOUND');
    expect(documentedErrorCodes('/api/auth/password/reset-code')).toEqual(
      expect.arrayContaining(['NOT_FOUND', 'RATE_LIMITED', 'PASSWORD_LOGIN_DISABLED']),
    );
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
