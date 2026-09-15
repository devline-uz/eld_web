import { describe, expect, it } from 'vitest';
import { formatDuration, formatDurationShort, formatMinutes } from './duration';

describe('§8.2 durations', () => {
  it('formats a segment and a KPI', () => {
    expect(formatDuration(19800)).toBe('05h 30m');
    expect(formatDuration(45600)).toBe('12h 40m');
    expect(formatDuration(0)).toBe('00h 00m');
    expect(formatDuration(-60)).toBe('00h 00m');
  });

  it('formats the compact and minute forms', () => {
    expect(formatDurationShort(19800)).toBe('5h 30m');
    expect(formatDurationShort(7200)).toBe('2h');
    expect(formatDurationShort(1800)).toBe('30m');
    expect(formatMinutes(2700)).toBe('45 min');
  });

  it('renders a missing duration as an em dash', () => {
    for (const format of [formatDuration, formatDurationShort, formatMinutes]) {
      expect(format(null)).toBe('—');
      expect(format(undefined)).toBe('—');
      expect(format(Number.POSITIVE_INFINITY)).toBe('—');
    }
  });
});
