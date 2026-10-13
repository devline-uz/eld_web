import { describe, expect, it } from 'vitest';
import { createMotionTracker } from './motion';

const unit = (over: Partial<Parameters<ReturnType<typeof createMotionTracker>['update']>[0][number]> = {}) => ({
  id: 'u1',
  lat: 40,
  lon: -90,
  speedMph: 60,
  heading: 90,
  moving: true,
  ...over,
});

describe('createMotionTracker — navigation-style marker motion (D-149)', () => {
  it('draws a new unit exactly at its fix', () => {
    const m = createMotionTracker();
    m.update([unit()], 0);
    expect(m.positions(0).get('u1')).toEqual({ lat: 40, lon: -90 });
  });

  it('a driving unit keeps moving along its heading between fixes, capped after 6 s', () => {
    const m = createMotionTracker();
    m.update([unit()], 0);
    const at2 = m.positions(2000).get('u1')!;
    const at6 = m.positions(6000).get('u1')!;
    const at20 = m.positions(20_000).get('u1')!;
    expect(at2.lat).toBeCloseTo(40, 6); // heading 90° = due east
    expect(at2.lon).toBeGreaterThan(-90);
    // 60 mph ≈ 26.8 m/s → 2 s ≈ 53.6 m east.
    expect((at2.lon + 90) * 111_320 * Math.cos((40 * Math.PI) / 180)).toBeCloseTo(53.6, 0);
    expect(at20).toEqual(at6);
    expect(m.active(2000)).toBe(true);
    expect(m.active(7000)).toBe(false);
  });

  it('a new fix is blended in from the drawn position — no jump back', () => {
    const m = createMotionTracker();
    m.update([unit()], 0);
    const before = m.positions(2000).get('u1')!;
    m.update([unit({ lon: -89.9995 })], 2000);
    expect(m.positions(2000).get('u1')!.lon).toBeCloseTo(before.lon, 9);
    // After the correction window the marker follows the new fix's dead-reckoned track.
    const settled = m.positions(3500).get('u1')!;
    expect(settled.lon).toBeGreaterThan(-89.9995);
  });

  it('parked or non-driving units do not drift and stop the frame loop once settled', () => {
    const m = createMotionTracker();
    m.update([unit({ moving: false })], 0);
    expect(m.positions(5000).get('u1')).toEqual({ lat: 40, lon: -90 });
    m.update([unit({ moving: false, lat: 40.001 })], 5000);
    expect(m.active(5100)).toBe(true);
    expect(m.active(7000)).toBe(false);
    expect(m.positions(7000).get('u1')).toEqual({ lat: 40.001, lon: -90 });
  });

  it('forgets units that left the data', () => {
    const m = createMotionTracker();
    m.update([unit(), unit({ id: 'u2' })], 0);
    m.update([unit()], 1000);
    expect([...m.positions(1000).keys()]).toEqual(['u1']);
  });
});
