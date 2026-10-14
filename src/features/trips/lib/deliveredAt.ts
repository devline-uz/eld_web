// QA LIVE-003 — the delivery time the dispatcher records with "Mark delivered" (`datetime-local`,
// carrier zone — the same zone as the Create trip windows and the board, LIVE-007): never in the
// future, never before the start.
import type { TripRow } from '@/shared/api/trips';
import { parseZonedInput, toZonedInput } from './zonedInput';
import { DELIVERED_AT_BEFORE_START, DELIVERED_AT_FUTURE, DELIVERED_AT_INVALID } from './copy';

/** Clock skew the backend allows on a delivery time (trips.service.ts `COMPLETED_AT_SKEW_MS`). */
const SKEW_MS = 2 * 60_000;

export const toLocalInput = (d: Date, timeZone: string): string => toZonedInput(d, timeZone);

/** The `datetime-local` value (wall time in `timeZone`) as an instant; `null` when blank or not a real date. */
export function parseLocalInput(value: string, timeZone: string): Date | null {
  return parseZonedInput(value, timeZone);
}

/** Why `deliveredAt` cannot be sent, or `null` when it can. */
export function deliveredAtError(
  value: string,
  trip: Pick<TripRow, 'startedAt'>,
  timeZone: string,
  now: number = Date.now(),
): string | null {
  const at = parseLocalInput(value, timeZone);
  if (!at) return DELIVERED_AT_INVALID;
  if (at.getTime() > now + SKEW_MS) return DELIVERED_AT_FUTURE;
  // The input has minute precision: compare against the start truncated to its minute.
  const started = trip.startedAt ? Date.parse(trip.startedAt) : NaN;
  if (Number.isFinite(started) && at.getTime() < Math.floor(started / 60_000) * 60_000) return DELIVERED_AT_BEFORE_START;
  return null;
}
