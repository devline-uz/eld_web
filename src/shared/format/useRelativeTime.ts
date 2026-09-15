// web/tz.md §8.2 — relative labels are recomputed every 30 seconds, from one shared tick so a
// 500-row table does not run 500 timers.
import { useEffect, useState } from 'react';
import { RELATIVE_TICK_MS, formatRelative, formatRelativeShort } from './relative';
import type { DateInput } from './datetime';

/** The current 30-second tick — a timestamp that changes twice a minute. */
export function useNowTick(intervalMs: number = RELATIVE_TICK_MS): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** `useRelativeTime(lastSyncedAt)` → `12 minutes ago`, refreshed every 30 s. */
export function useRelativeTime(value: DateInput, variant: 'long' | 'short' = 'long'): string {
  const now = useNowTick();
  return variant === 'short' ? formatRelativeShort(value, now) : formatRelative(value, now);
}
