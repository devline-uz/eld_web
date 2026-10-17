// owner: web-dashboard-fleet — W-01 `Duty status · now` donut (web/tz.md §10 W-01).
// WB-257 — a hand-written SVG ring: Recharts (97 KB gzip) was loaded for this one chart. Stroked
// circles, each drawing its share of the ring with `stroke-dasharray`; colours are the
// duty-status palette tokens (web-design-tokens: Driving success · On-duty danger · Sleeper
// violet · Off-duty neutral). The legend buttons below stay the keyboard/AT path.
// QA LIVE-002 — the slices are the ASSIGNED DRIVERS by their own HOS status (the Drivers list's
// source), so an ELD-offline / out-of-service unit's driver is still counted, and the legend always
// sums to the subtitle's "N assigned drivers"; a driver with no computable status is "Status unknown".
import type { DriverDutyStatus, LiveFleetListUnit } from '@/shared/api/liveFleet';
import { Badge, DutyBadge } from '@/shared/ui/Badge';
import { formatPercent } from '@/shared/format/numbers';
import { allocatePercents } from '../lib/allocatePercents';
import { DONUT_LABEL, dutyLegendLabel } from '../lib/dutyLegendLabel';
import { CIRCUMFERENCE, DONUT_RADIUS, DONUT_SIZE, DONUT_THICKNESS, donutArcs } from '../lib/donutArcs';
import { DONUT_SEGMENTS, driverDutyOf, notLiveLine, summarizeDriverDuty, type DonutDutyStatus } from '../lib/driverDuty';

const SEGMENT_COLOR: Record<DonutDutyStatus, string> = {
  DRIVING: 'var(--color-success)',
  ON_DUTY: 'var(--color-danger)',
  SLEEPER: 'var(--color-violet)',
  OFF_DUTY: 'var(--color-neutral)',
  UNKNOWN: 'var(--color-border-strong)',
};

export default function DutyDonut({
  units,
  onSegmentClick,
}: {
  units: LiveFleetListUnit[];
  onSegmentClick?: (status: DriverDutyStatus) => void;
}) {
  const summary = summarizeDriverDuty(units);
  // UNKNOWN only gets a row when someone is in it — the usual legend stays the four duty statuses.
  const counted = DONUT_SEGMENTS.filter((status) => status !== 'UNKNOWN' || summary.counts.UNKNOWN > 0).map(
    (status) => ({ status, count: summary.counts[status] }),
  );
  const total = summary.assigned;
  const onDuty = summary.onDuty;
  // A stale status (ELD silent / past its plausibility cap) is still counted by the driver's last
  // known status, as the Drivers list does — say so under the legend.
  const lastKnownUnits = units.filter((u) => {
    const status = u.isStale ? driverDutyOf(u) : null;
    return status !== null && status !== 'UNKNOWN';
  });
  const lastKnown = lastKnownUnits.length;
  // FE-04 — `isStale` is broader than "ELD offline": it also covers a status past its 16 h/24 h
  // plausibility cap while the ELD is ONLINE. Only units whose `connectivity` is ELD_OFFLINE (the
  // dashboard KPI's definition) may be called "ELD offline".
  const eldOffline = lastKnownUnits.filter((u) => u.connectivity === 'ELD_OFFLINE').length;
  const percents = allocatePercents(
    counted.map((s) => s.count),
    total,
  );
  const clickHandler = (status: DonutDutyStatus) =>
    onSegmentClick && status !== 'UNKNOWN' ? () => onSegmentClick(status) : undefined;

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
                onClick={clickHandler(arc.status)}
                className={clickHandler(arc.status) ? 'cursor-pointer' : undefined}
                data-testid="duty-donut-segment"
                data-status={arc.status}
              >
                <title>{labels[counted.findIndex((c) => c.status === arc.status)]}</title>
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
            onClick={clickHandler(s.status)}
            // Stage 3 — the visible pieces (badge, count, percent) otherwise run together as one
            // unseparated accessible name; give the row a real sentence instead.
            aria-label={labels[index]}
            className="flex items-center justify-between text-body"
          >
            {s.status === 'UNKNOWN' ? (
              <Badge tone="neutral" outline>
                {DONUT_LABEL.UNKNOWN}
              </Badge>
            ) : (
              <DutyBadge status={s.status} />
            )}
            <span className="flex items-center gap-3" aria-hidden="true">
              <span className="tabular-nums font-semibold text-text">{s.count}</span>
              <span className="tabular-nums text-text-muted">{formatPercent(percents[index])}</span>
            </span>
          </button>
        ))}
        {lastKnown > 0 && (
          <p className="text-caption text-text-muted">
            {notLiveLine(lastKnown, eldOffline)}
          </p>
        )}
      </div>
    </div>
  );
}
