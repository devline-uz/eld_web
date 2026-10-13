import { describe, expect, it } from 'vitest';
import {
  BLEND_MAX_MS,
  BLEND_MIN_MS,
  EXTRAPOLATE_MAX_METERS,
  EXTRAPOLATE_MAX_MS,
  FRESH_FIX_MAX_MS,
  blendDuration,
  createMotionTracker,
  extrapolationMeters,
  lerpAngle,
  offsetAlongHeading,
  shortestAngleDelta,
} from './motion';

const unit = (over: Partial<Parameters<ReturnType<typeof createMotionTracker>['update']>[0][number]> = {}) => ({
  id: 'u1',
  lat: 40,
  lon: -90,
  speedMph: 60,
  heading: 90,
  moving: true,
  ...over,
});
const metersEast = (lon: number) => (lon + 90) * 111_320 * Math.cos((40 * Math.PI) / 180);

describe('angles', () => {
  it('shortestAngleDelta takes the short way round', () => {
    expect(shortestAngleDelta(350, 10)).toBe(20);
    expect(shortestAngleDelta(10, 350)).toBe(-20);
    expect(shortestAngleDelta(0, 180)).toBe(180);
    expect(shortestAngleDelta(90, 90)).toBe(0);
  });
  it('lerpAngle crosses north instead of sweeping the long way', () => {
    expect(lerpAngle(350, 10, 0.5)).toBeCloseTo(0, 6);
    expect(lerpAngle(10, 350, 0.25)).toBeCloseTo(5, 6);
    expect(lerpAngle(350, 10, 0)).toBe(350);
    expect(lerpAngle(350, 10, 1)).toBeCloseTo(10, 6);
  });
});

describe('extrapolationMeters — dead reckoning rules', () => {
  const base = { heading: 90, speedMph: 60, moving: true, fixAgeMs: 0 };
  it('moves at speed along the heading', () => {
    expect(extrapolationMeters(base, 2000)).toBeCloseTo(53.6, 0);
  });
  it('speed 0 / null / not driving / no heading → no movement', () => {
    expect(extrapolationMeters({ ...base, speedMph: 0 }, 5000)).toBe(0);
    expect(extrapolationMeters({ ...base, speedMph: null }, 5000)).toBe(0);
    expect(extrapolationMeters({ ...base, moving: false }, 5000)).toBe(0);
    expect(extrapolationMeters({ ...base, heading: null }, 5000)).toBe(0);
  });
  it('a fix older than 90 s is stale — no extrapolation', () => {
    expect(extrapolationMeters({ ...base, fixAgeMs: FRESH_FIX_MAX_MS + 1 }, 0)).toBe(0);
    expect(extrapolationMeters({ ...base, fixAgeMs: FRESH_FIX_MAX_MS }, 0)).toBeGreaterThan(0);
  });
  it('is capped by time and by distance', () => {
    const slow = { ...base, speedMph: 10 };
    expect(extrapolationMeters(slow, EXTRAPOLATE_MAX_MS)).toBe(extrapolationMeters(slow, 10 * EXTRAPOLATE_MAX_MS));
    expect(extrapolationMeters({ ...base, speedMph: 100 }, EXTRAPOLATE_MAX_MS)).toBe(EXTRAPOLATE_MAX_METERS);
    expect(extrapolationMeters({ ...base, fixAgeMs: 80_000 }, 60_000)).toBe(extrapolationMeters({ ...base, fixAgeMs: 80_000 }, 70_000));
  });
});

describe('blendDuration', () => {
  it('follows the gap between fixes, clamped to 1…60 s', () => {
    expect(blendDuration(30_000)).toBe(30_000);
    expect(blendDuration(200)).toBe(BLEND_MIN_MS);
    expect(blendDuration(10 * 60_000)).toBe(BLEND_MAX_MS);
    expect(blendDuration(null)).toBe(BLEND_MAX_MS);
  });
});

