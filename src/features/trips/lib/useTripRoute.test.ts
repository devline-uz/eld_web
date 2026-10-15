import { afterEach, describe, expect, it, vi } from 'vitest';
import { OSRM_DEMO_URL, ROUTING_BASE_URL, resolveRoutingBaseUrl } from '@/shared/api/endpoints';
import { tripRouteEnds, type StopType } from '@/shared/api/trips';
import { fetchRoadRoute, fetchRoadRouteSummary, intermediateTripStops, metersToMiles, orderTripStops, stopScheduledAt } from './useTripRoute';

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

  it('CODE-051: multi-pickup / multi-drop keeps every stop in sequence, ending at the last drop', () => {
    const stops = [s('DELIVERY', 4, 'D2'), s('PICKUP', 1, 'P1'), s('DELIVERY', 2, 'D1'), s('PICKUP', 3, 'P2'), s('FUEL', 5, 'F')];
    // The fuel stop after the final drop still sits before the route's end (the last DELIVERY).
    expect(orderTripStops(stops).map((x) => x.name)).toEqual(['P1', 'D1', 'P2', 'F', 'D2']);
    expect(intermediateTripStops(stops).map((x) => x.name)).toEqual(['D1', 'P2', 'F']);
    expect(tripRouteEnds(stops)).toMatchObject({ pickup: { name: 'P1' }, delivery: { name: 'D2' } });
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

describe('fetchRoadRouteSummary (LIVE-029)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the road length and drive time the router reports', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ code: 'Ok', routes: [{ geometry: { coordinates: [[-87.6, 41.8], [-83, 39.9]] }, distance: 482803, duration: 17100 }] }),
      }),
    );
    const route = await fetchRoadRouteSummary([{ lat: 41.8, lon: -87.6 }, { lat: 39.9, lon: -83 }], undefined, 'https://osrm.example');
    expect(route).toEqual({ coordinates: [[-87.6, 41.8], [-83, 39.9]], distanceM: 482803, durationS: 17100 });
    expect(metersToMiles(482803)).toBe(300);
  });
});

describe('fetchRoadRoute without a router (CODE-057)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('never calls out when no routing base is configured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchRoadRoute([{ lat: 41.8, lon: -87.6 }, { lat: 39.9, lon: -83 }], undefined, null)).rejects.toThrow('not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('resolveRoutingBaseUrl (CODE-057 / LIVE-010)', () => {
  it('uses VITE_ROUTING_URL when set (trailing slash trimmed)', () => {
    expect(resolveRoutingBaseUrl(' https://osrm.example.com/ ', false)).toBe('https://osrm.example.com');
  });

  it('falls back to the public demo server in development only', () => {
    expect(resolveRoutingBaseUrl('', true)).toBe(OSRM_DEMO_URL);
    expect(resolveRoutingBaseUrl(undefined, false)).toBeNull();
    expect(resolveRoutingBaseUrl('   ', false)).toBeNull();
  });
});

// FE-15 — after an edit of the window the board shows the new pickup / delivery times.
describe('stopScheduledAt', () => {
  const stop = (type: StopType, sequence: number, scheduledAt: string | null) => ({ type, sequence, scheduledAt });
  const pickup = stop('PICKUP', 1, '2026-10-20T12:00:00.000Z');
  const fuel = stop('FUEL', 2, '2026-10-21T08:00:00.000Z');
  const delivery = stop('DELIVERY', 3, '2026-10-21T18:00:00.000Z');
  const trip = { stops: [pickup, fuel, delivery], plannedStartAt: '2026-10-22T12:00:00.000Z', plannedEndAt: '2026-10-23T18:00:00.000Z' };

  it('reads the pickup / delivery time from the (edited) trip window, not the stale stop copy', () => {
    expect(stopScheduledAt(trip, pickup)).toBe('2026-10-22T12:00:00.000Z');
    expect(stopScheduledAt(trip, delivery)).toBe('2026-10-23T18:00:00.000Z');
  });
  it('keeps an intermediate stop\'s own time, and falls back to the stop when the trip has no window', () => {
    expect(stopScheduledAt(trip, fuel)).toBe('2026-10-21T08:00:00.000Z');
    expect(stopScheduledAt({ stops: trip.stops, plannedStartAt: null, plannedEndAt: null }, pickup)).toBe('2026-10-20T12:00:00.000Z');
  });
});
