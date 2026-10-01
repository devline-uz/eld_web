// W-02 — maps a `telemetry.point` frame onto the cached `GET /live/fleet` response (web/tz.md §7.2:
// throttle to 200 ms, patch with `setQueryData`, never refetch the whole fleet per frame).
//
// Today's gateway frame is `{ vehicleId, count }` (backend ingest.service.ts) — it says *that* a
// unit reported, not *where*, so it cannot be mapped and the page falls back to one throttled
// invalidate. The moment the frame carries a fix (`latitude`/`longitude` like the ingest DTO, or
// `lat`/`lon`), only that unit's row is patched in place.
import type { LiveFleetResponse, LiveFleetUnit } from '@/shared/api/liveFleet';
import type { RealtimeEventPayloads } from '@/shared/realtime/events';

export type TelemetryPointPayload = RealtimeEventPayloads['telemetry.point'];
export type UnitPatch = Partial<Pick<LiveFleetUnit, 'lat' | 'lon' | 'speedMph' | 'headingDeg' | 'lastSeenAt'>>;

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
