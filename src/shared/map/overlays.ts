// owner: web-dashboard-fleet — the W-02 map overlay layers (`Vehicles` · `Trips` · `Geofences` ·
// `Traffic`, web/tz.md §10 W-02) as plain GeoJSON builders. Kept free of `maplibre-gl` on purpose:
// the page reads `trafficTilesUrl()` to decide whether the Traffic chip is usable, and importing
// `FleetMap.tsx` for that would pull the whole map chunk into the page bundle.
import type { Feature, FeatureCollection, LineString, Point, Polygon, Position } from 'geojson';

export const MAP_LAYERS = ['Vehicles', 'Trips', 'Geofences', 'Traffic'] as const;
export type MapLayer = (typeof MAP_LAYERS)[number];

/** Raster traffic tile template (`{z}/{x}/{y}`), e.g. TomTom flow tiles. Empty → no Traffic layer.
 * Read on every call, not at module eval, so tests can `vi.stubEnv` it. */
export function trafficTilesUrl(): string {
  return (import.meta.env.VITE_TRAFFIC_TILES_URL as string | undefined) ?? '';
}

const EARTH_RADIUS_M = 6_371_008.8;
const METERS_PER_MILE = 1609.344;
export const CIRCLE_STEPS = 64;

function isLat(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90;
}
function isLon(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180;
}
/** Same guard as FleetMap/`hasPosition`: `(0, 0)` is a missing fix, never a real place (WB-049). */
function validPosition(lon: unknown, lat: unknown): Position | null {
  if (!isLon(lon) || !isLat(lat)) return null;
  if (lon === 0 && lat === 0) return null;
  return [lon, lat];
}

/** A geodesic circle approximated by `steps` vertices — MapLibre has no native metre-radius
 * circle that scales with zoom, so a circular geofence is drawn as a closed polygon ring. */
export function circleToPolygon(center: Position, radiusMeters: number, steps = CIRCLE_STEPS): Polygon {
  const [lon, lat] = center as [number, number];
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  const angular = radiusMeters / EARTH_RADIUS_M;
  const ring: Position[] = [];
  for (let i = 0; i < steps; i++) {
    const bearing = (i / steps) * 2 * Math.PI;
    const pLat = Math.asin(
      Math.sin(latRad) * Math.cos(angular) + Math.cos(latRad) * Math.sin(angular) * Math.cos(bearing),
    );
    const pLon =
      lonRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(latRad),
        Math.cos(angular) - Math.sin(latRad) * Math.sin(pLat),
      );
    ring.push([((((pLon * 180) / Math.PI + 540) % 360) - 180), (pLat * 180) / Math.PI]);
  }
  ring.push(ring[0]!);
  return { type: 'Polygon', coordinates: [ring] };
}

// ---------------------------------------------------------------------------------------------
// Geofences
// ---------------------------------------------------------------------------------------------

/** The geometry-bearing subset of a geofence row. The backend's OpenAPI example for
 * `GET /geofences` (types.ts `GeofencesListResponse`) carries no coordinates at all, so every
 * field here is optional and read defensively; a row without usable geometry is skipped. */
export interface GeofenceGeometrySource {
  id: string;
  name: string;
  type: string;
  colour?: string | null;
  radiusMi?: number | null;
  radiusMeters?: number | null;
  centerLat?: number | null;
  centerLng?: number | null;
  centerLon?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Ring as `[lon, lat]` pairs or `{ lat, lng|lon }` objects. */
  polygon?: unknown;
  coordinates?: unknown;
  /** A GeoJSON Polygon, if the backend ever returns one. */
  geometry?: unknown;
}

export interface GeofenceFeatureProps {
  id: string;
  name: string;
  colour: string;
}

function toPosition(point: unknown): Position | null {
  if (Array.isArray(point)) return validPosition(point[0], point[1]);
  if (point && typeof point === 'object') {
    const p = point as Record<string, unknown>;
    return validPosition(p.lng ?? p.lon ?? p.longitude, p.lat ?? p.latitude);
  }
  return null;
}

function toRing(raw: unknown): Position[] | null {
  if (!Array.isArray(raw)) return null;
  // Accept a bare ring or a GeoJSON-style `[ring]` wrapper.
  const points = raw.length > 0 && Array.isArray(raw[0]) && Array.isArray(raw[0][0]) ? (raw[0] as unknown[]) : raw;
  const ring = points.map(toPosition);
  if (ring.some((p) => p === null)) return null;
  const closed = ring as Position[];
  if (closed.length < 3) return null;
  const [first, last] = [closed[0]!, closed[closed.length - 1]!];
  if (first[0] !== last[0] || first[1] !== last[1]) closed.push(first);
  return closed.length >= 4 ? closed : null;
}

