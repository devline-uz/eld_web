// owner: web-dashboard-fleet — `GET /geofences` for the W-02 `Geofences` map layer (web/tz.md §10
// W-02: "Geofences qatlami yoqilganda xaritada poligon/doira ko'rinadi"). The create path stays in
// `CreateGeofenceModal`, which already invalidates `qk.geofences()` on success.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

/* --------------------------------------------------------------------- Phase 13 (2026-09-24) */

/** `ADDRESS` (B-93) is geocoded server-side; with no geocoder configured the API answers
 * `422 GEOCODER_NOT_CONFIGURED` — surface it, never fall back to a client-side guess. */
export type GeofenceType = 'CIRCLE' | 'POLYGON' | 'ADDRESS';

/** `CreateGeofenceDto`. The radius is `radiusMi` (miles). The backend also accepts `radiusMeters`
 * as a pure ALIAS of `radiusMi` — same number, no conversion (D-098) — so new code sends `radiusMi`. */
export interface GeofencePayload {
  name: string;
  type?: GeofenceType;
  centerLat?: number;
  centerLon?: number;
  radiusMi?: number;
  polygon?: Array<{ lat: number; lon: number }>;
  address?: string;
  category?: string;
  alertOnEnter?: boolean;
  alertOnExit?: boolean;
  /** B-15 — alert when a unit stays inside longer than this. `null` on PATCH clears it. */
  dwellMinutes?: number | null;
  /** B-15 — only alert outside 06:00–20:00 local (backend D-098). */
  afterHoursOnly?: boolean;
  enabled?: boolean;
}

export function useCreateGeofence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GeofencePayload) => client.post<GeofenceRow>(endpoints.geofences.create, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.geofences() }),
  });
}

export function useUpdateGeofence(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Omit<GeofencePayload, 'type'>>) =>
      client.patch<GeofenceRow>(endpoints.geofences.update(id), payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.geofences() }),
  });
}
