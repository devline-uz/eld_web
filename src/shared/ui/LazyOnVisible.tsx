// owner: web-perf — mount heavy children (MapLibre, charts) only once their slot scrolls near the
// viewport (WB-257). Until then the caller's placeholder holds the exact same box, so nothing shifts
// when the real content arrives (no CLS). Without IntersectionObserver (jsdom, very old browsers)
// the children are never mounted — the placeholder is the whole render; pass `eager` to opt out.
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function LazyOnVisible({
  children,
  placeholder,
  rootMargin = '200px',
  eager = false,
}: {
  children: ReactNode;
  /** Same size as the real content — it is what occupies the slot until it becomes visible. */
  placeholder: ReactNode;
  rootMargin?: string;
  eager?: boolean;
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

  return visible ? <>{children}</> : <div ref={ref}>{placeholder}</div>;
}
