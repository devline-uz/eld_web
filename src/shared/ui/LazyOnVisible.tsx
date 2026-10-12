// owner: web-perf — mount heavy children (MapLibre, charts) only once their slot scrolls near the
// viewport (WB-257). Until then the caller's placeholder holds the exact same box, so nothing shifts
// when the real content arrives (no CLS). Without IntersectionObserver (jsdom, very old browsers)
// the children are never mounted — the placeholder is the whole render; pass `eager` to opt out.
// `fallbackMs` mounts anyway when the observer has not fired by then, or as soon as the tab turns
// visible: a dashboard opened in a background tab never intersects, so the card stayed a pulsing
// skeleton forever (QA dashboard lazy map).
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function LazyOnVisible({
  children,
  placeholder,
  rootMargin = '200px',
  eager = false,
  fallbackMs,
}: {
  children: ReactNode;
  /** Same size as the real content — it is what occupies the slot until it becomes visible. */
  placeholder: ReactNode;
  rootMargin?: string;
  eager?: boolean;
  /** Mount after this many ms (or on `visibilitychange` → visible) even if never intersected. */
  fallbackMs?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(eager);

  useEffect(() => {
    if (visible) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  useEffect(() => {
    // Only where the observer exists (every real browser): without it (jsdom) the documented
    // "never mounted" behaviour stays.
    if (visible || fallbackMs === undefined || typeof IntersectionObserver === 'undefined') return;
    const show = () => setVisible(true);
    const timer = window.setTimeout(show, fallbackMs);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') show();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [visible, fallbackMs]);

  return visible ? <>{children}</> : <div ref={ref}>{placeholder}</div>;
}
