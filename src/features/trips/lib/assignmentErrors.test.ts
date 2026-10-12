import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api/errors';
import { assignmentError, assignmentFieldError } from './assignmentErrors';

const err = (status: number, code: string, details: Record<string, unknown> = {}, message = 'Server sentence.') =>
  new ApiError(status, { code, message, details });

describe('BE-001 assignment errors', () => {
  it('assignmentError maps by code for 404 / 409 / 422', () => {
    expect(assignmentError(err(422, 'DRIVER_NOT_FOUND'))?.field).toBe('driverId');
    expect(assignmentError(err(409, 'VEHICLE_OUT_OF_SERVICE'))?.field).toBe('vehicleId');
    expect(assignmentError(err(404, 'TRAILER_NOT_FOUND'))?.field).toBe('trailerId');
    expect(assignmentError(err(409, 'CONFLICT'))).toBeNull();
    expect(assignmentError(err(500, 'DRIVER_NOT_FOUND'))).toBeNull();
    expect(assignmentError(new Error('x'))).toBeNull();
  });

  it('assignmentFieldError prefers the server sentence keyed by field (409 CONFLICT on an inactive unit)', () => {
    expect(assignmentFieldError(err(409, 'CONFLICT', { vehicleId: 'This unit is inactive and cannot be assigned a trip.' }))).toEqual({
      field: 'vehicleId',
      message: 'This unit is inactive and cannot be assigned a trip.',
    });
    expect(assignmentFieldError(err(422, 'DRIVER_NOT_FOUND'))?.field).toBe('driverId');
    expect(assignmentFieldError(err(409, 'CONFLICT', { status: 'Only a planned trip can be assigned.' }))).toBeNull();
    expect(assignmentFieldError(err(400, 'VALIDATION_FAILED', { driverId: 'x' }))).toBeNull();
  });
});
