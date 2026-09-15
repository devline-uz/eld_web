// web/tz.md §10 W-08 — the drawn grid: 24 columns, 15-minute ticks, TOTAL column, violation
// dashes, PC/YM dashes, the hatched unassigned block, role="img" + sr-only table, < 50 ms render.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GraphGrid } from './GraphGrid';
import { COLUMN_LABELS, GRID } from '../grid';
import type { HosViolation, RodsDaySummary, RodsGraphSegment, UnidentifiedSegment } from '@/shared/api/hosLogs';

const TZ = 'America/New_York';

const summary: RodsDaySummary = {
  date: '2026-09-10',
  timezone: TZ,
  offDutySec: 27_000,
  sleeperSec: 7_200,
  drivingSec: 41_160,
  onDutySec: 11_040,
  totalDistanceMi: 612,
  dayLengthSec: 86_400,
  certified: false,
  certifiedAt: null,
  certificationCount: 0,
  hasViolation: true,
  violationCount: 1,
  hasUnassigned: true,
  hasEdits: false,
};

const graph: RodsGraphSegment[] = [
  { status: 'SB', effective: 'SB', special: 'NONE', startAt: '2026-09-10T04:00:00.000Z', endAt: '2026-09-10T06:00:00.000Z', durationSec: 7200 },
  { status: 'D', effective: 'D', special: 'NONE', startAt: '2026-09-10T06:00:00.000Z', endAt: '2026-09-10T17:26:00.000Z', durationSec: 41160 },
  { status: 'ON', effective: 'ON', special: 'YM', startAt: '2026-09-10T17:26:00.000Z', endAt: '2026-09-10T20:30:00.000Z', durationSec: 11040 },
  { status: 'OFF', effective: 'OFF', special: 'PC', startAt: '2026-09-10T20:30:00.000Z', endAt: '2026-09-11T04:00:00.000Z', durationSec: 27000 },
];

const violations: HosViolation[] = [
  {
    id: 'v1',
    driverId: 'd1',
    dailyLogId: null,
    logDate: '2026-09-10',
    type: 'DRIVING_11',
    occurredAt: '2026-09-10T18:26:00.000Z',
    exceededBySec: 1560,
    detail: '11-hour driving limit exceeded by 00:26',
    status: 'OPEN',
    resolvedAt: null,
    resolvedById: null,
    resolutionNote: null,
  },
];

const unassigned: UnidentifiedSegment[] = [
  {
    id: 's1',
    vehicleId: 'veh',
    startAt: '2026-09-10T09:12:00.000Z',
    endAt: '2026-09-10T09:18:00.000Z',
    durationSec: 360,
    distanceMi: 1,
    startLocation: 'Columbus, OH terminal',
    endLocation: null,
    status: 'PENDING',
    assignedDriverId: null,
    assignedById: null,
    assignedAt: null,
    annotation: null,
    fromStoredEvents: true,
  },
];

function renderGrid(props: Partial<React.ComponentProps<typeof GraphGrid>> = {}) {
  return render(
    <GraphGrid
      summary={summary}
      graph={graph}
      violations={violations}
      unassigned={unassigned}
      timezone={TZ}
      dateLabel="Wed, Sep 10, 2026"
      zone="Eastern"
      {...props}
    />,
  );
}

