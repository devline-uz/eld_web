// web/tz.md W-11 — depart-date range bounds/validation (`PeriodDropdown` + Filters drawer).
import { describe, expect, it } from 'vitest';
import { isRealCalendarDate, validateDepartRange } from './periodRange';

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

describe('validateDepartRange', () => {
  const today = new Date(2026, 8, 19);

  it('accepts empty fields, past, future and single-day ranges', () => {
    const ok = { fromError: null, toError: null };
    expect(validateDepartRange(null, null, today)).toEqual(ok);
    expect(validateDepartRange('2025-01-01', '2025-03-31', today)).toEqual(ok);
    expect(validateDepartRange('2026-09-01', '2026-11-07', today)).toEqual(ok);
    expect(validateDepartRange('2026-09-19', '2026-09-19', today)).toEqual(ok);
  });

  it('rejects years like 1000 and 5000', () => {
    expect(validateDepartRange('1000-01-01', null, today).fromError).toBe('Must be on or after 1970-01-01.');
    expect(validateDepartRange(null, '5000-01-01', today).toError).toBe('Must be on or before 2027-12-31.');
  });

  it('rejects malformed dates and a To before From', () => {
    expect(validateDepartRange('50000-01-01', null, today).fromError).toBe('Enter a real date.');
    expect(validateDepartRange('2026-09-10', '2026-09-01', today).toError).toBe('Must be on or after the From date.');
  });
});
