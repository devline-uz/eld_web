// W-11 right rail (and the 11.10 Create trip form): real map of the pickup → intermediate stops →
// delivery route. `waypoints` must already be in route order; stops that cannot be placed are skipped.
import { lazy, Suspense } from 'react';
import { MapPin } from 'lucide-react';
import { useTripRoute, type RouteStop } from '../lib/useTripRoute';

const RouteMap = lazy(() => import('@/shared/map/RouteMap'));

const BOX = 'mt-3 h-48 overflow-hidden rounded-md bg-bg-subtle';

export function RoutePreview({
  pickup,
  delivery,
  waypoints,
}: {
  pickup: RouteStop | null;
  delivery: RouteStop | null;
  /** Intermediate stops in route order (between the pickup and the delivery). */
  waypoints?: readonly RouteStop[];
}) {
  const route = useTripRoute(pickup, delivery, waypoints);
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
        <span className="absolute bottom-1 left-1 rounded bg-bg-surface px-1.5 py-0.5 text-caption text-text-muted">Approximate route (straight line)</span>
      )}
    </div>
  );
}
