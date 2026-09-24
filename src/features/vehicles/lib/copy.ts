// owner: web-vehicles-drivers — reasons shown on controls this screen deliberately disables.
// Kept out of the page modules so the profile screen does not pull the (lazy) Vehicles route in.

/** Bulk bar — one unit at a time, because that is what `POST /vehicles/:id/assign-driver` does. */
export const MULTI_ASSIGN_REASON = 'Select one unit — a driver is assigned to a single unit.';
/** Row action / profile header — HOS logs are a driver record, so a driverless unit has none. */
export const NO_DRIVER_LOGS_REASON = 'No driver is assigned to this unit.';
