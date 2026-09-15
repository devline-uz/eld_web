// B-3 `GET /live/fleet` (shipped 2026-09-14) — identical to backend `live-fleet.mapper.ts`
// `LiveFleetResponse` (17 fields per unit + `generatedAt`), wrapped in the global `{ data }`
// envelope that `client.ts` unwraps.
// Both W-01 Fleet Dashboard and W-02 Live Fleet import from here — never from each other
// (features/* never imports another features/*).
import { useQuery } from '@tanstack/react-query';
import { client } from './client';
import { endpoints } from './endpoints';
import { qk } from './queryKeys';
import { typedCachePolicy } from './queryPolicy';
import type { DutyStatus } from '@/shared/ui/Badge';

export interface LiveFleetUnit {
  vehicleId: string;
  unitNumber: string;
  driverId: string | null;
  driverName: string | null;
  driverPhone: string | null;
  dutyStatus: DutyStatus;
  speedMph: number | null;
  headingDeg: number | null;
  odometerMi: number | null;
  lat: number | null;
  lon: number | null;
  locationLabel: string | null;
  lastSeenAt: string | null;
  driveRemainingSec: number | null;
  shiftEndsAt: string | null;
  eldSerial: string | null;
  bleState: 'CONNECTED' | 'DISCONNECTED' | null;
}

export interface LiveFleetResponse {
  items: LiveFleetUnit[];
  generatedAt: string;
}

/** `useLiveFleet()` — one query, shared by the Dashboard live-fleet card and the Live Fleet
 * screen. `cachePolicy('live')` is the §6.4 10s-stale/30s-poll pair, gated on tab visibility. */
export function useLiveFleet() {
  return useQuery({
    queryKey: qk.liveFleet(),
    queryFn: () => client.get<LiveFleetResponse>(endpoints.live.fleet),
    ...typedCachePolicy<LiveFleetResponse>('live'),
  });
}

/** Has the unit reported a real, usable GPS fix (§10 W-02: "GPS yo'q unitlar xaritada emas").
 * Rejects `NaN`, out-of-range values and the `(0, 0)` "null island" sentinel some upstream mock/
 * telemetry data uses in place of a missing fix — one such unit was enough to park the Live Fleet
 * map's camera in the middle of the ocean (web/bugs.md WB-049). */
export function hasPosition(unit: LiveFleetUnit): unit is LiveFleetUnit & { lat: number; lon: number } {
  const { lat, lon } = unit;
  if (typeof lat !== 'number' || typeof lon !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat === 0 && lon === 0) return false;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
  return true;
}
