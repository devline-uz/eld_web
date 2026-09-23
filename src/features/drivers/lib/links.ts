// owner: web-vehicles-drivers — deep links out of W-06/W-07 into screens owned by other features.
//
// WB-180: the driver screens used to link with `?driverId=…`, which only `/hos-logs` and
// `/messages` read. `/trips` filters on `fDriver` (a comma list — `features/trips/lib/filters.ts`
// `PARAM.driverId`), so every "Assign trip" / "Trips" link landed on an unfiltered board. The param
// name is written out here rather than imported: `features/*` may not import another `features/*`.
export function tripsHrefForDriver(driverId: string): string {
  return `/trips?${new URLSearchParams({ fDriver: driverId }).toString()}`;
}

/**
 * `/dvir` has no per-driver filter at all — not a URL param, not a drawer group, not a search that
 * matches a driver (`Search unit, defect…`); `GET /dvir` has no `driverId` either (gap B-80). The
 * link therefore goes to the plain screen and the caller says so, instead of carrying a param that
 * silently does nothing.
 */
export const DVIR_HREF = '/dvir';
