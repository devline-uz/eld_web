// GeoJSON for the route preview map (RouteMap): the polyline plus one point per stop in route order —
// pickup `P`, intermediate stops `1…N`, delivery `D`. Kept outside the component so it is unit-tested
// without MapLibre.
import type { Feature, FeatureCollection } from 'geojson';
import type { LatLon } from './overlays';

export interface RoutePoints {
  pickup: LatLon;
  delivery: LatLon;
  /** Intermediate stops, already in route order. */
  waypoints?: readonly LatLon[];
  /** Road geometry as [lon, lat] pairs. Empty/`null` → straight segments through every stop. */
  line: [number, number][] | null;
}

export type RouteCoord = [number, number];

const toCoord = (p: LatLon): RouteCoord => [p.lon, p.lat];

/** The polyline coordinates: the road geometry, or straight pickup → stops → delivery segments. */
export function routeCoords(p: RoutePoints): RouteCoord[] {
  if (p.line && p.line.length >= 2) return p.line;
  return [p.pickup, ...(p.waypoints ?? []), p.delivery].map(toCoord);
}

export function routeFeatures(p: RoutePoints): FeatureCollection {
  const point = (kind: 'pickup' | 'stop' | 'delivery', label: string, at: LatLon): Feature => ({
    type: 'Feature',
    properties: { kind, label },
    geometry: { type: 'Point', coordinates: toCoord(at) },
  });
  const features: Feature[] = [
    { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeCoords(p) } },
    point('pickup', 'P', p.pickup),
    ...(p.waypoints ?? []).map((w, i) => point('stop', String(i + 1), w)),
    point('delivery', 'D', p.delivery),
  ];
  return { type: 'FeatureCollection', features };
}
