import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('searchPlaces', () => {
  it('is off without a map key — no request is made', async () => {
    vi.stubEnv('VITE_MAP_API_KEY', '');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { geocodingEnabled, searchPlaces } = await import('./geocode');
    expect(geocodingEnabled).toBe(false);
    expect(await searchPlaces('Dayton')).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('maps MapTiler features to { name, lat, lon } and skips short queries', async () => {
    vi.stubEnv('VITE_MAP_API_KEY', 'k');
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ features: [{ place_name: 'Dayton, Ohio', center: [-84.19, 39.76] }, { place_name: 'no center' }] })),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const { searchPlaces } = await import('./geocode');
    expect(await searchPlaces('Da')).toEqual([]);
    expect(await searchPlaces(' Dayton ')).toEqual([{ name: 'Dayton, Ohio', lat: 39.76, lon: -84.19 }]);
    const url = new URL(String(fetchSpy.mock.calls[0]![0]));
    expect(url.pathname).toBe('/geocoding/Dayton.json');
    expect(url.searchParams.get('key')).toBe('k');
    expect(url.searchParams.get('country')).toBe('us,ca');
  });
});
