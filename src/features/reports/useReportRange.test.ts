// WB-102 — a half-specified report deep link keeps the half it names.
import { describe, expect, it } from 'vitest';
import { resolveRange } from './useReportRange';

const today = '2026-09-18';

describe('resolveRange', () => {
  it('keeps a complete, ordered range', () => {
    expect(resolveRange('2026-01-01', '2026-01-31', today)).toEqual({ from: '2026-01-01', to: '2026-01-31' });
  });

  it('runs a from-only link to today', () => {
    expect(resolveRange('2026-01-01', '', today)).toEqual({ from: '2026-01-01', to: today });
  });

  it('starts a to-only link on the first of that month', () => {
    expect(resolveRange('', '2026-03-12', today)).toEqual({ from: '2026-03-01', to: '2026-03-12' });
  });

  it('falls back to month to date for a missing or inverted pair', () => {
    expect(resolveRange('', '', today)).toEqual({ from: '2026-09-01', to: today });
    expect(resolveRange('2026-05-10', '2026-05-01', today)).toEqual({ from: '2026-09-01', to: today });
    expect(resolveRange('garbage', 'nope', today)).toEqual({ from: '2026-09-01', to: today });
  });
});
