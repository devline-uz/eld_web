// owner: web-dvir-safety — W-09 DVIR & Maintenance (web/tz.md §10).
// Design: web/roles and screens/admin panel/DVIRs, open defects, preventive maintenance.jpg
// Route `/dvir` · Perm `dvir` READ · absent for DISPATCHER (router.tsx already blocks it).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Filter, Plus, Search, Upload, Wrench, AlertTriangle, ClipboardList, ShieldOff, X } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import { usePageHeader } from '@/app/layouts/Topbar';
import { Button } from '@/shared/ui/Button';
import { Select } from '@/shared/ui/Select';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { Badge, SeverityBadge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { DataTable } from '@/shared/ui/DataTable';
import { Pagination } from '@/shared/ui/Pagination';
import { KpiCard, KpiRowSkeleton } from '@/shared/ui/KpiCard';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';
import { EMPTY_STATE_COPY, searchEmptyState, TOAST_COPY } from '@/shared/ui/copy';
import { useToast } from '@/shared/ui/Toast';
import { ApiError, formErrorMessage } from '@/shared/api/errors';
import { dateOnlyToInstant, formatCarrierDateTime, formatDateOnly, timezoneAbbreviation, todayInTz } from '@/shared/format/datetime';
import { useCarrierTimezone } from '@/shared/auth/useCarrierTimezone';
import { useNowTick } from '@/shared/format/useRelativeTime';
import { formatMoney, formatOdometer } from '@/shared/format/numbers';
import { orDash, orNone, orUnassigned } from '@/shared/format/empty';
import {
  useCloseWorkOrder,
  useCancelWorkOrder,
  useCompleteSchedule,
  useDeleteSchedule,
  useAssignDefect,
  type DvirTableRow,
  type DefectTableRow,
  type WorkOrderTableRow,
  type ScheduleTableRow,
} from '@/shared/api/dvir';
// DEMO DATA — these hooks fall back to `./mock` rows while the API is empty/failing
// (`VITE_DEMO_FALLBACK`, never in production). Remove: import them from `@/shared/api/dvir` / `@/shared/api/lookups` again.
import {
  useRecentDvirs,
  useOpenDefects,
  useWorkOrdersList,
  useSchedulesList,
  useDueSchedules,
  useVehiclesLookup,
} from './mock/useDvirMock';
import { useUsersList } from '@/shared/api/settingsAdmin';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { DvirDrawer } from './components/DvirDrawer';
import { DVIR_TOAST_COPY } from './lib/copy';
import { defectsCsv, dvirsCsv, schedulesCsv, workOrdersCsv } from './lib/exportCsv';
import { CreateWorkOrderModal } from './components/CreateWorkOrderModal';
import { EditWorkOrderModal } from './components/EditWorkOrderModal';
import { EditScheduleModal } from './components/EditScheduleModal';
import { scheduleIntervalLabel, scheduleNextDueLabel } from './lib/scheduleLabels';
import { maintenanceDueLabel } from './lib/maintenanceDue';

import { ResolveDefectModal } from './components/ResolveDefectModal';
import { blockOdometerKeys, getOdometerError, sanitizeOdometer } from './lib/workOrderFieldGuards';
import { DvirFiltersDrawer, DvirFilterChips } from './components/DvirFiltersDrawer';
import {
  parseDvirFilters,
  writeDvirFilters,
  matchesDvirFilters,
  countUnknownSeverityExcluded,
  EMPTY_DVIR_FILTERS,
  countActiveDvirFilters,
} from './lib/filters';
import { formatEnumLabel } from '@/shared/format/enumLabel';

/** UI-011 — sort key for the maintenance card: what is left (negative = overdue by). */
const remaining = (s: { due: { milesRemaining: number | null; daysRemaining: number | null } }) =>
  s.due.milesRemaining ?? s.due.daysRemaining ?? 0;

type Tab = 'dvirs' | 'defects' | 'workOrders' | 'schedules';

/** The 11.23 drawer only filters the Recent DVIRs table. */
const FILTERS_TAB_REASON = 'Filters apply to the DVIRs tab only.';

/** Same rows by content — the export only needs to change when what the table shows changes. */
function sameRows<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const DVIR_TYPE_LABEL: Record<string, string> = {
  PRE_TRIP: 'Pre-trip',
  POST_TRIP: 'Post-trip',
  INTERMEDIATE: 'Intermediate',
};

/** Same guard as Vehicles/Drivers: `?page=abc`, `?page=0` or `?limit=-3` fall back to the
 * default instead of rendering a `NaN–NaN of 12` footer. */
function positiveIntParam(raw: string | null, fallback: number): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function DvirStatusBadge({ row }: { row: DvirTableRow }) {
  if (row.vehicleCondition === 'SATISFACTORY') return <Badge tone="success">No defects</Badge>;
  if (row.repairStatus === 'REPAIRED') return <Badge tone="info">Defects fixed</Badge>;
  return <Badge tone="danger">Not fixed</Badge>;
}

export default function DvirPage() {
  const carrierTz = useCarrierTimezone();
  const { can } = usePermission();
  const [params, setParams] = useSearchParams();
  const canMaintenanceRead = can('maintenance', 'READ');
  const canDvirFull = can('dvir', 'FULL');
  const { toast } = useToast();

  const tab = (params.get('tab') as Tab) ?? 'dvirs';
  // FE-22 — the search is kept in the URL (`?q=`) with the filters and page; the box keeps its own
  // text so typing never waits on a router update.
  const [search, setSearch] = useState(() => params.get('q') ?? '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersRevision, setFiltersRevision] = useState(0);
  const filters = useMemo(() => parseDvirFilters(params), [params]);
  function applyFilters(next: typeof filters) {
    setParams(writeDvirFilters(params, next), { replace: true });
  }

  // WB-268 — the Recent DVIRs table pages like Vehicles/Drivers: `?page=&limit=` in the URL,
  // default 10 rows (the old fixed slice). A filter change already drops `page`
  // (`writeDvirFilters`); a new page size or search term does the same, so each lands on page 1.
  const dvirsPage = positiveIntParam(params.get('page'), 1);
  const dvirsLimit = positiveIntParam(params.get('limit'), 10);
  function setDvirsPaging(key: 'page' | 'limit', value: number) {
    const next = new URLSearchParams(params);
    next.set(key, String(value));
    if (key === 'limit' || value === 1) next.delete('page');
    setParams(next, { replace: true });
  }
  function changeSearch(value: string) {
    setSearch(value);
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    next.delete('page');
    setParams(next, { replace: true });
  }


  function setTab(next: Tab) {
    const nextParams = new URLSearchParams(params);
    if (next === 'dvirs') nextParams.delete('tab');
    else nextParams.set('tab', next);
    setParams(nextParams, { replace: true });
  }

  // WD-073 — only the active tab's list is requested; the DVIRs tab is the default and also
  // hosts the "Open defects" table, so it mounts: the newest-DVIRs window (1 request, also the
  // `DVIRs today` KPI), one open-defects page, the CRITICAL count, the due-schedules set and
  // the session-wide driver/vehicle lookups. Work orders / schedules load on click.
  const debouncedSearch = useDebouncedValue(search, 300);
  const dvirs = useRecentDvirs();
  const overdue = useDueSchedules();
  const vehicles = useVehiclesLookup();
  const [defectsPage, setDefectsPage] = useState(1);
  const [defectsLimit, setDefectsLimit] = useState(10);
  // A new search term re-pages the open-defects table from the start, and the page is clamped to
  // the narrowed result: page 3 of a 1-page result is an empty server page (server mode) or rows
  // that no longer match the page number Pagination shows (in-memory window mode, B-66).
  // Adjusted during render, not in an effect — react.dev "you might not need an effect".
  const [prevDefectsSearch, setPrevDefectsSearch] = useState(debouncedSearch);
  const requestedDefectsPage = debouncedSearch === prevDefectsSearch ? defectsPage : 1;
  if (debouncedSearch !== prevDefectsSearch) setPrevDefectsSearch(debouncedSearch);
  const defects = useOpenDefects({ page: requestedDefectsPage, limit: defectsLimit, search: debouncedSearch });
  const currentDefectsPage = defects.isLoading
    ? requestedDefectsPage
    : Math.min(requestedDefectsPage, Math.max(1, defects.totalPages));
  if (currentDefectsPage !== defectsPage) setDefectsPage(currentDefectsPage);

  const needle = debouncedSearch.trim().toLowerCase();
  const matchesSearch = (unit: string | undefined, ...text: (string | null | undefined)[]) =>
    !needle || (unit ?? '').toLowerCase().includes(needle) || text.some((t) => (t ?? '').toLowerCase().includes(needle));

  // CODE-075 — "oldest" is about OVERDUE services only, measured by how far past the due date
  // they are; `Math.abs` over every row turned a DUE_SOON "in 5 d" into "oldest 5 d".
  const oldestOverdueDays = useMemo(() => {
    const days = overdue.rows
      .filter((s) => s.due.state === 'OVERDUE' && s.due.daysRemaining != null && s.due.daysRemaining < 0)
      .map((s) => -(s.due.daysRemaining as number));
    return days.length ? Math.max(...days) : 0;
  }, [overdue.rows]);
  const nowTick = useNowTick();
  const dvirsToday = useMemo(() => {
    // F3-19 — "today" is the carrier's day, like the times the table shows (it was the browser's).
    const todayKey = todayInTz(carrierTz, new Date(nowTick));
    return dvirs.rows.filter((d) => todayInTz(carrierTz, new Date(d.submittedAt)) === todayKey);
  }, [dvirs.rows, nowTick, carrierTz]);
  const noDefectToday = useMemo(
    () => dvirsToday.filter((d) => d.vehicleCondition === 'SATISFACTORY').length,
    [dvirsToday],
  );
  // The window is newest-first: if every row in it is from today, today has at least that many.
  const dvirsTodayLabel = dvirs.windowFull && dvirsToday.length === dvirs.rows.length ? `${dvirsToday.length}+` : dvirsToday.length;
  const outOfServiceVehicles = useMemo(
    () => (vehicles.data?.items ?? []).filter((v) => v.status === 'OUT_OF_SERVICE'),
    [vehicles.data],
  );

  const isKpiLoading = dvirs.isLoading || defects.isLoading || overdue.isLoading || vehicles.isLoading;

  // The Work orders / Schedules tables own their paging and search, so they report the rows they
  // are showing up to the header's `Export`.
  const [tabRows, setTabRows] = useState<{ workOrders: WorkOrderTableRow[]; schedules: ScheduleTableRow[] }>({
    workOrders: [],
    schedules: [],
  });
  // Stage 3 (hang fix) — `usePagedQuery` hands back a fresh array every render (`data?.items ?? []`
  // while loading, `filtered.slice()` in window mode), so the tabs' `useEffect(() => onRows(rows))`
  // fed a new object into this state on every render and the Schedules tab re-rendered forever.
  // Keeping `prev` when the content is unchanged lets React bail out and breaks the loop.
  const setWorkOrderRows = useCallback(
    (rows: WorkOrderTableRow[]) =>
      setTabRows((prev) => (sameRows(prev.workOrders, rows) ? prev : { ...prev, workOrders: rows })),
    [],
  );
  const setScheduleRows = useCallback(
    (rows: ScheduleTableRow[]) =>
      setTabRows((prev) => (sameRows(prev.schedules, rows) ? prev : { ...prev, schedules: rows })),
    [],
  );

  const [drawerDvirId, setDrawerDvirId] = useState<string | null>(null);
  const [resolveDefect, setResolveDefect] = useState<DefectTableRow | null>(null);
  const [rowWorkOrderVehicleId, setRowWorkOrderVehicleId] = useState<string | null>(null);
  const [createWoOpen, setCreateWoOpen] = useState(false);

  // W-04's `New work order` (which may not import this feature's modal) links here with the unit
  // it was pressed on: `/dvir?newWorkOrder=<vehicleId>`. The modal is derived from the URL rather
  // than copied into state, and closing it removes the param.
  const linkedWorkOrderVehicleId = can('maintenance', 'FULL') ? params.get('newWorkOrder') : null;
  const workOrderVehicleId = rowWorkOrderVehicleId ?? linkedWorkOrderVehicleId;
  function closeWorkOrderModal() {
    setCreateWoOpen(false);
    setRowWorkOrderVehicleId(null);
    if (!params.get('newWorkOrder')) return;
    const next = new URLSearchParams(params);
    next.delete('newWorkOrder');
    setParams(next, { replace: true });
  }

  // B-47 — the server now applies the 48 h bound (`recentDvirsFrom`, `GET /dvir?from=`), so this
  // is only the search filter, before the severity/type/repair-status filters and the 10-row
  // slice. WB-078 needs the pre-filter set to know how many of the DVIRs a severity filter
  // *could* match are being silently dropped because their defects sit outside the loaded
  // window (B-66).
  const recentDvirsWindow = useMemo(
    () => dvirs.rows.filter((d) => matchesSearch(d.vehicle?.unitNumber, ...d.defects.map((x) => x.category))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dvirs.rows, needle],
  );

  const recentDvirsFiltered = useMemo(
    () =>
      recentDvirsWindow
        .filter((d) => matchesDvirFilters(d, filters))
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()),
    [recentDvirsWindow, filters],
  );
  // WB-268 — client-side paging over the filtered 48 h window. `GET /dvir` pages on the server, but
  // search, type and severity have no server param (B-66), so a server page could not be
  // filtered consistently; the window is bounded (`RECENT_DVIR_WINDOW`).
  const dvirsTotalPages = Math.max(1, Math.ceil(recentDvirsFiltered.length / dvirsLimit));
  const shownDvirsPage = Math.min(dvirsPage, dvirsTotalPages);
  const recentDvirs = useMemo(
    () => recentDvirsFiltered.slice((shownDvirsPage - 1) * dvirsLimit, shownDvirsPage * dvirsLimit),
    [recentDvirsFiltered, shownDvirsPage, dvirsLimit],
  );
  // A `page` past the end (a bookmark, the back button, rows aged out of the 48 h) snaps back to
  // the last page that exists, as on Vehicles/Drivers.
  useEffect(() => {
    if (dvirs.isLoading || dvirsPage <= dvirsTotalPages) return;
    setDvirsPaging('page', dvirsTotalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dvirsPage, dvirsTotalPages, dvirs.isLoading]);
  // `+` when the loaded window is full and every row in it is inside the 48 h the table shows:
  // there may be more submissions the window never reached (B-66).
  const recentDvirsCountLabel =
    dvirs.windowFull && recentDvirsWindow.length === dvirs.rows.length
      ? `${recentDvirsFiltered.length}+`
      : `${recentDvirsFiltered.length}`;

  const unknownSeverityExcluded = useMemo(
    () => countUnknownSeverityExcluded(recentDvirsWindow, filters),
    [recentDvirsWindow, filters],
  );

  // UI-011 — OVERDUE is its own list (most overdue first), never mixed into "Upcoming", which is
  // DUE_SOON only (soonest first).
  const overdueSchedules = useMemo(
    () => overdue.rows.filter((s) => s.due.state === 'OVERDUE').sort((a, b) => remaining(a) - remaining(b)).slice(0, 6),
    [overdue.rows],
  );
  const upcomingSchedules = useMemo(
    () => overdue.rows.filter((s) => s.due.state === 'DUE_SOON').sort((a, b) => remaining(a) - remaining(b)).slice(0, 6),
    [overdue.rows],
  );

  function renderScheduleDue(s: (typeof overdue.rows)[number]) {
    const isOverdue = s.due.state === 'OVERDUE';
    const ratio = isOverdue
      ? 1
      : s.intervalMi && s.due.milesRemaining != null
        ? Math.max(0, s.due.milesRemaining) / s.intervalMi
        : s.intervalDays && s.due.daysRemaining != null
          ? Math.max(0, s.due.daysRemaining) / s.intervalDays
          : 0;
    const tone = isOverdue ? 'danger' : 'warning';
    const dueLabel = maintenanceDueLabel(s.due, formatOdometer);
    return (
      <div key={s.id} className="flex flex-col gap-1.5 rounded-md border border-border p-3">
        <span className="text-body-strong text-text">
          🔧 Unit {s.vehicle?.unitNumber ?? '—'} · {s.name}
        </span>
        <span className="tabular-nums text-caption text-text-muted">
          <span className={isOverdue ? 'font-semibold text-danger' : undefined}>{dueLabel}</span> ·{' '}
          {/* LIVE-028 — the second half names the interval the first half is about: "Overdue by
              51,024 mi · Oct 23" read as overdue by a future date. A mileage overdue shows the
              due odometer; otherwise the due date (or the due odometer when there is no date). */}
          {orDash(s.nextDueAt ?? s.nextDueMi, () =>
            s.nextDueMi != null && (!s.nextDueAt || (s.due.milesRemaining != null && s.due.milesRemaining <= 0))
              ? `due at ${formatOdometer(s.nextDueMi)} mi`
              : s.nextDueAt
                ? `due ${formatDateOnly(s.nextDueAt, carrierTz, 'monthDay')}`
                : '—',
          )}
        </span>
        <ProgressBar ratio={ratio} tone={tone} thick label={`Unit ${s.vehicle?.unitNumber ?? '—'} ${s.name} — ${dueLabel}`} />
      </div>
    );
  }

  // There is no server-side export on any of these four lists, so the file is what the active
  // tab is showing. Stage 3 — it used to be a raw JSON dump with no toast and no error path; it is
  // now CSV like every other table export, and both outcomes are announced.
  const exportable: Record<Tab, { count: number; fileName: string; build: () => string }> = {
    dvirs: { count: recentDvirs.length, fileName: 'dvir-recent-dvirs.csv', build: () => dvirsCsv(recentDvirs) },
    defects: { count: defects.rows.length, fileName: 'dvir-open-defects.csv', build: () => defectsCsv(defects.rows) },
    workOrders: {
      count: tabRows.workOrders.length,
      fileName: 'dvir-work-orders.csv',
      build: () => workOrdersCsv(tabRows.workOrders),
    },
    schedules: {
      count: tabRows.schedules.length,
      fileName: 'dvir-schedules.csv',
      build: () => schedulesCsv(tabRows.schedules),
    },
  };

  function handleExport() {
    const { count, fileName, build } = exportable[tab];
    try {
      const blob = new Blob([build()], { type: 'text/csv' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(link.href);
      toast({ kind: 'success', ...DVIR_TOAST_COPY.exported(count, fileName) });
    } catch (error) {
      toast({
        kind: 'error',
        ...DVIR_TOAST_COPY.exportFailed(error instanceof Error ? error.message : 'Something went wrong.'),
      });
    }
  }

  usePageHeader({ title: 'DVIR & Maintenance', subtitle: 'Driver vehicle inspection reports, defects and service schedule' });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex h-input w-full items-center gap-2 rounded-md border border-border bg-bg-surface px-3 sm:w-auto">
            <Search size={16} strokeWidth={1.75} className="text-text-muted" />
            <input
              value={search}
              onChange={(e) => changeSearch(e.target.value)}
              // Stage 3 — one term, debounced once, feeds every tab; Esc and × clear it everywhere.
              onKeyDown={(e) => {
                if (e.key === 'Escape' && search) changeSearch('');
              }}
              aria-label="Search unit, defect"
              placeholder="Search unit, defect…"
              className="w-full min-w-0 bg-transparent text-body outline-none sm:w-56"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => changeSearch('')}
                className="flex size-6 items-center justify-center rounded-md text-text-muted hover:bg-bg-subtle hover:text-text"
              >
                <X size={14} strokeWidth={1.75} aria-hidden="true" />
              </button>
            )}
          </div>
          {/* The drawer's three groups (type / severity / repair status) only narrow the Recent
              DVIRs table. On the other three tabs it applied to nothing while still looking
              live, so it says so instead. */}
          <Button
            variant="secondary"
            iconLeft={<Filter size={16} strokeWidth={1.75} />}
            disabled={tab !== 'dvirs'}
            title={tab === 'dvirs' ? undefined : FILTERS_TAB_REASON}
            onClick={() => {
              setFiltersRevision((r) => r + 1);
              setFiltersOpen(true);
            }}
          >
            Filters{countActiveDvirFilters(filters) > 0 ? ` · ${countActiveDvirFilters(filters)}` : ''}
          </Button>
          <Button
            variant="secondary"
            iconLeft={<Upload size={16} strokeWidth={1.75} />}
            disabled={exportable[tab].count === 0}
            title={exportable[tab].count === 0 ? 'Nothing to export on this tab.' : undefined}
            onClick={handleExport}
          >
            Export
          </Button>
          <Can perm="maintenance" level="FULL">
            <Button variant="primary" iconLeft={<Plus size={16} strokeWidth={1.75} />} onClick={() => setCreateWoOpen(true)}>
              New work order
            </Button>
          </Can>
        </div>
      </div>

      {isKpiLoading ? (
        <KpiRowSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-card-gap sm:grid-cols-2 xl:grid-cols-4">
          {/* CODE-075 — a failed or forbidden source shows "—", never a reassuring 0. */}
          <KpiCard
            label="Open defects"
            value={defects.isError ? '—' : defects.total}
            chip={!defects.isError && defects.criticalCount > 0 ? { text: `${defects.criticalCount} critical`, tone: 'danger' } : undefined}
            icon={AlertTriangle}
            iconTone="danger"
          />
          <KpiCard
            label="Overdue services"
            value={overdue.isError ? '—' : overdue.rows.filter((s) => s.due.state === 'OVERDUE').length}
            chip={!overdue.isError && oldestOverdueDays > 0 ? { text: `oldest ${oldestOverdueDays} d`, tone: 'warning' } : undefined}
            icon={Wrench}
            iconTone="warning"
          />
          <KpiCard
            label="DVIRs today"
            value={dvirs.isError ? '—' : dvirsTodayLabel}
            chip={!dvirs.isError && dvirsToday.length > 0 ? { text: `${noDefectToday} no-defect`, tone: 'success' } : undefined}
            icon={ClipboardList}
            iconTone="success"
          />
          <KpiCard
            label="Vehicles out of service"
            value={vehicles.isError ? '—' : outOfServiceVehicles.length}
            chip={
              !vehicles.isError && outOfServiceVehicles.length > 0
                ? { text: `Unit ${outOfServiceVehicles[0]?.unitNumber ?? ''}`, tone: 'danger' }
                : undefined
            }
            icon={ShieldOff}
            iconTone="danger"
          />
        </div>
      )}

      <div className="flex h-9 w-fit max-w-full shrink-0 overflow-x-auto rounded-md border border-border">
        {(
          [
            // The table under this tab is the last 48 h, filtered — counting every DVIR the
            // server holds made the tab disagree with the rows beneath it.
            ['dvirs', `DVIRs ${recentDvirsCountLabel}`],
            ['defects', `Open defects ${defects.total}`],
            ...(canMaintenanceRead ? ([['workOrders', 'Work orders'], ['schedules', 'Schedules']] as [Tab, string][]) : []),
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
            className={
              tab === value
                ? 'shrink-0 whitespace-nowrap bg-bg-inverse px-3 text-body-strong text-text-inverse'
                : 'shrink-0 whitespace-nowrap bg-bg-surface px-3 text-body text-text-secondary hover:bg-bg-subtle'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'dvirs' && (
        <DvirFilterChips
          filters={filters}
          onRemove={(patch) => applyFilters({ ...filters, ...patch })}
          onClearAll={() => applyFilters(EMPTY_DVIR_FILTERS)}
        />
      )}

      {tab === 'dvirs' && (
        <div className="grid grid-cols-1 gap-card-gap xl:grid-cols-[1fr_348px]">
          <Card padded={false} className="flex flex-col">
            <div className="p-card pb-0">
              <SectionHeader title="Recent DVIRs" subtitle="Last 48 hours" />
              {unknownSeverityExcluded > 0 && (
                <p className="mt-1 text-caption text-text-muted">
                  {unknownSeverityExcluded} DVIR{unknownSeverityExcluded === 1 ? '' : 's'} with unknown defect severity
                  (outside the loaded window) {unknownSeverityExcluded === 1 ? 'is' : 'are'} excluded from this filter.
                </p>
              )}
            </div>
            {/* flex-1 lets the table area absorb the spare height of the grid row (stretched by the
                Upcoming maintenance card), so Pagination sits at the card bottom — as Trips (WB-264). */}
            <div className="flex-1 p-card">
              {dvirs.isLoading ? (
                <LoadingState />
              ) : dvirs.isError ? (
                <ErrorState onRetry={() => dvirs.refetch()} />
              ) : recentDvirsFiltered.length === 0 ? (
                search || countActiveDvirFilters(filters) > 0 ? (
                  <EmptyState
                    {...searchEmptyState(search || 'these filters')}
                    actions={[
                      {
                        label: search ? 'Clear search' : 'Clear filters',
                        onClick: () => (search ? changeSearch('') : applyFilters(EMPTY_DVIR_FILTERS)),
                      },
                    ]}
                  />
                ) : (
                  <EmptyState {...EMPTY_STATE_COPY.dvir} actions={undefined} />
                )
              ) : (
                <DataTable
                  caption="Recent DVIRs"
                  data={recentDvirs}
                  getRowId={(r) => r.id}
                  onRowClick={(row) => setDrawerDvirId(row.id)}
                  columns={
                    [
                      {
                        id: 'dateTime',
                        header: `DATE & TIME (${timezoneAbbreviation(carrierTz)})`,
                        cell: ({ row }) => (
                          <span className="tabular-nums text-text">{formatCarrierDateTime(row.original.submittedAt, carrierTz)}</span>
                        ),
                      },
                      {
                        id: 'unit',
                        header: 'UNIT',
                        cell: ({ row }) => <span className="text-text">{row.original.vehicle?.unitNumber ?? '—'}</span>,
                      },
                      {
                        id: 'driver',
                        header: 'DRIVER',
                        cell: ({ row }) => {
                          const driver = row.original.driver;
                          if (!driver) return <span className="text-text-muted">{orUnassigned(null)}</span>;
                          const name = `${driver.firstName} ${driver.lastName}`;
                          return (
                            <span className="flex items-center gap-2">
                              <Avatar name={name} size="sm" />
                              <span className="text-text">{name}</span>
                            </span>
                          );
                        },
                      },
                      {
                        id: 'type',
                        header: 'TYPE',
                        cell: ({ row }) => <span className="text-text">{DVIR_TYPE_LABEL[row.original.type] ?? row.original.type}</span>,
                      },
                      {
                        id: 'defects',
                        header: 'DEFECTS',
                        cell: ({ row }) => {
                          const cats = row.original.defects.map((d) => d.category).join(', ');
                          if (!cats && !row.original.defectsKnown) return <span className="text-text-muted">{orDash(null, String)}</span>;
                          return <span className={cats ? 'text-text' : 'text-text-muted'}>{orNone(cats || null)}</span>;
                        },
                      },
                      {
                        id: 'status',
                        header: 'STATUS',
                        cell: ({ row }) => <DvirStatusBadge row={row.original} />,
                      },
                    ] as ColumnDef<DvirTableRow, unknown>[]
                  }
                />
              )}
            </div>
            {!dvirs.isLoading && !dvirs.isError && recentDvirsFiltered.length > 0 && (
              <Pagination
                page={shownDvirsPage}
                limit={dvirsLimit}
                total={recentDvirsFiltered.length}
                totalPages={dvirsTotalPages}
                itemLabel="DVIRs"
                onPageChange={(p) => setDvirsPaging('page', p)}
                onLimitChange={(l) => setDvirsPaging('limit', l)}
              />
            )}
          </Card>

          <Card padded={false}>
            <div className="p-card pb-0">
              <SectionHeader title="Upcoming maintenance" subtitle="Due within 7 days or 500 mi" />
            </div>
            <div className="flex flex-col gap-3 p-card">
              {overdue.isLoading ? (
                <LoadingState rows={3} />
              ) : upcomingSchedules.length === 0 && overdueSchedules.length === 0 ? (
                <p className="text-body text-text-muted">No services due in the next 30 days.</p>
              ) : (
                <>
                  {overdueSchedules.length > 0 && (
                    <section aria-label="Overdue maintenance" className="flex flex-col gap-3">
                      <span className="text-caption font-semibold uppercase text-danger">Overdue</span>
                      {overdueSchedules.map((s) => renderScheduleDue(s))}
                    </section>
                  )}
                  {upcomingSchedules.length > 0 && (
                    <section aria-label="Upcoming maintenance" className="flex flex-col gap-3">
                      {overdueSchedules.length > 0 && <span className="text-caption font-semibold uppercase text-text-muted">Upcoming</span>}
                      {upcomingSchedules.map((s) => renderScheduleDue(s))}
                    </section>
                  )}
                </>
              )}
            </div>
          </Card>

          <Card padded={false} className="xl:col-span-2">
            <div className="flex items-start justify-between p-card pb-0">
              <SectionHeader title="Open defects" subtitle={`${defects.total} total · ${defects.criticalCount} critical`} />
              <Can perm="maintenance" level="FULL">
                <Button variant="secondary" iconLeft={<Plus size={16} strokeWidth={1.75} />} onClick={() => setCreateWoOpen(true)}>
                  Create work order
                </Button>
              </Can>
            </div>
            <div className="p-card">
              <OpenDefectsTable
                rows={defects.rows}
                total={defects.total}
                totalPages={defects.totalPages}
                page={currentDefectsPage}
                limit={defectsLimit}
                onPageChange={setDefectsPage}
                onLimitChange={(l) => {
                  setDefectsLimit(l);
                  setDefectsPage(1);
                }}
                isLoading={defects.isLoading}
                isError={defects.isError}
                onRetry={() => defects.refetch()}
                onRowClick={canDvirFull ? setResolveDefect : undefined}
              />
            </div>
          </Card>
        </div>
      )}

      {tab === 'defects' && (
        <Card padded={false}>
          <div className="p-card pb-0">
            <SectionHeader title="Open defects" subtitle={`${defects.total} total · ${defects.criticalCount} critical`} />
          </div>
          <div className="p-card">
            <OpenDefectsTable
              rows={defects.rows}
              total={defects.total}
              totalPages={defects.totalPages}
              page={currentDefectsPage}
              limit={defectsLimit}
              onPageChange={setDefectsPage}
              onLimitChange={(l) => {
                setDefectsLimit(l);
                setDefectsPage(1);
              }}
              isLoading={defects.isLoading}
              isError={defects.isError}
              onRetry={() => defects.refetch()}
              onRowClick={canDvirFull ? setResolveDefect : undefined}
            />
          </div>
        </Card>
      )}

      <Can perm="maintenance" level="READ">
        {tab === 'workOrders' && <WorkOrdersTab search={debouncedSearch} onRows={setWorkOrderRows} />}
        {tab === 'schedules' && <SchedulesTab search={debouncedSearch} onRows={setScheduleRows} />}
      </Can>

      {drawerDvirId && (
        <DvirDrawer
          dvirId={drawerDvirId}
          onClose={() => setDrawerDvirId(null)}
          onCreateWorkOrder={(vehicleId) => {
            setDrawerDvirId(null);
            setRowWorkOrderVehicleId(vehicleId);
          }}
        />
      )}
      {resolveDefect && <ResolveDefectModal defect={resolveDefect} onClose={() => setResolveDefect(null)} />}
      {(createWoOpen || workOrderVehicleId) && (
        <CreateWorkOrderModal
          vehicleId={workOrderVehicleId ?? undefined}
          onClose={closeWorkOrderModal}
        />
      )}
      <DvirFiltersDrawer
        key={filtersRevision}
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onApply={applyFilters}
      />
    </div>
  );
}

interface ServerPageProps {
  total: number;
  totalPages: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

/** B-40 — inline assignee picker on the Open defects table. `dvir` FULL only; a READ-only role
 * sees the resolved name (or `Unassigned`), never an editable control (§12.2). */
function AssignedToCell({ defect }: { defect: DefectTableRow }) {
  const { can } = usePermission();
  const { toast } = useToast();
  const { rows: users } = useUsersList();
  const assign = useAssignDefect(defect.id);
  const assignee = users.find((u) => u.id === defect.assigneeId);
  const assigneeLabel = assignee ? `${assignee.firstName} ${assignee.lastName}` : null;

  if (!can('dvir', 'FULL')) {
    return <span className="text-text-muted">{orUnassigned(assigneeLabel)}</span>;
  }

  // Shared Select (10-row scrolling menu). The wrapper keeps clicks/Enter on the trigger and on
  // the portalled menu (React bubbles through portals) from reaching the row's onRowClick.
  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Select
        value={defect.assigneeId ?? ''}
        disabled={assign.isPending}
        options={[
          { value: '', label: 'Unassigned' },
          ...users.map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` })),
        ]}
        onChange={(next) => {
          if (next === (defect.assigneeId ?? '')) return;
          // The assignment used to fail silently: the select snapped back with no reason.
          assign.mutate(next === '' ? null : next, {
            onError: (error) => toast({ kind: 'error', title: formErrorMessage(error, [], { assigneeId: 'Assignee' }) }),
          });
        }}
        aria-label={`Assign defect ${formatEnumLabel(defect.category)}`}
        className="h-8 rounded-md border border-border bg-bg-surface px-2 text-body text-text"
      />
    </span>
  );
}

function OpenDefectsTable({
  rows,
  total,
  totalPages,
  page,
  limit,
  onPageChange,
  onLimitChange,
  isLoading,
  isError,
  onRetry,
  onRowClick,
}: ServerPageProps & {
  rows: DefectTableRow[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onRowClick?: (defect: DefectTableRow) => void;
}) {
  const carrierTz = useCarrierTimezone();
  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={onRetry} />;
  if (total === 0) return <EmptyState {...EMPTY_STATE_COPY.openDefects} />;
  return (
    <>
    <DataTable
      caption="Open defects"
      data={rows}
      getRowId={(r) => r.id}
      onRowClick={onRowClick}
      columns={
        [
          { id: 'unit', header: 'UNIT', cell: ({ row }) => <span className="text-text">{row.original.vehicle?.unitNumber ?? '—'}</span> },
          {
            id: 'reported',
            header: 'REPORTED',
            cell: ({ row }) => <span className="tabular-nums text-text-muted">{formatCarrierDateTime(row.original.createdAt, carrierTz)}</span>,
          },
          { id: 'component', header: 'COMPONENT', cell: ({ row }) => <span className="text-text">{formatEnumLabel(row.original.category)}</span> },
          {
            id: 'severity',
            header: 'SEVERITY',
            cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
          },
          { id: 'description', header: 'DESCRIPTION', cell: ({ row }) => <span className="text-text-secondary">{row.original.description}</span> },
          {
            id: 'assignedTo',
            header: 'ASSIGNED TO',
            // B-40 (shipped 2026-09-24) — `PATCH /defects/:id/assign`.
            cell: ({ row }) => <AssignedToCell defect={row.original} />,
          },
          {
            id: 'status',
            header: 'STATUS',
            cell: ({ row }) =>
              row.original.outOfService ? (
                <Badge tone="danger" dot>
                  Out of service
                </Badge>
              ) : row.original.status === 'IN_PROGRESS' ? (
                <Badge tone="info">In progress</Badge>
              ) : (
                <Badge outline>Open</Badge>
              ),
          },
        ] as ColumnDef<DefectTableRow, unknown>[]
      }
    />
    <Pagination page={page} limit={limit} total={total} totalPages={totalPages} itemLabel="defects" onPageChange={onPageChange} onLimitChange={onLimitChange} />
    </>
  );
}

/** Mounted only while its tab is active — `GET /work-orders` (`q` is a real param) per page. */
function WorkOrdersTab({ search, onRows }: { search: string; onRows: (rows: WorkOrderTableRow[]) => void }) {
  const carrierTz = useCarrierTimezone();
  const { can } = usePermission();
  const canFull = can('maintenance', 'FULL');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  // A new search term re-pages from the start, and the page is clamped to the narrowed result —
  // otherwise `GET /work-orders?page=3` for a 1-page result answers an empty page and the table
  // renders with no rows at all. Adjusted during render, not in an effect.
  const [prevSearch, setPrevSearch] = useState(search);
  const requestedPage = search === prevSearch ? page : 1;
  if (search !== prevSearch) setPrevSearch(search);
  const q = search.trim() || undefined;
  const { rows, total, totalPages, isLoading, isError, refetch } = useWorkOrdersList({ page: requestedPage, limit, q });
  const currentPage = isLoading ? requestedPage : Math.min(requestedPage, Math.max(1, totalPages));
  if (currentPage !== page) setPage(currentPage);
  const onRetry = () => void refetch();
  useEffect(() => onRows(rows), [rows, onRows]);
  // WB-074 — the `…` menu's three actions; each opens its own confirm/edit overlay so the
  // mutation-bearing hooks (`useCloseWorkOrder(id)` etc.) only mount once the target is known.
  const [closeTarget, setCloseTarget] = useState<WorkOrderTableRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<WorkOrderTableRow | null>(null);
  const [editTarget, setEditTarget] = useState<WorkOrderTableRow | null>(null);
  return (
    <Card padded={false}>
      <div className="p-card pb-0">
        <SectionHeader title="Work orders" subtitle={`${total} total`} />
      </div>
      <div className="p-card">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState onRetry={onRetry} />
        ) : total === 0 ? (
          <EmptyState title="No work orders yet" description="Create a work order from an open defect to track repair costs." />
        ) : (
          <>
          <DataTable
            caption="Work orders"
            data={rows}
            getRowId={(r) => r.id}
            rowActions={
              canFull
                ? (row: WorkOrderTableRow) => {
                    const closed = row.status === 'DONE' || row.status === 'CANCELLED';
                    return (
                      <>
                        <DropdownMenu.Item
                          disabled={closed}
                          onSelect={() => setCloseTarget(row)}
                          className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                        >
                          Close
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          disabled={closed}
                          onSelect={() => setCancelTarget(row)}
                          className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                        >
                          Cancel
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          onSelect={() => setEditTarget(row)}
                          className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle"
                        >
                          Edit
                        </DropdownMenu.Item>
                      </>
                    );
                  }
                : undefined
            }
            columns={
              [
                { id: 'number', header: 'NUMBER', cell: ({ row }) => <span className="tabular-nums font-semibold text-text">{row.original.number}</span> },
                { id: 'unit', header: 'UNIT', cell: ({ row }) => <span className="text-text">{row.original.vehicle?.unitNumber ?? '—'}</span> },
                { id: 'title', header: 'TITLE', cell: ({ row }) => <span className="text-text">{row.original.title}</span> },
                { id: 'priority', header: 'PRIORITY', cell: ({ row }) => <Badge tone={row.original.priority === 'URGENT' || row.original.priority === 'HIGH' ? 'danger' : 'neutral'}>{formatEnumLabel(row.original.priority)}</Badge> },
                {
                  id: 'status',
                  header: 'STATUS',
                  cell: ({ row }) => (
                    <Badge tone={row.original.status === 'DONE' ? 'success' : row.original.status === 'CANCELLED' ? 'neutral' : row.original.status === 'IN_PROGRESS' ? 'info' : 'warning'}>
                      {formatEnumLabel(row.original.status)}
                    </Badge>
                  ),
                },
                { id: 'vendor', header: 'VENDOR', cell: ({ row }) => <span className="text-text">{orDash(row.original.vendor, (v) => v)}</span> },
                {
                  id: 'cost',
                  header: 'COST',
                  meta: { numeric: true },
                  cell: ({ row }) => <span className="tabular-nums text-text">{orDash(toNum(row.original.costUsd), formatMoney)}</span>,
                },
                {
                  id: 'due',
                  header: 'DUE',
                  cell: ({ row }) => <span className="tabular-nums text-text-muted">{formatDateOnly(row.original.dueAt, carrierTz)}</span>,
                },
              ] as ColumnDef<WorkOrderTableRow, unknown>[]
            }
          />
          <Pagination page={currentPage} limit={limit} total={total} totalPages={totalPages} itemLabel="work orders" onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
          </>
        )}
      </div>
      {closeTarget && <WorkOrderCloseModal workOrder={closeTarget} onClose={() => setCloseTarget(null)} />}
      {cancelTarget && <WorkOrderCancelModal workOrder={cancelTarget} onClose={() => setCancelTarget(null)} />}
      {editTarget && <EditWorkOrderModal workOrder={editTarget} onClose={() => setEditTarget(null)} />}
    </Card>
  );
}

/** WB-074 — Work orders `…` `Close`. `POST /work-orders/:id/close`. */
function WorkOrderCloseModal({ workOrder, onClose }: { workOrder: WorkOrderTableRow; onClose: () => void }) {
  const { toast } = useToast();
  const mutation = useCloseWorkOrder(workOrder.id);
  const [serverError, setServerError] = useState<string | null>(null);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Close work order ${workOrder.number}?`}
      subtitle={`Unit ${workOrder.vehicle?.unitNumber ?? '—'} · ${workOrder.title}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            loading={mutation.isPending}
            onClick={() =>
              mutation.mutate(undefined, {
                onSuccess: () => {
                  toast({ kind: 'success', ...TOAST_COPY.workOrderClosed(workOrder.number) });
                  onClose();
                },
                onError: (error) => setServerError(formErrorMessage(error)),
              })
            }
          >
            Close work order
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-body text-text-secondary">Marks the repair as done and clears it from open work.</p>
        {serverError && (
          <p role="alert" className="text-body text-danger">
            {serverError}
          </p>
        )}
      </div>
    </Modal>
  );
}

/** WB-074 — Work orders `…` `Cancel`. `POST /work-orders/:id/cancel`. */
function WorkOrderCancelModal({ workOrder, onClose }: { workOrder: WorkOrderTableRow; onClose: () => void }) {
  const { toast } = useToast();
  const mutation = useCancelWorkOrder(workOrder.id);
  const [serverError, setServerError] = useState<string | null>(null);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Cancel work order ${workOrder.number}?`}
      subtitle="This cannot be undone."
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={mutation.isPending}>
            Keep work order
          </Button>
          <Button
            variant="danger"
            size="lg"
            loading={mutation.isPending}
            onClick={() =>
              mutation.mutate(undefined, {
                onSuccess: () => {
                  toast({ kind: 'success', ...TOAST_COPY.workOrderCancelled(workOrder.number) });
                  onClose();
                },
                onError: (error) => setServerError(formErrorMessage(error)),
              })
            }
          >
            Cancel work order
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-body text-text-secondary">
          Unit {workOrder.vehicle?.unitNumber ?? '—'} · {workOrder.title}. No further work will be tracked against it; any
          linked defects stay open.
        </p>
        {serverError && (
          <p role="alert" className="text-body text-danger">
            {serverError}
          </p>
        )}
      </div>
    </Modal>
  );
}

/** Mounted only while its tab is active — one `GET /maintenance-schedules` page per render. */
function SchedulesTab({ search, onRows }: { search: string; onRows: (rows: ScheduleTableRow[]) => void }) {
  const carrierTz = useCarrierTimezone();
  const { can } = usePermission();
  const canFull = can('maintenance', 'FULL');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  // Same rule as the other two tables: a new search term re-pages from the start and the page is
  // clamped to the narrowed result. Adjusted during render, not in an effect.
  const [prevSearch, setPrevSearch] = useState(search);
  const requestedPage = search === prevSearch ? page : 1;
  if (search !== prevSearch) setPrevSearch(search);
  const { rows, total, totalPages, isLoading, isError, refetch } = useSchedulesList({ page: requestedPage, limit, search });
  const currentPage = isLoading ? requestedPage : Math.min(requestedPage, Math.max(1, totalPages));
  if (currentPage !== page) setPage(currentPage);
  const onRetry = () => refetch();
  useEffect(() => onRows(rows), [rows, onRows]);
  // WB-074 — same one-target-at-a-time pattern as the Work orders tab.
  const [completeTarget, setCompleteTarget] = useState<ScheduleTableRow | null>(null);
  const [editTarget, setEditTarget] = useState<ScheduleTableRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScheduleTableRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  return (
    <Card padded={false}>
      <div className="p-card pb-0">
        <SectionHeader
          title="Schedules"
          subtitle={`${total} total`}
          action={
            canFull ? (
              <Button variant="secondary" iconLeft={<Plus size={16} strokeWidth={1.75} />} onClick={() => setCreateOpen(true)}>
                New schedule
              </Button>
            ) : undefined
          }
        />
      </div>
      <div className="p-card">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState onRetry={onRetry} />
        ) : total === 0 ? (
          <EmptyState title="No maintenance schedules" description="Create a schedule to track preventive service by mileage or date." />
        ) : (
          <>
          <DataTable
            caption="Maintenance schedules"
            data={rows}
            getRowId={(r) => r.id}
            rowActions={
              canFull
                ? (row: ScheduleTableRow) => (
                    <>
                      <DropdownMenu.Item
                        onSelect={() => setCompleteTarget(row)}
                        className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle"
                      >
                        Complete
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onSelect={() => setEditTarget(row)}
                        className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle"
                      >
                        Edit
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onSelect={() => setDeleteTarget(row)}
                        className="cursor-pointer rounded-md px-2 py-1.5 text-body text-danger outline-none hover:bg-danger-soft"
                      >
                        Delete
                      </DropdownMenu.Item>
                    </>
                  )
                : undefined
            }
            columns={
              [
                { id: 'unit', header: 'UNIT', cell: ({ row }) => <span className="text-text">{row.original.vehicle?.unitNumber ?? '—'}</span> },
                { id: 'name', header: 'NAME', cell: ({ row }) => <span className="text-text">{row.original.name}</span> },
                {
                  id: 'interval',
                  header: 'INTERVAL',
                  cell: ({ row }) => (
<span className="tabular-nums text-text">{scheduleIntervalLabel(row.original)}</span>
                  ),
                },
                {
                  id: 'lastService',
                  header: 'LAST SERVICE',
                  cell: ({ row }) => <span className="tabular-nums text-text-muted">{formatDateOnly(row.original.lastServiceAt, carrierTz)}</span>,
                },
                {
                  id: 'nextDue',
                  header: 'NEXT DUE',
                  cell: ({ row }) => (
<span className="tabular-nums text-text">{scheduleNextDueLabel(row.original, carrierTz)}</span>
                  ),
                },
                {
                  id: 'status',
                  header: 'STATUS',
                  cell: ({ row }) => (
                    <Badge tone={row.original.due.state === 'OVERDUE' ? 'danger' : row.original.due.state === 'DUE_SOON' ? 'warning' : 'success'}>
                      {row.original.due.state === 'OVERDUE' ? 'Overdue' : row.original.due.state === 'DUE_SOON' ? 'Due soon' : 'OK'}
                    </Badge>
                  ),
                },
              ] as ColumnDef<ScheduleTableRow, unknown>[]
            }
          />
          <Pagination page={currentPage} limit={limit} total={total} totalPages={totalPages} itemLabel="schedules" onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
          </>
        )}
      </div>
      {completeTarget && <ScheduleCompleteModal schedule={completeTarget} onClose={() => setCompleteTarget(null)} />}
      {editTarget && <EditScheduleModal schedule={editTarget} onClose={() => setEditTarget(null)} />}
      {createOpen && <EditScheduleModal onClose={() => setCreateOpen(false)} />}
      {deleteTarget && <ScheduleDeleteModal schedule={deleteTarget} onClose={() => setDeleteTarget(null)} />}
    </Card>
  );
}

/** WB-074 — Schedules `…` `Complete`. `POST /maintenance-schedules/:id/complete` — recalculates
 * `nextDueMi`/`nextDueAt` from the optional odometer/date given here (server default: now). */
function ScheduleCompleteModal({ schedule, onClose }: { schedule: ScheduleTableRow; onClose: () => void }) {
  const { toast } = useToast();
  const mutation = useCompleteSchedule(schedule.id);
  const [odometer, setOdometer] = useState('');
  const carrierTz = useCarrierTimezone();
  // CODE-038 — the carrier's "today" (a UTC `slice(0, 10)` was tomorrow on a US evening).
  const [initialServiceDate] = useState(() => todayInTz(carrierTz));
  const [serviceDate, setServiceDate] = useState(initialServiceDate);
  const [serverError, setServerError] = useState<string | null>(null);
  // Stage 3 — typed odometer/date used to be lost silently on Cancel/×/Esc: the Modal had no
  // `isDirty` and Cancel called `onClose` straight past the 11.30 discard confirm.
  const isDirty = odometer !== '' || serviceDate !== initialServiceDate;
  // `CompleteMaintenanceDto.serviceOdometerMi` is a whole number ≥ 0 — a negative or decimal
  // reading used to go out and come back as an unexplained 422.
  const [serverOdometerError, setServerOdometerError] = useState<string | null>(null);
  const odometerError = getOdometerError(odometer) ?? serverOdometerError;
  const inputClass = 'h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text';
  return (
    <Modal
      open
      onClose={onClose}
      isDirty={isDirty}
      title={`Complete ${schedule.name}?`}
      subtitle={`Unit ${schedule.vehicle?.unitNumber ?? '—'}`}
      size="sm"
      footer={
        <>
          <ModalCancelButton disabled={mutation.isPending} />
          <Button
            variant="primary"
            size="lg"
            loading={mutation.isPending}
            disabled={Boolean(getOdometerError(odometer))}
            onClick={() =>
              mutation.mutate(
                {
                  serviceOdometerMi: odometer ? Number(odometer) : undefined,
                  serviceAt: dateOnlyToInstant(serviceDate, carrierTz),
                },
                {
                  onSuccess: () => {
                    toast({ kind: 'success', ...TOAST_COPY.scheduleCompleted(schedule.name) });
                    onClose();
                  },
                  onError: (error) => {
                    const odometerIssue = error instanceof ApiError ? error.fieldErrors.serviceOdometerMi : undefined;
                    setServerOdometerError(odometerIssue ?? null);
                    setServerError(
                      formErrorMessage(error, odometerIssue ? ['serviceOdometerMi'] : [], {
                        serviceAt: 'Service date',
                        serviceOdometerMi: 'Odometer at service',
                      }),
                    );
                  },
                },
              )
            }
          >
            Mark complete
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-label text-text">Service date</span>
          <input type="date" value={serviceDate} max={todayInTz(carrierTz)} onChange={(e) => setServiceDate(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label text-text">Odometer at service</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={odometer}
              onKeyDown={blockOdometerKeys}
              onChange={(e) => {
                setOdometer(sanitizeOdometer(e.target.value));
                setServerOdometerError(null);
              }}
              aria-invalid={odometerError ? true : undefined}
              aria-describedby={odometerError ? 'complete-schedule-odometer-error' : undefined}
              className={inputClass}
            />
            <span className="text-body text-text-muted">mi</span>
          </div>
          {odometerError && (
            <span id="complete-schedule-odometer-error" role="alert" className="text-caption text-danger">
              {odometerError}
            </span>
          )}
        </label>
        {serverError && (
          <p role="alert" className="text-body text-danger">
            {serverError}
          </p>
        )}
      </div>
    </Modal>
  );
}

/** WB-074 — Schedules `…` `Delete`. `DELETE /maintenance-schedules/:id`. */
function ScheduleDeleteModal({ schedule, onClose }: { schedule: ScheduleTableRow; onClose: () => void }) {
  const { toast } = useToast();
  const mutation = useDeleteSchedule();
  const [serverError, setServerError] = useState<string | null>(null);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Delete ${schedule.name}?`}
      subtitle="This cannot be undone."
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="lg"
            loading={mutation.isPending}
            onClick={() =>
              mutation.mutate(schedule.id, {
                onSuccess: () => {
                  toast({ kind: 'success', ...TOAST_COPY.scheduleDeleted(schedule.name) });
                  onClose();
                },
                onError: (error) => setServerError(formErrorMessage(error)),
              })
            }
          >
            Delete schedule
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-body text-text-secondary">
          Unit {schedule.vehicle?.unitNumber ?? '—'} · {schedule.name} stops tracking due dates. Historical service records
          stay in place for audits.
        </p>
        {serverError && (
          <p role="alert" className="text-body text-danger">
            {serverError}
          </p>
        )}
      </div>
    </Modal>
  );
}
