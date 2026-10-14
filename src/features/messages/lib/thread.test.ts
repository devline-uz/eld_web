import { describe, expect, it } from 'vitest';
import { messageDayKey, messageDayLabel, pickPanelTrip } from './thread';

const TZ = 'America/Denver';
const NOW = new Date('2026-10-14T18:00:00Z'); // Oct 14, 12:00 MT

describe('messageDayLabel (LIVE-026)', () => {
  it('Today / Yesterday / weekday date, in the carrier zone', () => {
    expect(messageDayLabel('2026-10-14T15:00:00Z', TZ, NOW)).toBe('Today');
    // 03:00Z on Oct 14 is still Oct 13 in Denver.
    expect(messageDayLabel('2026-10-14T03:00:00Z', TZ, NOW)).toBe('Yesterday');
    expect(messageDayLabel('2026-10-09T18:00:00Z', TZ, NOW)).toBe('Fri, Oct 9');
    expect(messageDayLabel('2025-12-31T18:00:00Z', TZ, NOW)).toBe('Wed, Dec 31, 2025');
  });

  it('day key changes on the carrier-zone midnight', () => {
    expect(messageDayKey('2026-10-14T05:59:00Z', TZ)).toBe('2026-10-13');
    expect(messageDayKey('2026-10-14T06:01:00Z', TZ)).toBe('2026-10-14');
  });
});

describe('pickPanelTrip (LIVE-026)', () => {
  const trip = (id: string, status: string, plannedStartAt: string | null, driverId = 'drv_1') => ({ id, status, plannedStartAt, driverId });

  it('an in-progress trip is current', () => {
    const out = pickPanelTrip([trip('a', 'ASSIGNED', '2026-10-14T10:00:00Z'), trip('b', 'IN_PROGRESS', '2026-10-13T10:00:00Z')], 'drv_1', NOW);
    expect(out).toMatchObject({ kind: 'current', trip: { id: 'b' } });
  });

  it('an assigned trip that has not started yet is "next", not current', () => {
    const out = pickPanelTrip([trip('later', 'ASSIGNED', '2026-10-20T10:00:00Z'), trip('soon', 'ASSIGNED', '2026-10-16T10:00:00Z')], 'drv_1', NOW);
    expect(out).toMatchObject({ kind: 'next', trip: { id: 'soon' } });
  });

  it('an assigned trip already due counts as current; other drivers are ignored', () => {
    expect(pickPanelTrip([trip('x', 'ASSIGNED', '2026-10-14T08:00:00Z')], 'drv_1', NOW)).toMatchObject({ kind: 'current' });
    expect(pickPanelTrip([trip('x', 'IN_PROGRESS', null, 'drv_2')], 'drv_1', NOW)).toBeNull();
  });
});
