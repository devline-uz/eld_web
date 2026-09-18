// owner: web-hos-logs — the pure maths behind the 24-hour ELD graph grid (web/tz.md §10 W-08).
// No React, no DOM: every function here is directly unit-testable, which is why the SVG component
// itself stays a thin renderer and can meet the < 50 ms budget on a full day of records.
import { formatInTimeZone } from 'date-fns-tz';
import { formatHosHours, formatMinutes } from '@/shared/format';
import type {
  HosViolation,
  RodsDutyStatus,
  RodsGraphSegment,
  UnidentifiedSegment,
  ViolationType,
} from '@/shared/api/hosLogs';

/* ------------------------------------------------------------------ geometry constants */

/** 4 rows × 26 px + a 16 px hour-label axis = the 120 px the design draws. */
export const GRID = {
  rows: 4,
  rowHeight: 26,
  axisHeight: 16,
  height: 120,
  /** §395.8(g) — the grid is divided into 24 columns however long the day is. */
  columns: 24,
  ticksPerColumn: 4,
  tickLength: 4,
  statusStrokeWidth: 2.5,
} as const;

export const ROW_ORDER = ['OFF', 'SB', 'D', 'ON'] as const;
export type GridRow = (typeof ROW_ORDER)[number];

export const ROW_LABELS: Record<GridRow, { code: string; caption: string; spoken: string }> = {
  OFF: { code: 'OFF', caption: 'Off duty', spoken: 'Off duty' },
  SB: { code: 'SB', caption: 'Sleeper', spoken: 'Sleeper' },
  D: { code: 'D', caption: 'Driving', spoken: 'Driving' },
  ON: { code: 'ON', caption: 'On duty', spoken: 'On duty' },
};

/** §3.1 duty palette, identical to the badges and the donut. */
export const ROW_COLOR_VAR: Record<GridRow, string> = {
  OFF: 'var(--color-neutral)',
  SB: 'var(--color-violet)',
  D: 'var(--color-success)',
  ON: 'var(--color-danger)',
};

/** The top of a row inside the plot (the hour axis is HTML, above the SVG). */
export const rowTop = (row: GridRow): number => ROW_ORDER.indexOf(row) * GRID.rowHeight;

/** Where the 2.5 px status line of a row sits. */
export const rowCenter = (row: GridRow): number => rowTop(row) + GRID.rowHeight / 2;

/** `M 1 2 … 11 N 1 2 … 11` — the 24 column labels (M = midnight, N = noon). */
export const COLUMN_LABELS: string[] = Array.from({ length: GRID.columns }, (_, i) => {
  if (i === 0) return 'M';
  if (i === 12) return 'N';
  return String(i % 12);
});

/* ------------------------------------------------------------------ time ↔ x */

/**
 * Cached `Intl` formatters. `formatInTimeZone` builds a new `Intl.DateTimeFormat` on every call,
 * and this screen formats a few hundred instants per render — caching one formatter per zone is
 * what brings the grid render from ~300 ms to inside its 50 ms budget.
 */
const PART_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const CLOCK_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function partFormatter(timezone: string): Intl.DateTimeFormat {
  let formatter = PART_FORMATTERS.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    PART_FORMATTERS.set(timezone, formatter);
  }
  return formatter;
}

/** `HH:mm` in the driver's home terminal zone — the only clock this screen ever prints. */
export function rodsClock(instantMs: number, timezone: string): string {
  let formatter = CLOCK_FORMATTERS.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    CLOCK_FORMATTERS.set(timezone, formatter);
  }
  return formatter.format(instantMs);
}

/** The zone's UTC offset at an instant, in milliseconds. */
function zoneOffsetMs(instantMs: number, timezone: string): number {
  const parts = partFormatter(timezone).formatToParts(instantMs);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour') % 24,
    read('minute'),
    read('second'),
  );
  return asUtc - instantMs;
}

const DAY_START_CACHE = new Map<string, number>();

/**
 * The UTC instant that starts this RODS day in the driver's home terminal zone. Two offset probes
 * are enough for every IANA zone, including both DST edges (§23).
 */
