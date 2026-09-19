// owner: web-dashboard-fleet — `GET /geofences` for the W-02 `Geofences` map layer (web/tz.md §10
// W-02: "Geofences qatlami yoqilganda xaritada poligon/doira ko'rinadi"). The create path stays in
// `CreateGeofenceModal`, which already invalidates `qk.geofences()` on success.
import { useQuery } from '@tanstack/react-query';
import { client } from './client';
import { endpoints } from './endpoints';
import { qk } from './queryKeys';
import { typedCachePolicy } from './queryPolicy';
import type { GeofencesListResponse } from './types';
import type { GeofenceGeometrySource } from '@/shared/map/overlays';

/** The documented list row plus the optional geometry fields the map reads when present — the
 * backend's OpenAPI example has no coordinates, so none of them are guaranteed. */
export type GeofenceRow = GeofencesListResponse['items'][number] & GeofenceGeometrySource;

export interface GeofencesResponse {
  items: GeofenceRow[];
}

/** Fetched only while the map layer is on (`enabled`); the 60s `list` policy keeps toggling the
 * layer off and on from refetching every time. */
export function useGeofences({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.geofences(),
    queryFn: ({ signal }) => client.get<GeofencesResponse>(endpoints.geofences.list, { signal }),
    ...typedCachePolicy<GeofencesResponse>('list'),
    enabled,
  });
}
