// Route Preview data (W-11): resolves the pickup/delivery coordinates — plus any intermediate stops,
// in route order — and a road route through them. Coordinates come from the stop's own
// latitude/longitude; trips created from the panel may carry none, so the stop's address/name is
// geocoded through the shared MapTiler helper (needs VITE_MAP_API_KEY). Road geometry comes from OSRM
// (`ROUTING_BASE_URL`) with the intermediate stops as waypoints; when routing fails the caller gets
// `line: null` + `approximate` and draws straight segments.
import { useQueries, useQuery } from '@tanstack/react-query';
import { ROUTING_BASE_URL } from '@/shared/api/endpoints';
import { qk } from '@/shared/api/queryKeys';
import { geocodingEnabled, searchPlaces } from '@/shared/map/geocode';
import type { LatLon } from '@/shared/map/overlays';
import type { TripStopRow } from '@/shared/api/trips';

/** What the preview reads from a stop — a saved `TripStopRow` or a stop still in the Create trip form. */
export type RouteStop = Pick<TripStopRow, 'name' | 'address' | 'latitude' | 'longitude'>;

export function validLatLon(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon) &&
    !(lat === 0 && lon === 0) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
  );
}

const routeRank = (type: TripStopRow['type']): number => (type === 'PICKUP' ? 0 : type === 'DELIVERY' ? 2 : 1);

/** Route order of a saved trip's stops: the pickup always first, the delivery always last, every
 * other stop between them by `sequence`. */
export function orderTripStops<T extends Pick<TripStopRow, 'type' | 'sequence'>>(stops: readonly T[]): T[] {
  return [...stops].sort((a, b) => routeRank(a.type) - routeRank(b.type) || a.sequence - b.sequence);
}

/** The stops between the pickup and the delivery, in route order. */
export function intermediateTripStops<T extends Pick<TripStopRow, 'type' | 'sequence'>>(stops: readonly T[]): T[] {
  return orderTripStops(stops).filter((s) => routeRank(s.type) === 1);
}

function stopPoint(stop: RouteStop | null): LatLon | null {
  return stop && validLatLon(stop.latitude, stop.longitude) ? { lat: stop.latitude as number, lon: stop.longitude as number } : null;
}

const coordsKey = (points: readonly LatLon[]): string => points.map((p) => `${p.lon},${p.lat}`).join(';');

/** OSRM road route through `points` in order (pickup, waypoints…, delivery) as [lon, lat] pairs. */
export async function fetchRoadRoute(points: readonly LatLon[], signal?: AbortSignal): Promise<[number, number][]> {
  const url = `${ROUTING_BASE_URL}/route/v1/driving/${coordsKey(points)}?overview=full&geometries=geojson`;
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
  | {
      status: 'ready';
      pickup: LatLon;
      delivery: LatLon;
      /** Intermediate stops that could be placed, in route order; unplaceable ones are skipped. */
      waypoints: LatLon[];
      line: [number, number][] | null;
      approximate: boolean;
      routing: boolean;
    };

const NO_WAYPOINTS: readonly RouteStop[] = [];

export function useTripRoute(
  pickup: RouteStop | null,
  delivery: RouteStop | null,
  waypoints: readonly RouteStop[] = NO_WAYPOINTS,
): TripRouteState {
  const stops = [pickup, ...waypoints, delivery];
  const direct = stops.map(stopPoint);
  // Stops without coordinates are geocoded by address/name — one query per distinct text, so two
  // stops with the same name never register duplicate queries.
  const texts = stops.map((stop, i) => (direct[i] || !stop ? '' : (stop.address || stop.name || '').trim()));
  const lookups = geocodingEnabled ? [...new Set(texts.filter(Boolean))] : [];
  const geocoded = useQueries({
    queries: lookups.map((query) => ({
      queryKey: qk.tripGeocode(query),
      queryFn: async ({ signal }: { signal: AbortSignal }) => (await searchPlaces(query, signal))[0] ?? null,
      staleTime: Infinity,
      retry: false,
    })),
  });
  const points = direct.map((d, i) => {
    if (d) return d;
    const g = geocoded[lookups.indexOf(texts[i]!)]?.data;
    return g ? { lat: g.lat, lon: g.lon } : null;
  });
  const a = points[0] ?? null;
  const b = points[points.length - 1] ?? null;
  const mid = points.slice(1, -1).filter((p): p is LatLon => p !== null);
  const route = useQuery({
    queryKey: qk.tripRoute(a && b ? coordsKey([a, ...mid, b]) : ''),
    queryFn: ({ signal }) => fetchRoadRoute([a!, ...mid, b!], signal),
    enabled: Boolean(a && b),
    staleTime: Infinity,
    retry: 1,
  });

  if (!pickup || !delivery) return { status: 'no-location' };
  const pending = geocoded.some((q) => q.isFetching);
  if (pending) return { status: 'loading' };
  if (!a || !b) return { status: 'no-location' };
  if (route.isPending && route.fetchStatus !== 'idle') {
    return { status: 'ready', pickup: a, delivery: b, waypoints: mid, line: null, approximate: true, routing: true };
  }
  return { status: 'ready', pickup: a, delivery: b, waypoints: mid, line: route.data ?? null, approximate: !route.data, routing: false };
}
