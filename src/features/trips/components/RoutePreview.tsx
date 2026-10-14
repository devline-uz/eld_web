// W-11 right rail (and the 11.10 Create trip form): real map of the pickup → intermediate stops →
// delivery route. `waypoints` must already be in route order; stops that cannot be placed are skipped.
import { lazy, Suspense, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { useTripRoute, type RouteStop } from '../lib/useTripRoute';

const RouteMap = lazy(() => import('@/shared/map/RouteMap'));

const BOX = 'mt-3 h-48 overflow-hidden rounded-md bg-bg-subtle';

export interface RouteSummary {
  distanceMi: number;
  durationSec: number | null;
}

export function RoutePreview({
  pickup,
  delivery,
  waypoints,
  onSummary,
}: {
  pickup: RouteStop | null;
  delivery: RouteStop | null;
  /** Intermediate stops in route order (between the pickup and the delivery). */
  waypoints?: readonly RouteStop[];
  /** LIVE-029 — told the road route's length / drive time once known (the Create trip form fills
   * Distance and Estimated drive time from it). Not called for a straight-line fallback. */
  onSummary?: (summary: RouteSummary) => void;
}) {
  const route = useTripRoute(pickup, delivery, waypoints);
  const distanceMi = route.status === 'ready' ? route.distanceMi : null;
  const durationSec = route.status === 'ready' ? route.durationSec : null;
  useEffect(() => {
    if (onSummary && distanceMi != null) onSummary({ distanceMi, durationSec });
    // `onSummary` is a callback prop; only a new route should re-report.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distanceMi, durationSec]);
  if (route.status === 'loading') {
    return <div className={BOX} role="status" aria-label="Loading route" data-testid="route-loading"><div className="size-full animate-pulse bg-bg-subtle" /></div>;
  }
  if (route.status === 'no-location') {
    return (
      <div className={`${BOX} flex flex-col items-center justify-center gap-1 text-center`} role="status">
        <MapPin size={20} className="text-text-muted" aria-hidden="true" />
        <p className="text-body-strong text-text">Route unavailable</p>
        <p className="max-w-56 text-caption text-text-muted">This trip has no pickup or delivery location that can be placed on a map.</p>
      </div>
    );
  }
  return (
    <div className={`${BOX} relative`}>
      <Suspense fallback={<div className="size-full animate-pulse bg-bg-subtle" />}>
        <RouteMap pickup={route.pickup} delivery={route.delivery} waypoints={route.waypoints} line={route.line} approximate={route.approximate} />
      </Suspense>
      {!route.routing && route.approximate && (
        <span className="absolute bottom-1 left-1 rounded bg-bg-surface px-1.5 py-0.5 text-caption text-text-muted">
          {route.routingConfigured ? 'Approximate route (straight line)' : 'Straight line — road routing is not configured'}
        </span>
      )}
    </div>
  );
}
