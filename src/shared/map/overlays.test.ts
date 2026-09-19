// W-02 map overlays — geofence rows → GeoJSON polygons (circles approximated), active trips →
// stop dots + straight planned lines. Pure functions: no MapLibre, no DOM.
import { describe, expect, it } from 'vitest';
import type { Polygon, Position } from 'geojson';
import { CIRCLE_STEPS, circleToPolygon, geofencesToGeoJSON, tripsToGeoJSON, type TripGeometrySource } from './overlays';

/** Great-circle distance in metres, to check the circle's radius independently. */
function haversine([lon1, lat1]: Position, [lon2, lat2]: Position): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2! - lat1!) / 2) ** 2 + Math.cos(r(lat1!)) * Math.cos(r(lat2!)) * Math.sin(r(lon2! - lon1!) / 2) ** 2;
  return 2 * 6_371_008.8 * Math.asin(Math.sqrt(a));
}

describe('circleToPolygon', () => {
  it('returns a closed ring of 64 vertices, each at the requested radius', () => {
    const center: Position = [-82.99, 39.96];
    const polygon = circleToPolygon(center, 1609.344);
    const ring = polygon.coordinates[0]!;
    expect(ring).toHaveLength(CIRCLE_STEPS + 1);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    for (const vertex of ring) expect(haversine(center, vertex)).toBeCloseTo(1609.344, 0);
  });
});

describe('geofencesToGeoJSON', () => {
  it('turns a circle (center + radiusMi) into a polygon and keeps name/colour properties', () => {
    const fc = geofencesToGeoJSON([
      { id: 'gf_1', name: 'Columbus Terminal', type: 'CIRCLE', radiusMi: 0.5, centerLat: 39.96, centerLng: -82.99, colour: 'GREEN' },
    ]);
    expect(fc.features).toHaveLength(1);
    const feature = fc.features[0]!;
    expect(feature.geometry.type).toBe('Polygon');
    expect(feature.properties).toEqual({ id: 'gf_1', name: 'Columbus Terminal', colour: 'GREEN' });
    expect(haversine([-82.99, 39.96], feature.geometry.coordinates[0]![0]!)).toBeCloseTo(804.672, 0);
  });

  it('prefers radiusMeters over radiusMi and defaults the colour to BLUE', () => {
    const fc = geofencesToGeoJSON([
      { id: 'gf_1', name: 'Dock', type: 'CIRCLE', radiusMeters: 200, radiusMi: 5, latitude: 40, longitude: -83 },
    ]);
    expect(haversine([-83, 40], fc.features[0]!.geometry.coordinates[0]![0]!)).toBeCloseTo(200, 0);
    expect(fc.features[0]!.properties.colour).toBe('BLUE');
  });

  it('uses polygon rings directly — [lon, lat] pairs or {lat, lng} objects — and closes an open ring', () => {
    const fc = geofencesToGeoJSON([
      { id: 'a', name: 'A', type: 'POLYGON', polygon: [[-83, 40], [-82, 40], [-82, 41], [-83, 41]] },
      { id: 'b', name: 'B', type: 'POLYGON', coordinates: [{ lat: 40, lng: -83 }, { lat: 40, lng: -82 }, { lat: 41, lng: -82 }, { lat: 40, lng: -83 }] },
      { id: 'c', name: 'C', type: 'POLYGON', geometry: { type: 'Polygon', coordinates: [[[-83, 40], [-82, 40], [-82, 41], [-83, 40]]] } },
    ]);
    expect(fc.features.map((f) => f.properties.id)).toEqual(['a', 'b', 'c']);
    const ring = (fc.features[0]!.geometry as Polygon).coordinates[0]!;
    expect(ring).toEqual([[-83, 40], [-82, 40], [-82, 41], [-83, 41], [-83, 40]]);
  });

  it('skips rows with no usable geometry instead of drawing them at (0, 0)', () => {
    const fc = geofencesToGeoJSON([
      { id: 'none', name: 'No geometry', type: 'CIRCLE', radiusMi: 1 },
      { id: 'island', name: 'Null island', type: 'CIRCLE', radiusMi: 1, centerLat: 0, centerLng: 0 },
      { id: 'short', name: 'Two points', type: 'POLYGON', polygon: [[-83, 40], [-82, 40]] },
      { id: 'bad', name: 'Out of range', type: 'POLYGON', polygon: [[-83, 40], [-82, 95], [-82, 41]] },
    ]);
    expect(fc.features).toHaveLength(0);
  });
});

describe('tripsToGeoJSON', () => {
  const trip = (overrides: Partial<TripGeometrySource> = {}): TripGeometrySource => ({
    id: 'trp_1',
    number: 'T-1',
    vehicleId: 'veh_1',
    status: 'IN_PROGRESS',
    stops: [
      { sequence: 2, type: 'DELIVERY', name: 'Dock', status: 'PENDING', latitude: 41, longitude: -84 },
      { sequence: 1, type: 'PICKUP', name: 'Yard', status: 'COMPLETED', latitude: 40, longitude: -83 },
      { sequence: 3, type: 'FUEL', name: 'No fix', status: 'PENDING', latitude: null, longitude: null },
    ],
    ...overrides,
  });

  it('draws stop dots and one planned line through the stops in sequence order', () => {
    const fc = tripsToGeoJSON([trip({ status: 'ASSIGNED' })]);
    expect(fc.features.filter((f) => f.properties.kind === 'stop')).toHaveLength(2);
    const planned = fc.features.find((f) => f.properties.kind === 'planned')!;
    expect(planned.geometry).toEqual({ type: 'LineString', coordinates: [[-83, 40], [-84, 41]] });
    expect(fc.features.some((f) => f.properties.kind === 'remaining')).toBe(false);
  });

  it('adds a live-position → next pending stop line for an in-progress trip whose unit reports', () => {
    const fc = tripsToGeoJSON([trip()], new Map([['veh_1', [-83.5, 40.5]]]));
    const remaining = fc.features.find((f) => f.properties.kind === 'remaining')!;
    expect(remaining.geometry).toEqual({ type: 'LineString', coordinates: [[-83.5, 40.5], [-84, 41]] });
  });

  it('draws nothing for a trip whose stops carry no coordinates', () => {
    const fc = tripsToGeoJSON([
      trip({ stops: [{ sequence: 1, type: 'PICKUP', name: 'Yard', status: 'PENDING', latitude: null, longitude: null }] }),
    ]);
    expect(fc.features).toHaveLength(0);
  });
});
