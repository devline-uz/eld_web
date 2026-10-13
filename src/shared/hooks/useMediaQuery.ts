import { useSyncExternalStore } from 'react';

/**
 * Live `window.matchMedia(query).matches`. Returns `false` where matchMedia is unavailable
 * (SSR, old test environments), so queries are written in the "is the narrow case" direction
 * (`max-width`) and the desktop layout stays the default.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;
      const mql = window.matchMedia(query);
      mql.addEventListener?.('change', onChange);
      return () => mql.removeEventListener?.('change', onChange);
    },
    () =>
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? Boolean(window.matchMedia(query)?.matches)
        : false,
    () => false,
  );
}

/** Below Tailwind's `lg` breakpoint (64rem) the sidebar becomes an off-canvas drawer. */
export const MOBILE_NAV_QUERY = '(max-width: 63.999rem)';
