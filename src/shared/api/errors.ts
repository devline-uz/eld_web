// owner: web-api-client — ErrorCode → user-facing English copy (web/tz.md §14.3).
// One-to-one with backend/src/common/errors/codes.ts (append-only registry).
// An unknown code falls back to `Something went wrong. Reference: <traceId>`.
import type { ApiErrorBody } from './types';

/** The error a screen ever sees: the envelope, plus the HTTP status and a resolved message. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly traceId: string;
  readonly timestamp: string;

  constructor(status: number, body: Partial<ApiErrorBody>) {
    super(body.message ?? 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code ?? 'INTERNAL_ERROR';
    this.details = body.details ?? {};
    this.traceId = body.traceId ?? '';
    this.timestamp = body.timestamp ?? new Date().toISOString();
  }

  /** §14.3 copy for this code, or the trace-id fallback. */
  get userMessage(): string {
    return errorMessage(this.code, this.traceId);
  }

  /** §6.2 rule 5 — a plain 403 replaces the page with <ForbiddenState> and shows no toast. */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  /** §6.2 rule 6 — field-level messages for react-hook-form `setError`. */
  get fieldErrors(): Record<string, string> {
    if (this.status !== 422 && this.status !== 400 && this.status !== 409) return {};
    const out: Record<string, string> = {};
    // The live backend's ZodValidationPipe sends `details: { issues: [{ path, code, message }] }`
    // (openapi.json 422 examples), not a field → message map. Reading `details` as a map turned
    // every such 422 into zero field errors — the generic "Check the highlighted fields" banner
    // with nothing highlighted. The first issue per path wins; a path-less issue is keyed `''`.
    const issues = this.details.issues;
    if (Array.isArray(issues)) {
      for (const issue of issues as unknown[]) {
        if (!issue || typeof issue !== 'object') continue;
        const { path, message } = issue as { path?: unknown; message?: unknown };
        if (typeof message !== 'string') continue;
        const field = Array.isArray(path) ? path.map(String).join('.') : typeof path === 'string' ? path : '';
        if (!(field in out)) out[field] = message;
      }
      return out;
    }
    const source = (this.details.fields ?? this.details) as Record<string, unknown>;
    for (const [field, value] of Object.entries(source)) {
      if (typeof value === 'string') out[field] = value;
      else if (Array.isArray(value) && typeof value[0] === 'string') out[field] = value[0];
    }
    return out;
  }
}

/**
 * The exact user strings from web/tz.md §14.3 come first; the remaining backend codes get the
 * same voice (sentence case, full stop, no jargon) so nothing ever reaches a user as a raw code.
 */
