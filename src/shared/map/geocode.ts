// Forward geocoding — a typed place name to `{ name, lat, lon }`, the shape `LocationDto` needs
// (11.11 Request a log edit, gap B-39). Provider: MapTiler, provisional (tz §22 Q-2). With no
// `VITE_MAP_API_KEY` the feature is off and callers keep their read-only fallback.
import { useQuery } from '@tanstack/react-query';
import { GEOCODING_BASE_URL } from '@/shared/api/endpoints';
import { qk } from '@/shared/api/queryKeys';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';

const API_KEY: string = import.meta.env.VITE_MAP_API_KEY ?? '';

export const geocodingEnabled = API_KEY.length > 0;

/** Shortest query worth sending — fewer letters only return noise. */
export const PLACE_QUERY_MIN = 3;

export interface Place {
  name: string;
  lat: number;
  lon: number;
}

interface GeocodingResponse {
  features?: { place_name?: string; center?: [number, number] }[];
}

/** Up to 5 places in the US and Canada (the carrier's operating area) matching `query`. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (!geocodingEnabled || q.length < PLACE_QUERY_MIN) return [];
  const url = new URL(`${GEOCODING_BASE_URL}/${encodeURIComponent(q)}.json`);
  url.searchParams.set('key', API_KEY);
  url.searchParams.set('limit', '5');
  url.searchParams.set('country', 'us,ca');
  url.searchParams.set('language', 'en');
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Geocoding failed (${response.status})`);
  const body = (await response.json()) as GeocodingResponse;
  return (body.features ?? []).flatMap((feature) =>
    feature.place_name && feature.center
      ? [{ name: feature.place_name, lon: feature.center[0], lat: feature.center[1] }]
      : [],
  );
}

/** Debounced (250 ms, as the command palette) place search; idle until `enabled` and long enough. */
export function usePlaceSearch(query: string, enabled: boolean) {
  const debounced = useDebouncedValue(query.trim(), 250);
  return useQuery({
    queryKey: qk.places(debounced),
    queryFn: ({ signal }) => searchPlaces(debounced, signal),
    enabled: enabled && geocodingEnabled && debounced.length >= PLACE_QUERY_MIN,
    staleTime: 5 * 60_000,
  });
}
