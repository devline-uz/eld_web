// LV-02 — the Live Fleet subtitle must not read "refreshed 2 minutes ago" while it is refetching.
import { describe, expect, it } from 'vitest';
import { REFRESHING_AFTER_MS, refreshedLabel } from './refreshedLabel';

const NOW = Date.UTC(2026, 9, 15, 12, 0, 0);

describe('refreshedLabel', () => {
  it('counts seconds, then minutes, from the client fetch time', () => {
    expect(refreshedLabel(NOW - 1_000, false, NOW)).toBe('refreshed 1 second ago');
    expect(refreshedLabel(NOW - 8_000, false, NOW)).toBe('refreshed 8 seconds ago');
    expect(refreshedLabel(NOW - 125_000, false, NOW)).toBe('refreshed 2 minutes ago');
  });

  it('has no label before the first fetch', () => {
    expect(refreshedLabel(0, true, NOW)).toBeNull();
  });

  it('LV-02: a minutes-old cached snapshot being refetched reads as refreshing, not "2 minutes ago"', () => {
    expect(refreshedLabel(NOW - 125_000, true, NOW)).toBeNull();
    expect(refreshedLabel(NOW - REFRESHING_AFTER_MS, true, NOW)).toBeNull();
  });

  it('keeps the age during the regular 30 s background poll', () => {
    expect(refreshedLabel(NOW - 31_000, true, NOW)).toBe('refreshed 31 seconds ago');
  });
});