describe('W-08 · 24-hour graph grid', () => {
  it('draws 25 hour rules (24 columns), 5 row rules and a 15-minute tick at every quarter', () => {
    renderGrid();
    const hourRules = screen.getByTestId('hos-hour-rules').getAttribute('d')!;
    expect(hourRules.match(/M/g)).toHaveLength(GRID.columns + 1);
    expect(hourRules).toContain(`M0 0V${GRID.rows * GRID.rowHeight}`);
    expect(hourRules).toContain(`M96 0V${GRID.rows * GRID.rowHeight}`);

    expect(screen.getByTestId('hos-row-rules').getAttribute('d')!.match(/M/g)).toHaveLength(GRID.rows + 1);

    // 4 rows × (96 quarter slots − 24 on-the-hour ones) = 288 ticks, 4 px each.
    const ticks = screen.getByTestId('hos-quarter-ticks').getAttribute('d')!;
    expect(ticks.match(/M/g)).toHaveLength(4 * (96 - 24));
    expect(ticks).toContain(`v-${GRID.tickLength}`);
    expect(ticks).not.toContain('M4 26v');
  });

  it('labels the axis M 1 … 11 N 1 … 11 M', () => {
    renderGrid();
    const labels = [...COLUMN_LABELS, 'M'];
    expect(labels).toHaveLength(25);
    expect(screen.getAllByText('M')).toHaveLength(2);
    expect(screen.getAllByText('N')).toHaveLength(1);
    expect(screen.getAllByText('11')).toHaveLength(2);
  });

  it('keeps the grid 120 px tall: a 104 px plot under a 16 px hour axis', () => {
    renderGrid();
    const svg = screen.getByTestId('hos-hour-rules').closest('svg')!;
    expect(svg.getAttribute('height')).toBe(String(GRID.rows * GRID.rowHeight));
    expect(svg.getAttribute('viewBox')).toBe(`0 0 96 ${GRID.rows * GRID.rowHeight}`);
    expect(GRID.rows * GRID.rowHeight + GRID.axisHeight).toBe(120);
  });

  it('paints the D row on --success-soft at 40%', () => {
    renderGrid();
    const band = screen.getByTestId('hos-driving-band');
    expect(band).toHaveAttribute('fill', 'var(--color-success-soft)');
    expect(band).toHaveAttribute('opacity', '0.4');
  });

  it('shows the four daily totals with driving in danger when it exceeds 11 hours', () => {
    renderGrid();
    expect(screen.getByTestId('hos-total-OFF')).toHaveTextContent('07:30');
    expect(screen.getByTestId('hos-total-SB')).toHaveTextContent('02:00');
    expect(screen.getByTestId('hos-total-D')).toHaveTextContent('11:26');
    expect(screen.getByTestId('hos-total-ON')).toHaveTextContent('03:04');
    expect(screen.getByTestId('hos-total-D').className).toContain('text-danger');
    expect(screen.getByTestId('hos-total-OFF').className).not.toContain('text-danger');
    // Every total is tabular (§3.2).
    expect(screen.getByTestId('hos-total-D').className).toContain('tabular');
  });

  it('draws the violation as a red dashed vertical line', () => {
    renderGrid();
    const mark = screen.getByTestId('hos-violation-mark');
    expect(mark).toHaveAttribute('stroke', 'var(--color-danger)');
    expect(mark).toHaveAttribute('stroke-dasharray', '3 2');
  });

  it('draws PC on the OFF row and YM on the ON row, both dashed, without moving the row', () => {
    renderGrid();
    const segments = screen.getAllByTestId('hos-segment');
    const pc = segments.find((node) => node.getAttribute('data-special') === 'PC')!;
    const ym = segments.find((node) => node.getAttribute('data-special') === 'YM')!;
    expect(pc).toHaveAttribute('data-row', 'OFF');
    expect(pc).toHaveAttribute('stroke-dasharray', '4 2');
    expect(ym).toHaveAttribute('data-row', 'ON');
    expect(ym).toHaveAttribute('stroke-dasharray', '4 2');
    // A normal segment is solid.
    const driving = segments.find((node) => node.getAttribute('data-special') === 'NONE')!;
    expect(driving).not.toHaveAttribute('stroke-dasharray');
  });

  it('draws a vertical connector at every duty change', () => {
    renderGrid();
    expect(screen.getAllByTestId('hos-connector')).toHaveLength(3);
  });

  it('hatches the unassigned segment', () => {
    renderGrid();
    expect(screen.getByTestId('hos-unassigned-block')).toHaveAttribute('fill', 'url(#hos-unassigned-hatch)');
  });

  it('exposes role="img" with a spoken summary of all four totals plus an sr-only table', () => {
    renderGrid();
    const figure = screen.getByRole('img', {
      name: '24-hour graph grid for Wed, Sep 10, 2026. Off duty 07:30, Sleeper 02:00, Driving 11:26, On duty 03:04. All times Eastern.',
    });
    expect(figure).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /Duty status segments, all times Eastern/ })).toBeInTheDocument();
    expect(screen.getAllByRole('row').length).toBeGreaterThan(graph.length);
  });

  it('shows the hover indicator and the documented tooltip, and clicking calls back', async () => {
    const onSelectSegment = vi.fn();
    const { container } = renderGrid({
      onSelectSegment,
      locationAt: () => '1.04 mi W of Harrisburg, OH',
    });
    const plot = container.querySelector('svg')!.parentElement!;
    // jsdom has no layout; pin a width so the hover maths has something to divide by.
    vi.spyOn(plot, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 960, height: 120, right: 960, bottom: 120, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);

    await userEvent.pointer({ target: plot, coords: { clientX: 480, clientY: 60 } });
    expect(screen.getByTestId('hos-hover-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('hos-tooltip').textContent).toContain('1.04 mi W of Harrisburg, OH');

    await userEvent.click(plot);
    expect(onSelectSegment).toHaveBeenCalledTimes(1);
  });

  it('keeps 24 columns on a 23-hour DST day and scales against dayLengthSec', () => {
    renderGrid({
      summary: { ...summary, date: '2026-03-08', dayLengthSec: 82_800 },
      graph: [
        {
          status: 'D',
          effective: 'D',
          special: 'NONE',
          // Local noon on the spring-forward day → 11/23 of the day, i.e. ~47.83%.
          startAt: '2026-03-08T16:00:00.000Z',
          endAt: '2026-03-08T17:00:00.000Z',
          durationSec: 3600,
        },
      ],
      violations: [],
      unassigned: [],
    });
    expect(screen.getByTestId('hos-hour-rules').getAttribute('d')!.match(/M/g)).toHaveLength(25);
    const segment = screen.getByTestId('hos-segment');
    // 11/23 of the day in plot units (96 across) — measured against dayLengthSec, not 86 400.
    expect(Number(segment.getAttribute('x1'))).toBeCloseTo((11 / 23) * 96, 2);
  });

  // The §10 W-08 budget (< 50 ms) is a BROWSER number and is pinned in grid.test.ts against the
  // model computation. A wall-clock assertion on a jsdom mount is meaningless on a shared CI box
  // (it swings 130–680 ms with unrelated suites), so the fence here is the NODE COUNT: the whole
  // 320-element lattice collapsed into three paths, and only the data scales.
  it('mounts a full day of records without a node-count regression', () => {
    const busy: RodsGraphSegment[] = Array.from({ length: 96 }, (_, i) => {
      const start = Date.parse('2026-09-10T04:00:00.000Z') + i * 900_000;
      const statuses = ['OFF', 'SB', 'D', 'ON'] as const;
      const status = statuses[i % 4]!;
      return {
        status,
        effective: status,
        special: 'NONE',
        startAt: new Date(start).toISOString(),
        endAt: new Date(start + 900_000).toISOString(),
        durationSec: 900,
      };
    });
    const { container } = renderGrid({ graph: busy });
    // Three paths carry the whole lattice; only segments and connectors scale with the data.
    expect(container.querySelectorAll('svg path')).toHaveLength(3);
    // 96 status lines + 95 connectors + the hatch pattern's line + the violation marker.
    expect(container.querySelectorAll('svg line')).toHaveLength(96 + 95 + 1 + 1);
  });
});
