// owner: web-dvir-safety — W-09 DVIR & Maintenance (web/tz.md §10).
// Design: web/roles and screens/admin panel/DVIRs, open defects, preventive maintenance.jpg
// Route `/dvir` · Perm `dvir` READ · absent for DISPATCHER (router.tsx already blocks it).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Filter, Plus, Search, Download, Wrench, AlertTriangle, ClipboardList, ShieldOff, X } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import { useDynamicSubtitle } from '@/app/layouts/Topbar';
import { Button } from '@/shared/ui/Button';
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
import { ApiError } from '@/shared/api/errors';
import { formatLocal } from '@/shared/format/datetime';
import { useNowTick } from '@/shared/format/useRelativeTime';
import { formatOdometer } from '@/shared/format/numbers';
import { orDash, orNone, orUnassigned } from '@/shared/format/empty';
import {
  useRecentDvirs,
  useOpenDefects,
  useWorkOrdersList,
  useSchedulesList,
  useDueSchedules,
  useCloseWorkOrder,
  useCancelWorkOrder,
  useCompleteSchedule,
  useDeleteSchedule,
  type DvirTableRow,
  type DefectTableRow,
  type WorkOrderTableRow,
  type ScheduleTableRow,
} from '@/shared/api/dvir';
import { useVehiclesLookup } from '@/shared/api/lookups';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { DvirDrawer } from './components/DvirDrawer';
import { DVIR_TOAST_COPY } from './lib/copy';
import { defectsCsv, dvirsCsv, schedulesCsv, workOrdersCsv } from './lib/exportCsv';
import { CreateWorkOrderModal } from './components/CreateWorkOrderModal';
import { EditWorkOrderModal } from './components/EditWorkOrderModal';
import { EditScheduleModal } from './components/EditScheduleModal';
import { ResolveDefectModal } from './components/ResolveDefectModal';
import { DvirFiltersDrawer, DvirFilterChips } from './components/DvirFiltersDrawer';
import {
  parseDvirFilters,
  writeDvirFilters,
  matchesDvirFilters,
  countUnknownSeverityExcluded,
  EMPTY_DVIR_FILTERS,
  countActiveDvirFilters,
} from './lib/filters';

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

function DvirStatusBadge({ row }: { row: DvirTableRow }) {
  if (row.vehicleCondition === 'SATISFACTORY') return <Badge tone="success">No defects</Badge>;
  if (row.repairStatus === 'REPAIRED') return <Badge tone="info">Defects fixed</Badge>;
  return <Badge tone="danger">Not fixed</Badge>;
}

