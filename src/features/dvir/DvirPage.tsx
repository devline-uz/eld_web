// owner: web-dvir-safety — W-09 DVIR & Maintenance (web/tz.md §10).
// Design: web/roles and screens/admin panel/DVIRs, open defects, preventive maintenance.jpg
// Route `/dvir` · Perm `dvir` READ · absent for DISPATCHER (router.tsx already blocks it).
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, Filter, Plus, Search, Wrench, AlertTriangle, ClipboardList, ShieldOff } from 'lucide-react';
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
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';
import { EMPTY_STATE_COPY, searchEmptyState } from '@/shared/ui/copy';
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
  type DvirTableRow,
  type DefectTableRow,
  type WorkOrderTableRow,
  type ScheduleTableRow,
} from '@/shared/api/dvir';
import { useVehiclesLookup } from '@/shared/api/lookups';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { DvirDrawer } from './components/DvirDrawer';
import { CreateWorkOrderModal } from './components/CreateWorkOrderModal';
import { ResolveDefectModal } from './components/ResolveDefectModal';
import { DvirFiltersDrawer, DvirFilterChips } from './components/DvirFiltersDrawer';
import { parseDvirFilters, writeDvirFilters, matchesDvirFilters, EMPTY_DVIR_FILTERS, countActiveDvirFilters } from './lib/filters';

type Tab = 'dvirs' | 'defects' | 'workOrders' | 'schedules';

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

  const [drawerDvirId, setDrawerDvirId] = useState<string | null>(null);
  const [resolveDefect, setResolveDefect] = useState<DefectTableRow | null>(null);
  const [workOrderVehicleId, setWorkOrderVehicleId] = useState<string | null>(null);
  const [createWoOpen, setCreateWoOpen] = useState(false);

  const recentDvirs = useMemo(() => {
    const cutoff = nowTick - 48 * 60 * 60 * 1000;
    return dvirs.rows
      .filter(
        (d) =>
          new Date(d.submittedAt).getTime() >= cutoff &&
          matchesSearch(d.vehicle?.unitNumber, ...d.defects.map((x) => x.category)) &&
          matchesDvirFilters(d, filters),
      )
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
      .slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dvirs.rows, needle, nowTick, filters]);

  const upcomingSchedules = useMemo(
    () =>
      overdue.rows
        .filter((s) => s.due.state !== 'OK')
        .sort((a, b) => (a.due.milesRemaining ?? a.due.daysRemaining ?? 0) - (b.due.milesRemaining ?? b.due.daysRemaining ?? 0))
        .slice(0, 6),
    [overdue.rows],
  );

  async function handleExport() {
    // The export is the open-defects page currently on screen (the API has no defects export).
    const blob = new Blob([JSON.stringify(defects.rows, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'dvir-export.json';
    link.click();
    URL.revokeObjectURL(link.href);
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
              placeholder="Search unit, defect…"
              className="w-56 bg-transparent text-body outline-none"
            />
          </div>
          <Button
            variant="secondary"
            iconLeft={<Filter size={16} strokeWidth={1.75} />}
            onClick={() => {
              setFiltersRevision((r) => r + 1);
              setFiltersOpen(true);
            }}
          >
            Filters{countActiveDvirFilters(filters) > 0 ? ` · ${countActiveDvirFilters(filters)}` : ''}
          </Button>
          <Button variant="secondary" iconLeft={<Download size={16} strokeWidth={1.75} />} onClick={handleExport}>
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
            ['dvirs', `DVIRs ${dvirs.page?.total ?? dvirs.rows.length}`],
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
              page={defectsPage}
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
        {tab === 'workOrders' && <WorkOrdersTab search={debouncedSearch} />}
        {tab === 'schedules' && <SchedulesTab search={debouncedSearch} />}
      </Can>

      {drawerDvirId && (
        <DvirDrawer
          dvirId={drawerDvirId}
          onClose={() => setDrawerDvirId(null)}
          onCreateWorkOrder={(vehicleId) => {
            setDrawerDvirId(null);
            setWorkOrderVehicleId(vehicleId);
          }}
        />
      )}
      {resolveDefect && <ResolveDefectModal defect={resolveDefect} onClose={() => setResolveDefect(null)} />}
      {(createWoOpen || workOrderVehicleId) && (
        <CreateWorkOrderModal
          vehicleId={workOrderVehicleId ?? undefined}
          onClose={() => {
            setCreateWoOpen(false);
            setWorkOrderVehicleId(null);
          }}
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
function WorkOrdersTab({ search }: { search: string }) {
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
                ? () => (
                    <>
                      <DropdownMenu.Item className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
                        Close
                      </DropdownMenu.Item>
                      <DropdownMenu.Item className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
                        Cancel
                      </DropdownMenu.Item>
                      <DropdownMenu.Item className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
                        Edit
                      </DropdownMenu.Item>
                    </>
                  )
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
    </Card>
  );
}

/** Mounted only while its tab is active — one `GET /maintenance-schedules` page per render. */
function SchedulesTab({ search }: { search: string }) {
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
                ? () => (
                    <>
                      <DropdownMenu.Item className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
                        Complete
                      </DropdownMenu.Item>
                      <DropdownMenu.Item className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
                        Edit
                      </DropdownMenu.Item>
                      <DropdownMenu.Item className="cursor-pointer rounded-md px-2 py-1.5 text-body text-danger outline-none hover:bg-danger-soft">
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
    </Card>
  );
}
