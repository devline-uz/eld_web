import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RELATIVE_TICK_MS,
  formatRelative,
  formatRelativeShort,
  formatTimeWithAge,
} from './relative';
import { useNowTick, useRelativeTime } from './useRelativeTime';

const NOW = Date.parse('2026-09-12T15:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('§8.2 relative time', () => {
  it('walks every step of the rule', () => {
    expect(formatRelative(ago(5_000), NOW)).toBe('just now');
    expect(formatRelative(ago(-5_000), NOW)).toBe('just now');
    expect(formatRelative(ago(MINUTE), NOW)).toBe('1 minute ago');
    expect(formatRelative(ago(2 * MINUTE), NOW)).toBe('2 minutes ago');
    expect(formatRelative(ago(4 * HOUR), NOW)).toBe('4 h');
    expect(formatRelative(ago(26 * HOUR), NOW)).toBe('Yesterday');
    expect(formatRelative(ago(3 * DAY), NOW)).toBe('3 d');
    expect(formatRelative(ago(30 * DAY), NOW)).toBe('Aug 13, 2026');
    expect(formatRelative(new Date(NOW - 2 * MINUTE), NOW)).toBe('2 minutes ago');
    expect(formatRelativeShort(new Date(NOW - 2 * MINUTE), NOW)).toBe('2 min');
    expect(formatTimeWithAge('14:26', new Date(NOW - HOUR), NOW)).toBe('14:26 · 1h ago');
    expect(formatRelative(null, NOW)).toBe('—');
    expect(formatRelative('nope', NOW)).toBe('—');
  });

  it('uses the short form in tables', () => {
    expect(formatRelativeShort(ago(10_000), NOW)).toBe('just now');
    expect(formatRelativeShort(ago(12 * MINUTE), NOW)).toBe('12 min');
    expect(formatRelativeShort(ago(3 * HOUR), NOW)).toBe('3 h');
    expect(formatRelativeShort(ago(26 * HOUR), NOW)).toBe('Yesterday');
    expect(formatRelativeShort(ago(2 * DAY), NOW)).toBe('2 d');
    expect(formatRelativeShort(ago(400 * DAY), NOW)).toBe('Aug 08, 2025');
    expect(formatRelativeShort(undefined, NOW)).toBe('—');
  });

  it('renders the mixed `HH:MM · N ago` form', () => {
    expect(formatTimeWithAge('14:26', ago(HOUR + MINUTE), NOW)).toBe('14:26 · 1h ago');
    expect(formatTimeWithAge('14:26', ago(30 * MINUTE), NOW)).toBe('14:26 · 30m ago');
    expect(formatTimeWithAge('14:26', ago(1_000), NOW)).toBe('14:26 · 1m ago');
    expect(formatTimeWithAge('14:26', ago(3 * DAY), NOW)).toBe('14:26 · 3d ago');
    expect(formatTimeWithAge('14:26', null, NOW)).toBe('14:26');
  });
});

describe('useRelativeTime — recomputed every 30 s', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('re-renders the label on each tick', () => {
    const at = new Date(NOW - 60_000).toISOString();
    const { result } = renderHook(() => useRelativeTime(at));
    expect(result.current).toBe('1 minute ago');

    act(() => {
      vi.advanceTimersByTime(RELATIVE_TICK_MS * 2);
    });
    expect(result.current).toBe('2 minutes ago');
  });

  it('supports the short table variant and a custom interval', () => {
    const at = new Date(NOW - 12 * 60_000).toISOString();
    const { result } = renderHook(() => useRelativeTime(at, 'short'));
    expect(result.current).toBe('12 min');

    const tick = renderHook(() => useNowTick(1_000));
    const first = tick.result.current;
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(tick.result.current).toBeGreaterThan(first - 1);
  });

  it('clears its interval on unmount', () => {
    const clear = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = renderHook(() => useNowTick());
    unmount();
    expect(clear).toHaveBeenCalled();
  });
});
