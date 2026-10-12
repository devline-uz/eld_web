// owner: web-dispatch-messaging — where a trip create / assign refusal belongs. Shared by 11.2
// Create trip and 11.4 Assign load so both place a driver / unit / trailer error under the picker
// it names instead of a generic toast (BE-001: 422 DRIVER_NOT_FOUND / VEHICLE_NOT_FOUND, 409
// VEHICLE_OUT_OF_SERVICE / CONFLICT keyed `driverId` / `vehicleId`, 404 on a deleted row).
import { ApiError, ERROR_MESSAGES } from '@/shared/api/errors';

export type AssignmentField = 'driverId' | 'vehicleId' | 'trailerId';

/** A driver/unit/trailer refusal (`DRIVER_NOT_FOUND`, `VEHICLE_OUT_OF_SERVICE`, …) as 404, 409 or
 * 422 — placed under the picker it names, with the §14.3 copy when the code has one, else the
 * server's own sentence. `null` for anything else (or a 422 that names its fields in `details`,
 * which `applyServerFieldErrors` already places). */
export function assignmentError(
  error: unknown,
): { field: 'driverId' | 'vehicleId' | 'trailerId'; message: string } | null {
  if (!(error instanceof ApiError) || ![404, 409, 422].includes(error.status)) return null;
  const field = /^(CO_)?DRIVER_/.test(error.code)
    ? 'driverId'
    : /^VEHICLE_/.test(error.code)
      ? 'vehicleId'
      : /^TRAILER_/.test(error.code)
        ? 'trailerId'
        : null;
  if (!field) return null;
  const known = ERROR_MESSAGES[error.code];
  return { field, message: known ?? (error.message || 'This selection is no longer available.') };
}

const ASSIGNMENT_FIELDS: AssignmentField[] = ['driverId', 'vehicleId', 'trailerId'];

/**
 * 11.4 — the refusal's field and sentence: the server's own `details.driverId` / `vehicleId` /
 * `trailerId` sentence first (BE-001 keys every 409/422 that way, schedule conflicts included),
 * else the code-based `assignmentError`. `null` → not an assignment problem (generic copy).
 */
export function assignmentFieldError(error: unknown): { field: AssignmentField; message: string } | null {
  if (!(error instanceof ApiError) || ![404, 409, 422].includes(error.status)) return null;
  for (const field of ASSIGNMENT_FIELDS) {
    const message = error.details[field];
    if (typeof message === 'string' && message) return { field, message };
  }
  return assignmentError(error);
}
