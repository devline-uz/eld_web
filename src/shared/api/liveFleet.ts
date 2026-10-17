// B-3 `GET /live/fleet` (shipped 2026-09-14) — identical to backend `live-fleet.mapper.ts`,
// wrapped in the global `{ data }` envelope that `client.ts` unwraps. The web polls the slim
// `?view=list` rows (`LiveFleetListUnit`: what the unit list, map markers, Vehicles and Messages
// read); the W-02 selected-unit card reads the full 22-field `LiveFleetUnit` from
// `GET /live/fleet/:vehicleId` (`useLiveFleetUnit`), only while a unit is selected.
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

/** Backend `LIVE_FLEET_DETAIL_ONLY_FIELDS` — only the W-02 selected-unit card reads these. */
export type LiveFleetDetailOnlyField = 'driverPhone' | 'odometerMi' | 'driveRemainingSec' | 'shiftEndsAt' | 'eldSerial';

/** One `GET /live/fleet?view=list` row (backend `LiveFleetListUnit`): the full unit minus the
 * detail-card-only fields. */
export type LiveFleetListUnit = Omit<LiveFleetUnit, LiveFleetDetailOnlyField>;

/**
 * FE-05 — the colour a map marker is drawn in. The grey "ELD offline" marker means exactly what the
 * dashboard KPI "units with ELD offline" and `/live/fleet` `connectivity: ELD_OFFLINE` mean: an
 * ACTIVE unit whose paired ELD has gone silent — whatever its last duty status (an OFF/SB unit with a
 * silent ELD is grey too). A status that is merely stale while the ELD is ONLINE (past its 16 h/24 h
 * plausibility cap — `dutyStatus` reads ELD_OFFLINE then) keeps the driver's last known duty colour
 * and is drawn dimmed through `stale: isStale`, never grey.
 */
export function mapMarkerStatus(
  unit: Pick<LiveFleetListUnit, 'dutyStatus' | 'driverDutyStatus' | 'connectivity' | 'recordStatus'>,
): DutyStatus {
  if (unit.connectivity === 'ELD_OFFLINE' && unit.recordStatus === 'ACTIVE') return 'ELD_OFFLINE';
  if (unit.dutyStatus === 'ELD_OFFLINE') return unit.driverDutyStatus ?? 'INACTIVE';
  return unit.dutyStatus;
}

/** Backend `live-fleet.mapper.ts#DriverDutyStatus` — the HOS engine's effective status (PC = OFF, YM = ON). */
export type DriverDutyStatus = 'DRIVING' | 'ON_DUTY' | 'SLEEPER' | 'OFF_DUTY';
export type LiveConnectivity = 'NO_DEVICE' | 'ELD_OFFLINE' | 'ONLINE';

/** `GET /live/fleet?view=list` — the web's fleet poll (`useLiveFleet`). */
export interface LiveFleetResponse {
  items: LiveFleetListUnit[];
  generatedAt: string;
}

/** `?view=list` — sent by every web read of the fleet list (the hook and the route prefetch). */
export const LIVE_FLEET_LIST_PARAMS = { view: 'list' } as const;

/** The web's fleet list request — shared by `useLiveFleet` and the `/live-fleet` route prefetch,
 * so both cache the same slim shape under `qk.liveFleet()`. */
export async function fetchLiveFleet(signal?: AbortSignal): Promise<LiveFleetResponse> {
  const fleet = await client.get<LiveFleetResponse>(endpoints.live.fleet, { params: LIVE_FLEET_LIST_PARAMS, signal });
  noteServerClock(fleet.generatedAt);
  return fleet;
}

/**
 * FE-06 — server clock minus browser clock, learnt from each `GET /live/fleet` `generatedAt`. The
 * Live Fleet socket clamps a unit's newest applied frame time to the server's "now"
 * (`appliedFrameAt`), so a future-dated frame can't mark later frames stale (`isStaleFrame`); a
 * skewed browser clock would set that clamp too early or too late. `generatedAt` is stamped before
 * the response is sent, so the estimate errs by at most the response's own latency.
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

/** `useLiveFleet()` — one query (slim `?view=list` rows), shared by the Live Fleet screen, the
 * Vehicles status column and the Messages driver panel. `cachePolicy('live')` is the §6.4
 * 10s-stale/30s-poll pair, gated on tab visibility. */
export function useLiveFleet() {
  return useQuery({
    queryKey: qk.liveFleet(),
    queryFn: ({ signal }) => fetchLiveFleet(signal),
    ...typedCachePolicy<LiveFleetResponse>('live'),
  });
}

/** `useLiveFleetUnit(vehicleId)` — W-02's selected-unit card: the full row (HOS clocks, odometer,
 * ELD serial, phone) from `GET /live/fleet/:vehicleId`. Enabled only while a unit is selected
 * (`vehicleId` non-null) and polled on the same `live` policy; `telemetry.point` frames for the
 * unit patch it in between (LiveFleetPage). */
export function useLiveFleetUnit(vehicleId: string | null) {
  return useQuery({
    queryKey: qk.liveFleetUnit(vehicleId ?? ''),
    queryFn: ({ signal }) => client.get<LiveFleetUnit>(endpoints.live.unit(vehicleId!), { signal }),
    enabled: Boolean(vehicleId),
    ...typedCachePolicy<LiveFleetUnit>('live'),
  });
}

/** Has the unit reported a real, usable GPS fix (§10 W-02: "GPS yo'q unitlar xaritada emas").
 * Rejects `NaN`, out-of-range values and the `(0, 0)` "null island" sentinel some upstream mock/
 * telemetry data uses in place of a missing fix — one such unit was enough to park the Live Fleet
 * map's camera in the middle of the ocean (web/bugs.md WB-049). */
export function hasPosition<T extends Pick<LiveFleetListUnit, 'lat' | 'lon'>>(unit: T): unit is T & { lat: number; lon: number } {
  const { lat, lon } = unit;
  if (typeof lat !== 'number' || typeof lon !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat === 0 && lon === 0) return false;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
  return true;
}