export function rodsDayStart(date: string, timezone: string): number {
  const cacheKey = `${date}|${timezone}`;
  const cached = DAY_START_CACHE.get(cacheKey);
  if (cached !== undefined) return cached;
  const target = Date.parse(`${date}T00:00:00Z`);
  let start = target - zoneOffsetMs(target, timezone);
  start = target - zoneOffsetMs(start, timezone);
  DAY_START_CACHE.set(cacheKey, start);
  return start;
}

/**
 * ⭐ DST rule (§23): the grid always has 24 columns, so a 23-hour day's column is 57.5 minutes
 * and a 25-hour day's is 62.5. Every coordinate is a fraction of `dayLengthSec`.
 */
export function fractionOf(instantMs: number, dayStartMs: number, dayLengthSec: number): number {
  if (dayLengthSec <= 0) return 0;
  const offsetSec = (instantMs - dayStartMs) / 1000;
  return Math.min(1, Math.max(0, offsetSec / dayLengthSec));
}

/** A fraction as a percentage string — used by the HTML hour-label row and the hover indicator. */
export const pct = (fraction: number): string => `${(fraction * 100).toFixed(4)}%`;

/**
 * The SVG's horizontal user space: one unit per quarter hour, 96 across. `preserveAspectRatio`
 * is `none` so the plot stretches to the card, and every stroked element carries
 * `vector-effect="non-scaling-stroke"` so a 1 px rule stays 1 px whatever the scale. That is what
 * lets the whole grid be four `<path>` elements instead of ~320 `<line>`s — the difference between
 * missing and meeting the 50 ms render budget.
 */
export const PLOT_UNITS = GRID.columns * GRID.ticksPerColumn;
export const PLOT_HEIGHT = GRID.rows * GRID.rowHeight;

/** A fraction of the day in plot units. */
export const ux = (fraction: number): number => Number((fraction * PLOT_UNITS).toFixed(4));

/** The 25 hour rules, as one path. */
export function hourRulesPath(): string {
  return Array.from({ length: GRID.columns + 1 }, (_, i) => `M${i * GRID.ticksPerColumn} 0V${PLOT_HEIGHT}`).join('');
}

/** The 5 row separators, as one path. */
export function rowRulesPath(): string {
  return Array.from({ length: GRID.rows + 1 }, (_, i) => `M0 ${i * GRID.rowHeight}H${PLOT_UNITS}`).join('');
}

/** Every 15-minute tick on every row baseline (the on-the-hour slots already have a full rule). */
export function quarterHourTicksPath(): string {
  const parts: string[] = [];
  for (let row = 1; row <= GRID.rows; row += 1) {
    const baseline = row * GRID.rowHeight;
    for (let i = 1; i < PLOT_UNITS; i += 1) {
      if (i % GRID.ticksPerColumn === 0) continue;
      parts.push(`M${i} ${baseline}v-${GRID.tickLength}`);
    }
  }
  return parts.join('');
}

/* ------------------------------------------------------------------ segments */

export interface PlottedSegment {
  key: string;
  row: GridRow;
  /** PC and YM draw DASHED and do NOT move the row (PC on OFF, YM on ON). */
  dashed: boolean;
  special: 'NONE' | 'PC' | 'YM';
  status: RodsDutyStatus;
  from: number;
  to: number;
  startAt: string;
  endAt: string;
  durationSec: number;
  color: string;
}

/** `effective` is the row (PC ⇒ OFF, YM ⇒ ON); `special` decides the dash. */
export function plotSegments(
  graph: RodsGraphSegment[],
  dayStartMs: number,
  dayLengthSec: number,
): PlottedSegment[] {
  return graph.map((segment, index) => {
    const row = segment.effective as GridRow;
    return {
      key: `${segment.startAt}-${index}`,
      row,
      dashed: segment.special !== 'NONE',
      special: segment.special,
      status: segment.status,
      from: fractionOf(Date.parse(segment.startAt), dayStartMs, dayLengthSec),
      to: fractionOf(Date.parse(segment.endAt), dayStartMs, dayLengthSec),
      startAt: segment.startAt,
      endAt: segment.endAt,
      durationSec: segment.durationSec,
      color: ROW_COLOR_VAR[row],
    };
  });
}

export interface Connector {
  key: string;
  at: number;
  fromRow: GridRow;
  toRow: GridRow;
  color: string;
}

