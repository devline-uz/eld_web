// Live Fleet marker motion (backend D-149), Yandex-Navigator style. Pure (no MapLibre, no timers):
// FleetMap calls `update()` when data changes and `positions()` once per animation frame.
//
//  * Interpolation — a new fix is never a jump. The marker glides from where it is DRAWN to the new
//    fix over `blendMs` = the gap between the two fixes (clamped to 1…60 s), linearly in lat/lon;
//    the heading turns along the shortest arc over the first `TURN_MS_MAX` of that glide.
//  * Dead reckoning — after the last fix a unit that is DRIVING, has speed > 0 and whose fix is
//    fresh (≤ `FRESH_FIX_MAX_MS` old) keeps moving along its heading at its speed, until it has run
//    `EXTRAPOLATE_MAX_MS` or `EXTRAPOLATE_MAX_METERS` past the fix; then it stops (stale). The next
//    fix is blended in from the extrapolated position (no snap back).
//  * No snapping to roads — there is no routing service; the path is a straight line.

/** Glide between two fixes: the gap between them, never shorter / longer than this. */
export const BLEND_MIN_MS = 1000;
export const BLEND_MAX_MS = 60_000;
/** Used when only one fix has been seen (no gap to measure): the app reports about once a minute. */
export const BLEND_DEFAULT_MS = 60_000;
/** Heading turns faster than the glide itself. */
export const TURN_MS_MAX = 3000;
/** A fix older than this is not trusted to extrapolate from. */
export const FRESH_FIX_MAX_MS = 90_000;
/** Dead reckoning stops this long after the fix… */
export const EXTRAPOLATE_MAX_MS = 75_000;
/** …or this far (1.5 mi) from it, whichever comes first. */
export const EXTRAPOLATE_MAX_METERS = 2414;
export const MIN_SPEED_MPH = 1;

const MPH_TO_MPS = 0.44704;
const M_PER_DEG_LAT = 111_320;

/** Signed shortest rotation from `from` to `to`, in (−180, 180]. */
export function shortestAngleDelta(from: number, to: number): number {
  const d = (((to - from) % 360) + 540) % 360 - 180;
  return d === -180 ? 180 : d;
}

/** Heading `t` (0…1) of the way from `from` to `to` along the shortest arc, in [0, 360). */
export function lerpAngle(from: number, to: number, t: number): number {
  const v = (from + shortestAngleDelta(from, to) * t) % 360;
  return v < 0 ? v + 360 : v;
}

export interface LatLonPoint {
  lat: number;
  lon: number;
}

export interface ExtrapolateInput extends LatLonPoint {
  heading: number | null;
  speedMph: number | null | undefined;
  /** DRIVING and not stale. */
  moving: boolean;
  /** Age of the fix at the moment `elapsedMs` is 0. */
  fixAgeMs: number;
}

/** Metres a unit has travelled since its fix, after `elapsedMs` more — 0 when it must not move
 * (not driving, speed 0, no heading, fix too old to trust) and capped by time and distance. */
export function extrapolationMeters(input: Omit<ExtrapolateInput, 'lat' | 'lon'>, elapsedMs: number): number {
  const { heading, speedMph, moving, fixAgeMs } = input;
  if (!moving || heading === null) return 0;
  if (typeof speedMph !== 'number' || !Number.isFinite(speedMph) || speedMph < MIN_SPEED_MPH) return 0;
  if (fixAgeMs > FRESH_FIX_MAX_MS) return 0;
  const ms = Math.min(Math.max(0, fixAgeMs + elapsedMs), EXTRAPOLATE_MAX_MS);
  return Math.min(speedMph * MPH_TO_MPS * (ms / 1000), EXTRAPOLATE_MAX_METERS);
}

/** The point `meters` from `p` along `heading` (degrees clockwise from north). */
export function offsetAlongHeading(p: LatLonPoint, heading: number, meters: number): LatLonPoint {
  if (meters === 0) return { lat: p.lat, lon: p.lon };
  const rad = (heading * Math.PI) / 180;
  const cosLat = Math.max(0.01, Math.cos((p.lat * Math.PI) / 180));
  return {
    lat: p.lat + (meters * Math.cos(rad)) / M_PER_DEG_LAT,
    lon: p.lon + (meters * Math.sin(rad)) / (M_PER_DEG_LAT * cosLat),
  };
}

/** Glide duration for a fix that follows one `gapMs` earlier. */
export function blendDuration(gapMs: number | null): number {
  if (gapMs === null || !Number.isFinite(gapMs) || gapMs <= 0) return BLEND_DEFAULT_MS;
  return Math.min(BLEND_MAX_MS, Math.max(BLEND_MIN_MS, gapMs));
}

export interface MotionUnit {
  id: string;
  lat: number;
  lon: number;
  speedMph?: number | null;
  /** Resolved heading (reported or derived), degrees clockwise from north. */
  heading?: number | null;
  /** Only a unit that is actually driving (and not stale) is extrapolated. */
  moving: boolean;
  /** Epoch ms of the fix itself (`lastSeenAt`); unknown → the fix is treated as fresh. */
  fixAtMs?: number | null;
  /** Epoch ms "now" when this update is made, to age `fixAtMs`. */
  wallNowMs?: number;
}

export interface DrawnUnit extends LatLonPoint {
  heading: number | null;
}

