// owner: web-dashboard-fleet — W-01 `Live fleet` card map preview (web/tz.md §10 W-01).
// Re-exports the shared MapLibre integration; this module (not FleetMap itself) is what the
// Dashboard's `React.lazy()` call points at, so the map chunk only loads on screens that draw one.
import FleetMap from '@/shared/map/FleetMap';
import { DutyBadge } from '@/shared/ui/Badge';
import type { LiveFleetUnit } from '@/shared/api/liveFleet';

const LEGEND: LiveFleetUnit['dutyStatus'][] = ['DRIVING', 'ON_DUTY', 'SLEEPER', 'OFF_DUTY'];

export default function DashboardMapPreview({ units }: { units: LiveFleetUnit[] }) {
  return (
    // Desktop (≥1280px) fills the card: `h-map-preview` (260px) still drives every narrower
    // viewport, while at `xl:` the map grows to `--spacing-map-preview-xl` so the card matches
    // the `Duty status · now` card beside it exactly — no dead space under the map. `xl:mt-1`
    // tops the wrapper's `pt-4` up to the card's own 20px padding, so the inset is equal on
    // all four sides.
    <div className="relative h-map-preview overflow-hidden rounded-md xl:mt-1 xl:h-map-preview-xl">
      <FleetMap
        units={units.map((u) => ({ id: u.vehicleId, lat: u.lat!, lon: u.lon!, dutyStatus: u.dutyStatus, headingDeg: u.headingDeg }))}
      />
      <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-2 rounded-md bg-bg-surface/90 p-2 shadow-card">
        {LEGEND.map((status) => (
          <DutyBadge key={status} status={status} />
        ))}
      </div>
    </div>
  );
}
