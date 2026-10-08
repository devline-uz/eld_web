// Route Preview data (W-11): resolves the selected trip's pickup/delivery coordinates and a road
// route between them. Coordinates come from the stop's own latitude/longitude; trips created from the
// panel carry none, so the stop's address/name is geocoded through the shared MapTiler helper (needs
// VITE_MAP_API_KEY). Road geometry comes from OSRM (`ROUTING_BASE_URL`); when routing fails the caller
// gets `line: null` + `approximate` and draws a straight segment.
import { useQueries, useQuery } from '@tanstack/react-query';
import { ROUTING_BASE_URL } from '@/shared/api/endpoints';
import { qk } from '@/shared/api/queryKeys';
import { geocodingEnabled, searchPlaces } from '@/shared/map/geocode';
import type { LatLon } from '@/shared/map/overlays';
import type { TripStopRow } from '@/shared/api/trips';

export function validLatLon(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon) &&
    !(lat === 0 && lon === 0) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
  );
}

function stopPoint(stop: TripStopRow | null): LatLon | null {
  return stop && validLatLon(stop.latitude, stop.longitude) ? { lat: stop.latitude as number, lon: stop.longitude as number } : null;
}

export async function fetchRoadRoute(a: LatLon, b: LatLon, signal?: AbortSignal): Promise<[number, number][]> {
  const url = `${ROUTING_BASE_URL}/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);
  const body = (await res.json()) as { code?: string; routes?: { geometry?: { coordinates?: [number, number][] } }[] };
  const coords = body.routes?.[0]?.geometry?.coordinates;
  if (body.code !== 'Ok' || !coords || coords.length < 2) throw new Error('No route found');
  return coords;
}

export type TripRouteState =
  | { status: 'loading' }
  | { status: 'no-location' } // pickup/delivery missing or no coordinates and nothing to geocode
  | { status: 'ready'; pickup: LatLon; delivery: LatLon; line: [number, number][] | null; approximate: boolean; routing: boolean };

export function useTripRoute(pickup: TripStopRow | null, delivery: TripStopRow | null): TripRouteState {
  const direct = [stopPoint(pickup), stopPoint(delivery)];
  const stops = [pickup, delivery];
  const geocoded = useQueries({
    queries: stops.map((stop, i) => {
      const query = (stop?.address || stop?.name || '').trim();
      return {
        queryKey: qk.tripGeocode(query),
        queryFn: async ({ signal }: { signal: AbortSignal }) => (await searchPlaces(query, signal))[0] ?? null,
        enabled: !direct[i] && Boolean(stop) && geocodingEnabled && query.length > 0,
        staleTime: Infinity,
        retry: false,
      };
    }),
  });
  const points = direct.map((d, i) => {
    if (d) return d;
    const g = geocoded[i]?.data;
    return g ? { lat: g.lat, lon: g.lon } : null;
  });
  const [a, b] = points;
  const route = useQuery({
    queryKey: qk.tripRoute(a && b ? `${a.lon},${a.lat};${b.lon},${b.lat}` : ''),
    queryFn: ({ signal }) => fetchRoadRoute(a!, b!, signal),
    enabled: Boolean(a && b),
    staleTime: Infinity,
    retry: 1,
  });

  if (!pickup || !delivery) return { status: 'no-location' };
  const pending = geocoded.some((q, i) => !direct[i] && q.isFetching);
  if (pending) return { status: 'loading' };
  if (!a || !b) return { status: 'no-location' };
  if (route.isPending && route.fetchStatus !== 'idle') return { status: 'ready', pickup: a, delivery: b, line: null, approximate: true, routing: true };
  return { status: 'ready', pickup: a, delivery: b, line: route.data ?? null, approximate: !route.data, routing: false };
}
