import { describe, expect, it } from 'vitest';
import { GLIDE_MS, createMotionTracker, lerpAngle, shortestAngleDelta, type MotionUnit } from './motion';

const unit = (over: Partial<MotionUnit> = {}): MotionUnit => ({ id: 'u1', lat: 40, lon: -90, heading: 90, ...over });

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

describe('createMotionTracker — markers sit on the received fix (D-149)', () => {
  it('the glide is short', () => {
    expect(GLIDE_MS).toBeGreaterThan(0);
    expect(GLIDE_MS).toBeLessThanOrEqual(2000);
  });

  it('draws a new unit exactly at its fix, with nothing to animate', () => {
    const m = createMotionTracker();
    m.update([unit()], 0);
    expect(m.positions(0).get('u1')).toEqual({ lat: 40, lon: -90, heading: 90 });
    expect(m.active(0)).toBe(false);
  });

  it('a unit is never drawn past its last fix, however long it goes without a new one', () => {
    const m = createMotionTracker();
    m.update([unit({ lat: 41.123456789, lon: -87.987654321, heading: 45 })], 0);
    for (const t of [0, 500, 2000, 30_000, 75_000, 600_000]) {
      expect(m.positions(t).get('u1')).toEqual({ lat: 41.123456789, lon: -87.987654321, heading: 45 });
    }
    expect(m.active(5000)).toBe(false);
  });

  it('a new fix glides in from where the marker is drawn and lands exactly on it', () => {
    const m = createMotionTracker();
    m.update([unit()], 0);
    const fix = { lat: 40.0123456789, lon: -89.9876543219 };
    m.update([unit(fix)], 30_000);
    expect(m.positions(30_000).get('u1')).toMatchObject({ lat: 40, lon: -90 }); // no teleport
    const mid = m.positions(30_000 + GLIDE_MS / 2).get('u1')!;
    expect(mid.lat).toBeCloseTo((40 + fix.lat) / 2, 9);
    expect(mid.lon).toBeCloseTo((-90 + fix.lon) / 2, 9);
    expect(m.active(30_000 + GLIDE_MS - 1)).toBe(true);
    // Settled: === the fix, and the frame loop can stop.
    const end = m.positions(30_000 + GLIDE_MS).get('u1')!;
    expect(end.lat).toBe(fix.lat);
    expect(end.lon).toBe(fix.lon);
    expect(m.active(30_000 + GLIDE_MS)).toBe(false);
    expect(m.positions(30_000 + 60_000).get('u1')).toMatchObject(fix);
  });

  it('a fix arriving mid-glide starts the next glide from the drawn point, then lands on the newest fix', () => {
    const m = createMotionTracker();
    m.update([unit()], 0);
    m.update([unit({ lon: -89.99 })], 1000);
    const drawnBefore = m.positions(1000 + GLIDE_MS / 2).get('u1')!;
    m.update([unit({ lon: -89.98 })], 1000 + GLIDE_MS / 2);
    expect(m.positions(1000 + GLIDE_MS / 2).get('u1')!.lon).toBeCloseTo(drawnBefore.lon, 12);
    expect(m.positions(1000 + GLIDE_MS / 2 + GLIDE_MS).get('u1')!.lon).toBe(-89.98);
    expect(m.active(1000 + GLIDE_MS / 2 + GLIDE_MS)).toBe(false);
  });

  it('turns the heading along the shortest arc within the glide', () => {
    const m = createMotionTracker();
    m.update([unit({ heading: 350 })], 0);
    m.update([unit({ lat: 40.0001, heading: 10 })], 60_000);
    const mid = m.positions(60_000 + GLIDE_MS / 2).get('u1')!.heading!;
    expect(Math.abs(shortestAngleDelta(mid, 0))).toBeLessThan(1e-6);
    expect(m.positions(60_000 + GLIDE_MS).get('u1')!.heading).toBe(10);
  });

  it('a heading change on the same fix only turns the marker — it never leaves the fix', () => {
    const m = createMotionTracker();
    m.update([unit({ heading: 0 })], 0);
    m.update([unit({ heading: 90 })], 5000);
    expect(m.active(5000)).toBe(true);
    expect(m.positions(5000 + GLIDE_MS / 2).get('u1')).toMatchObject({ lat: 40, lon: -90 });
    expect(m.positions(5000 + GLIDE_MS).get('u1')).toEqual({ lat: 40, lon: -90, heading: 90 });
    expect(m.active(5000 + GLIDE_MS)).toBe(false);
  });

  it('the same fix again changes nothing', () => {
    const m = createMotionTracker();
    m.update([unit()], 0);
    m.update([unit()], 10_000);
    expect(m.active(10_000)).toBe(false);
    expect(m.positions(10_000).get('u1')).toEqual({ lat: 40, lon: -90, heading: 90 });
  });

  it('forgets units that left the data', () => {
    const m = createMotionTracker();
    m.update([unit(), unit({ id: 'u2' })], 0);
    m.update([unit()], 1000);
    expect([...m.positions(1000).keys()]).toEqual(['u1']);
  });
});