function geofencePolygon(g: GeofenceGeometrySource): Polygon | null {
  const geometry = g.geometry as { type?: unknown; coordinates?: unknown } | null | undefined;
  if (geometry && geometry.type === 'Polygon') {
    const ring = toRing(geometry.coordinates);
    if (ring) return { type: 'Polygon', coordinates: [ring] };
  }
  const ring = toRing(g.polygon ?? g.coordinates);
  if (ring) return { type: 'Polygon', coordinates: [ring] };

  const center = validPosition(g.centerLng ?? g.centerLon ?? g.longitude, g.centerLat ?? g.latitude);
  const radiusMeters =
    typeof g.radiusMeters === 'number' && g.radiusMeters > 0
      ? g.radiusMeters
      : typeof g.radiusMi === 'number' && g.radiusMi > 0
        ? g.radiusMi * METERS_PER_MILE
        : null;
  if (center && radiusMeters) return circleToPolygon(center, radiusMeters);
  return null;
}

export function geofencesToGeoJSON(
  geofences: readonly GeofenceGeometrySource[],
): FeatureCollection<Polygon, GeofenceFeatureProps> {
  const features: Feature<Polygon, GeofenceFeatureProps>[] = [];
  for (const g of geofences) {
    const polygon = geofencePolygon(g);
    if (!polygon) continue;
    features.push({
      type: 'Feature',
      id: g.id,
      geometry: polygon,
      properties: { id: g.id, name: g.name, colour: g.colour ?? 'BLUE' },
    });
  }
  return { type: 'FeatureCollection', features };
}

// ---------------------------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------------------------

/** The subset of `TripRow` (shared/api/trips.ts) the map needs. */
export interface TripGeometrySource {
  id: string;
  number: string;
  vehicleId: string | null;
  status: string;
  stops: ReadonlyArray<{
    sequence: number;
    type: string;
    name: string;
    status: string;
    latitude: number | null;
    longitude: number | null;
  }>;
}

export interface TripFeatureProps {
  tripId: string;
  number: string;
  /** `planned` — straight segments through the trip's stops in sequence (no road geometry exists);
   * `remaining` — the unit's live position to its next pending stop; `stop` — one stop marker. */
  kind: 'planned' | 'remaining' | 'stop';
  stopType?: string;
  name?: string;
}

/**
 * There is no route/breadcrumb endpoint for a trip or a vehicle (`/vehicles/:id/histories` is
 * backend gap B-4), so the Trips layer draws what the data honestly supports: each active trip's
 * stops, the straight line joining them in order, and — for an in-progress trip whose unit is
 * reporting — a line from the unit's live position to its next pending stop.
 */
export function tripsToGeoJSON(
  trips: readonly TripGeometrySource[],
  unitPositions: ReadonlyMap<string, Position> = new Map(),
): FeatureCollection<LineString | Point, TripFeatureProps> {
  const features: Feature<LineString | Point, TripFeatureProps>[] = [];
  for (const trip of trips) {
    const stops = [...trip.stops]
      .sort((a, b) => a.sequence - b.sequence)
      .map((s) => ({ stop: s, pos: validPosition(s.longitude, s.latitude) }))
      .filter((s): s is { stop: (typeof s)['stop']; pos: Position } => s.pos !== null);

    for (const { stop, pos } of stops) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: pos },
        properties: { tripId: trip.id, number: trip.number, kind: 'stop', stopType: stop.type, name: stop.name },
      });
    }
    if (stops.length >= 2) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: stops.map((s) => s.pos) },
        properties: { tripId: trip.id, number: trip.number, kind: 'planned' },
      });
    }
    const current = trip.status === 'IN_PROGRESS' && trip.vehicleId ? unitPositions.get(trip.vehicleId) : undefined;
    const next = stops.find((s) => s.stop.status === 'PENDING' || s.stop.status === 'ARRIVED');
    if (current && next) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [current, next.pos] },
        properties: { tripId: trip.id, number: trip.number, kind: 'remaining' },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

export const EMPTY_COLLECTION: FeatureCollection = { type: 'FeatureCollection', features: [] };
