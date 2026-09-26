import { describe, expect, it } from 'vitest';
import { conflictField, type ConflictRule } from './conflicts';
import { ApiError } from './errors';

const RULES: readonly ConflictRule<'username' | 'email' | 'phone'>[] = [
  { field: 'username', code: /USERNAME/, hint: /username/, message: /\busername\b/i },
  { field: 'email', code: /EMAIL/, hint: /email/, message: /\be-?mail\b/i },
  { field: 'phone', code: /PHONE/, hint: /phone/, message: /\bphone\b/i },
];

const conflict = (code: string, message: string, details?: Record<string, unknown>) =>
  new ApiError(409, { code, message, details });

describe('conflictField', () => {
  it('reads a specific code first', () => {
    expect(conflictField(conflict('DUPLICATE_EMAIL', 'This username is taken.'), RULES)).toBe('email');
    expect(conflictField(conflict('PHONE_TAKEN', 'x'), RULES)).toBe('phone');
  });

  it('reads details.field, a Prisma-style details.target and field-keyed details', () => {
    expect(conflictField(conflict('CONFLICT', 'Conflict', { field: 'email' }), RULES)).toBe('email');
    expect(conflictField(conflict('CONFLICT', 'Conflict', { target: ['tenantId', 'phone'] }), RULES)).toBe('phone');
    expect(conflictField(conflict('CONFLICT', 'Conflict', { username: 'Taken.' }), RULES)).toBe('username');
  });

  it('falls back to the message text', () => {
    expect(conflictField(conflict('CONFLICT', 'A driver with this e-mail already exists.'), RULES)).toBe('email');
  });

  it('answers null when nothing names a field — the caller must not guess', () => {
    expect(conflictField(conflict('CONFLICT', 'Unique constraint failed'), RULES)).toBeNull();
  });
});
