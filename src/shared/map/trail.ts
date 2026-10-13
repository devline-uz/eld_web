// Breadcrumb trail of the selected unit on the Live Fleet map: the last few telemetry fixes as one
// thin line under the markers. Straight segments between fixes — there is no routing service.
import type { Feature, FeatureCollection, LineString } from 'geojson';

export const TRAIL_SOURCE = 'fleet-trail';
export const TRAIL_LAYER = 'fleet-trail-line';
export const EMPTY_TRAIL: FeatureCollection = { type: 'FeatureCollection', features: [] };

/** A line needs two distinct points; fewer → nothing is drawn. Null-island / non-finite fixes are dropped. */
export function trailToGeoJSON(trail: ReadonlyArray<readonly [number, number]> | undefined): FeatureCollection {
  const pts = (trail ?? []).filter(
    ([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat) && !(lon === 0 && lat === 0),
  );
  if (pts.length < 2) return EMPTY_TRAIL;
  const line: Feature<LineString> = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: pts.map(([lon, lat]) => [lon, lat]) },
  };
  return { type: 'FeatureCollection', features: [line] };
}

/** Telemetry rows arrive newest first with Decimal columns possibly as strings → `[lon, lat]`, oldest first. */
export function trailFromTelemetry(
  rows: ReadonlyArray<{ latitude: number | string; longitude: number | string }> | undefined,
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const r of rows ?? []) {
    const lat = Number(r.latitude);
    const lon = Number(r.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon)) out.push([lon, lat]);
  }
  return out.reverse();
}
