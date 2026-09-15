// web/tz.md §10 W-01/W-02 — the live "Shift ends in" / "Drive time left" countdown.
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { formatCountdown, useCountdown, useCountdownFromSeconds } from './useCountdown';

describe('formatCountdown', () => {
  it('pads to HH:MM:SS and clamps at zero', () => {
    expect(formatCountdown(1234)).toBe('00:20:34');
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(-5)).toBe('00:00:00');
  });
});

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-12T15:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks down once a second toward an absolute ISO deadline', () => {
    const { result } = renderHook(() => useCountdown('2026-09-12T15:00:05.000Z'));
    expect(result.current).toBe(5);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(4);
    act(() => vi.advanceTimersByTime(4000));
    expect(result.current).toBe(0);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(0);
  });

  it('returns 0 for a null target', () => {
    const { result } = renderHook(() => useCountdown(null));
    expect(result.current).toBe(0);
  });
});

describe('useCountdownFromSeconds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-12T15:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts down from an "N seconds remaining as of now" value', () => {
    const { result } = renderHook(() => useCountdownFromSeconds(10));
    expect(result.current).toBe(10);
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current).toBe(7);
  });

  it('returns 0 when seconds is null', () => {
    const { result } = renderHook(() => useCountdownFromSeconds(null));
    expect(result.current).toBe(0);
  });
});
