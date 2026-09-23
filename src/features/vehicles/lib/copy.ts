// owner: web-vehicles-drivers — reasons shown on controls this screen deliberately disables.
// Kept out of the page modules so the profile screen does not pull the (lazy) Vehicles route in.

/** Bulk bar — one unit at a time, because that is what `POST /vehicles/:id/assign-driver` does. */
export const MULTI_ASSIGN_REASON = 'Select one unit — a driver is assigned to a single unit.';
/** Row action / profile header — HOS logs are a driver record, so a driverless unit has none. */
export const NO_DRIVER_LOGS_REASON = 'No driver is assigned to this unit.';

/** B-74 — neither `POST /vehicles/:id/assign-driver` nor `POST /trips/:id/assign` takes a
 * notify flag, so the "Notify the driver" tick has nowhere to go. */
export const NOTIFY_REASON = 'not available yet: the assign endpoint sends no notification.';

/** B-4 — there is no histories endpoint (and no per-point track) on the real backend, so there
 * is nothing to animate: Route replay's Play control is disabled and says why. */
export const REPLAY_UNAVAILABLE_REASON =
  'Route replay is not available yet: the backend has no unit-histories track to play back (B-4).';
