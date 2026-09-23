import { describe, expect, it } from 'vitest';
import { liveFleetHref } from './liveFleetHref';

describe('liveFleetHref', () => {
  it('selects the unit via ?unit=', () => {
    expect(liveFleetHref('veh_1')).toBe('/live-fleet?unit=veh_1');
  });
  it('falls back to the plain page with no id', () => {
    expect(liveFleetHref(null)).toBe('/live-fleet');
    expect(liveFleetHref(undefined)).toBe('/live-fleet');
  });
});
