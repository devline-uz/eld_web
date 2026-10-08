// W-11 right rail: real map of the selected trip's pickup → delivery route.
import { lazy, Suspense } from 'react';
import { MapPin } from 'lucide-react';
import type { TripStopRow } from '@/shared/api/trips';
import { useTripRoute } from '../lib/useTripRoute';

const RouteMap = lazy(() => import('@/shared/map/RouteMap'));

const BOX = 'mt-3 h-48 overflow-hidden rounded-md bg-bg-subtle';

export function RoutePreview({ pickup, delivery }: { pickup: TripStopRow | null; delivery: TripStopRow | null }) {
  const route = useTripRoute(pickup, delivery);
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
        <RouteMap pickup={route.pickup} delivery={route.delivery} line={route.line} approximate={route.approximate} />
      </Suspense>
      {!route.routing && route.approximate && (
        <span className="absolute bottom-1 left-1 rounded bg-bg-surface px-1.5 py-0.5 text-caption text-text-muted">Approximate route (straight line)</span>
      )}
    </div>
  );
}
