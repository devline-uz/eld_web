// owner: web-api-client — session-wide reference lookups (WD-073, perf plan item 2).
//
// The list endpoints answer with raw Prisma rows (`driverId`/`vehicleId` only — B-35/B-36), so the
// DRIVER / UNIT / ELD SERIAL columns on Vehicles, Trips and DVIR are client-side joins. Those joins
// used to be fetched by every screen, sequentially, page after page. This module is the single
// place that owns them: one `reference`-cached (10 min) query per resource, shared by every
// screen and every modal, with the pages above the API maximum fetched in parallel
// (`client.list`). A screen never re-fetches a lookup per page — it reads the map.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from './client';
import { endpoints } from './endpoints';
import { qk } from './queryKeys';
import { pagePolicy, type PageQueryOptions } from './paging';
import { withoutDeletedVehicles } from './deletedVehicles';
import type { OffsetPage } from './types';
import type { DeviceRow, DriverRow, VehicleRow } from './vehicles';

/** Fleet-sized resources — walked in 200-row pages, parallel after the first (WB-030 / WD-073). */
export const LOOKUP_LIMIT = 500;

/** Rows a filtered fallback (`useWindowedPage`) may load before it gives up on exactness — the
 * backend has no server params for most 11.23 drawer groups (B-54/B-59/B-60); matches outside
 * this newest-first window are not shown, as recorded per gap. */
export const FILTER_WINDOW = 1000;

export const driversLookupQuery = (): PageQueryOptions<DriverRow> => ({
  queryKey: qk.drivers({ limit: LOOKUP_LIMIT }),
  queryFn: ({ signal }) => client.list<DriverRow>(endpoints.drivers.list, { limit: LOOKUP_LIMIT }, { signal }),
  ...pagePolicy('reference'),
});

export const vehiclesLookupQuery = (): PageQueryOptions<VehicleRow> => ({
  queryKey: qk.vehicles({ limit: LOOKUP_LIMIT }),
  queryFn: async ({ signal, client: queryClient }) =>
    withoutDeletedVehicles(await client.list<VehicleRow>(endpoints.vehicles.list, { limit: LOOKUP_LIMIT }, { signal }), queryClient),
  ...pagePolicy('reference'),
});

export const devicesLookupQuery = (): PageQueryOptions<DeviceRow> => ({
  queryKey: qk.devices({ limit: LOOKUP_LIMIT }),
  queryFn: ({ signal }) => client.list<DeviceRow>(endpoints.devices.list, { limit: LOOKUP_LIMIT }, { signal }),
  ...pagePolicy('reference'),
});

export function useDriversLookup(enabled = true) {
  return useQuery({ ...driversLookupQuery(), enabled });
}
export function useVehiclesLookup(enabled = true) {
  return useQuery({ ...vehiclesLookupQuery(), enabled });
}
export function useDevicesLookup(enabled = true) {
  return useQuery({ ...devicesLookupQuery(), enabled });
}

function byId<T extends { id: string }>(page: OffsetPage<T> | undefined): Map<string, T> {
  return new Map((page?.items ?? []).map((row) => [row.id, row]));
}

/** `Map<driverId, DriverRow>` — memoised on the cached page, so a re-render costs nothing. */
export function useDriverMap(enabled = true) {
  const query = useDriversLookup(enabled);
  const map = useMemo(() => byId(query.data), [query.data]);
  return { map, query };
}

export function useVehicleMap(enabled = true) {
  const query = useVehiclesLookup(enabled);
  const map = useMemo(() => byId(query.data), [query.data]);
  return { map, query };
}
