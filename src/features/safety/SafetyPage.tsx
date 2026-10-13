// owner: web-dvir-safety — W-10 Safety (web/tz.md §10).
// Design: web/roles and screens/admin panel/Harsh driving, speeding, fleet score, scorecard.jpg
// Route `/safety` · Perm `safety` READ · absent for DISPATCHER (router.tsx already blocks it).
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Filter, Search, Upload, ShieldCheck, AlertTriangle, Gauge, Users, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import { usePageHeader } from '@/app/layouts/Topbar';
import { useRoom } from '@/shared/realtime/useRoom';
import { useQueryClient } from '@tanstack/react-query';
import { qkRoot } from '@/shared/api/queryKeys';
import { Button } from '@/shared/ui/Button';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { cn } from '@/shared/ui/cn';
import { Avatar } from '@/shared/ui/Avatar';
import { DataTable } from '@/shared/ui/DataTable';
import { Pagination } from '@/shared/ui/Pagination';
import { KpiCard, KpiRowSkeleton } from '@/shared/ui/KpiCard';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';
import { EMPTY_STATE_COPY, searchEmptyState } from '@/shared/ui/copy';
import { formatDateRange, formatLocal } from '@/shared/format/datetime';
import { useNowTick } from '@/shared/format/useRelativeTime';
import { formatGForce } from '@/shared/format/numbers';
import { orDash } from '@/shared/format/empty';
import { toCsv } from '@/shared/lib/csv';
import { isScored, useSafetyEventsList, useScorecard, type SafetyEventTableRow, type ScorecardFleet, type ScorecardTableRow } from '@/shared/api/safety';
import { useDriversLookup } from '@/shared/api/lookups';
import { AssignCoachingModal, type CoachingTarget } from './components/AssignCoachingModal';
import { SafetyFiltersDrawer, SafetyFilterChips } from './components/SafetyFiltersDrawer';
import { parseSafetyFilters, writeSafetyFilters, matchesSafetyFilters, EMPTY_SAFETY_FILTERS, countActiveSafetyFilters, safetyEventLabel } from './lib/filters';
// safetyMock — TEMPORARY demo fallback; delete this import and the `safetyMock` block below to remove.
import { MOCK_SAFETY_EVENTS, MOCK_SCORECARD, MOCK_SCORECARD_FLEET, MOCK_SCORECARD_PERIOD } from './lib/mockData';
import { DEMO_FALLBACK_ENABLED, DEMO_FALLBACK_MODE } from '@/shared/lib/mockMode';

/** Fleet-score verdict bands — the same 90 / 70 cut-offs as the driver SCORE badge. */
const FLEET_VERDICT = {
  good: { label: 'Good standing', className: 'text-success' },
  watch: { label: 'Needs attention', className: 'text-warning' },
  below: { label: 'Below coaching threshold', className: 'text-danger' },
} as const;

const verdictBand = (score: number): keyof typeof FLEET_VERDICT => (score >= 90 ? 'good' : score >= 70 ? 'watch' : 'below');

/** SCORE pill tone — ≥90 success, 70–89 warning, <70 danger (W-10). */
const scoreTone = (score: number): 'success' | 'warning' | 'danger' => (score >= 90 ? 'success' : score >= 70 ? 'warning' : 'danger');

/** W-10 KPI chip `↑ 4 pts` (success) / `↓ 3 pts` (danger) — fleet score vs the previous 30-day
 * period, server-computed (`fleet.trend`). Null (no comparable period) ⇒ no chip. */
function fleetTrendChip(trend: number | null | undefined): { text: string; tone: 'success' | 'danger' | 'neutral' } | undefined {
  if (trend == null) return undefined;
  if (trend > 0) return { text: `↑ ${trend} pts`, tone: 'success' };
  if (trend < 0) return { text: `↓ ${Math.abs(trend)} pts`, tone: 'danger' };
  return { text: 'No change', tone: 'neutral' };
}

/** Period labels are calendar dates (each driver's home-terminal day), so they are rendered as
 * dates in UTC — never shifted by the browser or carrier zone. */
const periodLabel = (start: string | null | undefined, end: string | null | undefined): string | null =>
  start && end ? formatDateRange(`${start}T00:00:00Z`, `${end}T00:00:00Z`, 'UTC') : null;

/** "Not enough miles" rows (< `minMiles` in the period) render muted. */
const rowTone = (row: ScorecardTableRow): string => (isScored(row) ? 'text-text' : 'text-text-muted');

