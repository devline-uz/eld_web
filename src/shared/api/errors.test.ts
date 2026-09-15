// web/tz.md §14.3 — the code table maps one-to-one with backend/src/common/errors/codes.ts.
import { describe, expect, it } from 'vitest';
import { ApiError, ERROR_MESSAGES, NetworkError, errorMessage, isApiError, toUserMessage } from './errors';

describe('§14.3 error copy', () => {
  it('uses the exact strings from the table', () => {
    expect(errorMessage('DRIVING_TIME_IMMUTABLE')).toBe(
      'Driving time can never be shortened, deleted or restatused (49 CFR §395.30).',
    );
    expect(errorMessage('RECERTIFICATION_REQUIRED')).toBe(
      'The log changed after the last certification — it must be certified again.',
    );
    expect(errorMessage('DRIVER_NOT_FOUND')).toBe('Driver not found.');
    expect(errorMessage('RANGE_TOO_LARGE')).toBe('The selected range is too large.');
    expect(errorMessage('INVALID_TRANSFER_RECIPIENT')).toBe(
      'Only fmcsa.dot.gov addresses are accepted.',
    );
    expect(errorMessage('CHANNEL_NOT_AVAILABLE')).toBe(
      'SMS is not available — this rule will be delivered by email.',
    );
    expect(errorMessage('UNRESOLVED_UNIDENTIFIED')).toBe(
      'Resolve the unassigned driving segments first.',
    );
    expect(errorMessage('UNCERTIFIED_LOGS')).toBe('Some logs in this range are not certified.');
    expect(errorMessage('ACTIVE_MALFUNCTION')).toBe('An ELD malfunction is active for this driver.');
    expect(errorMessage('USER_NOT_INVITED')).toBe('This account is not invited to the panel.');
    expect(errorMessage('EMAIL_NOT_VERIFIED')).toBe('Verify your email address first.');
  });

  it('answers both spellings of the eRODS test-mode code (web/bugs.md WB-001)', () => {
    const expected = 'eRODS is in test mode — the file will not reach FMCSA.';
    expect(errorMessage('ERODS_TEST_MODE')).toBe(expected);
    expect(errorMessage('ERODS_TEST_MODE_ONLY')).toBe(expected);
  });

  it('falls back to the trace id for an unknown code', () => {
    expect(errorMessage('SOMETHING_NEW', '01J8X3')).toBe('Something went wrong. Reference: 01J8X3');
    expect(errorMessage(undefined, '01J8X3')).toBe('Something went wrong. Reference: 01J8X3');
  });

  it('never leaves a backend code without copy', () => {
    for (const [code, message] of Object.entries(ERROR_MESSAGES)) {
      expect(message, code).toMatch(/[.!]$/);
    }
  });
});

describe('ApiError', () => {
  it('defaults every envelope field', () => {
    const error = new ApiError(500, {});
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.message).toBe('Request failed');
    expect(error.traceId).toBe('');
    expect(error.timestamp).toBeTruthy();
    expect(error.details).toEqual({});
    expect(isApiError(error)).toBe(true);
    expect(isApiError(new Error('x'))).toBe(false);
  });

  it('carries the envelope through', () => {
    const error = new ApiError(422, {
      code: 'DRIVING_TIME_IMMUTABLE',
      message: 'Driving time is immutable.',
      details: { eventId: '12345' },
      traceId: '01J8X',
      timestamp: '2026-09-12T10:00:00.000Z',
    });
    expect(error.userMessage).toContain('49 CFR §395.30');
    expect(error.details.eventId).toBe('12345');
    expect(error.isForbidden).toBe(false);
  });

  it('resolves the message for any thrown value', () => {
    expect(toUserMessage(new ApiError(403, { code: 'FORBIDDEN' }))).toBe(
      'You do not have access to this.',
    );
    expect(toUserMessage(new NetworkError())).toBe(
      'No connection. Check your network and try again.',
    );
    expect(toUserMessage(new NetworkError('Offline.'))).toBe('Offline.');
    expect(toUserMessage('oops')).toBe('Something went wrong. Reference: ');
  });
});
