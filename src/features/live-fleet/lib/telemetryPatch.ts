// W-02 — maps a `telemetry.point` frame onto the cached `GET /live/fleet` response (web/tz.md §7.2:
// throttle to 200 ms, patch with `setQueryData`, never refetch the whole fleet per frame).
//
// The gateway frame is `{ vehicleId, count, latitude, longitude, speedMph, headingDeg, time }`
// (backend D-149), sent to `vehicle:{id}` and `fleet`; only that unit's row is patched in place.
// A batch without a GPS fix has no coordinates — the page then falls back to one throttled
// invalidate.
import type { LiveFleetListUnit, LiveFleetResponse } from '@/shared/api/liveFleet';
import type { RealtimeEventPayloads } from '@/shared/realtime/events';

export type TelemetryPointPayload = RealtimeEventPayloads['telemetry.point'];
export type UnitPatch = Partial<Pick<LiveFleetListUnit, 'lat' | 'lon' | 'speedMph' | 'headingDeg' | 'lastSeenAt'>>;

function finite(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** The row fields a frame can update, or `null` when the frame carries no usable position. */
export function telemetryUnitPatch(payload: TelemetryPointPayload): UnitPatch | null {
  const frame = payload as TelemetryPointPayload & Record<string, unknown>;
  const lat = finite(frame.latitude ?? frame.lat);
  const lon = finite(frame.longitude ?? frame.lon);
  if (lat === null || lon === null) return null;
  const patch: UnitPatch = { lat, lon };
  const speed = finite(frame.speedMph);
  if (speed !== null) patch.speedMph = speed;
  const heading = finite(frame.headingDeg);
  if (heading !== null) patch.headingDeg = heading;
  const at = frame.time ?? frame.at;
  if (typeof at === 'string') patch.lastSeenAt = at;
  return patch;
}

/** Slack for comparing a frame with the row's `lastSeenAt`, which may come from a device heartbeat
 * newer than the unit's last GPS fix. */
export const STALE_FRAME_SLACK_MS = 5 * 60_000;

/**
 * CODE-023 — true when a frame is older than what the marker already shows, so applying it would
 * move the unit backwards (an offline backfill replays hours-old fixes). Compared with the newest
 * frame already applied for the unit, else with the row's `lastSeenAt` minus a heartbeat slack.
 * A frame without a time can't be ordered and is applied as before.
 */
export function isStaleFrame(frameAt: string | null | undefined, unitLastSeenAt: string | null | undefined, lastAppliedAt: number | undefined): boolean {
  if (!frameAt) return false;
  const at = Date.parse(frameAt);
  if (!Number.isFinite(at)) return false;
  if (lastAppliedAt !== undefined) return at < lastAppliedAt;
  const seen = unitLastSeenAt ? Date.parse(unitLastSeenAt) : NaN;
  return Number.isFinite(seen) && at < seen - STALE_FRAME_SLACK_MS;
}

/** FE-06 — the time recorded as a unit's newest applied frame: the frame's own time, but never
 * later than `nowMs` (the server's clock), so a future-dated frame cannot block the next ones. */
export function appliedFrameAt(frameAt: string, nowMs: number): number {
  const at = Date.parse(frameAt);
  return Number.isFinite(at) ? Math.min(at, nowMs) : at;
}

/** True when the cached fleet holds the frame's unit, i.e. a patch has a row to land on. */
export function fleetHasUnit(fleet: LiveFleetResponse | undefined, vehicleId: string): boolean {
  return Boolean(fleet?.items.some((unit) => unit.vehicleId === vehicleId));
}

/** Applies every pending per-unit patch; untouched rows keep their identity (memoized list rows
 * and the map's marker signature skip them). Returns `current` itself when nothing matched. */
export function applyUnitPatches(
  current: LiveFleetResponse | undefined,
  patches: ReadonlyMap<string, UnitPatch>,
): LiveFleetResponse | undefined {
  if (!current || patches.size === 0) return current;
  let changed = false;
  const items = current.items.map((unit) => {
    const patch = patches.get(unit.vehicleId);
    if (!patch) return unit;
    changed = true;
    return { ...unit, ...patch };
  });
  return changed ? { ...current, items } : current;
}