interface Track {
  fixLat: number;
  fixLon: number;
  /** Monotonic time (the `now` passed to update) this fix was taken in. */
  arrivedAt: number;
  fixAtMs: number | null;
  /** Fix age when it arrived. */
  fixAgeMs: number;
  /** Drawn position minus the (extrapolated) target at arrival; decays linearly to 0 over blendMs. */
  offLat: number;
  offLon: number;
  blendMs: number;
  speedMph: number | null;
  moving: boolean;
  heading: number | null;
  /** Heading drawn at arrival, turned toward `heading` over turnMs. */
  fromHeading: number | null;
}

function targetAt(t: Track, now: number): LatLonPoint {
  const meters = extrapolationMeters(
    { heading: t.heading, speedMph: t.speedMph, moving: t.moving, fixAgeMs: t.fixAgeMs },
    now - t.arrivedAt,
  );
  return t.heading === null ? { lat: t.fixLat, lon: t.fixLon } : offsetAlongHeading({ lat: t.fixLat, lon: t.fixLon }, t.heading, meters);
}

function drawn(t: Track, now: number): DrawnUnit {
  const p = targetAt(t, now);
  const w = Math.max(0, 1 - (now - t.arrivedAt) / t.blendMs);
  let heading = t.heading;
  if (t.heading !== null && t.fromHeading !== null) {
    const turn = Math.min(TURN_MS_MAX, t.blendMs);
    heading = lerpAngle(t.fromHeading, t.heading, Math.min(1, (now - t.arrivedAt) / turn));
  }
  return { lat: p.lat + t.offLat * w, lon: p.lon + t.offLon * w, heading };
}

function extrapolating(t: Track, now: number): boolean {
  const meters = extrapolationMeters(
    { heading: t.heading, speedMph: t.speedMph, moving: t.moving, fixAgeMs: t.fixAgeMs },
    now - t.arrivedAt,
  );
  if (meters === 0) return false;
  const ms = t.fixAgeMs + (now - t.arrivedAt);
  return ms < EXTRAPOLATE_MAX_MS && meters < EXTRAPOLATE_MAX_METERS;
}

export function createMotionTracker() {
  const tracks = new Map<string, Track>();

  return {
    /** New data (a poll or a patched frame). Unchanged fixes keep their track untouched. */
    update(units: readonly MotionUnit[], now: number): void {
      const seen = new Set<string>();
      for (const u of units) {
        seen.add(u.id);
        const heading = u.heading ?? null;
        const fixAtMs = u.fixAtMs ?? null;
        const fixAgeMs = fixAtMs !== null && u.wallNowMs !== undefined ? Math.max(0, u.wallNowMs - fixAtMs) : 0;
        const speedMph = u.speedMph ?? null;
        const prev = tracks.get(u.id);
        const fresh = (): Track => ({
          fixLat: u.lat, fixLon: u.lon, arrivedAt: now, fixAtMs, fixAgeMs, offLat: 0, offLon: 0,
          blendMs: BLEND_DEFAULT_MS, speedMph, moving: u.moving, heading, fromHeading: heading,
        });
        if (!prev) {
          tracks.set(u.id, fresh());
          continue;
        }
        const sameFix = prev.fixLat === u.lat && prev.fixLon === u.lon && (fixAtMs === null || fixAtMs === prev.fixAtMs);
        if (sameFix) {
          // Nothing new about where it is. A change of state (stopped / started / turned) re-bases
          // the track from what is drawn right now so nothing jumps.
          if (prev.moving === u.moving && prev.speedMph === speedMph && prev.heading === heading) continue;
          const cur = drawn(prev, now);
          const t = fresh();
          const target = targetAt({ ...t, fixAgeMs: prev.fixAgeMs + (now - prev.arrivedAt) }, now);
          tracks.set(u.id, {
            ...t,
            fixAgeMs: prev.fixAgeMs + (now - prev.arrivedAt),
            offLat: cur.lat - target.lat,
            offLon: cur.lon - target.lon,
            blendMs: BLEND_MIN_MS * 2,
            fromHeading: cur.heading ?? heading,
          });
          continue;
        }
        const cur = drawn(prev, now);
        const gap = fixAtMs !== null && prev.fixAtMs !== null ? fixAtMs - prev.fixAtMs : now - prev.arrivedAt;
        const next = fresh();
        const target = targetAt(next, now);
        tracks.set(u.id, {
          ...next,
          offLat: cur.lat - target.lat,
          offLon: cur.lon - target.lon,
          blendMs: blendDuration(gap),
          fromHeading: cur.heading ?? heading,
        });
      }
      for (const id of tracks.keys()) if (!seen.has(id)) tracks.delete(id);
    },

    /** Where (and facing which way) each unit is drawn at `now`. */
    positions(now: number): Map<string, DrawnUnit> {
      const out = new Map<string, DrawnUnit>();
      for (const [id, t] of tracks) out.set(id, drawn(t, now));
      return out;
    },

    /** True while any marker is still gliding or extrapolating — the frame loop stops otherwise. */
    active(now: number): boolean {
      for (const t of tracks.values()) {
        const age = now - t.arrivedAt;
        if (age < t.blendMs && (t.offLat !== 0 || t.offLon !== 0)) return true;
        if (t.heading !== null && t.fromHeading !== null && t.fromHeading !== t.heading && age < Math.min(TURN_MS_MAX, t.blendMs)) return true;
        if (extrapolating(t, now)) return true;
      }
      return false;
    },
  };
}

export type MotionTracker = ReturnType<typeof createMotionTracker>;
