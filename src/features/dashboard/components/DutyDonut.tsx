// owner: web-dashboard-fleet — W-01 `Duty status · now` donut (web/tz.md §10 W-01).
// WB-257 — a hand-written SVG ring: Recharts (97 KB gzip) was loaded for this one chart. Four
// stroked circles, each drawing its share of the ring with `stroke-dasharray`; colours are the
// duty-status palette tokens (web-design-tokens: Driving success · On-duty danger · Sleeper
// violet · Off-duty neutral). The legend buttons below stay the keyboard/AT path.
import type { DutyStatus } from '@/shared/ui/Badge';
import { DutyBadge } from '@/shared/ui/Badge';
import type { LiveFleetUnit } from '@/shared/api/liveFleet';
import { formatPercent } from '@/shared/format/numbers';
import { allocatePercents } from '../lib/allocatePercents';
import { dutyLegendLabel } from '../lib/dutyLegendLabel';
import { CIRCUMFERENCE, DONUT_RADIUS, DONUT_SIZE, DONUT_THICKNESS, donutArcs } from '../lib/donutArcs';

const SEGMENTS: DutyStatus[] = ['DRIVING', 'ON_DUTY', 'SLEEPER', 'OFF_DUTY'];

const SEGMENT_COLOR: Partial<Record<DutyStatus, string>> = {
  DRIVING: 'var(--color-success)',
  ON_DUTY: 'var(--color-danger)',
  SLEEPER: 'var(--color-violet)',
  OFF_DUTY: 'var(--color-neutral)',
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

  const labels = counted.map((s, index) => dutyLegendLabel(s.status, s.count, percents[index] ?? 0));

  return (
    // Desktop-only +50px so this card keeps pace with the `Live fleet` map preview beside it
    // (both grow by the same 50px at `xl:`); mobile and tablet stay exactly as they were.
    <div className="flex flex-col items-center gap-4 xl:pb-duty-donut-xl-pad">
      <div className="relative">
        <svg
          role="img"
          aria-label={`Duty status now: ${labels.join('; ')}`}
          width={DONUT_SIZE}
          height={DONUT_SIZE}
          viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
          className="block"
        >
          <g transform={`rotate(-90 ${DONUT_SIZE / 2} ${DONUT_SIZE / 2})`}>
            {donutArcs(counted).map((arc) => (
              <circle
                key={arc.status}
                cx={DONUT_SIZE / 2}
                cy={DONUT_SIZE / 2}
                r={DONUT_RADIUS}
                fill="none"
                stroke={SEGMENT_COLOR[arc.status]}
                strokeWidth={DONUT_THICKNESS}
                strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
                strokeDashoffset={-arc.offset}
                onClick={onSegmentClick ? () => onSegmentClick(arc.status) : undefined}
                className={onSegmentClick ? 'cursor-pointer' : undefined}
                data-testid="duty-donut-segment"
                data-status={arc.status}
              >
                <title>{labels[SEGMENTS.indexOf(arc.status)]}</title>
              </circle>
            ))}
          </g>
        </svg>
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
            // Stage 3 — the visible pieces (badge, count, percent) otherwise run together as one
            // unseparated accessible name; give the row a real sentence instead.
            aria-label={labels[index]}
            className="flex items-center justify-between text-body"
          >
            <DutyBadge status={s.status} />
            <span className="flex items-center gap-3" aria-hidden="true">
              <span className="tabular-nums font-semibold text-text">{s.count}</span>
              <span className="tabular-nums text-text-muted">{formatPercent(percents[index])}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
