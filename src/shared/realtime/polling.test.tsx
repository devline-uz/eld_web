// owner: web-realtime — the named polling constants standing in for §7.4's missing events, and
// their visibility gating.
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import {
  DASHBOARD_POLL_MS,
  HOS_LOGS_POLL_MS,
  LIVE_FLEET_POLL_MS,
  useVisiblePolling,
} from './polling';

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

function Probe({ onTick, enabled }: { onTick: () => void; enabled?: boolean }) {
  useVisiblePolling(1_000, onTick, enabled);
  return null;
}

describe('polling constants', () => {
  it('are the documented per-screen values', () => {
    expect(DASHBOARD_POLL_MS).toBe(30_000);
    expect(LIVE_FLEET_POLL_MS).toBe(30_000);
    expect(HOS_LOGS_POLL_MS).toBe(60_000);
  });
});

describe('useVisiblePolling', () => {
  afterEach(() => {
    vi.useRealTimers();
    setVisibility('visible');
  });

  it('ticks on the given interval while the tab is visible', () => {
    vi.useFakeTimers();
    setVisibility('visible');
    const onTick = vi.fn();
    render(<Probe onTick={onTick} />);

    vi.advanceTimersByTime(3_000);
    expect(onTick).toHaveBeenCalledTimes(3);
  });

  it('does not tick while hidden', () => {
    vi.useFakeTimers();
    setVisibility('hidden');
    const onTick = vi.fn();
    render(<Probe onTick={onTick} />);

    vi.advanceTimersByTime(5_000);
    expect(onTick).not.toHaveBeenCalled();
  });

  it('does not tick when disabled', () => {
    vi.useFakeTimers();
    setVisibility('visible');
    const onTick = vi.fn();
    render(<Probe onTick={onTick} enabled={false} />);

    vi.advanceTimersByTime(5_000);
    expect(onTick).not.toHaveBeenCalled();
  });
});
