// owner: web-dispatch-messaging — reasons shown on controls W-11 deliberately disables.
import { formatLocal } from '@/shared/format/datetime';
import type { TripScheduleConflict } from '@/shared/api/trips';

/** `CreateTripPayload.trailerId` exists, but there is no session-wide trailer lookup yet beyond
 * `GET /trailers` itself failing to return any rows — shown only if that call errors. */
export const TRAILER_LOOKUP_ERROR = 'Trailers unavailable — try again.';

/** 409 `TRIP_SCHEDULE_CONFLICT`, in the browser zone — the same zone the modal's
 * `datetime-local` windows and the board's dates use. */
export function scheduleConflictMessage(c: TripScheduleConflict): string {
  const unit = c.unitNumber ? `Unit ${c.unitNumber}` : 'This unit';
  const range = c.end
    ? `from ${formatLocal(c.start, 'dateTime')} to ${formatLocal(c.end, 'dateTime')}`
    : `from ${formatLocal(c.start, 'dateTime')} onward (no planned end)`;
  // e.g. `Unit 1 is already assigned to another trip (TRP-500) from Oct 10, 12:00 to Oct 20, 12:00.`
  return `${unit} is already assigned to another trip (${c.number}) ${range}.`;
}

/** Short pointer shown under the pickup window next to the full message on the Unit field. */
export const scheduleConflictWindowHint = (c: TripScheduleConflict): string => `Overlaps trip ${c.number} on this unit.`;

/** 409 `CONFLICT` on `POST /trips` — shown under the "Trip / load ID" input. */
export const TRIP_NUMBER_TAKEN = 'A trip with this ID already exists.';