export default function DvirPage() {
  const { can } = usePermission();
  const [params, setParams] = useSearchParams();
  const canMaintenanceRead = can('maintenance', 'READ');
  const canDvirFull = can('dvir', 'FULL');
  const { toast } = useToast();

  const tab = (params.get('tab') as Tab) ?? 'dvirs';
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersRevision, setFiltersRevision] = useState(0);
  const filters = useMemo(() => parseDvirFilters(params), [params]);
  function applyFilters(next: typeof filters) {
    setParams(writeDvirFilters(params, next), { replace: true });
  }

  useDynamicSubtitle('Driver vehicle inspection reports, defects and service schedule');

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

  const oldestOverdueDays = useMemo(() => {
    const days = overdue.rows.map((s) => Math.abs(s.due.daysRemaining ?? 0)).filter((d) => d > 0);
    return days.length ? Math.max(...days) : 0;
  }, [overdue.rows]);
  const nowTick = useNowTick();
  const dvirsToday = useMemo(() => {
    const todayKey = new Date(nowTick).toDateString();
    return dvirs.rows.filter((d) => new Date(d.submittedAt).toDateString() === todayKey);
  }, [dvirs.rows, nowTick]);
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

  // The 48 h + search window, before the severity/type/repair-status filters and the 10-row
  // slice — WB-078 needs this to know how many of the DVIRs a severity filter *could* match are
  // being silently dropped because their defects sit outside the loaded window (B-66).
  const recentDvirsWindow = useMemo(() => {
    const cutoff = nowTick - 48 * 60 * 60 * 1000;
    return dvirs.rows.filter(
      (d) =>
        new Date(d.submittedAt).getTime() >= cutoff &&
        matchesSearch(d.vehicle?.unitNumber, ...d.defects.map((x) => x.category)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dvirs.rows, needle, nowTick]);

  const recentDvirsFiltered = useMemo(
    () =>
      recentDvirsWindow
        .filter((d) => matchesDvirFilters(d, filters))
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()),
    [recentDvirsWindow, filters],
  );
  const recentDvirs = useMemo(() => recentDvirsFiltered.slice(0, 10), [recentDvirsFiltered]);
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

  const upcomingSchedules = useMemo(
    () =>
      overdue.rows
        .filter((s) => s.due.state !== 'OK')
        .sort((a, b) => (a.due.milesRemaining ?? a.due.daysRemaining ?? 0) - (b.due.milesRemaining ?? b.due.daysRemaining ?? 0))
        .slice(0, 6),
    [overdue.rows],
  );

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title text-text">DVIR &amp; Maintenance</h1>
          <p className="text-page-sub text-text-muted">Driver vehicle inspection reports, defects and service schedule</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-input items-center gap-2 rounded-md border border-border bg-bg-surface px-3">
            <Search size={16} strokeWidth={1.75} className="text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              // Stage 3 — one term, debounced once, feeds every tab; Esc and × clear it everywhere.
              onKeyDown={(e) => {
                if (e.key === 'Escape' && search) setSearch('');
              }}
              aria-label="Search unit, defect"
              placeholder="Search unit, defect…"
              className="w-56 bg-transparent text-body outline-none"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch('')}
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
            iconLeft={<Download size={16} strokeWidth={1.75} />}
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
        <div className="grid grid-cols-4 gap-card-gap">
          <KpiCard
            label="Open defects"
            value={defects.total}
            chip={defects.criticalCount > 0 ? { text: `${defects.criticalCount} critical`, tone: 'danger' } : undefined}
            icon={AlertTriangle}
            iconTone="danger"
          />
          <KpiCard
            label="Overdue services"
            value={overdue.rows.filter((s) => s.due.state === 'OVERDUE').length}
            chip={oldestOverdueDays > 0 ? { text: `oldest ${oldestOverdueDays} d`, tone: 'warning' } : undefined}
            icon={Wrench}
            iconTone="warning"
          />
          <KpiCard
            label="DVIRs today"
            value={dvirsTodayLabel}
            chip={dvirsToday.length > 0 ? { text: `${noDefectToday} no-defect`, tone: 'success' } : undefined}
            icon={ClipboardList}
            iconTone="success"
          />
          <KpiCard
            label="Vehicles out of service"
            value={outOfServiceVehicles.length}
            chip={
              outOfServiceVehicles.length > 0
                ? { text: `Unit ${outOfServiceVehicles[0]?.unitNumber ?? ''}`, tone: 'danger' }
                : undefined
            }
            icon={ShieldOff}
            iconTone="danger"
          />
        </div>
      )}

      <div className="flex h-9 w-fit overflow-hidden rounded-md border border-border">
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
                ? 'bg-bg-inverse px-3 text-body-strong text-text-inverse'
                : 'bg-bg-surface px-3 text-body text-text-secondary hover:bg-bg-subtle'
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
        <div className="grid grid-cols-[1fr_348px] gap-card-gap">
          <Card padded={false}>
            <div className="p-card pb-0">
              <SectionHeader title="Recent DVIRs" subtitle="Last 48 hours" />
              {unknownSeverityExcluded > 0 && (
                <p className="mt-1 text-caption text-text-muted">
                  {unknownSeverityExcluded} DVIR{unknownSeverityExcluded === 1 ? '' : 's'} with unknown defect severity
                  (outside the loaded window) {unknownSeverityExcluded === 1 ? 'is' : 'are'} excluded from this filter.
                </p>
              )}
            </div>
            <div className="p-card">
              {dvirs.isLoading ? (
                <LoadingState />
              ) : dvirs.isError ? (
                <ErrorState onRetry={() => dvirs.refetch()} />
              ) : recentDvirs.length === 0 ? (
                search || countActiveDvirFilters(filters) > 0 ? (
                  <EmptyState
                    {...searchEmptyState(search || 'these filters')}
                    actions={[
                      {
                        label: search ? 'Clear search' : 'Clear filters',
                        onClick: () => (search ? setSearch('') : applyFilters(EMPTY_DVIR_FILTERS)),
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
                        header: 'DATE & TIME',
                        cell: ({ row }) => (
                          <span className="tabular-nums text-text">{formatLocal(row.original.submittedAt, 'dateTime')}</span>
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
          </Card>

          <Card padded={false}>
            <div className="p-card pb-0">
              <SectionHeader title="Upcoming maintenance" subtitle="Next 30 days" />
            </div>
            <div className="flex flex-col gap-3 p-card">
              {overdue.isLoading ? (
                <LoadingState rows={3} />
              ) : upcomingSchedules.length === 0 ? (
                <p className="text-body text-text-muted">No services due in the next 30 days.</p>
              ) : (
                upcomingSchedules.map((s) => {
                  const ratio =
                    s.intervalMi && s.due.milesRemaining != null
                      ? Math.max(0, s.due.milesRemaining) / s.intervalMi
                      : s.intervalDays && s.due.daysRemaining != null
                        ? Math.max(0, s.due.daysRemaining) / s.intervalDays
                        : 0;
                  const tone = s.due.state === 'OVERDUE' ? 'danger' : s.due.state === 'DUE_SOON' ? 'warning' : 'success';
                  const dueLabel =
                    s.due.milesRemaining != null
                      ? `Due in ${formatOdometer(Math.abs(s.due.milesRemaining))} mi`
                      : s.due.daysRemaining != null
                        ? `Due in ${Math.abs(s.due.daysRemaining)} d`
                        : 'Due';
                  return (
                    <div key={s.id} className="flex flex-col gap-1.5 rounded-md border border-border p-3">
                      <span className="text-body-strong text-text">
                        🔧 Unit {s.vehicle?.unitNumber ?? '—'} · {s.name}
                      </span>
                      <span className="tabular-nums text-caption text-text-muted">
                        {dueLabel} · {orDash(s.nextDueAt ?? s.nextDueMi, () => (s.nextDueAt ? formatLocal(s.nextDueAt, 'monthDay') : `${s.nextDueMi} mi`))}
                      </span>
                      <ProgressBar ratio={ratio} tone={tone} thick label={`Unit ${s.vehicle?.unitNumber ?? '—'} ${s.name} — ${dueLabel}`} />
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <Card padded={false} className="col-span-2">
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
            cell: ({ row }) => <span className="tabular-nums text-text-muted">{formatLocal(row.original.createdAt, 'dateTime')}</span>,
          },
          { id: 'component', header: 'COMPONENT', cell: ({ row }) => <span className="text-text">{row.original.category}</span> },
          {
            id: 'severity',
            header: 'SEVERITY',
            cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
          },
          { id: 'description', header: 'DESCRIPTION', cell: ({ row }) => <span className="text-text-secondary">{row.original.description}</span> },
          {
            id: 'assignedTo',
            header: 'ASSIGNED TO',
            // ⛔ GAP B-36 — `Defect` has no assignee/shop field; fall back to the linked work
            // order's vendor if one exists, else `Unassigned` (web/backend-gaps.md).
            cell: () => <span className="text-text-muted">{orUnassigned(null)}</span>,
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
                { id: 'priority', header: 'PRIORITY', cell: ({ row }) => <Badge tone={row.original.priority === 'URGENT' || row.original.priority === 'HIGH' ? 'danger' : 'neutral'}>{row.original.priority}</Badge> },
                {
                  id: 'status',
                  header: 'STATUS',
                  cell: ({ row }) => (
                    <Badge tone={row.original.status === 'DONE' ? 'success' : row.original.status === 'CANCELLED' ? 'neutral' : row.original.status === 'IN_PROGRESS' ? 'info' : 'warning'}>
                      {row.original.status}
                    </Badge>
                  ),
                },
                { id: 'vendor', header: 'VENDOR', cell: ({ row }) => <span className="text-text">{orDash(row.original.vendor, (v) => v)}</span> },
                {
                  id: 'cost',
                  header: 'COST',
                  meta: { numeric: true },
                  cell: ({ row }) => <span className="tabular-nums text-text">{orDash(toNum(row.original.costUsd), (v) => `$${v.toFixed(2)}`)}</span>,
                },
                {
                  id: 'due',
                  header: 'DUE',
                  cell: ({ row }) => <span className="tabular-nums text-text-muted">{row.original.dueAt ? formatLocal(row.original.dueAt, 'shortDate') : '—'}</span>,
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
                onError: (error) => setServerError(error instanceof ApiError ? error.userMessage : 'Something went wrong.'),
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
        {serverError && <p className="text-body text-danger">{serverError}</p>}
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
                onError: (error) => setServerError(error instanceof ApiError ? error.userMessage : 'Something went wrong.'),
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
        {serverError && <p className="text-body text-danger">{serverError}</p>}
      </div>
    </Modal>
  );
}

/** Mounted only while its tab is active — one `GET /maintenance-schedules` page per render. */
function SchedulesTab({ search, onRows }: { search: string; onRows: (rows: ScheduleTableRow[]) => void }) {
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
  return (
    <Card padded={false}>
      <div className="p-card pb-0">
        <SectionHeader title="Schedules" subtitle={`${total} total`} />
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
                    <span className="tabular-nums text-text">
                      {row.original.intervalMi
                        ? `Every ${formatOdometer(row.original.intervalMi)} mi`
                        : row.original.intervalDays
                          ? `Every ${row.original.intervalDays} days`
                          : '—'}
                    </span>
                  ),
                },
                {
                  id: 'lastService',
                  header: 'LAST SERVICE',
                  cell: ({ row }) => <span className="tabular-nums text-text-muted">{row.original.lastServiceAt ? formatLocal(row.original.lastServiceAt, 'shortDate') : '—'}</span>,
                },
                {
                  id: 'nextDue',
                  header: 'NEXT DUE',
                  cell: ({ row }) => (
                    <span className="tabular-nums text-text">
                      {row.original.nextDueAt ? formatLocal(row.original.nextDueAt, 'shortDate') : row.original.nextDueMi ? `${formatOdometer(row.original.nextDueMi)} mi` : '—'}
                    </span>
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
  const [initialServiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [serviceDate, setServiceDate] = useState(initialServiceDate);
  const [serverError, setServerError] = useState<string | null>(null);
  // Stage 3 — typed odometer/date used to be lost silently on Cancel/×/Esc: the Modal had no
  // `isDirty` and Cancel called `onClose` straight past the 11.30 discard confirm.
  const isDirty = odometer !== '' || serviceDate !== initialServiceDate;
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
            onClick={() =>
              mutation.mutate(
                {
                  serviceOdometerMi: odometer ? Number(odometer) : undefined,
                  serviceAt: serviceDate ? new Date(serviceDate).toISOString() : undefined,
                },
                {
                  onSuccess: () => {
                    toast({ kind: 'success', ...TOAST_COPY.scheduleCompleted(schedule.name) });
                    onClose();
                  },
                  onError: (error) => setServerError(error instanceof ApiError ? error.userMessage : 'Something went wrong.'),
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
          <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label text-text">Odometer at service</span>
          <div className="flex items-center gap-2">
            <input type="number" value={odometer} onChange={(e) => setOdometer(e.target.value)} className={inputClass} />
            <span className="text-body text-text-muted">mi</span>
          </div>
        </label>
        {serverError && <p className="text-body text-danger">{serverError}</p>}
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
                onError: (error) => setServerError(error instanceof ApiError ? error.userMessage : 'Something went wrong.'),
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
        {serverError && <p className="text-body text-danger">{serverError}</p>}
      </div>
    </Modal>
  );
}
