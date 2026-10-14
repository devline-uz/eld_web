// QA LIVE-003 — the delivery time the dispatcher records with "Mark delivered".
import { describe, expect, it } from 'vitest';
import { fromZonedTime } from 'date-fns-tz';
import { deliveredAtError } from './deliveredAt';

// Wall times below are read in this zone (the carrier's), whatever zone the test runner is in.
const TZ = 'America/Denver';
const at = (local: string) => fromZonedTime(local, TZ);
const NOW = at('2026-10-14T12:00:00').getTime();

describe('deliveredAtError', () => {
  it('accepts now and earlier times after the start', () => {
    expect(deliveredAtError('2026-10-14T12:00', { startedAt: null }, TZ, NOW)).toBeNull();
    expect(deliveredAtError('2026-10-14T09:30', { startedAt: at('2026-10-14T08:00:00').toISOString() }, TZ, NOW)).toBeNull();
  });

  it('accepts the start minute itself (the input has no seconds)', () => {
    expect(deliveredAtError('2026-10-14T08:00', { startedAt: at('2026-10-14T08:00:42').toISOString() }, TZ, NOW)).toBeNull();
  });

  it('refuses a blank value, a future time and a time before the start', () => {
    expect(deliveredAtError('', { startedAt: null }, TZ, NOW)).toBe('Enter a valid date and time.');
    expect(deliveredAtError('2026-10-14T12:10', { startedAt: null }, TZ, NOW)).toBe('Delivery time cannot be in the future.');
    expect(deliveredAtError('2026-10-14T07:59', { startedAt: at('2026-10-14T08:00:00').toISOString() }, TZ, NOW)).toBe(
      'Delivery time cannot be before the trip started.',
    );
  });
});
