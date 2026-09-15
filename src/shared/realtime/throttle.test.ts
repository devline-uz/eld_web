// owner: web-realtime — the 200 ms throttle used before every high-frequency setQueryData patch.
import { describe, expect, it, vi } from 'vitest';
import { throttle } from './throttle';

describe('throttle', () => {
  it('runs the first call immediately (leading edge)', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 200);
    throttled('a');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('collapses calls within the window into one trailing call with the latest argument', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const throttled = throttle(fn, 200);

    throttled('a');
    throttled('b');
    throttled('c');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith('a');

    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('c');

    vi.useRealTimers();
  });

  it('allows an immediate call again once the window has fully elapsed', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const throttled = throttle(fn, 200);

    throttled('a');
    vi.advanceTimersByTime(250);
    throttled('b');

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, 'a');
    expect(fn).toHaveBeenNthCalledWith(2, 'b');

    vi.useRealTimers();
  });

  it('cancel() drops a pending trailing call', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const throttled = throttle(fn, 200);

    throttled('a');
    throttled('b');
    throttled.cancel();
    vi.advanceTimersByTime(500);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith('a');

    vi.useRealTimers();
  });

  it('never drops the most recent update across several bursts', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const throttled = throttle(fn, 200);

    throttled(1);
    vi.advanceTimersByTime(50);
    throttled(2);
    vi.advanceTimersByTime(50);
    throttled(3);
    vi.advanceTimersByTime(200);

    expect(fn).toHaveBeenLastCalledWith(3);

    vi.useRealTimers();
  });
});
