// web/tz.md §10 W-08 — the grid specification, asserted item by item. These are the numbers an
// FMCSA inspector reads off the screen, so every one of them is pinned.
import { describe, expect, it } from 'vitest';
import {
  COLUMN_LABELS,
  DRIVING_LIMIT_SEC,
  GRID,
  ROW_ORDER,
  certificationNote,
  connectorsOf,
  fractionOf,
  gridSpokenSummary,
  hourRulesPath,
  pct,
  plotSegments,
  quarterHourTicksPath,
  rowRulesPath,
  ux,
  plotUnassigned,
  plotViolations,
  rodsDayStart,
  rowCenter,
  rowTop,
  rowTotals,
  segmentTooltip,
  unassignedInDay,
  zoneLabel,
} from './grid';
import type { HosViolation, RodsGraphSegment, UnidentifiedSegment } from '@/shared/api/hosLogs';

const TZ = 'America/New_York';

/** `noUncheckedIndexedAccess` is on; these helpers assert the one element the test builds. */
function plotSegmentsOf(...args: Parameters<typeof plotSegments>) {
  const out = plotSegments(...args);
  return out as [(typeof out)[number], ...typeof out];
}
function plotViolationsOf(...args: Parameters<typeof plotViolations>) {
  const out = plotViolations(...args);
  return out as [(typeof out)[number], ...typeof out];
}

function segment(
  status: RodsGraphSegment['status'],
  startAt: string,
  endAt: string,
  special: RodsGraphSegment['special'] = 'NONE',
  effective: RodsGraphSegment['effective'] = status,
): RodsGraphSegment {
  return {
    status,
    effective,
    special,
    startAt,
    endAt,
    durationSec: (Date.parse(endAt) - Date.parse(startAt)) / 1000,
  };
}

