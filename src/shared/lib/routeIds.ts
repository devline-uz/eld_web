import { isApiError } from '@/shared/api/errors';

// LIVE-019 — record pages take their id from the URL. A malformed id is never sent to the API
// (it would 422/404 and look like an outage), and a 404 is shown as "not found", not "retry".
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** The id to query with, or `undefined` (query disabled) when the URL id is not a UUID. */
export function validRouteId(value: string | null | undefined): string | undefined {
  return isUuid(value) ? value : undefined;
}

export function isNotFoundError(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}
