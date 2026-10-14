// B-3 `GET /live/fleet` (shipped 2026-09-14) — identical to backend `live-fleet.mapper.ts`
// `LiveFleetResponse` (22 fields per unit + `generatedAt`), wrapped in the global `{ data }`
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
  /**
   * QA LIVE-002 — the assigned driver's own HOS duty status, in the Drivers roster's vocabulary
   * (`DriverRosterEntry.dutyStatus`): last known even when the ELD is offline or the unit is out of
   * service. `null` = no driver, or their HOS state is unavailable. Optional only for fixtures /
   * an older API; the backend always sends it.
   */
  driverDutyStatus?: DriverDutyStatus | null;
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
  /** UI-004 — the stored `Vehicle.status`. OUT_OF_SERVICE / INACTIVE units read `dutyStatus: 'INACTIVE'`. */
  recordStatus: LiveRecordStatus;
  /** UI-004 — NO_DEVICE (no ELD paired), ELD_OFFLINE (silent > 30 min) or ONLINE. */
  connectivity: LiveConnectivity;
  /** UI-003 — the duty status is not live (past its plausibility cap, or a D/ON unit whose ELD
   * went silent); `dutyStatus` then reads ELD_OFFLINE. */
  isStale: boolean;
  /** UI-003 — the cap instant or the last signal heard; null when unknown / not stale. */
  staleSince: string | null;
}

export type LiveRecordStatus = 'ACTIVE' | 'INACTIVE' | 'OUT_OF_SERVICE';
/** Backend `live-fleet.mapper.ts#DriverDutyStatus` — the HOS engine's effective status (PC = OFF, YM = ON). */
export type DriverDutyStatus = 'DRIVING' | 'ON_DUTY' | 'SLEEPER' | 'OFF_DUTY';
export type LiveConnectivity = 'NO_DEVICE' | 'ELD_OFFLINE' | 'ONLINE';

export interface LiveFleetResponse {
  items: LiveFleetUnit[];
  generatedAt: string;
}

/** `useLiveFleet()` — one query, shared by the Dashboard live-fleet card and the Live Fleet
 * screen. `cachePolicy('live')` is the §6.4 10s-stale/30s-poll pair, gated on tab visibility. */
export function useLiveFleet() {
  return useQuery({
    queryKey: qk.liveFleet(),
    queryFn: ({ signal }) => client.get<LiveFleetResponse>(endpoints.live.fleet, { signal }),
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
