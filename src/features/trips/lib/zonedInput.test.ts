// LIVE-007 — `datetime-local` values read and written in the carrier zone.
import { describe, expect, it } from 'vitest';
import { isoToZonedInput, parseZonedInput, zonedInputToIso, zonedPickupRange } from './zonedInput';

describe('zonedInput', () => {
  it('reads a wall time in the given zone, not the runner zone', () => {
    expect(zonedInputToIso('2026-10-14T08:00', 'America/Denver')).toBe('2026-10-14T14:00:00.000Z');
    expect(isoToZonedInput('2026-10-14T14:00:00.000Z', 'America/Denver')).toBe('2026-10-14T08:00');
  });

  it('refuses malformed and non-existent calendar dates', () => {
    expect(parseZonedInput('', 'UTC')).toBeNull();
    expect(parseZonedInput('2027-02-29T10:00', 'UTC')).toBeNull();
    expect(parseZonedInput('20260-01-01T10:00', 'UTC')).toBeNull();
    expect(parseZonedInput('2028-02-29T10:00', 'UTC')).not.toBeNull();
  });

  it('pickup range runs from the zone midnight today through the same day next year', () => {
    const now = new Date('2026-10-14T03:00:00.000Z'); // Oct 13, 21:00 in Denver
    const { min, max } = zonedPickupRange('America/Denver', now);
    expect(min.toISOString()).toBe('2026-10-13T06:00:00.000Z');
    expect(max.toISOString()).toBe('2027-10-14T05:59:59.999Z');
  });
});
