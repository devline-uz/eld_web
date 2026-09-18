// owner: web-dashboard-fleet — W-01 `Duty status · now` donut (web/tz.md §10 W-01).
// Recharts, lazy-loaded alongside the rest of the Dashboard's own chunk (§16.3 rule 2).
import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import type { DutyStatus } from '@/shared/ui/Badge';
import { DutyBadge } from '@/shared/ui/Badge';
import type { LiveFleetUnit } from '@/shared/api/liveFleet';
import { formatPercent } from '@/shared/format/numbers';
import { allocatePercents } from '../lib/allocatePercents';

const SEGMENTS: DutyStatus[] = ['DRIVING', 'ON_DUTY', 'SLEEPER', 'OFF_DUTY'];

function token(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

const SEGMENT_TOKEN: Record<DutyStatus, string> = {
  DRIVING: '--color-success',
  ON_DUTY: '--color-danger',
  SLEEPER: '--color-violet',
  OFF_DUTY: '--color-neutral',
  YARD_MOVE: '--color-danger',
  PERSONAL_CONVEYANCE: '--color-neutral',
  ELD_OFFLINE: '--color-danger',
  IDLE: '--color-warning',
  INACTIVE: '--color-neutral',
};

export default function DutyDonut({
  units,
  onSegmentClick,
}: {
  units: LiveFleetUnit[];
  onSegmentClick?: (status: DutyStatus) => void;
}) {
  const counted = SEGMENTS.map((status) => ({
    status,
    count: units.filter((u) => u.dutyStatus === status).length,
  }));
  const total = counted.reduce((sum, s) => sum + s.count, 0);
  const onDuty = counted
    .filter((s) => s.status !== 'OFF_DUTY')
    .reduce((sum, s) => sum + s.count, 0);
  const percents = allocatePercents(
    counted.map((s) => s.count),
    total,
  );

  if (total === 0) {
    return <p className="py-8 text-center text-body text-text-muted">No drivers reporting</p>;
  }

  return (
    // Desktop-only +50px so this card keeps pace with the `Live fleet` map preview beside it
    // (both grow by the same 50px at `xl:`); mobile and tablet stay exactly as they were.
    <div className="flex flex-col items-center gap-4 xl:pb-duty-donut-xl-pad">
      <div className="relative">
        <PieChart width={180} height={180}>
          <Pie
            data={counted}
            dataKey="count"
            nameKey="status"
            innerRadius={58}
            outerRadius={78}
            paddingAngle={1}
            onClick={(entry) => onSegmentClick?.((entry as { status: DutyStatus }).status)}
            cursor={onSegmentClick ? 'pointer' : undefined}
          >
            {counted.map((s) => (
              <Cell key={s.status} fill={token(SEGMENT_TOKEN[s.status], 'gray')} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number, _name, entry) => [value, (entry.payload as { status: DutyStatus }).status]} />
        </PieChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular-nums text-kpi font-semibold text-text">{onDuty}</span>
          <span className="text-caption text-text-muted">on duty</span>
        </div>
      </div>
      <div className="flex w-full flex-col gap-2">
        {counted.map((s, index) => (
          <button
            key={s.status}
            type="button"
            onClick={() => onSegmentClick?.(s.status)}
            className="flex items-center justify-between text-body"
          >
            <DutyBadge status={s.status} />
            <span className="flex items-center gap-3">
              <span className="tabular-nums font-semibold text-text">{s.count}</span>
              <span className="tabular-nums text-text-muted">{formatPercent(percents[index])}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
