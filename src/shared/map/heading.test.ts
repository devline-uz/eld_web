import { describe, expect, it } from 'vitest';
import {
  MIN_MOVE_METERS,
  bearingDeg,
  createHeadingTracker,
  distanceMeters,
  normalizeHeading,
} from './heading';

const ORIGIN = { lat: 40, lon: -83 };
/** ~111 m per 0.001° of latitude. */
const NORTH = { lat: 40.001, lon: -83 };

describe('normalizeHeading', () => {
  it('wraps into [0, 360) and rejects non-numbers', () => {
    expect(normalizeHeading(0)).toBe(0);
    expect(normalizeHeading(360)).toBe(0);
    expect(normalizeHeading(-90)).toBe(270);
    expect(normalizeHeading(725)).toBe(5);
    expect(normalizeHeading(null)).toBeNull();
    expect(normalizeHeading(undefined)).toBeNull();
    expect(normalizeHeading(Number.NaN)).toBeNull();
    expect(normalizeHeading(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('bearingDeg', () => {
  it('is 0 north, 90 east, 180 south, 270 west', () => {
    expect(bearingDeg(ORIGIN, NORTH)).toBeCloseTo(0, 5);
    expect(bearingDeg(ORIGIN, { lat: 40, lon: -82.999 })).toBeCloseTo(90, 1);
    expect(bearingDeg(ORIGIN, { lat: 39.999, lon: -83 })).toBeCloseTo(180, 5);
    expect(bearingDeg(ORIGIN, { lat: 40, lon: -83.001 })).toBeCloseTo(270, 1);
  });
});

describe('distanceMeters', () => {
  it('measures ~111 m per 0.001° latitude', () => {
    expect(distanceMeters(ORIGIN, NORTH)).toBeGreaterThan(110);
    expect(distanceMeters(ORIGIN, NORTH)).toBeLessThan(112);
    expect(distanceMeters(ORIGIN, ORIGIN)).toBe(0);
  });
});

describe('createHeadingTracker', () => {
  it('prefers the reported headingDeg', () => {
    const t = createHeadingTracker();
    expect(t.update([{ id: 'a', ...ORIGIN, headingDeg: 274 }]).get('a')).toBe(274);
    // moved north, but the device still reports its own heading — that wins
    expect(t.update([{ id: 'a', ...NORTH, headingDeg: 12 }]).get('a')).toBe(12);
  });

  it('is unknown (null) for a first fix without headingDeg', () => {
    const t = createHeadingTracker();
    expect(t.update([{ id: 'a', ...ORIGIN, headingDeg: null }]).get('a')).toBeNull();
  });

  it('derives the bearing from movement when headingDeg is null', () => {
    const t = createHeadingTracker();
    t.update([{ id: 'a', ...ORIGIN }]);
    expect(t.update([{ id: 'a', lat: 40, lon: -83.001 }]).get('a')).toBeCloseTo(270, 1);
  });

  it('ignores GPS jitter below the threshold and keeps the last heading when stationary', () => {
    const t = createHeadingTracker();
    t.update([{ id: 'a', ...ORIGIN }]);
    t.update([{ id: 'a', ...NORTH }]); // heading ≈ 0
    // ~5 m east — jitter, not a turn
    const jitter = t.update([{ id: 'a', lat: NORTH.lat, lon: NORTH.lon + 0.00006 }]).get('a')!;
    expect(distanceMeters(NORTH, { lat: NORTH.lat, lon: NORTH.lon + 0.00006 })).toBeLessThan(MIN_MOVE_METERS);
    expect(jitter).toBeCloseTo(0, 5);
    // parked: same fix again, still ≈ 0
    expect(t.update([{ id: 'a', ...NORTH }]).get('a')).toBeCloseTo(0, 5);
  });

  it('accumulates slow creep from the last anchor instead of dropping it', () => {
    const t = createHeadingTracker();
    t.update([{ id: 'a', ...ORIGIN }]);
    // three ~11 m steps east: each alone is jitter, together they are 33 m of real movement
    let h: number | null = null;
    for (const step of [1, 2, 3]) h = t.update([{ id: 'a', lat: 40, lon: -83 + step * 0.00013 }]).get('a')!;
    expect(h).toBeCloseTo(90, 0);
  });

  it('is idempotent for a repeated update (StrictMode double effects)', () => {
    const t = createHeadingTracker();
    t.update([{ id: 'a', ...ORIGIN }]);
    const first = t.update([{ id: 'a', ...NORTH }]).get('a');
    const second = t.update([{ id: 'a', ...NORTH }]).get('a');
    expect(second).toBe(first);
  });

  it('keeps the last known heading when headingDeg later turns null', () => {
    const t = createHeadingTracker();
    t.update([{ id: 'a', ...ORIGIN, headingDeg: 88 }]);
    expect(t.update([{ id: 'a', ...ORIGIN, headingDeg: null }]).get('a')).toBe(88);
  });
});
