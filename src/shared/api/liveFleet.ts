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

/**
 * FE-05 — the colour a map marker is drawn in. The grey "ELD offline" marker means exactly what the
 * dashboard KPI "units with ELD offline" and `/live/fleet` `connectivity: ELD_OFFLINE` mean: an
 * ACTIVE unit whose paired ELD has gone silent — whatever its last duty status (an OFF/SB unit with a
 * silent ELD is grey too). A status that is merely stale while the ELD is ONLINE (past its 16 h/24 h
 * plausibility cap — `dutyStatus` reads ELD_OFFLINE then) keeps the driver's last known duty colour
 * and is drawn dimmed through `stale: isStale`, never grey.
 */
export function mapMarkerStatus(
  unit: Pick<LiveFleetUnit, 'dutyStatus' | 'driverDutyStatus' | 'connectivity' | 'recordStatus'>,
): DutyStatus {
  if (unit.connectivity === 'ELD_OFFLINE' && unit.recordStatus === 'ACTIVE') return 'ELD_OFFLINE';
  if (unit.dutyStatus === 'ELD_OFFLINE') return unit.driverDutyStatus ?? 'INACTIVE';
  return unit.dutyStatus;
}

/** Backend `live-fleet.mapper.ts#DriverDutyStatus` — the HOS engine's effective status (PC = OFF, YM = ON). */
export type DriverDutyStatus = 'DRIVING' | 'ON_DUTY' | 'SLEEPER' | 'OFF_DUTY';
export type LiveConnectivity = 'NO_DEVICE' | 'ELD_OFFLINE' | 'ONLINE';

export interface LiveFleetResponse {
  items: LiveFleetUnit[];
  generatedAt: string;
}

/**
 * FE-06 — browser clock minus server clock, learnt from each `GET /live/fleet` `generatedAt`. Marker
 * motion ages a fix against "now"; a browser clock 2 min fast made every fix look too old to glide
 * from (and a slow one made old fixes look fresh). `generatedAt` is stamped before the response
 * is sent, so the estimate errs by at most the response's own latency.
 */
let serverClockOffsetMs = 0;

/** Records the server's clock from a response timestamp received just now (unparsable → ignored). */
export function noteServerClock(serverIso: string | null | undefined, receivedAt = Date.now()): void {
  const server = serverIso ? Date.parse(serverIso) : NaN;
  if (Number.isFinite(server)) serverClockOffsetMs = server - receivedAt;
}

/** "Now" on the server's clock (`Date.now()` until a fleet response has been seen). */
export function serverNowMs(): number {
  return Date.now() + serverClockOffsetMs;
}

/** `useLiveFleet()` — one query, shared by the Dashboard live-fleet card and the Live Fleet
 * screen. `cachePolicy('live')` is the §6.4 10s-stale/30s-poll pair, gated on tab visibility. */
export function useLiveFleet() {
  return useQuery({
    queryKey: qk.liveFleet(),
    queryFn: async ({ signal }) => {
      const fleet = await client.get<LiveFleetResponse>(endpoints.live.fleet, { signal });
      noteServerClock(fleet.generatedAt);
      return fleet;
    },
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
