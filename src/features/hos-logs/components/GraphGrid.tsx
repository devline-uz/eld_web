// owner: web-hos-logs — ⭐ the 24-hour ELD graph grid (web/tz.md §10 W-08).
//
// Hand-built SVG on purpose: no charting library produces the §395.8(g) format (four duty rows,
// 24 columns whatever the day's real length, 15-minute ticks, a continuous line with vertical
// connectors at every duty change).
//
// Geometry: the SVG's user space is one unit per quarter hour — 96 across, 104 tall — stretched
// to the card with `preserveAspectRatio="none"`. Every stroked element carries
// `vector-effect="non-scaling-stroke"`, so a 1 px rule is 1 px and the 2.5 px status line is
// 2.5 px at any width. The 25 hour rules, the 5 row rules and all 288 quarter-hour ticks are
// three `<path>` elements rather than ~320 `<line>`s: that is what keeps the render under 50 ms.
// The hour labels live in HTML above the SVG, because a non-uniform scale would squash text.
import { useMemo, useRef, useState } from 'react';
import { cn } from '@/shared/ui/cn';
import type { HosViolation, RodsDaySummary, RodsGraphSegment, UnidentifiedSegment } from '@/shared/api/hosLogs';
import {
  COLUMN_LABELS,
  GRID,
  PLOT_HEIGHT,
  PLOT_UNITS,
  ROW_LABELS,
  ROW_ORDER,
  connectorsOf,
  gridSpokenSummary,
  hourRulesPath,
  pct,
  plotSegments,
  plotUnassigned,
  plotViolations,
  quarterHourTicksPath,
  rodsDayStart,
  rowCenter,
  rowRulesPath,
  rowTop,
  rodsClock,
  rowTotals,
  segmentTooltip,
  ux,
  type PlottedSegment,
} from '../grid';

const HOUR_RULES = hourRulesPath();
const ROW_RULES = rowRulesPath();
const QUARTER_TICKS = quarterHourTicksPath();

export interface GraphGridProps {
  summary: RodsDaySummary;
  graph: RodsGraphSegment[];
  violations: HosViolation[];
  unassigned: UnidentifiedSegment[];
  timezone: string;
  /** `Wed, Sep 10, 2025` — used in the spoken summary. */
  dateLabel: string;
  /** `Eastern` — the card caption already says `all times Eastern`. */
  zone: string;
  /** Location text per segment start, taken from the log events. */
  locationAt?: (startAt: string) => string | null;
  /** Click a segment → scroll to and highlight the matching `Log events` row. */
  onSelectSegment?: (startAt: string) => void;
}

interface HoverState {
  x: number;
  fraction: number;
  segment: PlottedSegment;
}

