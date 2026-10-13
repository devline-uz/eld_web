// owner: web-vehicles-drivers — reasons shown on controls this screen deliberately disables.
// Kept out of the page modules so the profile screen does not pull the (lazy) Vehicles route in.

/** Bulk bar — one unit at a time, because that is what `POST /vehicles/:id/assign-driver` does. */
export const MULTI_ASSIGN_REASON = 'Select one unit — a driver is assigned to a single unit.';
/** Row action / profile header — HOS logs are a driver record, so a driverless unit has none. */
export const NO_DRIVER_LOGS_REASON = 'No driver is assigned to this unit.';
/** Row action — a co-driver is paired with the unit's primary driver, so a driverless unit has none. */
export const NO_PRIMARY_DRIVER_CO_DRIVER_REASON = 'Assign a primary driver before adding a co-driver.';
