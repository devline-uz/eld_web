// owner: web-dashboard-fleet — reasons shown on W-02 controls that are deliberately disabled.

/** A unit with no driver has no RODS to open — `View logs` is disabled with this reason. */
export const VIEW_LOGS_NO_DRIVER = 'No driver assigned — there are no logs to open.';

/** B-93 — `POST /geofences` takes `type: 'CIRCLE' | 'POLYGON'` only;
 * there is no address-based shape (and no geocoder behind it), so `Address` is disabled. */
export const GEOFENCE_ADDRESS_SHAPE_REASON =
  'Address shape is not available yet — the geofence API accepts only circle or polygon shapes.';
