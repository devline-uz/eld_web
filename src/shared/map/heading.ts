// owner: web-dashboard-fleet — which way a unit's map marker points (web/decisions.md WD-076).
// `GET /live/fleet` carries `headingDeg` (degrees clockwise from true north); when it is null the
// heading is derived from the unit's own movement between two polls/patches, and when the unit is
// standing still the last known heading is kept, so a parked truck does not spin back to north.

export interface LatLon {
  lat: number;
  lon: number;
}

/** Below this distance two fixes are GPS jitter, not movement — no new bearing is derived. */
export const MIN_MOVE_METERS = 25;

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** `[0, 360)` or `null` for anything that is not a finite number. */
export function normalizeHeading(deg: number | null | undefined): number | null {
  if (typeof deg !== 'number' || !Number.isFinite(deg)) return null;
  const n = ((deg % 360) + 360) % 360;
  return n === 360 ? 0 : n;
}

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from `a` to `b`, degrees clockwise from north in `[0, 360)`. */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return normalizeHeading(toDeg(Math.atan2(y, x)))!;
}

export interface HeadingUnit extends LatLon {
  id: string;
  headingDeg?: number | null;
}

interface Track {
  /** Position the last bearing was measured from — only moved on real movement, so slow creep
   * below `MIN_MOVE_METERS` per update still accumulates into a bearing eventually. */
  anchor: LatLon;
  heading: number | null;
}

/** Remembers every unit's last anchor/heading across updates. `update()` is idempotent for the
 * same input (a repeated call sees zero movement and keeps the heading), so it is safe under
 * React StrictMode's double-invoked effects. */
export function createHeadingTracker() {
  const tracks = new Map<string, Track>();

  return {
    update(units: readonly HeadingUnit[]): ReadonlyMap<string, number | null> {
      const out = new Map<string, number | null>();
      for (const u of units) {
        const reported = normalizeHeading(u.headingDeg);
        const prev = tracks.get(u.id);
        const here = { lat: u.lat, lon: u.lon };
        let track: Track;
        if (!prev) {
          track = { anchor: here, heading: reported };
        } else if (distanceMeters(prev.anchor, here) >= MIN_MOVE_METERS) {
          track = { anchor: here, heading: reported ?? bearingDeg(prev.anchor, here) };
        } else {
          track = { anchor: prev.anchor, heading: reported ?? prev.heading };
        }
        tracks.set(u.id, track);
        out.set(u.id, track.heading);
      }
      return out;
    },
  };
}

export type HeadingTracker = ReturnType<typeof createHeadingTracker>;
