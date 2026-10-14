import { describe, expect, it } from 'vitest';
import { recordedBySubtitle } from './recordedBy';

const eld = { deviceId: 'dev-1', serial: 'PT30_D3ED', vehicleId: 'veh-106', unitNumber: '106' };

describe('recordedBySubtitle (LIVE-005)', () => {
  it('names the ELD serial and its unit instead of a hard-coded "Not assigned"', () => {
    expect(recordedBySubtitle([eld], 'EDT')).toBe('Recorded by ELD PT30_D3ED (Unit #106) · all times EDT');
  });

  it('lists every ELD of a day spent in two trucks', () => {
    expect(
      recordedBySubtitle([eld, { ...eld, deviceId: 'dev-2', serial: 'PT30_AAAA', unitNumber: '#101' }], 'EDT'),
    ).toBe('Recorded by ELD PT30_D3ED (Unit #106), PT30_AAAA (Unit #101) · all times EDT');
  });

  it('says when a unit had no ELD paired', () => {
    expect(recordedBySubtitle([{ ...eld, deviceId: null, serial: null }], 'EDT')).toBe(
      'Recorded by ELD Unit #106 (no ELD paired) · all times EDT',
    );
  });

  it('says a day has no ELD records, and claims nothing while the answer is unknown', () => {
    expect(recordedBySubtitle([], 'EDT')).toBe('No ELD records on this day · all times EDT');
    expect(recordedBySubtitle(undefined, 'EDT')).toBe('Recorded by ELD — · all times EDT');
  });
});
