// web/tz.md W-11 — custom Date Range bounds/validation for the `PeriodDropdown` popover.
import { describe, expect, it } from 'vitest';
import { customFromBounds, customToBounds, isRealCalendarDate, validateCustomFrom, validateCustomTo } from './periodRange';

const TODAY = new Date('2026-09-18T12:00:00.000Z');

describe('isRealCalendarDate', () => {
  it('accepts a real calendar date', () => {
    expect(isRealCalendarDate('2026-09-18')).toBe(true);
  });

  it('rejects a non-existent day (date-fns would otherwise roll it over)', () => {
    expect(isRealCalendarDate('2026-02-31')).toBe(false);
  });

  it('rejects a wrong-length year', () => {
    expect(isRealCalendarDate('20266-09-18')).toBe(false);
    expect(isRealCalendarDate('266-09-18')).toBe(false);
  });

  it('rejects malformed strings', () => {
    expect(isRealCalendarDate('')).toBe(false);
    expect(isRealCalendarDate('2026/09/18')).toBe(false);
    expect(isRealCalendarDate('not-a-date')).toBe(false);
  });
});

describe('customFromBounds', () => {
  it('is [1970-01-01, yesterday]', () => {
    expect(customFromBounds(TODAY)).toEqual({ min: '1970-01-01', max: '2026-09-17' });
  });
});

describe('customToBounds', () => {
  it('is [From + 1 day, today] when From is set', () => {
    expect(customToBounds('2026-09-10', TODAY)).toEqual({ min: '2026-09-11', max: '2026-09-18' });
  });

  it('falls back to 1970-01-02 when From is empty', () => {
    expect(customToBounds(null, TODAY)).toEqual({ min: '1970-01-02', max: '2026-09-18' });
  });

  it('falls back to 1970-01-02 when From is not a real date', () => {
    expect(customToBounds('2026-02-31', TODAY)).toEqual({ min: '1970-01-02', max: '2026-09-18' });
  });
});

describe('validateCustomFrom', () => {
  it('allows empty (not required)', () => {
    expect(validateCustomFrom('', TODAY)).toBeNull();
  });

  it('allows yesterday', () => {
    expect(validateCustomFrom('2026-09-17', TODAY)).toBeNull();
  });

  it('rejects today and future dates', () => {
    expect(validateCustomFrom('2026-09-18', TODAY)).toMatch(/on or before/);
    expect(validateCustomFrom('2026-12-25', TODAY)).toMatch(/on or before/);
  });

  it('rejects before the 1970 floor', () => {
    expect(validateCustomFrom('1969-12-31', TODAY)).toMatch(/on or after/);
  });

  it('rejects a non-existent date', () => {
    expect(validateCustomFrom('2026-02-31', TODAY)).toBe('Enter a real date.');
  });
});

describe('validateCustomTo', () => {
  it('allows empty (not required)', () => {
    expect(validateCustomTo('', '2026-09-01', TODAY)).toBeNull();
  });

  it('allows today', () => {
    expect(validateCustomTo('2026-09-18', '2026-09-01', TODAY)).toBeNull();
  });

  it('rejects a To equal to From', () => {
    expect(validateCustomTo('2026-09-01', '2026-09-01', TODAY)).toMatch(/later than the From date/);
  });

  it('rejects a To before From', () => {
    expect(validateCustomTo('2026-08-30', '2026-09-01', TODAY)).toMatch(/later than the From date/);
  });

  it('rejects a To after today', () => {
    expect(validateCustomTo('2026-09-19', '2026-09-01', TODAY)).toMatch(/on or before/);
  });

  it('rejects a non-existent date', () => {
    expect(validateCustomTo('2026-04-31', '2026-09-01', TODAY)).toBe('Enter a real date.');
  });
});
