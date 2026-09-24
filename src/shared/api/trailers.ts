// owner: web-dispatch-messaging — 11.10 Create trip `Trailer` picker only.
//
// `GET /trailers` is a real, session-wide reference list (fleet-sized, like `/drivers` and
// `/vehicles` in `shared/api/lookups.ts`) — this module is the minimal client-side lookup the
// Create trip modal needs for the trailer picker (`trailerId` on `CreateTripPayload`, B-73). It
// intentionally does not duplicate the full Trailers CRUD surface that `features/vehicles`
// (or a future `features/trailers`) owns.
import { useQuery } from '@tanstack/react-query';
import { client } from './client';
import { endpoints } from './endpoints';
import { qk } from './queryKeys';
import { pagePolicy, type PageQueryOptions } from './paging';

/** The real, raw `Trailer` row (`GET /trailers` — `TrailersListResponse`). */
export interface TrailerRow {
  id: string;
  number: string;
  vin: string;
  licensePlate: string | null;
  licenseState: string | null;
}

/** Fleet-sized, `reference`-cached like `driversLookupQuery`/`vehiclesLookupQuery` (WD-073). */
export const TRAILERS_LOOKUP_LIMIT = 500;

export const trailersLookupQuery = (): PageQueryOptions<TrailerRow> => ({
  queryKey: qk.trailers({ limit: TRAILERS_LOOKUP_LIMIT }),
  queryFn: ({ signal }) => client.list<TrailerRow>(endpoints.trailers.list, { limit: TRAILERS_LOOKUP_LIMIT }, { signal }),
  ...pagePolicy('reference'),
});

export function useTrailersLookup() {
  return useQuery(trailersLookupQuery());
}
