import { describe, expect, it } from 'vitest';
import { formatLocal } from '@/shared/format/datetime';
import { scheduleIntervalLabel, scheduleNextDueLabel } from './scheduleLabels';

describe('scheduleIntervalLabel', () => {
  it('shows both intervals when both exist', () => {
    expect(scheduleIntervalLabel({ intervalMi: 10_000, intervalDays: 30 })).toBe('Every 10,000 mi · 30 days');
  });
  it('shows a single interval', () => {
    expect(scheduleIntervalLabel({ intervalMi: 10_000, intervalDays: null })).toBe('Every 10,000 mi');
    expect(scheduleIntervalLabel({ intervalMi: null, intervalDays: 30 })).toBe('Every 30 days');
    expect(scheduleIntervalLabel({ intervalMi: null, intervalDays: 1 })).toBe('Every 1 day');
  });
  it('dash when none', () => {
    expect(scheduleIntervalLabel({ intervalMi: null, intervalDays: null })).toBe('—');
  });
});

describe('scheduleNextDueLabel', () => {
  const at = '2026-11-08T12:00:00.000Z';
  it('shows mileage and date', () => {
    expect(scheduleNextDueLabel({ nextDueMi: 12_000, nextDueAt: at })).toBe(`12,000 mi · ${formatLocal(at, 'shortDate')}`);
  });
  it('shows a single half', () => {
    expect(scheduleNextDueLabel({ nextDueMi: 12_000, nextDueAt: null })).toBe('12,000 mi');
    expect(scheduleNextDueLabel({ nextDueMi: null, nextDueAt: at })).toBe(formatLocal(at, 'shortDate'));
  });
  it('dash when none', () => {
    expect(scheduleNextDueLabel({ nextDueMi: null, nextDueAt: null })).toBe('—');
  });
  it('FE-07: the date is the carrier\'s calendar day, whatever the browser zone', () => {
    // 03:00Z on Nov 8 is still Nov 7 in Denver.
    expect(scheduleNextDueLabel({ nextDueMi: null, nextDueAt: '2026-11-08T03:00:00.000Z' }, 'America/Denver')).toBe('Nov 07, 2026');
    expect(scheduleNextDueLabel({ nextDueMi: 12_000, nextDueAt: '2026-11-08T03:00:00.000Z' }, 'Asia/Tokyo')).toBe('12,000 mi · Nov 08, 2026');
  });
});