const EVENT_TONE: Record<string, 'danger' | 'violet' | 'warning'> = {
  HARSH_BRAKING: 'danger',
  SPEEDING: 'danger',
  HARSH_TURN: 'violet',
  HARSH_ACCEL: 'warning',
  SEATBELT: 'warning',
};

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function token(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function ScoreGauge({ score }: { score: number }) {
  const radius = 62;
  const thickness = 10;
  const circumference = Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  return (
    // +caption room below the arc — the `/100` label sits at `radius + 18` and was clipped.
    <svg width={radius * 2 + thickness} height={radius + thickness + 12} viewBox={`0 0 ${radius * 2 + thickness} ${radius + thickness + 12}`} className="shrink-0">
      <path
        d={`M ${thickness / 2} ${radius + thickness / 2} A ${radius} ${radius} 0 0 1 ${radius * 2 + thickness / 2} ${radius + thickness / 2}`}
        fill="none"
        stroke={token('--color-neutral-soft', 'lightgray')}
        strokeWidth={thickness}
        strokeLinecap="round"
      />
      <path
        d={`M ${thickness / 2} ${radius + thickness / 2} A ${radius} ${radius} 0 0 1 ${radius * 2 + thickness / 2} ${radius + thickness / 2}`}
        fill="none"
        stroke={token('--color-success', 'green')}
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeDasharray={`${circumference * pct} ${circumference}`}
      />
      <text x="50%" y={radius} textAnchor="middle" className="fill-text text-kpi font-semibold">
        {score}
      </text>
      <text x="50%" y={radius + 18} textAnchor="middle" className="fill-text-muted text-caption">
        /100
      </text>
    </svg>
  );
}

// ---- tabs (design: `Events 186` · `Coaching 12` · `Scorecards 58`, top left) ------------------
// URL-synced like W-09 DVIR / W-05 Driver profile: `?tab=coaching|scorecards`, the default
// `events` tab drops the param.
type SafetyTab = 'events' | 'coaching' | 'scorecards';
const TAB_ORDER: SafetyTab[] = ['events', 'coaching', 'scorecards'];
const TAB_LABEL: Record<SafetyTab, string> = { events: 'Events', coaching: 'Coaching', scorecards: 'Scorecards' };

function parseTab(value: string | null): SafetyTab {
  return TAB_ORDER.includes(value as SafetyTab) ? (value as SafetyTab) : 'events';
}

function SafetyTabs({ tab, counts, onChange }: { tab: SafetyTab; counts: Record<SafetyTab, number>; onChange: (next: SafetyTab) => void }) {
  const refs = useRef<Partial<Record<SafetyTab, HTMLButtonElement | null>>>({});
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = TAB_ORDER.indexOf(tab);
    const n = TAB_ORDER.length;
    const next =
      e.key === 'ArrowRight' ? TAB_ORDER[(i + 1) % n]
      : e.key === 'ArrowLeft' ? TAB_ORDER[(i - 1 + n) % n]
      : e.key === 'Home' ? TAB_ORDER[0]
      : e.key === 'End' ? TAB_ORDER[n - 1]
      : undefined;
    if (!next) return;
    e.preventDefault();
    onChange(next);
    refs.current[next]?.focus();
  }
  return (
    <div role="tablist" aria-label="Safety views" onKeyDown={onKeyDown} className="flex h-9 w-fit max-w-full shrink-0 items-center gap-1 overflow-x-auto rounded-md bg-bg-subtle p-1">
      {TAB_ORDER.map((value) => {
        const selected = tab === value;
        return (
          <button
            key={value}
            ref={(el) => {
              refs.current[value] = el;
            }}
            id={`safety-tab-${value}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={selected ? `safety-panel-${value}` : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(value)}
            className={
              selected
                ? 'flex h-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm bg-bg-surface px-3 text-body-strong text-text shadow-card'
                : 'flex h-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm px-3 text-body text-text-secondary hover:text-text'
            }
          >
            {TAB_LABEL[value]}
            <span className="tabular-nums text-caption font-normal text-text-muted">{counts[value].toLocaleString('en-US')}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---- table columns ---------------------------------------------------------------------------
const EVENT_BASE_COLUMNS: ColumnDef<SafetyEventTableRow, unknown>[] = [
  {
    id: 'event',
    header: 'EVENT',
    cell: ({ row }) => <Badge tone={EVENT_TONE[row.original.type] ?? 'neutral'}>{safetyEventLabel(row.original.type)}</Badge>,
  },
  {
    id: 'driver',
    header: 'DRIVER',
    cell: ({ row }) => {
      const d = row.original.driver;
      if (!d) return <span className="text-text-muted">Unassigned</span>;
      const name = `${d.firstName} ${d.lastName}`;
      return (
        <span className="flex items-center gap-2">
          <Avatar name={name} size="sm" />
          <span className="text-text">{name}</span>
        </span>
      );
    },
  },
  { id: 'unit', header: 'UNIT', cell: ({ row }) => <span className="text-text">{row.original.vehicle?.unitNumber ?? '—'}</span> },
  {
    id: 'dateTime',
    header: 'DATE & TIME',
    cell: ({ row }) => <span className="tabular-nums text-text-muted">{formatLocal(row.original.occurredAt, 'dateTime')}</span>,
  },
];

const EVENT_COLUMNS: ColumnDef<SafetyEventTableRow, unknown>[] = [
  ...EVENT_BASE_COLUMNS,
  { id: 'location', header: 'LOCATION', cell: ({ row }) => <span className="text-text">{orDash(row.original.locationName, (v) => v)}</span> },
  {
    id: 'severity',
    header: 'SEVERITY',
    meta: { numeric: true },
    cell: ({ row }) => {
      const speed = row.original.speedMph;
      const limitMph = row.original.speedLimitMph;
      const g = toNum(row.original.gForce);
      return (
        <span className="tabular-nums text-danger">
          {speed != null && limitMph != null ? `${speed} / ${limitMph} mph` : g != null ? formatGForce(g) : '—'}
        </span>
      );
    },
  },
];

// Coaching is recorded per event (`POST /safety/coaching { eventId, note }` → status COACHED,
// `coachedAt`, `coachingNote`), so a "session" is a coached event — no separate sessions API.
const COACHING_COLUMNS: ColumnDef<SafetyEventTableRow, unknown>[] = [
  ...EVENT_BASE_COLUMNS,
  {
    id: 'coachedAt',
    header: 'COACHED',
    cell: ({ row }) => <span className="tabular-nums text-text-muted">{row.original.coachedAt ? formatLocal(row.original.coachedAt, 'dateTime') : '—'}</span>,
  },
  {
    id: 'note',
    header: 'NOTE',
    cell: ({ row }) => (
      <span className="block max-w-xs truncate text-text" title={row.original.coachingNote ?? undefined}>
        {orDash(row.original.coachingNote, (v) => v)}
      </span>
    ),
  },
];

const SCORECARD_COLUMNS: ColumnDef<ScorecardTableRow, unknown>[] = [
  {
    id: 'rank',
    header: 'RANK',
    cell: ({ row }) =>
      isScored(row.original) && row.original.rank != null ? (
        <span className="tabular-nums text-text">#{row.original.rank}</span>
      ) : (
        <span className="text-text-muted">—</span>
      ),
  },
  {
    id: 'driver',
    header: 'DRIVER',
    cell: ({ row }) => {
      const d = row.original.driver;
      const name = d ? `${d.firstName} ${d.lastName}` : 'Unknown driver';
      return (
        <span className="flex items-center gap-2">
          <Avatar name={name} size="sm" />
          <span className={rowTone(row.original)}>{name}</span>
        </span>
      );
    },
  },
  {
    id: 'score',
    header: 'SCORE',
    // Phase 1 (backend D-133) — fewer than `minMiles` in the period ⇒ no score, no rank, no pill.
    cell: ({ row }) =>
      isScored(row.original) ? (
        <Badge tone={scoreTone(row.original.score)}>{row.original.score}</Badge>
      ) : (
        <span className="text-caption text-text-muted">Not enough miles</span>
      ),
  },
  { id: 'harsh', header: 'HARSH EVENTS', meta: { numeric: true }, cell: ({ row }) => <span className={cn('tabular-nums', rowTone(row.original))}>{orDash(row.original.harshCount, (v) => v.toLocaleString('en-US'))}</span> },
  { id: 'speeding', header: 'SPEEDING', meta: { numeric: true }, cell: ({ row }) => <span className={cn('tabular-nums', rowTone(row.original))}>{orDash(row.original.speedingCount, (v) => v.toLocaleString('en-US'))}</span> },
  {
    id: 'miles',
    header: 'MILES DRIVEN',
    meta: { numeric: true },
    cell: ({ row }) => <span className={cn('tabular-nums', rowTone(row.original))}>{orDash(row.original.milesDriven, (v) => v.toLocaleString('en-US'))}</span>,
  },
  {
    id: 'trend',
    header: 'TREND',
    // B-44 (shipped 2026-09-24) — `previousScore`/`trend` are server-computed against the prior
    // period of the same length; `null` (no prior-period row) renders `—`, never a fabricated arrow.
    cell: ({ row }) => {
      const { trend, previousScore } = row.original;
      if (trend == null || previousScore == null) return <span className="text-text-muted">—</span>;
      const Icon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
      const tone = trend > 0 ? 'text-success' : trend < 0 ? 'text-danger' : 'text-text-muted';
      return (
        <span className={cn('flex items-center gap-1 tabular-nums', tone)}>
          <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
          {trend > 0 ? '+' : ''}
          {trend}
        </span>
      );
    },
  },
  {
    id: 'view',
    header: '',
    cell: ({ row }) => <ViewProfileCell driverId={row.original.driverId} />,
  },
];

/**
 * WB-168 — this used to be a styled `<span>`: no handler, no href, not reachable from the
 * keyboard. It is a real button now, and it is absent (not disabled) for a role without
 * `drivers` READ, which is the only rule §12 allows.
 */
function ViewProfileCell({ driverId }: { driverId: string }) {
  const navigate = useNavigate();
  const { can } = usePermission();
  if (!can('drivers')) return null;
  return (
    <Button variant="link" onClick={() => navigate(`/drivers/${driverId}`)}>
      View profile ›
    </Button>
  );
}

export default function SafetyPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  // The driver the open "Assign coaching" dialog is for — an id, not a row snapshot, so the dialog
  // always renders the driver that is selected now (it used to keep the previous driver's name).
  const [coachingDriverId, setCoachingDriverId] = useState<string | null>(null);
  const [coachDriverId, setCoachDriverId] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersRevision, setFiltersRevision] = useState(0);
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseSafetyFilters(params), [params]);
  const tab = parseTab(params.get('tab'));
  function applyFilters(next: typeof filters) {
    setParams(writeSafetyFilters(params, next), { replace: true });
  }
  function setTab(next: SafetyTab) {
    const nextParams = new URLSearchParams(params);
    if (next === 'events') nextParams.delete('tab');
    else nextParams.set('tab', next);
    setParams(nextParams, { replace: true });
  }

  // `safety.event_created` is a real event (§7.3); `dvir.submitted`/`defect.created` are not —
  // those two fall back to list staleness + the topbar Refresh (web/tz.md §7.4).
  useRoom('fleet', {
    'safety.event_created': () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.safety });
    },
  });

  const eventsQuery = useSafetyEventsList({ limit: 500 });
  const scorecardQuery = useScorecard();
  // safetyMock — while the API returns no rows (empty or failed), show demo data from
  // `./lib/mockData` instead. Real rows always win (unless `VITE_DEMO_FALLBACK=always`).
  // Never in production: `DEMO_FALLBACK_ENABLED` is the literal `false` there, so both flags fold to
  // `false`, the page shows its own error / empty states, and `./lib/mockData` is tree-shaken out.
  // Remove: `const events = eventsQuery;` etc.
  const shouldMockSafety = (q: { isLoading: boolean; rows: unknown[] }) =>
    DEMO_FALLBACK_MODE === 'always' || (DEMO_FALLBACK_MODE === 'fallback' && !q.isLoading && q.rows.length === 0);
  const eventsMock = DEMO_FALLBACK_ENABLED && shouldMockSafety(eventsQuery);
  const scorecardMock = DEMO_FALLBACK_ENABLED && shouldMockSafety(scorecardQuery);
  const events = eventsMock
    ? { ...eventsQuery, rows: MOCK_SAFETY_EVENTS, isLoading: false, isError: false }
    : eventsQuery;
  const scorecard = scorecardMock
    ? {
        ...scorecardQuery,
        rows: MOCK_SCORECARD,
        fleet: MOCK_SCORECARD_FLEET as ScorecardFleet,
        periodStart: MOCK_SCORECARD_PERIOD.periodStart as string | null,
        periodEnd: MOCK_SCORECARD_PERIOD.periodEnd as string | null,
        isLoading: false,
        isError: false,
      }
    : scorecardQuery;

  // "Assign coaching" posts a real `driverId` (`AssignCoachingDto.driverId` is a uuid). The demo
  // scorecard rows carry demo driver ids, which the server refuses with a 422 — so whenever the
  // scorecard is the demo fallback, the picker lists the carrier's real drivers instead.
  const driversLookup = useDriversLookup(scorecardMock);
  const coachTargets = useMemo((): CoachingTarget[] => {
    if (!scorecardMock) return scorecard.rows;
    return (driversLookup.data?.items ?? [])
      .map((d) => ({ driverId: d.id, driver: d, score: null }))
      .sort((a, b) => `${a.driver.firstName} ${a.driver.lastName}`.localeCompare(`${b.driver.firstName} ${b.driver.lastName}`));
  }, [scorecardMock, scorecard.rows, driversLookup.data]);
  const coachingTarget = coachingDriverId ? coachTargets.find((t) => t.driverId === coachingDriverId) ?? null : null;

  const now = useNowTick();
  const last30 = now - 30 * 24 * 60 * 60 * 1000;
  const prev30 = now - 60 * 24 * 60 * 60 * 1000;

  const currentEvents = useMemo(() => events.rows.filter((e) => new Date(e.occurredAt).getTime() >= last30), [events.rows, last30]);
  const previousEvents = useMemo(
    () => events.rows.filter((e) => new Date(e.occurredAt).getTime() >= prev30 && new Date(e.occurredAt).getTime() < last30),
    [events.rows, prev30, last30],
  );
  const harshTypes = new Set(['HARSH_BRAKING', 'HARSH_ACCEL', 'HARSH_TURN']);
  const harshNow = currentEvents.filter((e) => harshTypes.has(e.type)).length;
  const harshPrev = previousEvents.filter((e) => harshTypes.has(e.type)).length;
  const speedingNow = currentEvents.filter((e) => e.type === 'SPEEDING').length;
  const speedingPrev = previousEvents.filter((e) => e.type === 'SPEEDING').length;
  const coachedNow = currentEvents.filter((e) => e.status === 'COACHED').length;
  const pendingCoaching = currentEvents.filter((e) => e.status === 'NEW').length;

  // Phase 1 (backend D-133) — the fleet score is the server's MILE-WEIGHTED mean of scored drivers
  // ("Not enough miles" drivers excluded) with its trend vs the previous 30-day period. Never
  // re-averaged here: a plain client mean would weight a 120-mile driver like a 12,000-mile one.
  const fleetScore = scorecard.fleet.score;
  const fleetChip = fleetTrendChip(scorecard.fleet.trend);
  const belowThreshold = scorecard.fleet.belowThresholdCount;
  const rankedCount = useMemo(() => scorecard.rows.filter((r) => isScored(r)).length, [scorecard.rows]);
  const unrankedCount = scorecard.rows.length - rankedCount;
  const scorecardPeriod = periodLabel(scorecard.periodStart, scorecard.periodEnd);

  const needle = search.trim().toLowerCase();
  const filteredEvents = useMemo(
    () =>
      currentEvents.filter((e) => {
        if (needle) {
          const driverName = e.driver ? `${e.driver.firstName} ${e.driver.lastName}` : '';
          if (!driverName.toLowerCase().includes(needle) && !(e.vehicle?.unitNumber ?? '').toLowerCase().includes(needle)) return false;
        }
        return matchesSafetyFilters(e, filters);
      }),
    [currentEvents, needle, filters],
  );
  // Coaching tab — the same 30-day window, search and drawer filters, narrowed to COACHED.
  const coachingEvents = useMemo(() => filteredEvents.filter((e) => e.status === 'COACHED'), [filteredEvents]);
  // Scorecards tab — the search box narrows the ranking by driver name.
  const visibleScorecard = useMemo(
    () =>
      tab === 'scorecards' && needle
        ? scorecard.rows.filter((r) => (r.driver ? `${r.driver.firstName} ${r.driver.lastName}` : '').toLowerCase().includes(needle))
        : scorecard.rows,
    [tab, needle, scorecard.rows],
  );

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  // Reset to page 1 when the search term or the tab changes — adjusted during render, not an
  // effect (react.dev "you might not need an effect": bail out once state already matches).
  const [prevNeedle, setPrevNeedle] = useState(needle);
  const [prevTab, setPrevTab] = useState(tab);
  if (needle !== prevNeedle || tab !== prevTab) {
    setPrevNeedle(needle);
    setPrevTab(tab);
    setPage(1);
  }
  const tableEvents = tab === 'coaching' ? coachingEvents : filteredEvents;
  const totalPages = Math.max(1, Math.ceil(tableEvents.length / limit));
  // The drawer filters live in the URL, so they can shrink the result set while `page` still
  // points past the end — clamp during render (same bail-out rule as the search reset above),
  // otherwise the table body renders empty while Pagination still claims page N.
  if (page > totalPages) setPage(totalPages);
  const pageEvents = tableEvents.slice((page - 1) * limit, page * limit);

  const eventsByType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of currentEvents) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    return (['HARSH_BRAKING', 'SPEEDING', 'HARSH_ACCEL'] as const)
      .map((type) => ({ type, count: counts.get(type) ?? 0 }))
      .filter((r) => r.count > 0 || true);
  }, [currentEvents]);
  const maxTypeCount = Math.max(1, ...eventsByType.map((r) => r.count));

  /**
   * WB-169 — the export used to dump every loaded row as raw JSON under one fixed file name,
   * ignoring the tab, the search box and the drawer filters, so what the user saw and what they
   * got were different data sets. It now writes exactly the rows the current tab lists, as CSV
   * (RFC 4180 via `toCsv`, like the audit log), with the matching columns.
   */
  function handleExport() {
    const driverOf = (r: SafetyEventTableRow) => (r.driver ? `${r.driver.firstName} ${r.driver.lastName}` : 'Unassigned');
    const rows: (string | number | null)[][] =
      tab === 'scorecards'
        ? [
            ['rank', 'driver', 'score', 'harsh events', 'speeding', 'miles driven'],
            ...visibleScorecard.map((r) => [
              r.rank ?? '',
              r.driver ? `${r.driver.firstName} ${r.driver.lastName}` : r.driverId,
              r.score ?? 'Not enough miles',
              r.harshCount,
              r.speedingCount,
              r.milesDriven,
            ]),
          ]
        : tab === 'coaching'
          ? [
              ['event', 'driver', 'unit', 'date & time', 'coached', 'note'],
              ...tableEvents.map((r) => [
                safetyEventLabel(r.type),
                driverOf(r),
                r.vehicle?.unitNumber ?? '',
                formatLocal(r.occurredAt, 'dateTime'),
                r.coachedAt ? formatLocal(r.coachedAt, 'dateTime') : '',
                r.coachingNote ?? '',
              ]),
            ]
          : [
              ['event', 'driver', 'unit', 'date & time', 'location', 'severity'],
              ...tableEvents.map((r) => [
                safetyEventLabel(r.type),
                driverOf(r),
                r.vehicle?.unitNumber ?? '',
                formatLocal(r.occurredAt, 'dateTime'),
                r.locationName ?? '',
                r.speedMph != null && r.speedLimitMph != null
                  ? `${r.speedMph} / ${r.speedLimitMph} mph`
                  : toNum(r.gForce) != null
                    ? formatGForce(toNum(r.gForce) as number)
                    : '',
              ]),
            ];
    const blob = new Blob([toCsv(rows)], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `safety-${tab}-export.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const isKpiLoading = events.isLoading || scorecard.isLoading;
  const hasFilters = countActiveSafetyFilters(filters) > 0;
  // Tab counts match what each tab lists: the 30-day event window (not the all-time server
  // `total`), the coached events in that window (= the `Coaching sessions` KPI), the ranked drivers.
  const tabCounts: Record<SafetyTab, number> = { events: currentEvents.length, coaching: coachedNow, scorecards: scorecard.rows.length };

  function eventsTableBody(rows: SafetyEventTableRow[], columns: ColumnDef<SafetyEventTableRow, unknown>[], caption: string, emptyKey: 'safety' | 'safetyCoaching') {
    if (events.isLoading) return <LoadingState />;
    if (events.isError) return <ErrorState onRetry={() => events.refetch()} />;
    if (rows.length === 0) {
      return search || hasFilters ? (
        <EmptyState
          {...searchEmptyState(search || 'these filters')}
          actions={[
            {
              label: search ? 'Clear search' : 'Clear filters',
              onClick: () => (search ? setSearch('') : applyFilters(EMPTY_SAFETY_FILTERS)),
            },
          ]}
        />
      ) : (
        <EmptyState {...EMPTY_STATE_COPY[emptyKey]} />
      );
    }
    return (
      <>
        <DataTable caption={caption} data={pageEvents} getRowId={(r) => r.id} columns={columns} />
        <Pagination page={page} limit={limit} total={rows.length} totalPages={totalPages} itemLabel="events" onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
      </>
    );
  }

  const fleetScoreCard = (
    <Card>
      <SectionHeader title="Fleet safety score" />
      {scorecard.isLoading ? (
        <LoadingState rows={2} />
      ) : fleetScore == null ? (
        <p className="mt-3 text-body text-text-muted">
          {scorecard.rows.length > 0
            ? `Not enough miles — no driver reached ${scorecard.minMiles.toLocaleString('en-US')} mi in this period.`
            : 'No scorecards yet.'}
        </p>
      ) : (
        <div className="mt-3 flex items-center gap-4">
          <ScoreGauge score={fleetScore} />
          <div>
            {fleetChip && (
              <Badge tone={fleetChip.tone} className="mb-1">
                {fleetChip.text}
              </Badge>
            )}
            {/* WB-170 — the verdict used to read `Good standing` in success green at any score,
                including the 68 the mock fleet actually scores, against this card's own 70-point
                threshold. It is derived now, on the same bands the SCORE badge uses. */}
            <p className={cn('text-label font-semibold', FLEET_VERDICT[verdictBand(fleetScore)].className)}>
              {FLEET_VERDICT[verdictBand(fleetScore)].label}
            </p>
            <p className="mt-1 text-caption text-text-muted">
              {belowThreshold} driver{belowThreshold === 1 ? '' : 's'} {belowThreshold === 1 ? 'is' : 'are'} below the
              70-point coaching threshold.
            </p>
          </div>
        </div>
      )}
    </Card>
  );

  const driverScorecardCard = (
    <Card padded={false}>
      <div className="flex flex-wrap items-start justify-between gap-2 p-card pb-0">
        <SectionHeader
          title="Driver scorecard"
          subtitle={[
            `${rankedCount} drivers ranked`,
            unrankedCount > 0 ? `${unrankedCount} not enough miles` : null,
            scorecardPeriod,
          ]
            .filter(Boolean)
            .join(' · ')}
        />
        <Can perm="safety" level="FULL">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Select driver to coach"
              value={coachDriverId}
              onChange={(e) => setCoachDriverId(e.target.value)}
              className="h-btn rounded-md border border-border bg-bg-surface px-2 text-body text-text"
            >
              <option value="">Select driver…</option>
              {coachTargets.map((r) => (
                <option key={r.driverId} value={r.driverId}>
                  {r.driver ? `${r.driver.firstName} ${r.driver.lastName}` : r.driverId}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              iconLeft={<Users size={16} strokeWidth={1.75} />}
              disabled={!coachTargets.some((t) => t.driverId === coachDriverId)}
              onClick={() => setCoachingDriverId(coachDriverId)}
            >
              Assign coaching
            </Button>
          </div>
        </Can>
      </div>
      <div className="p-card">
        {scorecard.isLoading ? (
          <LoadingState />
        ) : scorecard.isError ? (
          <ErrorState onRetry={() => scorecard.refetch()} />
        ) : scorecard.rows.length === 0 ? (
          <EmptyState {...EMPTY_STATE_COPY.safetyScorecard} />
        ) : visibleScorecard.length === 0 ? (
          <EmptyState {...searchEmptyState(search)} actions={[{ label: 'Clear search', onClick: () => setSearch('') }]} />
        ) : (
          <DataTable caption="Driver scorecard" data={visibleScorecard} getRowId={(r) => r.driverId} columns={SCORECARD_COLUMNS} />
        )}
      </div>
    </Card>
  );

  usePageHeader({ title: 'Safety', subtitle: 'Harsh driving, speeding and coaching · last 30 days' });

  return (
    <div className="flex flex-col gap-4">

      <div className="flex flex-wrap items-center justify-between gap-4">
        <SafetyTabs tab={tab} counts={tabCounts} onChange={setTab} />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-input w-full items-center gap-2 rounded-md border border-border bg-bg-surface px-3 sm:w-auto">
            <Search size={16} strokeWidth={1.75} className="text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === 'scorecards' ? 'Search driver…' : 'Search driver, unit…'}
              aria-label={tab === 'scorecards' ? 'Search driver' : 'Search driver, unit'}
              className="w-full min-w-0 bg-transparent text-body outline-none sm:w-56"
            />
          </div>
          {tab !== 'scorecards' && (
            <Button
              variant="secondary"
              iconLeft={<Filter size={16} strokeWidth={1.75} />}
              onClick={() => {
                setFiltersRevision((r) => r + 1);
                setFiltersOpen(true);
              }}
            >
              Filters{hasFilters ? ` · ${countActiveSafetyFilters(filters)}` : ''}
            </Button>
          )}
          <Button variant="secondary" iconLeft={<Upload size={16} strokeWidth={1.75} />} onClick={handleExport}>
            Export
          </Button>
        </div>
      </div>

      {tab !== 'scorecards' && (
        <SafetyFilterChips
          filters={filters}
          onRemove={(patch) => applyFilters({ ...filters, ...patch })}
          onClearAll={() => applyFilters(EMPTY_SAFETY_FILTERS)}
        />
      )}

      <div role="tabpanel" id={`safety-panel-${tab}`} aria-labelledby={`safety-tab-${tab}`} className="flex flex-col gap-4">
        {tab === 'events' && (
          <>
            {isKpiLoading ? (
              <KpiRowSkeleton />
            ) : (
              <div className="grid grid-cols-1 gap-card-gap sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  label="Fleet safety score"
                  value={fleetScore ?? '—'}
                  hint={fleetScore == null ? 'No scorecards yet' : undefined}
                  chip={fleetScore == null ? undefined : fleetChip}
                  icon={ShieldCheck}
                  iconTone="success"
                />
                <KpiCard
                  label="Harsh events"
                  value={harshNow}
                  chip={harshPrev > 0 || harshNow > 0 ? { text: harshNow <= harshPrev ? `↓ ${harshPrev - harshNow} vs prev.` : `↑ ${harshNow - harshPrev} vs prev.`, tone: harshNow <= harshPrev ? 'success' : 'danger' } : undefined}
                  icon={AlertTriangle}
                  iconTone="danger"
                />
                <KpiCard
                  label="Speeding events"
                  value={speedingNow}
                  chip={speedingPrev > 0 || speedingNow > 0 ? { text: speedingNow >= speedingPrev ? `↑ ${speedingNow - speedingPrev} vs prev.` : `↓ ${speedingPrev - speedingNow} vs prev.`, tone: speedingNow >= speedingPrev ? 'danger' : 'success' } : undefined}
                  icon={Gauge}
                  iconTone="danger"
                />
                <KpiCard
                  label="Coaching sessions"
                  value={coachedNow}
                  chip={pendingCoaching > 0 ? { text: `${pendingCoaching} pending`, tone: 'warning' } : undefined}
                  icon={Users}
                  iconTone="warning"
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-card-gap xl:grid-cols-[1fr_348px]">
              <Card padded={false}>
                <div className="p-card pb-0">
                  <SectionHeader title="Safety events" subtitle={`${currentEvents.length.toLocaleString('en-US')} events · ${pendingCoaching} need review`} />
                </div>
                <div className="p-card">{eventsTableBody(filteredEvents, EVENT_COLUMNS, 'Safety events', 'safety')}</div>
              </Card>

              <div className="flex flex-col gap-card-gap">
                {fleetScoreCard}

                <Card>
                  <SectionHeader title="Events by type" subtitle="Last 30 days" />
                  <div className="mt-3 flex flex-col gap-3">
                    {eventsByType.map((row) => (
                      <div key={row.type}>
                        <div className="flex items-center justify-between text-body">
                          <span className="text-text">{safetyEventLabel(row.type)}</span>
                          <span className="tabular-nums font-semibold text-text">{row.count}</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle">
                          <div
                            className={row.type === 'HARSH_ACCEL' ? 'h-full rounded-full bg-warning' : 'h-full rounded-full bg-danger'}
                            style={{ width: `${(row.count / maxTypeCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>

            {driverScorecardCard}
          </>
        )}

        {tab === 'coaching' && (
          <Card padded={false}>
            <div className="p-card pb-0">
              <SectionHeader title="Coaching sessions" subtitle={`${coachedNow} coached · ${pendingCoaching} pending review · last 30 days`} />
            </div>
            <div className="p-card">{eventsTableBody(coachingEvents, COACHING_COLUMNS, 'Coaching sessions', 'safetyCoaching')}</div>
          </Card>
        )}

        {tab === 'scorecards' && (
          <>
            {fleetScoreCard}
            {driverScorecardCard}
          </>
        )}
      </div>

      {/* `key` — a different driver is a fresh dialog: empty note, no previous error. */}
      {coachingTarget && (
        <AssignCoachingModal key={coachingTarget.driverId} driver={coachingTarget} onClose={() => setCoachingDriverId(null)} />
      )}
      <SafetyFiltersDrawer
        key={filtersRevision}
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onApply={applyFilters}
      />
    </div>
  );
}
