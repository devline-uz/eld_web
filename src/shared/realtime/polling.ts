// owner: web-realtime — named polling constants standing in for the §7.4 events that do not
// exist yet. Gated on `document.visibilityState === 'visible'` (web/tz.md §6.4/§7.4) exactly like
// `shared/api/cache.ts`'s `whileVisible`. When an event ships, deleting the matching constant
// (and the `useVisiblePolling` call using it) is the whole migration — nothing else changes.
import { useEffect, useEffectEvent } from 'react';

/** Dashboard and Live Fleet stand in for the missing `fleet.position` event. */
export const DASHBOARD_POLL_MS = 30_000;
export const LIVE_FLEET_POLL_MS = 30_000;
/** HOS Logs stands in for the missing `hos.updated` event. */
export const HOS_LOGS_POLL_MS = 60_000;

function isVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

/**
 * Calls `onTick` every `ms` while the tab is visible; pauses (without drifting) while hidden and
 * resumes on the next visibility change. Screens pass one of the named constants above — never a
 * bare number — so the fallback stays a single, greppable seam.
 */
export function useVisiblePolling(ms: number, onTick: () => void, enabled = true): void {
  const tick = useEffectEvent(() => onTick());

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer || !isVisible()) return;
      timer = setInterval(() => tick(), ms);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (isVisible()) start();
      else stop();
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [ms, enabled]);
}
