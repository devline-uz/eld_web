// owner: web-dispatch-messaging — reasons shown on controls W-11 deliberately disables.
import { formatInTz } from '@/shared/format/datetime';
import { ERROR_MESSAGES } from '@/shared/api/errors';
import type { TripScheduleConflict } from '@/shared/api/trips';

/** `CreateTripPayload.trailerId` exists, but there is no session-wide trailer lookup yet beyond
 * `GET /trailers` itself failing to return any rows — shown only if that call errors. */
export const TRAILER_LOOKUP_ERROR = 'Trailers unavailable — try again.';

/** 409 `TRIP_SCHEDULE_CONFLICT`, in the carrier zone — the same zone the modal's
 * `datetime-local` windows and the board's dates use (LIVE-007). */
export function scheduleConflictMessage(c: TripScheduleConflict, timeZone: string): string {
  const unit =
    c.resource === 'driver'
      ? c.driverName ? `Driver ${c.driverName}` : 'This driver'
      : c.resource === 'trailer'
        ? c.trailerNumber ? `Trailer ${c.trailerNumber}` : 'This trailer'
        : c.unitNumber ? `Unit ${c.unitNumber}` : 'This unit';
  const range = c.end
    ? `from ${formatInTz(c.start, timeZone, 'dateTime')} to ${formatInTz(c.end, timeZone, 'dateTime')}`
    : `from ${formatInTz(c.start, timeZone, 'dateTime')} onward (no planned end)`;
  // e.g. `Unit 1 is already assigned to another trip (TRP-500) from Oct 10, 12:00 to Oct 20, 12:00.`
  return `${unit} is already assigned to another trip (${c.number}) ${range}.`;
}

/** Create-trip field the full 409 message belongs under. */
export const scheduleConflictField = (c: TripScheduleConflict): 'vehicleId' | 'driverId' | 'trailerId' =>
  c.resource === 'driver' ? 'driverId' : c.resource === 'trailer' ? 'trailerId' : 'vehicleId';

/** Short pointer shown under the pickup window next to the full message on the Unit field. */
export const scheduleConflictWindowHint = (c: TripScheduleConflict): string => `Overlaps trip ${c.number} on this ${c.resource === 'vehicle' ? 'unit' : c.resource}.`;

/** 409 `CONFLICT` on `POST /trips` — shown under the "Trip / load ID" input. */
/** QA FE-008 — a typed address with no coordinates saved a trip whose route could never be drawn. */
export const PICK_PLACE_MESSAGE = 'Choose a place from the suggestions so the route can be drawn.';
export const TRIP_NUMBER_TAKEN = 'A trip with this ID already exists.';

/* ------------------------------------------------------------------- Edit / Delete trip */

/** Row-menu `title` on the disabled `Edit trip` item and the 409 `TRIP_NOT_EDITABLE` toast. */
export const TRIP_NOT_EDITABLE = ERROR_MESSAGES.TRIP_NOT_EDITABLE as string;
/** Row-menu `title` on the disabled `Delete trip` item and the 409 `TRIP_IN_PROGRESS` toast. */
export const TRIP_IN_PROGRESS = ERROR_MESSAGES.TRIP_IN_PROGRESS as string;
/** 404 from `PATCH` / `DELETE /trips/:id` — someone else removed it first. */
/** FE-14 — fallback for a 409 status conflict without a server message (the server's own
 * "This trip was changed by someone else (it is now …). Refresh and try again." is shown first). */
export const TRIP_CHANGED_CONCURRENTLY = 'This trip was changed by someone else. Reload and try again.';
export const TRIP_NOT_FOUND = 'This trip no longer exists. The list has been refreshed.';
/** `PATCH` cannot null a number or a date (`UpdateTripDto` has no nullable fields). */
export const TRIP_FIELD_NOT_CLEARABLE = 'This value can be changed but not cleared.';
export const tripUpdatedToast = (number: string): string => `Trip ${number} updated`;
export const tripDeletedToast = (number: string): string => `Trip ${number} deleted`;
export const deleteTripTitle = (number: string): string => `Delete trip ${number}?`;
/** §5.9 destructive confirm — says the delete is permanent and nothing survives it. */
export const DELETE_TRIP_DESCRIPTION =
  'This permanently deletes the trip and its stops. It cannot be undone, and the trip will not be kept for history or reports.';

/* --------------------------------------------- Start / Mark delivered / Cancel (QA LIVE-003) */

export const tripStartedToast = (number: string): string => `Trip ${number} started`;
export const tripDeliveredToast = (number: string): string => `Trip ${number} marked delivered`;
export const tripCancelledToast = (number: string): string => `Trip ${number} cancelled`;
export const cancelTripTitle = (number: string): string => `Cancel trip ${number}?`;
/** §5.9 destructive confirm — unlike Delete, the trip is kept (Completed segment, `Cancelled` filter). */
export const CANCEL_TRIP_DESCRIPTION =
  'The trip is kept for history (filter Completed by “Cancelled”) and its driver, unit and trailer are freed for other trips. A cancelled trip cannot be reopened or edited.';
export const DELIVERED_AT_INVALID = 'Enter a valid date and time.';
export const DELIVERED_AT_FUTURE = 'Delivery time cannot be in the future.';
export const DELIVERED_AT_BEFORE_START = 'Delivery time cannot be before the trip started.';
