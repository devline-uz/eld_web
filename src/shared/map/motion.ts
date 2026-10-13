// Live Fleet marker motion (backend D-149): markers glide like a navigation app instead of jumping
// from fix to fix. Between two `telemetry.point` frames a DRIVING unit keeps moving along its
// heading at its reported speed (dead reckoning, capped so a silent unit never drifts far), and
// every new fix is blended in over CORRECT_MS from wherever the marker is drawn — no snap back.
// Pure (no MapLibre, no timers): FleetMap calls `update()` on new data and `positions()` per frame.

const CORRECT_MS = 1200;
/** Dead reckoning stops this long after the last fix — a unit that went quiet stays put. */
const EXTRAPOLATE_MAX_MS = 6000;
const MIN_SPEED_MPH = 3;
const MPH_TO_MPS = 0.44704;
const M_PER_DEG_LAT = 111_320;

export interface MotionUnit {
  id: string;
  lat: number;
  lon: number;
  speedMph?: number | null;
  /** Resolved heading (reported or derived), degrees clockwise from north. */
  heading?: number | null;
  /** Only a unit that is actually driving is extrapolated. */
  moving: boolean;
}

interface Track {
  fixLat: number;
  fixLon: number;
  fixAt: number;
  /** Drawn position minus the new fix at `fixAt`; decays to zero over CORRECT_MS. */
  offLat: number;
  offLon: number;
  speedMps: number;
  heading: number | null;
}

function deadReckon(t: Track, now: number): { lat: number; lon: number } {
  if (t.speedMps <= 0 || t.heading === null) return { lat: t.fixLat, lon: t.fixLon };
  const dt = Math.min(Math.max(0, now - t.fixAt), EXTRAPOLATE_MAX_MS) / 1000;
  const d = t.speedMps * dt;
  const rad = (t.heading * Math.PI) / 180;
  const cosLat = Math.max(0.01, Math.cos((t.fixLat * Math.PI) / 180));
  return {
    lat: t.fixLat + (d * Math.cos(rad)) / M_PER_DEG_LAT,
    lon: t.fixLon + (d * Math.sin(rad)) / (M_PER_DEG_LAT * cosLat),
  };
}

function drawn(t: Track, now: number): { lat: number; lon: number } {
  const p = deadReckon(t, now);
  const k = Math.max(0, 1 - (now - t.fixAt) / CORRECT_MS);
  // Ease-out: most of the correction happens early, the tail is imperceptible.
  const w = k * k;
  return { lat: p.lat + t.offLat * w, lon: p.lon + t.offLon * w };
}

export function createMotionTracker() {
  const tracks = new Map<string, Track>();

  return {
    /** New data (a poll or a patched frame). Unchanged fixes keep their track untouched. */
    update(units: readonly MotionUnit[], now: number): void {
      const seen = new Set<string>();
      for (const u of units) {
        seen.add(u.id);
        const speedMps = u.moving && (u.speedMph ?? 0) >= MIN_SPEED_MPH ? (u.speedMph ?? 0) * MPH_TO_MPS : 0;
        const heading = u.heading ?? null;
        const prev = tracks.get(u.id);
        if (!prev) {
          tracks.set(u.id, { fixLat: u.lat, fixLon: u.lon, fixAt: now, offLat: 0, offLon: 0, speedMps, heading });
          continue;
        }
        if (prev.fixLat === u.lat && prev.fixLon === u.lon) {
          prev.heading = heading;
          if (speedMps === 0 && prev.speedMps > 0) {
            // Stopped: freeze where the marker is drawn now and settle onto the fix from there.
            const cur = drawn(prev, now);
            Object.assign(prev, { fixAt: now, offLat: cur.lat - u.lat, offLon: cur.lon - u.lon, speedMps: 0 });
          } else {
            prev.speedMps = speedMps;
          }
          continue;
        }
        const cur = drawn(prev, now);
        tracks.set(u.id, {
          fixLat: u.lat,
          fixLon: u.lon,
          fixAt: now,
          offLat: cur.lat - u.lat,
          offLon: cur.lon - u.lon,
          speedMps,
          heading,
        });
      }
      for (const id of tracks.keys()) if (!seen.has(id)) tracks.delete(id);
    },

    /** Where each unit is drawn at `now`. */
    positions(now: number): Map<string, { lat: number; lon: number }> {
      const out = new Map<string, { lat: number; lon: number }>();
      for (const [id, t] of tracks) out.set(id, drawn(t, now));
      return out;
    },

    /** True while any marker is still gliding — the frame loop stops otherwise. */
    active(now: number): boolean {
      for (const t of tracks.values()) {
        const age = now - t.fixAt;
        if (age < CORRECT_MS && (t.offLat !== 0 || t.offLon !== 0)) return true;
        if (t.speedMps > 0 && t.heading !== null && age < EXTRAPOLATE_MAX_MS) return true;
      }
      return false;
    },
  };
}

export type MotionTracker = ReturnType<typeof createMotionTracker>;
