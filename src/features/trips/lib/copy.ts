// owner: web-dispatch-messaging — reasons shown on controls W-11 deliberately disables.

/** `CreateTripPayload.trailerId` exists, but there is no session-wide trailer lookup yet beyond
 * `GET /trailers` itself failing to return any rows — shown only if that call errors. */
export const TRAILER_LOOKUP_ERROR = 'Trailers unavailable — try again.';
