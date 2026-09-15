// owner: web-dashboard-fleet — W-01 `Live fleet` card map preview (web/tz.md §10 W-01).
// Re-exports the shared MapLibre integration; this module (not FleetMap itself) is what the
// Dashboard's `React.lazy()` call points at, so the map chunk only loads on screens that draw one.
import FleetMap from '@/shared/map/FleetMap';
import { DutyBadge } from '@/shared/ui/Badge';
import type { LiveFleetUnit } from '@/shared/api/liveFleet';

const LEGEND: LiveFleetUnit['dutyStatus'][] = ['DRIVING', 'ON_DUTY', 'SLEEPER', 'OFF_DUTY'];

export default function DashboardMapPreview({ units }: { units: LiveFleetUnit[] }) {
  return (
    <div className="relative h-map-preview overflow-hidden rounded-md">
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
