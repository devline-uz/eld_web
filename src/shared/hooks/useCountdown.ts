// web/tz.md §10 W-01/W-02 — "Shift ends in 00:19:34" / "Drive time left 00:00:00", a live
// per-second countdown driven by a server timestamp, not by re-fetching.
import { useEffect, useState } from 'react';

function secondsRemaining(target: string | null): number {
  if (!target) return 0;
  const diff = Math.floor((new Date(target).getTime() - Date.now()) / 1000);
  return Math.max(0, diff);
}

/** `00:19:34` / `00:00:00` — clamps at zero, never goes negative. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/**
 * Ticks every second toward `targetIso`; stops (and stays red-worthy) at 0. The initial value is
 * read once through `useState`'s lazy initializer (the one place React's purity check allows a
 * clock read); every later update happens inside the interval's own callback, never directly in
 * render or synchronously at the top of an effect. One consequence: if `targetIso` itself changes
 * (e.g. a different unit is selected), the displayed number can lag the new target by up to one
 * second until the next tick — imperceptible for a countdown, and the trade-off that keeps this
 * hook free of synchronous `setState`-in-effect calls.
 */
export function useCountdown(targetIso: string | null): number {
  const [remaining, setRemaining] = useState(() => secondsRemaining(targetIso));

  useEffect(() => {
    const timer = setInterval(() => setRemaining(secondsRemaining(targetIso)), 1000);
    return () => clearInterval(timer);
  }, [targetIso]);

  return remaining;
}

/**
 * Same clock, but for values the caller only has as "N seconds remaining as of now" (e.g. a
 * `driveRemainingSec` field) rather than an absolute deadline. The `Date.now()` snapshot is taken
 * inside a `setTimeout(…, 0)` callback — not in the render body and not synchronously at the top
 * of the effect — so it stays outside both the purity check and `set-state-in-effect`.
 */
export function useCountdownFromSeconds(seconds: number | null): number {
  const [target, setTarget] = useState<string | null>(() =>
    seconds != null ? new Date(Date.now() + seconds * 1000).toISOString() : null,
  );

  useEffect(() => {
    const resync = setTimeout(() => {
      setTarget(seconds != null ? new Date(Date.now() + seconds * 1000).toISOString() : null);
    }, 0);
    return () => clearTimeout(resync);
  }, [seconds]);

  return useCountdown(target);
}