export function GraphGrid({
  summary,
  graph,
  violations,
  unassigned,
  timezone,
  dateLabel,
  zone,
  locationAt,
  onSelectSegment,
}: GraphGridProps) {
  const plotRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  const model = useMemo(() => {
    const dayStartMs = rodsDayStart(summary.date, timezone);
    const segments = plotSegments(graph, dayStartMs, summary.dayLengthSec);
    return {
      dayStartMs,
      segments,
      connectors: connectorsOf(segments),
      violations: plotViolations(violations, dayStartMs, summary.dayLengthSec),
      unassigned: plotUnassigned(unassigned, dayStartMs, summary.dayLengthSec),
      totals: rowTotals(summary),
    };
  }, [summary, graph, violations, unassigned, timezone]);

  const spoken = gridSpokenSummary(model.totals, dateLabel, zone);

  function onMove(event: React.MouseEvent<HTMLDivElement>) {
    const box = plotRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const x = event.clientX - box.left;
    const fraction = Math.min(1, Math.max(0, x / box.width));
    const instant = model.dayStartMs + fraction * summary.dayLengthSec * 1000;
    const segment = model.segments.find(
      (candidate) =>
        Date.parse(candidate.startAt) <= instant && Date.parse(candidate.endAt) >= instant,
    );
    setHover(segment ? { x, fraction, segment } : null);
  }

  return (
    <div role="img" aria-label={spoken} className="flex items-stretch gap-3">
      {/* left column: OFF / SB / D / ON with their sub-labels */}
      <div aria-hidden className="w-hos-labels shrink-0" style={{ paddingTop: GRID.axisHeight }}>
        {ROW_ORDER.map((row) => (
          <div key={row} className="h-hos-grid-row leading-none">
            <div className="text-badge font-semibold text-text">{ROW_LABELS[row].code}</div>
            <div className="text-[0.625rem] leading-4 text-text-muted">{ROW_LABELS[row].caption}</div>
          </div>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        {/* hour axis — HTML, so the text is never stretched by the non-uniform SVG scale */}
        <div aria-hidden className="relative" style={{ height: GRID.axisHeight }}>
          {[...COLUMN_LABELS, 'M'].map((label, i) => (
            <span
              key={`label-${i}`}
              className="absolute bottom-0 -translate-x-1/2 text-[0.625rem] font-medium leading-none text-text-muted"
              style={{ left: pct(i / GRID.columns) }}
            >
              {label}
            </span>
          ))}
        </div>

        <div
          ref={plotRef}
          className="relative"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          onClick={() => hover && onSelectSegment?.(hover.segment.startAt)}
        >
          <svg
            aria-hidden
            width="100%"
            height={PLOT_HEIGHT}
            viewBox={`0 0 ${PLOT_UNITS} ${PLOT_HEIGHT}`}
            preserveAspectRatio="none"
            className="block"
          >
            <defs>
              <pattern
                id="hos-unassigned-hatch"
                width="3"
                height="6"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(20)"
              >
                <rect width="3" height="6" fill="var(--color-bg-subtle)" />
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="6"
                  stroke="var(--color-text-muted)"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              </pattern>
            </defs>

            {/* D row background — --success-soft at 40% */}
            <rect
              x="0"
              y={rowTop('D')}
              width={PLOT_UNITS}
              height={GRID.rowHeight}
              fill="var(--color-success-soft)"
              opacity="0.4"
              data-testid="hos-driving-band"
            />

            {/* unassigned driving — grey hatched blocks */}
            {model.unassigned.map((block) => (
              <rect
                key={block.id}
                x={ux(block.from)}
                y="0"
                width={Math.max(ux(block.to - block.from), 0.15)}
                height={PLOT_HEIGHT}
                fill="url(#hos-unassigned-hatch)"
                opacity="0.7"
                data-testid="hos-unassigned-block"
              />
            ))}

            {/* violation band, under the dashed marker */}
            {model.violations.map((violation) => (
              <rect
                key={`band-${violation.id}`}
                x={ux(violation.from)}
                y="0"
                width={Math.max(ux(violation.to - violation.from), 0.2)}
                height={PLOT_HEIGHT}
                fill="var(--color-danger-soft)"
                data-testid="hos-violation-band"
              />
            ))}

            {/* 15-minute ticks (4 px), hour rules and row rules — one path each */}
            <path
              d={QUARTER_TICKS}
              stroke="var(--color-border)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              fill="none"
              data-testid="hos-quarter-ticks"
            />
            <path
              d={HOUR_RULES}
              stroke="var(--color-border)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              fill="none"
              data-testid="hos-hour-rules"
            />
            <path
              d={ROW_RULES}
              stroke="var(--color-border)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              fill="none"
              data-testid="hos-row-rules"
            />

            {/* status line — 2.5 px in the duty colour, dashed for PC / YM */}
            {model.segments.map((segment) => (
              <line
                key={segment.key}
                x1={ux(segment.from)}
                x2={ux(segment.to)}
                y1={rowCenter(segment.row)}
                y2={rowCenter(segment.row)}
                stroke={segment.color}
                strokeWidth={GRID.statusStrokeWidth}
                strokeDasharray={segment.dashed ? '4 2' : undefined}
                vectorEffect="non-scaling-stroke"
                data-testid="hos-segment"
                data-row={segment.row}
                data-special={segment.special}
              />
            ))}

            {/* vertical connector at every duty change */}
            {model.connectors.map((connector) => (
              <line
                key={connector.key}
                x1={ux(connector.at)}
                x2={ux(connector.at)}
                y1={rowCenter(connector.fromRow)}
                y2={rowCenter(connector.toRow)}
                stroke={connector.color}
                strokeWidth={GRID.statusStrokeWidth}
                vectorEffect="non-scaling-stroke"
                data-testid="hos-connector"
              />
            ))}

            {/* violations — red dashed vertical line */}
            {model.violations.map((violation) => (
              <line
                key={`mark-${violation.id}`}
                x1={ux(violation.at)}
                x2={ux(violation.at)}
                y1="0"
                y2={PLOT_HEIGHT}
                stroke="var(--color-danger)"
                strokeWidth="1.5"
                strokeDasharray="3 2"
                vectorEffect="non-scaling-stroke"
                data-testid="hos-violation-mark"
              >
                <title>{violation.title}</title>
              </line>
            ))}

            {/* hover indicator */}
            {hover && (
              <line
                x1={ux(hover.fraction)}
                x2={ux(hover.fraction)}
                y1="0"
                y2={PLOT_HEIGHT}
                stroke="var(--color-text-secondary)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
                data-testid="hos-hover-indicator"
              />
            )}
          </svg>

          {hover && (
            <div
              role="tooltip"
              data-testid="hos-tooltip"
              className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-bg-inverse px-2 py-1 text-caption text-text-inverse shadow-pop"
              style={{ left: hover.x, top: PLOT_HEIGHT }}
            >
              {segmentTooltip(hover.segment, timezone, locationAt?.(hover.segment.startAt) ?? null)}
            </div>
          )}
        </div>
      </div>

      {/* TOTAL column */}
      <div className="w-hos-total shrink-0 text-right">
        <div
          className="text-table-head font-semibold uppercase tracking-wide text-text-muted"
          style={{ height: GRID.axisHeight }}
        >
          Total
        </div>
        {model.totals.map((total) => (
          <div
            key={total.row}
            className={cn(
              'flex h-hos-grid-row items-center justify-end tabular text-body-strong',
              total.overLimit ? 'text-danger' : 'text-text',
            )}
            data-testid={`hos-total-${total.row}`}
          >
            {total.label}
          </div>
        ))}
      </div>

      {/* the audit-proof text equivalent of everything drawn above */}
      <table className="sr-only">
        <caption>{`Duty status segments, all times ${zone}`}</caption>
        <thead>
          <tr>
            <th scope="col">Duty status</th>
            <th scope="col">Start</th>
            <th scope="col">End</th>
            <th scope="col">Duration</th>
          </tr>
        </thead>
        <tbody>
          {model.segments.map((segment) => (
            <tr key={`sr-${segment.key}`}>
              <td>{ROW_LABELS[segment.row].caption}</td>
              <td>{rodsClock(Date.parse(segment.startAt), timezone)}</td>
              <td>{rodsClock(Date.parse(segment.endAt), timezone)}</td>
              <td>{segmentTooltip(segment, timezone, null)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Daily totals</th>
            <td colSpan={3}>
              {model.totals.map((total) => `${ROW_LABELS[total.row].caption} ${total.label}`).join(', ')}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
