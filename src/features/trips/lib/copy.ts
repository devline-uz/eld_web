// owner: web-dispatch-messaging — reasons shown on controls W-11 deliberately disables.

/** B-74 — `POST /trips/:id/assign` (like `POST /vehicles/:id/assign-driver`) takes no notify
 * flag, so the "Notify the driver" tick has nowhere to go. */
export const NOTIFY_REASON = 'not available yet: the assign endpoint sends no notification.';

/** B-92 — `POST /trips` (`CreateTripPayload`) has no estimated-drive-time
 * field, so the value only drives the on-screen HOS warning and is never saved. */
export const EST_DRIVE_TIME_HINT =
  'Not saved yet — used only for the HOS check below; the create-trip API has no drive-time field.';
