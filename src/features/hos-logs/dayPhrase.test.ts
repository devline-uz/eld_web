import { describe, expect, it } from 'vitest';
import { dayPhrase } from './dayPhrase';

describe('dayPhrase (LIVE-017)', () => {
  it('says "today" only for the current RODS day', () => {
    expect(dayPhrase('2026-10-14', '2026-10-14')).toBe('today');
    expect(dayPhrase('2026-10-08', '2026-10-14')).toBe('on Oct 8');
  });

  it('falls back to "this day" for a malformed key', () => {
    expect(dayPhrase('abc', '2026-10-14')).toBe('this day');
  });
});
