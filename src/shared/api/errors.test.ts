// web/tz.md §14.3 — the code table maps one-to-one with backend/src/common/errors/codes.ts.
import { describe, expect, it } from 'vitest';
import { ApiError, ERROR_MESSAGES, NetworkError, errorMessage, formErrorMessage, isApiError, openTripsOf, toUserMessage, assignDriverErrorMessage } from './errors';

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

  it('surfaces the server text for the Super Admin guard 403', () => {
    const text = 'Only a Super Admin can manage administrators.';
    expect(toUserMessage(new ApiError(403, { code: 'FORBIDDEN', message: text }))).toBe(text);
  });

  it('surfaces the server text for permission-ceiling 403s (roles, role assignment, API-key scopes)', () => {
    const own = 'You cannot edit the role you are assigned to.';
    expect(toUserMessage(new ApiError(403, { code: 'FORBIDDEN', message: own }))).toBe(own);
    const scopes = 'API key scopes cannot exceed your own permissions: users (FULL, you have NONE).';
    expect(
      toUserMessage(
        new ApiError(403, {
          code: 'FORBIDDEN',
          message: scopes,
          details: { exceeding: [{ key: 'users', requested: 'FULL', allowed: 'NONE' }] },
        }),
      ),
    ).toBe(scopes);
    // The plain guard refusal keeps the generic copy.
    expect(toUserMessage(new ApiError(403, { code: 'FORBIDDEN', message: 'Insufficient permission.' }))).toBe(
      'You do not have access to this.',
    );
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

describe('backend Phase 13 codes (2026-09-24)', () => {
  it.each([
    'PASSWORD_LOGIN_DISABLED', 'VEHICLE_HAS_OPEN_CRITICAL_DEFECTS', 'DRIVER_DOCUMENT_NOT_FOUND',
    'CO_DRIVER_PAIRING_NOT_FOUND', 'IMAGE_TOO_SMALL', 'ATTACHMENT_NOT_FOUND', 'TRIP_NOT_FOUND',
    'TRAILER_NOT_FOUND', 'TRIP_NOT_DRAFT', 'GEOCODER_NOT_CONFIGURED', 'GEOCODE_FAILED',
    'TRIP_SCHEDULE_CONFLICT',
  ])('%s has English copy, never the trace-id fallback', (code) => {
    expect(ERROR_MESSAGES[code]).toBeTruthy();
    expect(errorMessage(code, 'T1')).not.toContain('Reference');
  });
});

describe('formErrorMessage', () => {
  const issues = (list: { path: string; message: string }[]) =>
    new ApiError(422, { code: 'VALIDATION_FAILED', details: { issues: list.map((i) => ({ ...i, code: 'too_big' })) } });

  it('spells out issues the form could not place on a field, labelled', () => {
    const error = issues([
      { path: 'estimatedLaborHours', message: 'Number must be less than or equal to 999' },
      { path: 'odometerMi', message: 'Too big' },
    ]);
    expect(formErrorMessage(error, ['odometerMi'], { estimatedLaborHours: 'Estimated labor' })).toBe(
      'Estimated labor: Number must be less than or equal to 999.',
    );
  });

  it('humanizes an unlabelled path and keeps a path-less issue as is', () => {
    expect(formErrorMessage(issues([{ path: 'driverIds', message: 'Required' }]))).toBe('Driver ids: Required.');
    expect(formErrorMessage(issues([{ path: '', message: 'Provide exactly one of eventId or driverId.' }]))).toBe(
      'Provide exactly one of eventId or driverId.',
    );
  });

  it('falls back to the §14.3 copy when every issue is placed, or for other errors', () => {
    expect(formErrorMessage(issues([{ path: 'note', message: 'Too long' }]), ['note'])).toBe(ERROR_MESSAGES.VALIDATION_FAILED);
    expect(formErrorMessage(new ApiError(404, { code: 'NOT_FOUND' }))).toBe('Not found.');
    expect(formErrorMessage(new NetworkError())).toBe('No connection. Check your network and try again.');
    expect(formErrorMessage('oops')).toBe('Something went wrong.');
  });
});

describe('BE-013 openTripsOf', () => {
  const conflict = (details: Record<string, unknown>, status = 409) =>
    new ApiError(status, { code: 'CONFLICT', message: 'still has open trips', details });

  it('reads the open trips a 409 delete refusal names', () => {
    const trips = [{ id: 'trp_1', number: 'TRP-1001', status: 'ASSIGNED' }];
    expect(openTripsOf(conflict({ openTrips: trips }))).toEqual(trips);
  });

  it('is null for anything else', () => {
    expect(openTripsOf(conflict({ openTrips: [] }))).toBeNull();
    expect(openTripsOf(conflict({ openTrips: 'TRP-1' }))).toBeNull();
    expect(openTripsOf(conflict({ openTrips: [{ id: 1 }] }))).toBeNull();
    expect(openTripsOf(conflict({ openTrips: [{ id: 'trp_1', number: 'TRP-1' }] }, 422))).toBeNull();
    expect(openTripsOf(new Error('boom'))).toBeNull();
  });
});

describe('assign-driver refusals (POST /vehicles/:id/assign-driver)', () => {
  const e = (status: number, code: string, message = 'Request failed') => new ApiError(status, { code, message });
  it('uses the server sentence for a 409 CONFLICT, never "That value is already in use."', () => {
    expect(assignDriverErrorMessage(e(409, 'CONFLICT', 'Vehicle is inactive and cannot be assigned a driver.'))).toBe(
      'Vehicle is inactive and cannot be assigned a driver.',
    );
    expect(assignDriverErrorMessage(e(409, 'CONFLICT'))).toBe(ERROR_MESSAGES.CONFLICT);
  });
  it('explains out of service, a deleted driver and a deleted unit', () => {
    expect(assignDriverErrorMessage(e(409, 'VEHICLE_OUT_OF_SERVICE'))).toMatch(/out of service/);
    expect(assignDriverErrorMessage(e(404, 'DRIVER_NOT_FOUND'))).toBe('This driver was deleted or no longer exists. Pick another driver.');
    expect(assignDriverErrorMessage(e(404, 'VEHICLE_NOT_FOUND'))).toBe('This unit was deleted or no longer exists.');
    expect(assignDriverErrorMessage(new Error('x'))).toBe('Something went wrong.');
  });
});