describe('createMotionTracker — navigation-style marker motion (D-149)', () => {
  it('draws a new unit exactly at its fix', () => {
    const m = createMotionTracker();
    m.update([unit()], 0);
    expect(m.positions(0).get('u1')).toMatchObject({ lat: 40, lon: -90, heading: 90 });
  });

  it('a driving unit is extrapolated along its heading, then stops after the cap', () => {
    const m = createMotionTracker();
    m.update([unit({ speedMph: 30 })], 0);
    const at2 = m.positions(2000).get('u1')!;
    expect(at2.lat).toBeCloseTo(40, 6);
    expect(metersEast(at2.lon)).toBeCloseTo(26.8, 0);
    const capped = m.positions(EXTRAPOLATE_MAX_MS).get('u1')!;
    expect(m.positions(200_000).get('u1')).toEqual(capped);
    expect(m.active(2000)).toBe(true);
    expect(m.active(EXTRAPOLATE_MAX_MS + 1)).toBe(false);
  });

  it('a stale fix (old lastSeenAt) is not extrapolated', () => {
    const m = createMotionTracker();
    m.update([unit({ fixAtMs: 0, wallNowMs: 120_000 })], 0);
    expect(m.positions(5000).get('u1')).toMatchObject({ lat: 40, lon: -90 });
    expect(m.active(1000)).toBe(false);
  });

  it('a new fix glides in over the gap between fixes — no jump, no snap back', () => {
    const m = createMotionTracker();
    m.update([unit({ speedMph: 0, fixAtMs: 0, wallNowMs: 0 })], 0);
    const newLon = -89.99;
    m.update([unit({ speedMph: 0, lon: newLon, fixAtMs: 30_000, wallNowMs: 30_000 })], 30_000);
    expect(m.positions(30_000).get('u1')!.lon).toBeCloseTo(-90, 9); // still where it was drawn
    expect(m.positions(45_000).get('u1')!.lon).toBeCloseTo((-90 + newLon) / 2, 6); // linear, half way
    expect(m.positions(60_000).get('u1')!.lon).toBeCloseTo(newLon, 9);
    expect(m.active(59_000)).toBe(true);
    expect(m.active(60_001)).toBe(false);
  });

  it('corrects from the extrapolated position, not from the old fix', () => {
    const m = createMotionTracker();
    m.update([unit({ fixAtMs: 0, wallNowMs: 0 })], 0);
    const before = m.positions(10_000).get('u1')!;
    m.update([unit({ lon: -89.99, fixAtMs: 10_000, wallNowMs: 10_000 })], 10_000);
    expect(m.positions(10_000).get('u1')!.lon).toBeCloseTo(before.lon, 9);
  });

  it('turns the heading along the shortest arc', () => {
    const m = createMotionTracker();
    m.update([unit({ speedMph: 0, heading: 350 })], 0);
    m.update([unit({ speedMph: 0, lat: 40.0001, heading: 10 })], 60_000);
    const mid = m.positions(60_000 + 1500).get('u1')!.heading!;
    expect(mid === 0 || Math.abs(shortestAngleDelta(mid, 0)) < 1e-6).toBe(true);
    expect(m.positions(60_000 + 4000).get('u1')!.heading).toBeCloseTo(10, 6);
  });

  it('speed 0 or not DRIVING never drifts; a stop settles the marker without a jump', () => {
    const m = createMotionTracker();
    m.update([unit({ moving: false })], 0);
    expect(m.positions(5000).get('u1')).toMatchObject({ lat: 40, lon: -90 });
    expect(m.active(5000)).toBe(false);

    const d = createMotionTracker();
    d.update([unit()], 0);
    const cur = d.positions(5000).get('u1')!;
    d.update([unit({ speedMph: 0 })], 5000);
    expect(d.positions(5000).get('u1')!.lon).toBeCloseTo(cur.lon, 9);
    expect(d.positions(20_000).get('u1')).toMatchObject({ lat: 40, lon: -90 });
  });

  it('offsetAlongHeading goes north for 0° and east for 90°', () => {
    expect(offsetAlongHeading({ lat: 40, lon: -90 }, 0, 1000).lat).toBeGreaterThan(40);
    expect(offsetAlongHeading({ lat: 40, lon: -90 }, 90, 1000).lon).toBeGreaterThan(-90);
  });

  it('forgets units that left the data', () => {
    const m = createMotionTracker();
    m.update([unit(), unit({ id: 'u2' })], 0);
    m.update([unit()], 1000);
    expect([...m.positions(1000).keys()]).toEqual(['u1']);
  });
});
