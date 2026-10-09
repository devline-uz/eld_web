import { describe, expect, it } from 'vitest';
import type { Point } from 'geojson';
import { routeCoords, routeFeatures } from './routeFeatures';

const P = { lat: 41.8, lon: -87.6 };
const S1 = { lat: 41.6, lon: -86.2 };
const S2 = { lat: 41.1, lon: -85.1 };
const D = { lat: 39.9, lon: -83 };

describe('routeFeatures', () => {
  it('labels the points in route order: P, 1…N, D', () => {
    const fc = routeFeatures({ pickup: P, delivery: D, waypoints: [S1, S2], line: null });
    const points = fc.features.filter((f) => f.geometry.type === 'Point');
    expect(points.map((f) => [f.properties?.kind, f.properties?.label, (f.geometry as Point).coordinates])).toEqual([
      ['pickup', 'P', [P.lon, P.lat]],
      ['stop', '1', [S1.lon, S1.lat]],
      ['stop', '2', [S2.lon, S2.lat]],
      ['delivery', 'D', [D.lon, D.lat]],
    ]);
  });

  it('draws straight segments through every stop when there is no road geometry', () => {
    expect(routeCoords({ pickup: P, delivery: D, waypoints: [S1, S2], line: null })).toEqual([
      [P.lon, P.lat],
      [S1.lon, S1.lat],
      [S2.lon, S2.lat],
      [D.lon, D.lat],
    ]);
    expect(routeCoords({ pickup: P, delivery: D, line: [] })).toEqual([[P.lon, P.lat], [D.lon, D.lat]]);
  });

  it('uses the road geometry when there is one', () => {
    const line: [number, number][] = [[1, 2], [3, 4], [5, 6]];
    expect(routeCoords({ pickup: P, delivery: D, waypoints: [S1], line })).toBe(line);
  });
});
