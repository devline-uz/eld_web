import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROUTING_BASE_URL } from '@/shared/api/endpoints';
import type { StopType } from '@/shared/api/trips';
import { fetchRoadRoute, intermediateTripStops, orderTripStops } from './useTripRoute';

const s = (type: StopType, sequence: number, name: string) => ({ type, sequence, name });

describe('orderTripStops', () => {
  it('puts the pickup first, the delivery last and the rest by sequence', () => {
    const stops = [s('CHECKPOINT', 3, 'B'), s('DELIVERY', 4, 'D'), s('FUEL', 2, 'A'), s('PICKUP', 1, 'P')];
    expect(orderTripStops(stops).map((x) => x.name)).toEqual(['P', 'A', 'B', 'D']);
    expect(intermediateTripStops(stops).map((x) => x.name)).toEqual(['A', 'B']);
  });

  it('keeps pickup first and delivery last even when their sequence says otherwise', () => {
    const stops = [s('DELIVERY', 1, 'D'), s('CHECKPOINT', 5, 'B'), s('PICKUP', 9, 'P'), s('CHECKPOINT', 2, 'A')];
    expect(orderTripStops(stops).map((x) => x.name)).toEqual(['P', 'A', 'B', 'D']);
  });

  it('does not mutate its input', () => {
    const stops = [s('DELIVERY', 2, 'D'), s('PICKUP', 1, 'P')];
    orderTripStops(stops);
    expect(stops.map((x) => x.name)).toEqual(['D', 'P']);
  });
});

describe('fetchRoadRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('routes through the intermediate stops as OSRM waypoints, in order', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'Ok', routes: [{ geometry: { coordinates: [[-87.6, 41.8], [-83, 39.9]] } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await fetchRoadRoute([
      { lat: 41.8, lon: -87.6 },
      { lat: 41.6, lon: -86.2 },
      { lat: 41.1, lon: -85.1 },
      { lat: 39.9, lon: -83 },
    ]);
    expect(fetchMock.mock.calls[0]![0]).toBe(
      `${ROUTING_BASE_URL}/route/v1/driving/-87.6,41.8;-86.2,41.6;-85.1,41.1;-83,39.9?overview=full&geometries=geojson`,
    );
  });
});