/** A vertical connector at every duty change — §395.8(g)'s continuous line. */
export function connectorsOf(segments: PlottedSegment[]): Connector[] {
  const out: Connector[] = [];
  for (let i = 1; i < segments.length; i += 1) {
    const previous = segments[i - 1];
    const current = segments[i];
    if (!previous || !current || previous.row === current.row) continue;
    out.push({
      key: `c-${current.key}`,
      at: current.from,
      fromRow: previous.row,
      toRow: current.row,
      color: current.color,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ violations */

export const VIOLATION_TITLE: Record<ViolationType, string> = {
  DRIVING_11: '11-hour driving limit',
  SHIFT_14: '14-hour shift limit',
  BREAK_30: '30-minute break',
  CYCLE_70: '70-hour cycle limit',
  CYCLE_60: '60-hour cycle limit',
  FORM_MANNER: 'Form and manner',
};

export interface PlottedViolation {
  id: string;
  /** The instant the limit was crossed — the red dashed vertical line. */
  at: number;
  /** The light red band covering the interval that ran over. */
  from: number;
  to: number;
  title: string;
  /**
   * WB-061 — `false` once the violation is RESOLVED / AUTO_CLEARED. It still happened, so it stays
   * on the grid (the audit trail is never hidden), but muted so it never reads as an open one.
   */
  open: boolean;
}

export function plotViolations(
  violations: HosViolation[],
  dayStartMs: number,
  dayLengthSec: number,
): PlottedViolation[] {
  return violations.map((violation) => {
    const atMs = Date.parse(violation.occurredAt);
    return {
      id: violation.id,
      at: fractionOf(atMs, dayStartMs, dayLengthSec),
      from: fractionOf(atMs - violation.exceededBySec * 1000, dayStartMs, dayLengthSec),
      to: fractionOf(atMs, dayStartMs, dayLengthSec),
      title:
        violation.status === 'OPEN'
          ? VIOLATION_TITLE[violation.type]
          : `${VIOLATION_TITLE[violation.type]} · Resolved`,
      open: violation.status === 'OPEN',
    };
  });
}

/* ------------------------------------------------------------------ unassigned driving */

export interface PlottedUnassigned {
  id: string;
  from: number;
  to: number;
}

/**
 * Segments that overlap the RODS day `[dayStart, dayStart + dayLengthSec)` — the one definition the
 * grid, the header chip and the 11.13 subtitle all count by (WB-058).
 */
export function unassignedInDay<T extends Pick<UnidentifiedSegment, 'startAt' | 'endAt'>>(
  segments: T[],
  dayStartMs: number,
  dayLengthSec: number,
): T[] {
  const dayEndMs = dayStartMs + dayLengthSec * 1000;
  return segments.filter(
    (segment) => Date.parse(segment.startAt) < dayEndMs && Date.parse(segment.endAt) > dayStartMs,
  );
}

/** Grey hatched blocks — segments that overlap this RODS day, clamped to it. */
export function plotUnassigned(
  segments: UnidentifiedSegment[],
  dayStartMs: number,
  dayLengthSec: number,
): PlottedUnassigned[] {
  return unassignedInDay(segments, dayStartMs, dayLengthSec)
    .map((segment) => ({
      id: segment.id,
      from: fractionOf(Date.parse(segment.startAt), dayStartMs, dayLengthSec),
      to: fractionOf(Date.parse(segment.endAt), dayStartMs, dayLengthSec),
    }));
}

/* ------------------------------------------------------------------ totals */

/** §395.3(a)(3)(i) — 11 hours is the ONLY daily per-row ceiling; OFF/SB/ON have none. */
export const DRIVING_LIMIT_SEC = 11 * 3600;

export interface RowTotal {
  row: GridRow;
  seconds: number;
  /** True only when the row has an FMCSA daily limit and the total passed it. */
  overLimit: boolean;
  label: string;
}

export function rowTotals(summary: {
  offDutySec: number;
  sleeperSec: number;
  drivingSec: number;
  onDutySec: number;
}): RowTotal[] {
  return [
    { row: 'OFF' as const, seconds: summary.offDutySec, overLimit: false },
    { row: 'SB' as const, seconds: summary.sleeperSec, overLimit: false },
    { row: 'D' as const, seconds: summary.drivingSec, overLimit: summary.drivingSec > DRIVING_LIMIT_SEC },
    { row: 'ON' as const, seconds: summary.onDutySec, overLimit: false },
  ].map((total) => ({ ...total, label: formatHosHours(total.seconds) }));
}

/* ------------------------------------------------------------------ tooltip and a11y */

const SPECIAL_SUFFIX: Record<'NONE' | 'PC' | 'YM', string> = {
  NONE: '',
  PC: ' · Personal conveyance',
  YM: ' · Yard move',
};

/**
 * `08:00 – 08:30 · Off duty · 30 min · 1.04 mi W of Harrisburg, OH` — the documented tooltip.
 * Times are always in the driver's home terminal zone.
 */
export function segmentTooltip(
  segment: PlottedSegment,
  timezone: string,
  location: string | null,
): string {
  const from = rodsClock(Date.parse(segment.startAt), timezone);
  const to = rodsClock(Date.parse(segment.endAt), timezone);
  const duration =
    segment.durationSec < 3600
      ? formatMinutes(segment.durationSec)
      : formatHosHours(segment.durationSec);
  const parts = [
    `${from} – ${to}`,
    `${ROW_LABELS[segment.row].caption}${SPECIAL_SUFFIX[segment.special]}`,
    duration,
  ];
  if (location) parts.push(location);
  return parts.join(' · ');
}

/** The spoken summary behind `role="img"` — all four totals, in the driver's zone. */
export function gridSpokenSummary(
  totals: RowTotal[],
  dateLabel: string,
  zoneLabel: string,
): string {
  const spoken = totals
    .map((total) => `${ROW_LABELS[total.row].spoken} ${total.label}`)
    .join(', ');
  return `24-hour graph grid for ${dateLabel}. ${spoken}. All times ${zoneLabel}.`;
}

/**
 * `Eastern` from `America/New_York` — the panel names the zone, never whether it is on daylight
 * time (`Eastern Daylight Time` → `Eastern`).
 */
export function zoneLabel(timezone: string, at: Date = new Date()): string {
  const long = formatInTimeZone(at, timezone, 'zzzz');
  return long.replace(/\s+(Standard|Daylight|Summer)\s+Time$/, '').replace(/\s+Time$/, '');
}

/** `Driver signature required for Sep 9 and Sep 10.` — built from the real range, never invented. */
export function certificationNote(
  days: Array<{ date: string; certified: boolean }>,
  timezone: string,
): string | null {
  const pending = days.filter((day) => !day.certified);
  if (pending.length === 0) return null;
  const labels = pending.map((day) =>
    formatInTimeZone(new Date(`${day.date}T12:00:00Z`), timezone, 'MMM d'),
  );
  const list =
    labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
  return `Driver signature required for ${list}.`;
}

/* ------------------------------------------------------------------ page helpers */

/**
 * WB-066 — a `?date=` is used only when it is a real calendar day (`2026-02-31` and `banana` both
 * fail the round-trip) and not after today in the home-terminal zone; anything else falls back to
 * today instead of throwing `RangeError: Invalid time value` in render. The 62-day rule bounds a
 * RANGE's length (transfer/report), not how far back a single RODS day may be opened, so older
 * valid days stay reachable (§395.8(k) retention).
 */
export function validDayKey(raw: string | null, todayKey: string): string {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return todayKey;
  const parsed = Date.parse(`${raw}T00:00:00Z`);
  if (Number.isNaN(parsed) || new Date(parsed).toISOString().slice(0, 10) !== raw) return todayKey;
  return raw > todayKey ? todayKey : raw;
}

/**
 * WB-071 — the rule set is read off the response's `cycleLimitSec` (§395.3(b): 60 h / 7 days or
 * 70 h / 8 days), never hardcoded. An unrecognised limit prints its hours without inventing a
 * day count; until the clocks load, no rule is claimed.
 */
export function cycleRuleLabel(cycleLimitSec: number | undefined): string {
  if (cycleLimitSec === undefined) return 'Property-carrying';
  if (cycleLimitSec === 70 * 3600) return 'Property-carrying · 70 hr / 8 day';
  if (cycleLimitSec === 60 * 3600) return 'Property-carrying · 60 hr / 7 day';
  return `Property-carrying · ${formatHosHours(cycleLimitSec)} cycle`;
}
