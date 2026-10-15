// Route Preview data (W-11): resolves the pickup/delivery coordinates — plus any intermediate stops,
// in route order — and a road route through them. Coordinates come from the stop's own
// latitude/longitude; trips created from the panel may carry none, so the stop's address/name is
// geocoded through the shared MapTiler helper (needs VITE_MAP_API_KEY). Road geometry comes from OSRM
// (`ROUTING_BASE_URL`) with the intermediate stops as waypoints; when routing fails — or no router is
// configured (`routingConfigured: false`, CODE-057) — the caller gets `line: null` + `approximate` and
// draws straight segments.
import { useQueries, useQuery } from '@tanstack/react-query';
import { ROUTING_BASE_URL } from '@/shared/api/endpoints';
import { qk } from '@/shared/api/queryKeys';
import { geocodingEnabled, searchPlaces } from '@/shared/map/geocode';
import type { LatLon } from '@/shared/map/overlays';
import { tripRouteEnds, type TripStopRow } from '@/shared/api/trips';

/** What the preview reads from a stop — a saved `TripStopRow` or a stop still in the Create trip form. */
export type RouteStop = Pick<TripStopRow, 'name' | 'address' | 'latitude' | 'longitude'>;

export function validLatLon(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon) &&
    !(lat === 0 && lon === 0) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
  );
}

/** Route order of a saved trip's stops: the route's pickup (first PICKUP) first, its delivery (last
 * DELIVERY) last, every other stop — further pickups and drops included (CODE-051) — between them
 * by `sequence`. */
export function orderTripStops<T extends Pick<TripStopRow, 'type' | 'sequence'>>(stops: readonly T[]): T[] {
  const { pickup, delivery } = tripRouteEnds(stops);
  const middle = [...stops].filter((s) => s !== pickup && s !== delivery).sort((a, b) => a.sequence - b.sequence);
  return [...(pickup ? [pickup] : []), ...middle, ...(delivery ? [delivery] : [])];
}

/** The stops between the route's pickup and its delivery, in route order (the waypoints). */
export function intermediateTripStops<T extends Pick<TripStopRow, 'type' | 'sequence'>>(stops: readonly T[]): T[] {
  const { pickup, delivery } = tripRouteEnds(stops);
  return orderTripStops(stops).filter((s) => s !== pickup && s !== delivery);
}

/** FE-15 — a stop's scheduled time on the board. The route's pickup / delivery show the trip's own
 * window (`plannedStartAt` / `plannedEndAt`): create copies the window into those two stops, but
 * `PATCH /trips/:id` cannot change stop times (backend gap), so after an edit of the window the
 * stops' `scheduledAt` is stale while the window is current. Other stops keep their `scheduledAt`. */
export function stopScheduledAt<T extends Pick<TripStopRow, 'type' | 'sequence' | 'scheduledAt'>>(
  trip: { stops: readonly T[]; plannedStartAt?: string | null; plannedEndAt?: string | null },
  stop: T,
): string | null {
  const { pickup, delivery } = tripRouteEnds(trip.stops);
  if (stop === pickup && trip.plannedStartAt) return trip.plannedStartAt;
  if (stop === delivery && trip.plannedEndAt) return trip.plannedEndAt;
  return stop.scheduledAt;
}

function stopPoint(stop: RouteStop | null): LatLon | null {
  return stop && validLatLon(stop.latitude, stop.longitude) ? { lat: stop.latitude as number, lon: stop.longitude as number } : null;
}

const coordsKey = (points: readonly LatLon[]): string => points.map((p) => `${p.lon},${p.lat}`).join(';');

/** A road route: its geometry plus OSRM's length and drive time (LIVE-029). */
export interface RoadRoute {
  coordinates: [number, number][];
  /** Metres; `null` when the router did not say. */
  distanceM: number | null;
  /** Seconds; `null` when the router did not say. */
  durationS: number | null;
}

const METERS_PER_MILE = 1609.344;
export const metersToMiles = (m: number): number => Math.round((m / METERS_PER_MILE) * 10) / 10;

/** OSRM road route through `points` in order (pickup, waypoints…, delivery). */
export async function fetchRoadRouteSummary(
  points: readonly LatLon[],
  signal?: AbortSignal,
  base: string | null = ROUTING_BASE_URL,
): Promise<RoadRoute> {
  if (!base) throw new Error('Road routing is not configured');
  const url = `${base}/route/v1/driving/${coordsKey(points)}?overview=full&geometries=geojson`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);
  const body = (await res.json()) as {
    code?: string;
    routes?: { geometry?: { coordinates?: [number, number][] }; distance?: number; duration?: number }[];
  };
  const first = body.routes?.[0];
  const coords = first?.geometry?.coordinates;
  if (body.code !== 'Ok' || !coords || coords.length < 2) throw new Error('No route found');
  const finite = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
  return { coordinates: coords, distanceM: finite(first?.distance), durationS: finite(first?.duration) };
}

/** OSRM road route through `points` in order (pickup, waypoints…, delivery) as [lon, lat] pairs. */
export async function fetchRoadRoute(
  points: readonly LatLon[],
  signal?: AbortSignal,
  base: string | null = ROUTING_BASE_URL,
): Promise<[number, number][]> {
  return (await fetchRoadRouteSummary(points, signal, base)).coordinates;
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
      /** CODE-057 — false when the build has no router (`VITE_ROUTING_URL` unset in production). */
      routingConfigured: boolean;
      /** LIVE-029 — the road route's length (mi) and drive time (s); `null` without a road route. */
      distanceMi: number | null;
      durationSec: number | null;
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
    queryFn: ({ signal }) => fetchRoadRouteSummary([a!, ...mid, b!], signal),
    enabled: Boolean(a && b && ROUTING_BASE_URL),
    staleTime: Infinity,
    retry: 1,
  });

  if (!pickup || !delivery) return { status: 'no-location' };
  const pending = geocoded.some((q) => q.isFetching);
  if (pending) return { status: 'loading' };
  if (!a || !b) return { status: 'no-location' };
  const routingConfigured = ROUTING_BASE_URL !== null;
  if (route.isPending && route.fetchStatus !== 'idle') {
    return { status: 'ready', pickup: a, delivery: b, waypoints: mid, line: null, approximate: true, routing: true, routingConfigured, distanceMi: null, durationSec: null };
  }
  return {
    status: 'ready',
    pickup: a,
    delivery: b,
    waypoints: mid,
    line: route.data?.coordinates ?? null,
    approximate: !route.data,
    routing: false,
    routingConfigured,
    distanceMi: route.data?.distanceM != null ? metersToMiles(route.data.distanceM) : null,
    durationSec: route.data?.durationS != null ? Math.round(route.data.durationS) : null,
  };
}
