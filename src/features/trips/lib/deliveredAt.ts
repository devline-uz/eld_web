// QA LIVE-003 — the delivery time the dispatcher records with "Mark delivered" (`datetime-local`,
// browser zone — the same zone as the Create trip windows): never in the future, never before the start.
import { format } from 'date-fns';
import type { TripRow } from '@/shared/api/trips';
import { DELIVERED_AT_BEFORE_START, DELIVERED_AT_FUTURE, DELIVERED_AT_INVALID } from './copy';

/** Clock skew the backend allows on a delivery time (trips.service.ts `COMPLETED_AT_SKEW_MS`). */
const SKEW_MS = 2 * 60_000;

export const toLocalInput = (d: Date): string => format(d, "yyyy-MM-dd'T'HH:mm");

/** The `datetime-local` value (browser zone) as an instant; `null` when blank or not a real date. */
export function parseLocalInput(value: string): Date | null {
  if (!value) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** Why `deliveredAt` cannot be sent, or `null` when it can. */
export function deliveredAtError(
  value: string,
  trip: Pick<TripRow, 'startedAt'>,
  now: number = Date.now(),
): string | null {
  const at = parseLocalInput(value);
  if (!at) return DELIVERED_AT_INVALID;
  if (at.getTime() > now + SKEW_MS) return DELIVERED_AT_FUTURE;
  // The input has minute precision: compare against the start truncated to its minute.
  const started = trip.startedAt ? Date.parse(trip.startedAt) : NaN;
  if (Number.isFinite(started) && at.getTime() < Math.floor(started / 60_000) * 60_000) return DELIVERED_AT_BEFORE_START;
  return null;
}
