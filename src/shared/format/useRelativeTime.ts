// web/tz.md §8.2 — relative labels are recomputed every 30 seconds, from one shared tick so a
// 500-row table does not run 500 timers. One module-level ticker per interval length: its single
// `setInterval` starts with the first subscriber and stops with the last (web/bugs.md WB-254).
import { useCallback, useSyncExternalStore } from 'react';
import { RELATIVE_TICK_MS, formatRelative, formatRelativeShort } from './relative';
import type { DateInput } from './datetime';

interface Ticker {
  now: number;
  listeners: Set<() => void>;
  timer: ReturnType<typeof setInterval> | null;
}

/** Keyed by interval length — in practice one or two entries for the whole app. */
const tickers = new Map<number, Ticker>();

function tickerFor(intervalMs: number): Ticker {
  let ticker = tickers.get(intervalMs);
  if (!ticker) {
    ticker = { now: Date.now(), listeners: new Set(), timer: null };
    tickers.set(intervalMs, ticker);
  }
  return ticker;
}

function subscribeTick(intervalMs: number, listener: () => void): () => void {
  const ticker = tickerFor(intervalMs);
  ticker.listeners.add(listener);
  if (ticker.timer === null) {
    ticker.timer = setInterval(() => {
      ticker.now = Date.now();
      for (const notify of ticker.listeners) notify();
    }, intervalMs);
  }
  return () => {
    ticker.listeners.delete(listener);
    if (ticker.listeners.size === 0 && ticker.timer !== null) {
      clearInterval(ticker.timer);
      ticker.timer = null;
    }
  };
}

/** The shared tick's timestamp. While the ticker is idle (no subscriber) a value older than one
 * interval (or from a clock that moved backwards) is refreshed on read, so the first row mounted
 * after a quiet period is not stale; it stays stable between reads within an interval, as
 * `useSyncExternalStore` requires. */
function readTick(intervalMs: number): number {
  const ticker = tickerFor(intervalMs);
  const age = Date.now() - ticker.now;
  if (ticker.timer === null && (age < 0 || age >= intervalMs)) ticker.now = Date.now();
  return ticker.now;
}

/** Test seam — how many intervals are running and how many components listen to them. */
export function nowTickStats(): { intervals: number; subscribers: number } {
  let intervals = 0;
  let subscribers = 0;
  for (const ticker of tickers.values()) {
    if (ticker.timer !== null) intervals += 1;
    subscribers += ticker.listeners.size;
  }
  return { intervals, subscribers };
}

/** The current 30-second tick — a timestamp that changes twice a minute, shared by every caller
 * with the same `intervalMs` (one `setInterval` however many components read it). */
export function useNowTick(intervalMs: number = RELATIVE_TICK_MS): number {
  const subscribe = useCallback((listener: () => void) => subscribeTick(intervalMs, listener), [intervalMs]);
  const getSnapshot = useCallback(() => readTick(intervalMs), [intervalMs]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** `useRelativeTime(lastSyncedAt)` → `12 minutes ago`, refreshed every 30 s. */
export function useRelativeTime(value: DateInput, variant: 'long' | 'short' = 'long'): string {
  const now = useNowTick();
  return variant === 'short' ? formatRelativeShort(value, now) : formatRelative(value, now);
}
