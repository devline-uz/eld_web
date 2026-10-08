// owner: web-dispatch-messaging — reasons shown on controls W-11 deliberately disables.
import { formatLocal } from '@/shared/format/datetime';
import { ERROR_MESSAGES } from '@/shared/api/errors';
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

/* ------------------------------------------------------------------- Edit / Delete trip */

/** Row-menu `title` on the disabled `Edit trip` item and the 409 `TRIP_NOT_EDITABLE` toast. */
export const TRIP_NOT_EDITABLE = ERROR_MESSAGES.TRIP_NOT_EDITABLE as string;
/** Row-menu `title` on the disabled `Delete trip` item and the 409 `TRIP_IN_PROGRESS` toast. */
export const TRIP_IN_PROGRESS = ERROR_MESSAGES.TRIP_IN_PROGRESS as string;
/** 404 from `PATCH` / `DELETE /trips/:id` — someone else removed it first. */
export const TRIP_NOT_FOUND = 'This trip no longer exists. The list has been refreshed.';
/** `PATCH` cannot null a number or a date (`UpdateTripDto` has no nullable fields). */
export const TRIP_FIELD_NOT_CLEARABLE = 'This value can be changed but not cleared.';
export const tripUpdatedToast = (number: string): string => `Trip ${number} updated`;
export const tripDeletedToast = (number: string): string => `Trip ${number} deleted`;
export const deleteTripTitle = (number: string): string => `Delete trip ${number}?`;
/** §5.9 destructive confirm — says the delete is permanent and nothing survives it. */
export const DELETE_TRIP_DESCRIPTION =
  'This permanently deletes the trip and its stops. It cannot be undone, and the trip will not be kept for history or reports.';
