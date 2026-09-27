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
import type { OffsetPage } from './types';

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
  // The live `GET /trailers` returns a bare array (`data: []`), not the `{ items }` page its
  // OpenAPI example shows — `client.list` then rejected every response and the Create trip picker
  // always read "Trailers unavailable — try again." Accept both shapes.
  queryFn: async ({ signal }) => {
    const body = await client.get<TrailerRow[] | OffsetPage<TrailerRow>>(endpoints.trailers.list, { signal });
    const items = Array.isArray(body) ? body : (body?.items ?? []);
    return { items, page: 1, limit: items.length, total: items.length, totalPages: 1 };
  },
  ...pagePolicy('reference'),
});

export function useTrailersLookup() {
  return useQuery(trailersLookupQuery());
}
