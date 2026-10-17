// Live Fleet marker motion (backend D-149). Pure (no MapLibre, no timers): FleetMap calls
// `update()` when data changes and `positions()` once per animation frame.
//
//  * The fix is the truth — a marker is only ever drawn on a received fix or on the straight line
//    between the fix it was drawn at and the newest one. There is no dead reckoning: a DRIVING unit
//    is never pushed past its last fix along its heading, however fast it goes.
//  * Short glide — a new fix is not a teleport: the marker slides from where it is DRAWN to the new
//    fix over `GLIDE_MS`, linearly in lat/lon, and the heading turns along the shortest arc in the
//    same time. Once the glide is over the drawn point is the fix itself (=== its lat/lon) and
//    `active()` turns false, so the frame loop stops.
//  * No snapping to roads — there is no routing service; the path is a straight line.

/** How long a marker takes to slide (and turn) onto a new fix. */
export const GLIDE_MS = 1000;

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

export interface MotionUnit {
  id: string;
  lat: number;
  lon: number;
  /** Resolved heading (reported or derived), degrees clockwise from north. */
  heading?: number | null;
}

export interface DrawnUnit {
  lat: number;
  lon: number;
  heading: number | null;
}

interface Track {
  fixLat: number;
  fixLon: number;
  /** Monotonic time (the `now` passed to update) the glide onto this fix started. */
  arrivedAt: number;
  /** Drawn position minus the fix at arrival; decays linearly to 0 over `GLIDE_MS`. */
  offLat: number;
  offLon: number;
  heading: number | null;
  /** Heading drawn at arrival, turned toward `heading` over `GLIDE_MS`. */
  fromHeading: number | null;
}

function gliding(t: Track, now: number): boolean {
  return now - t.arrivedAt < GLIDE_MS;
}

function drawn(t: Track, now: number): DrawnUnit {
  // Settled: exactly the fix — no arithmetic that could leave a rounding residue.
  if (!gliding(t, now)) return { lat: t.fixLat, lon: t.fixLon, heading: t.heading };
  const p = Math.max(0, (now - t.arrivedAt) / GLIDE_MS);
  const w = 1 - p;
  const heading = t.heading !== null && t.fromHeading !== null ? lerpAngle(t.fromHeading, t.heading, p) : t.heading;
  return { lat: t.fixLat + t.offLat * w, lon: t.fixLon + t.offLon * w, heading };
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
        const prev = tracks.get(u.id);
        if (!prev) {
          tracks.set(u.id, { fixLat: u.lat, fixLon: u.lon, arrivedAt: now, offLat: 0, offLon: 0, heading, fromHeading: heading });
          continue;
        }
        if (prev.fixLat === u.lat && prev.fixLon === u.lon && prev.heading === heading) continue;
        // A new fix (or a new heading on the same fix) glides in from what is drawn right now.
        const cur = drawn(prev, now);
        tracks.set(u.id, {
          fixLat: u.lat,
          fixLon: u.lon,
          arrivedAt: now,
          offLat: cur.lat - u.lat,
          offLon: cur.lon - u.lon,
          heading,
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

    /** True while any marker is still gliding or turning — the frame loop stops otherwise. */
    active(now: number): boolean {
      for (const t of tracks.values()) {
        if (!gliding(t, now)) continue;
        if (t.offLat !== 0 || t.offLon !== 0) return true;
        if (t.heading !== null && t.fromHeading !== null && t.fromHeading !== t.heading) return true;
      }
      return false;
    },
  };
}

export type MotionTracker = ReturnType<typeof createMotionTracker>;