export const ERROR_MESSAGES: Record<string, string> = {
  // --- §14.3, verbatim ------------------------------------------------------------------------
  DRIVING_TIME_IMMUTABLE:
    'Driving time can never be shortened, deleted or restatused (49 CFR §395.30).',
  RECERTIFICATION_REQUIRED:
    'The log changed after the last certification — it must be certified again.',
  DRIVER_NOT_FOUND: 'Driver not found.',
  RANGE_TOO_LARGE: 'The selected range is too large.',
  INVALID_TRANSFER_RECIPIENT: 'Only fmcsa.dot.gov addresses are accepted.',
  CHANNEL_NOT_AVAILABLE: 'SMS is not available — this rule will be delivered by email.',
  UNRESOLVED_UNIDENTIFIED: 'Resolve the unassigned driving segments first.',
  UNCERTIFIED_LOGS: 'Some logs in this range are not certified.',
  ACTIVE_MALFUNCTION: 'An ELD malfunction is active for this driver.',
  ERODS_TEST_MODE: 'eRODS is in test mode — the file will not reach FMCSA.',
  // The backend registry spells this one ERODS_TEST_MODE_ONLY (web/bugs.md WB-001).
  ERODS_TEST_MODE_ONLY: 'eRODS is in test mode — the file will not reach FMCSA.',
  USER_NOT_INVITED: 'This account is not invited to the panel.',
  EMAIL_NOT_VERIFIED: 'Verify your email address first.',
  CONFLICT: 'That value is already in use.',

  // --- generic / transport --------------------------------------------------------------------
  INTERNAL_ERROR: 'Something went wrong on our side. Try again.',
  // Client-side only: `NetworkError` — the request never reached the backend, so no traceId.
  NETWORK_ERROR: 'No connection. Check your network and try again.',
  NOT_IMPLEMENTED: 'This action is not available yet.',
  VALIDATION_FAILED: 'Check the highlighted fields and try again.',
  NOT_FOUND: 'Not found.',
  RATE_LIMITED: 'Too many requests. Wait a moment and try again.',
  PAYLOAD_TOO_LARGE: 'That upload is too large.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Try again shortly.',

  // --- auth / rbac ----------------------------------------------------------------------------
  UNAUTHORIZED: 'Your session has ended. Sign in again.',
  FORBIDDEN: 'You do not have access to this.',
  INVALID_CREDENTIALS: 'Incorrect email or password.',
  TOKEN_EXPIRED: 'Your session has expired.',
  TOKEN_INVALID: 'Your session is no longer valid. Sign in again.',
  REFRESH_TOKEN_REUSED: 'Your session was ended for security reasons. Sign in again.',
  ACCOUNT_LOCKED: 'This account is locked. Contact an administrator.',
  ROLE_IMMUTABLE: 'System roles cannot be changed.',
  API_KEY_INVALID: 'That API key is not valid.',
  API_KEY_REVOKED: 'That API key has been revoked.',
  API_KEY_EXPIRED: 'That API key has expired.',
  DRIVER_CONTEXT_REQUIRED: 'Select a driver first.',

  // --- fleet ----------------------------------------------------------------------------------
  VEHICLE_NOT_FOUND: 'Unit not found.',
  DEVICE_NOT_FOUND: 'Device not found.',
  DEVICE_ALREADY_PAIRED: 'That device is already paired with another unit.',
  VEHICLE_OUT_OF_SERVICE: 'This unit is out of service.',
  ODOMETER_ANOMALY: 'The odometer reading does not match the recorded mileage.',
  ODOMETER_NOT_CALIBRATED: 'Calibrate the odometer for this unit first.',
  IMPORT_FAILED: 'The import could not be completed. Check the file and try again.',

  // --- ingest ---------------------------------------------------------------------------------
  CHECKSUM_MISMATCH: 'The record failed its integrity check.',
  DUPLICATE_EVENT: 'That event has already been recorded.',
  EVENT_SEQUENCE_IMMUTABLE: 'Recorded events cannot be reordered.',
  EVENT_OUT_OF_RANGE: 'That event falls outside the allowed range.',
  BATCH_TOO_LARGE: 'That batch is too large.',
  UNKNOWN_DEVICE: 'This device is not registered.',

  // --- HOS / RODS -----------------------------------------------------------------------------
  LOG_ALREADY_CERTIFIED: 'This log is already certified.',
  EDIT_REQUIRES_DRIVER_APPROVAL: 'The driver must accept this edit before it takes effect.',
  EDIT_ALREADY_RESOLVED: 'This edit request has already been answered.',
  UNIDENTIFIED_ALREADY_ASSIGNED: 'That segment has already been assigned.',
  HOS_ENGINE_VERSION_MISMATCH: 'The log was recalculated. Reload the page.',

  // --- transfers / eRODS ----------------------------------------------------------------------
  TRANSFER_VALIDATION_FAILED: 'The output file failed validation and was not sent.',
  TRANSFER_ENCRYPTION_UNAVAILABLE: 'The transfer cannot be encrypted. Contact support.',
  TRANSFER_NOT_ENCRYPTED: 'The transfer was stopped because it was not encrypted.',
  OUTPUT_FILE_INVALID: 'The output file failed validation and was not sent.',

  // --- DVIR / maintenance ---------------------------------------------------------------------
  DVIR_ALREADY_SIGNED: 'This DVIR is already signed.',
  DEFECT_NOT_RESOLVED: 'Resolve the defect first.',
  WORK_ORDER_CLOSED: 'This work order is closed.',
  DVIR_NOT_FOUND: 'DVIR not found.',
  DEFECT_NOT_FOUND: 'Defect not found.',
  WORK_ORDER_NOT_FOUND: 'Work order not found.',
  MAINTENANCE_SCHEDULE_NOT_FOUND: 'Maintenance schedule not found.',

  // --- notifications / messaging --------------------------------------------------------------
  ALERT_RULE_INVALID: 'This rule is not valid. Check the conditions.',

  // --- sync / realtime ------------------------------------------------------------------------
  SYNC_CONFLICT: 'This record changed elsewhere. Reload and try again.',
  SYNC_CURSOR_INVALID: 'The connection needs to resynchronise. Reload the page.',
  RESUME_WINDOW_EXPIRED: 'The connection was idle too long. Reload the page.',
  SYNC_BATCH_TOO_LARGE: 'That batch is too large.',
  SYNC_UNKNOWN_CHANGE_TYPE: 'This app version is out of date. Reload the page.',

  // --- reports --------------------------------------------------------------------------------
  REPORT_NOT_FOUND: 'Report not found.',
  REPORT_NOT_READY: 'The report is still being generated.',
  REPORT_SCHEDULE_NOT_FOUND: 'Schedule not found.',
  INVALID_CRON_EXPRESSION: 'That schedule expression is not valid.',

  // --- storage / integrations -----------------------------------------------------------------
  FILE_TOO_LARGE: 'That file is too large.',
  UNSUPPORTED_FILE_TYPE: 'That file type is not supported.',
  STORAGE_UNAVAILABLE: 'File storage is temporarily unavailable.',
  WEBHOOK_DELIVERY_FAILED: 'The webhook could not be delivered.',
  INTEGRATION_NOT_CONFIGURED: 'This integration is not configured yet.',
  // --- backend Phase 13 (2026-09-24) ------------------------------------------------------------
  PASSWORD_LOGIN_DISABLED: 'Password sign-in is disabled. Continue with Google.',
  VEHICLE_HAS_OPEN_CRITICAL_DEFECTS: 'This unit has an open critical defect and must stay out of service.',
  DRIVER_DOCUMENT_NOT_FOUND: 'Document not found.',
  CO_DRIVER_PAIRING_NOT_FOUND: 'Co-driver pairing not found or already ended.',
  IMAGE_TOO_SMALL: 'The image must be a PNG or JPG of at least 256 × 256 pixels.',
  ATTACHMENT_NOT_FOUND: 'Attachment not found.',
  TRIP_NOT_FOUND: 'Trip not found.',
  TRAILER_NOT_FOUND: 'Trailer not found.',
  TRIP_NOT_DRAFT: 'Only a draft trip can be published.',
  GEOCODER_NOT_CONFIGURED: 'Address lookup is not configured. Draw the geofence on the map instead.',
  GEOCODE_FAILED: 'That address could not be found. Check it or draw the geofence on the map.',
};

/** §14.3 — unknown code → `Something went wrong. Reference: <traceId>`. */
export function errorMessage(code: string | undefined, traceId = ''): string {
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  return `Something went wrong. Reference: ${traceId}`;
}

/** Network failure / abort — anything that never reached the backend. */
export class NetworkError extends Error {
  readonly status = 0;
  readonly code = 'NETWORK_ERROR';
  constructor(message = 'No connection. Check your network and try again.') {
    super(message);
    this.name = 'NetworkError';
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** The message a toast or banner shows for any thrown value. */
export function toUserMessage(error: unknown): string {
  if (error instanceof ApiError) return error.userMessage;
  if (error instanceof NetworkError) return error.message;
  return errorMessage(undefined, '');
}