describe('grid geometry', () => {
  it('has 24 columns labelled M 1 … 11 N 1 … 11 and a closing M', () => {
    expect(COLUMN_LABELS).toHaveLength(24);
    expect(COLUMN_LABELS[0]).toBe('M');
    expect(COLUMN_LABELS[12]).toBe('N');
    expect(COLUMN_LABELS.slice(1, 12)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
    expect(COLUMN_LABELS.slice(13)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
  });

  it('is 120 px tall: 4 rows × 26 px plus the 16 px hour axis', () => {
    expect(GRID.rows * GRID.rowHeight + GRID.axisHeight).toBe(GRID.height);
    expect(GRID.height).toBe(120);
  });

  it('ticks every 15 minutes — 4 per column, 96 per row', () => {
    expect(GRID.ticksPerColumn).toBe(4);
    expect(GRID.columns * GRID.ticksPerColumn).toBe(96);
  });

  it('stacks the rows OFF / SB / D / ON in order', () => {
    expect(ROW_ORDER).toEqual(['OFF', 'SB', 'D', 'ON']);
    // The hour axis is HTML above the SVG, so the plot's own origin is 0.
    expect(rowTop('OFF')).toBe(0);
    expect(rowTop('ON')).toBe(3 * 26);
    expect(rowCenter('D')).toBe(2 * 26 + 13);
  });

  it('builds the three grid paths instead of ~320 line elements', () => {
    expect(hourRulesPath().match(/M/g)).toHaveLength(25);
    expect(rowRulesPath().match(/M/g)).toHaveLength(5);
    expect(quarterHourTicksPath().match(/M/g)).toHaveLength(4 * (96 - 24));
  });

  it('maps a fraction into the 96-unit plot space', () => {
    expect(ux(0)).toBe(0);
    expect(ux(1)).toBe(96);
    expect(ux(0.5)).toBe(48);
  });

  it('computes the whole day model for 96 segments inside the 50 ms render budget', () => {
    const dayStart = rodsDayStart('2026-09-10', TZ);
    const busy: RodsGraphSegment[] = Array.from({ length: 96 }, (_, i) => {
      const start = dayStart + i * 900_000;
      const statuses = ['OFF', 'SB', 'D', 'ON'] as const;
      const status = statuses[i % 4]!;
      return {
        status,
        effective: status,
        special: 'NONE' as const,
        startAt: new Date(start).toISOString(),
        endAt: new Date(start + 900_000).toISOString(),
        durationSec: 900,
      };
    });
    const started = performance.now();
    const plotted = plotSegments(busy, dayStart, 86_400);
    connectorsOf(plotted);
    rowTotals({ offDutySec: 1, sleeperSec: 1, drivingSec: 1, onDutySec: 1 });
    for (const segment of plotted) segmentTooltip(segment, TZ, null);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it('formats a fraction as an SVG percentage', () => {
    expect(pct(0.5)).toBe('50.0000%');
    expect(pct(0)).toBe('0.0000%');
  });
});

describe('DST — 23/25-hour days keep 24 columns', () => {
  it('finds the day start on a normal day', () => {
    expect(new Date(rodsDayStart('2026-09-10', TZ)).toISOString()).toBe('2026-09-10T04:00:00.000Z');
  });

  it('finds the day start on the spring-forward day (23 hours)', () => {
    expect(new Date(rodsDayStart('2026-03-08', TZ)).toISOString()).toBe('2026-03-08T05:00:00.000Z');
  });

  it('finds the day start on the fall-back day (25 hours)', () => {
    expect(new Date(rodsDayStart('2026-11-01', TZ)).toISOString()).toBe('2026-11-01T04:00:00.000Z');
  });

  it('measures coordinates against dayLengthSec, not a hard-coded 86 400', () => {
    const start = rodsDayStart('2026-03-08', TZ);
    // Noon local on a 23-hour day sits at 11/23 of the day, not 12/24.
    const noon = Date.parse('2026-03-08T16:00:00.000Z');
    expect(fractionOf(noon, start, 82_800)).toBeCloseTo(11 / 23, 6);
    // The last instant of a 25-hour day is still the right-hand edge of column 24.
    const fallStart = rodsDayStart('2026-11-01', TZ);
    expect(fractionOf(fallStart + 90_000 * 1000, fallStart, 90_000)).toBe(1);
  });

  it('WB-072 — a fall-back day is 25 h = 90 000 s, a spring-forward day 23 h = 82 800 s', () => {
    expect((rodsDayStart('2026-11-02', TZ) - rodsDayStart('2026-11-01', TZ)) / 1000).toBe(90_000);
    expect((rodsDayStart('2026-03-09', TZ) - rodsDayStart('2026-03-08', TZ)) / 1000).toBe(82_800);
  });

  it('clamps anything outside the day to [0, 1]', () => {
    expect(fractionOf(0, 1_000, 86_400)).toBe(0);
    expect(fractionOf(9e15, 0, 86_400)).toBe(1);
  });
});

describe('status lines, PC/YM and connectors', () => {
  const dayStart = rodsDayStart('2026-09-10', TZ);

  it('puts a segment on its effective row and never dashes a normal one', () => {
    const [plotted] = plotSegmentsOf(
      [segment('D', '2026-09-10T12:00:00.000Z', '2026-09-10T13:00:00.000Z')],
      dayStart,
      86_400,
    );
    expect(plotted.row).toBe('D');
    expect(plotted.dashed).toBe(false);
  });

  it('draws personal conveyance DASHED on the OFF row without changing the row', () => {
    const [plotted] = plotSegmentsOf(
      [segment('OFF', '2026-09-10T12:00:00.000Z', '2026-09-10T13:00:00.000Z', 'PC', 'OFF')],
      dayStart,
      86_400,
    );
    expect(plotted.row).toBe('OFF');
    expect(plotted.dashed).toBe(true);
    expect(plotted.special).toBe('PC');
  });

  it('draws yard move DASHED on the ON row', () => {
    const [plotted] = plotSegmentsOf(
      [segment('ON', '2026-09-10T12:00:00.000Z', '2026-09-10T13:00:00.000Z', 'YM', 'ON')],
      dayStart,
      86_400,
    );
    expect(plotted.row).toBe('ON');
    expect(plotted.dashed).toBe(true);
  });

  it('emits a vertical connector at every duty change and none when the row repeats', () => {
    const segments = plotSegments(
      [
        segment('OFF', '2026-09-10T04:00:00.000Z', '2026-09-10T10:00:00.000Z'),
        segment('D', '2026-09-10T10:00:00.000Z', '2026-09-10T14:00:00.000Z'),
        segment('D', '2026-09-10T14:00:00.000Z', '2026-09-10T15:00:00.000Z'),
        segment('ON', '2026-09-10T15:00:00.000Z', '2026-09-10T16:00:00.000Z'),
      ],
      dayStart,
      86_400,
    );
    const connectors = connectorsOf(segments);
    expect(connectors).toHaveLength(2);
    expect(connectors[0]?.fromRow).toBe('OFF');
    expect(connectors[0]?.toRow).toBe('D');
  });
});

describe('violations and unassigned segments', () => {
  const dayStart = rodsDayStart('2026-09-10', TZ);

  const violation: HosViolation = {
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
  };

  it('marks the instant and bands the interval that ran over', () => {
    const [plotted] = plotViolationsOf([violation], dayStart, 86_400);
    expect(plotted.title).toBe('11-hour driving limit');
    expect(plotted.at).toBeCloseTo(plotted.to, 10);
    expect(plotted.to - plotted.from).toBeCloseTo(1560 / 86_400, 8);
    expect(plotted.open).toBe(true);
  });

  it('WB-061 — keeps a resolved violation on the grid, flagged not-open and titled Resolved', () => {
    const [resolved, cleared] = plotViolations(
      [
        { ...violation, id: 'v2', status: 'RESOLVED' },
        { ...violation, id: 'v3', status: 'AUTO_CLEARED' },
      ],
      dayStart,
      86_400,
    );
    expect(resolved).toMatchObject({ id: 'v2', open: false, title: '11-hour driving limit · Resolved' });
    expect(cleared).toMatchObject({ id: 'v3', open: false });
  });

  it('keeps only the unassigned segments that overlap the day', () => {
    const base: UnidentifiedSegment = {
      id: 's1',
      vehicleId: 'veh',
      startAt: '2026-09-10T12:00:00.000Z',
      endAt: '2026-09-10T12:06:00.000Z',
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
    };
    const outside = { ...base, id: 's2', startAt: '2026-09-08T12:00:00.000Z', endAt: '2026-09-08T12:06:00.000Z' };
    expect(plotUnassigned([base, outside], dayStart, 86_400).map((s) => s.id)).toEqual(['s1']);
  });
});

describe('TOTAL column', () => {
  it('shows the four daily totals as HH:MM', () => {
    const totals = rowTotals({ offDutySec: 27_000, sleeperSec: 7_200, drivingSec: 41_160, onDutySec: 11_040 });
    expect(totals.map((t) => t.label)).toEqual(['07:30', '02:00', '11:26', '03:04']);
  });

  it('renders driving in danger only when it passes the §395.3(a)(3)(i) 11-hour limit', () => {
    const over = rowTotals({ offDutySec: 0, sleeperSec: 0, drivingSec: DRIVING_LIMIT_SEC + 60, onDutySec: 0 });
    expect(over.find((t) => t.row === 'D')?.overLimit).toBe(true);
    const under = rowTotals({ offDutySec: 86_400, sleeperSec: 0, drivingSec: DRIVING_LIMIT_SEC, onDutySec: 0 });
    expect(under.find((t) => t.row === 'D')?.overLimit).toBe(false);
    // OFF / SB / ON have no daily ceiling in §395 — they are never drawn in danger.
    expect(under.filter((t) => t.row !== 'D').every((t) => !t.overLimit)).toBe(true);
  });
});

describe('tooltip and spoken summary', () => {
  const dayStart = rodsDayStart('2026-09-10', TZ);

  it('builds the documented tooltip in the home terminal zone', () => {
    const [plotted] = plotSegmentsOf(
      [segment('OFF', '2026-09-10T12:00:00.000Z', '2026-09-10T12:30:00.000Z')],
      dayStart,
      86_400,
    );
    expect(segmentTooltip(plotted, TZ, '1.04 mi W of Harrisburg, OH')).toBe(
      '08:00 – 08:30 · Off duty · 30 min · 1.04 mi W of Harrisburg, OH',
    );
  });

  it('names the special category in the tooltip', () => {
    const [plotted] = plotSegmentsOf(
      [segment('OFF', '2026-09-10T12:00:00.000Z', '2026-09-10T12:30:00.000Z', 'PC', 'OFF')],
      dayStart,
      86_400,
    );
    expect(segmentTooltip(plotted, TZ, null)).toContain('Personal conveyance');
  });

  it('speaks all four totals for role="img"', () => {
    const totals = rowTotals({ offDutySec: 27_000, sleeperSec: 7_200, drivingSec: 41_160, onDutySec: 11_040 });
    expect(gridSpokenSummary(totals, 'Wed, Sep 10, 2025', 'Eastern')).toBe(
      '24-hour graph grid for Wed, Sep 10, 2025. Off duty 07:30, Sleeper 02:00, Driving 11:26, On duty 03:04. All times Eastern.',
    );
  });
});

describe('zone label and certification note', () => {
  it('names the zone without the daylight/standard qualifier', () => {
    expect(zoneLabel(TZ, new Date('2026-09-10T12:00:00Z'))).toBe('Eastern');
    expect(zoneLabel(TZ, new Date('2026-01-10T12:00:00Z'))).toBe('Eastern');
  });

  it('lists the days still waiting for a driver signature', () => {
    expect(
      certificationNote(
        [
          { date: '2026-09-08', certified: true },
          { date: '2026-09-09', certified: false },
          { date: '2026-09-10', certified: false },
        ],
        TZ,
      ),
    ).toBe('Driver signature required for Sep 9 and Sep 10.');
    expect(certificationNote([{ date: '2026-09-08', certified: true }], TZ)).toBeNull();
  });
});

describe('unassignedInDay (WB-057 / WB-058)', () => {
  const seg = (startAt: string, endAt: string) => ({ startAt, endAt });

  it('keeps a 21:30 ET segment on the viewed day and drops the neighbouring days', () => {
    const start = rodsDayStart('2026-09-10', TZ); // 04:00Z
    const late = seg('2026-09-11T01:30:00.000Z', '2026-09-11T01:50:00.000Z'); // 21:30 ET Sep 10
    const prev = seg('2026-09-10T03:00:00.000Z', '2026-09-10T03:30:00.000Z'); // 23:00 ET Sep 9
    const next = seg('2026-09-11T04:30:00.000Z', '2026-09-11T05:00:00.000Z'); // 00:30 ET Sep 11
    expect(unassignedInDay([prev, late, next], start, 86_400)).toEqual([late]);
    // The old UTC-midnight window ended at 2026-09-11T00:00Z — before the segment started.
    expect(Date.parse(late.startAt)).toBeGreaterThan(Date.parse('2026-09-11T00:00:00.000Z'));
  });

  it('keeps a segment straddling either edge, drops one ending exactly at the day start', () => {
    const start = rodsDayStart('2026-09-10', TZ);
    const iso = (ms: number) => new Date(ms).toISOString();
    const straddleStart = seg(iso(start - 600_000), iso(start + 600_000));
    const straddleEnd = seg(iso(start + 86_400_000 - 600_000), iso(start + 86_400_000 + 600_000));
    const endsAtStart = seg(iso(start - 600_000), iso(start));
    const startsAtEnd = seg(iso(start + 86_400_000), iso(start + 86_400_000 + 600_000));
    expect(unassignedInDay([straddleStart, straddleEnd, endsAtStart, startsAtEnd], start, 86_400)).toEqual([
      straddleStart,
      straddleEnd,
    ]);
  });

  it('uses the 25-hour DST day length, not 24 hours', () => {
    const start = rodsDayStart('2026-11-01', TZ); // fall back: 25-hour RODS day
    const iso = (ms: number) => new Date(ms).toISOString();
    const lastHour = seg(iso(start + 24.5 * 3_600_000), iso(start + 24.75 * 3_600_000));
    expect(unassignedInDay([lastHour], start, 90_000)).toEqual([lastHour]);
    expect(unassignedInDay([lastHour], start, 86_400)).toEqual([]);
  });
});
