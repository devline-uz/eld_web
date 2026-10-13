import { describe, expect, it } from 'vitest';
import { EMPTY_TRAIL, trailFromTelemetry, trailToGeoJSON } from './trail';

describe('trail', () => {
  it('reverses newest-first rows and coerces string decimals', () => {
    expect(trailFromTelemetry([{ latitude: '40.2', longitude: '-83.2' }, { latitude: 40.1, longitude: -83.1 }])).toEqual([
      [-83.1, 40.1],
      [-83.2, 40.2],
    ]);
  });
  it('needs two good points for a line', () => {
    expect(trailToGeoJSON([[-83, 40]])).toBe(EMPTY_TRAIL);
    expect(trailToGeoJSON([[0, 0], [-83, 40]])).toBe(EMPTY_TRAIL);
    expect(trailToGeoJSON([[-83, 40], [-83.1, 40.1]]).features[0]!.geometry).toEqual({
      type: 'LineString',
      coordinates: [[-83, 40], [-83.1, 40.1]],
    });
  });
});
