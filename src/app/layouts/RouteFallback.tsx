// Lazy-route fallback — a skeleton, never a spinner (web/tz.md §13, §16.2).
import { KpiRowSkeleton, LoadingState } from '@/shared/ui';

export function RouteFallback() {
  return (
    <div className="flex flex-col gap-card-gap">
      <KpiRowSkeleton />
      <LoadingState />
    </div>
  );
}
