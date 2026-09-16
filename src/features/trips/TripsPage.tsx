// owner: web-dispatch-messaging — W-11 Dispatch & Trips (web/tz.md §10 W-11) + 11.10 Create trip.
// Design: web/roles and screens/admin panel/Active trips, route timeline, unassigned loads.jpg
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Search, Plus, Filter, Users, MapPin } from 'lucide-react';
import { usePermission } from '@/shared/auth/usePermission';
import { Can } from '@/shared/auth/Can';
import { useDynamicSubtitle } from '@/app/layouts/Topbar';
import { useRoom } from '@/shared/realtime/useRoom';
import { useQueryClient } from '@tanstack/react-query';
import {
  useTripsBoard,
  useUnassignedLoads,
  useAutoAssignTrips,
  type TripTableRow,
  type TripRow,
} from '@/shared/api/trips';
import { qkRoot } from '@/shared/api/queryKeys';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import type { OffsetPage } from '@/shared/api/types';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { KpiCard, KpiRowSkeleton } from '@/shared/ui/KpiCard';
import { DataTable } from '@/shared/ui/DataTable';
import { Pagination } from '@/shared/ui/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';
import { EMPTY_STATE_COPY, searchEmptyState } from '@/shared/ui/copy';
import { useToast } from '@/shared/ui/Toast';
import { formatLocal } from '@/shared/format/datetime';
import { formatWeight } from '@/shared/format/numbers';
import { orDash } from '@/shared/format/empty';
import { CreateTripModal } from './components/CreateTripModal';
import { AssignLoadModal } from './components/AssignLoadModal';
import { TripFiltersDrawer, TripFilterChips } from './components/TripFiltersDrawer';
import { PeriodDropdown } from './components/PeriodDropdown';
import { parseTripFilters, writeTripFilters, matchesTripFilters, EMPTY_TRIP_FILTERS, countActiveTripFilters } from './lib/filters';

type Segment = 'ACTIVE' | 'SCHEDULED' | 'COMPLETED' | 'UNASSIGNED';

export default function TripsPage() {
  const { can } = usePermission();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canFull = can('trips', 'FULL');
  useDynamicSubtitle(null);

  const [segment, setSegmentState] = useState<Segment>('ACTIVE');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignLoad, setAssignLoad] = useState<TripRow | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersRevision, setFiltersRevision] = useState(0);
  const [params, setParams] = useSearchParams();

  const filters = useMemo(() => parseTripFilters(params), [params]);
  const activeFilterCount = countActiveTripFilters(filters);
  function applyFilters(next: typeof filters) {
    setPage(1);
    setParams(writeTripFilters(params, next), { replace: true });
  }
  function setSegment(next: Segment) {
    setPage(1);
    setSegmentState(next);
  }

  // WD-073 — Active is two bounded server slices (exact in-memory search/filter); Scheduled and
  // Completed are one server page each (`q`/`status` real params); the 11.23 groups the API has
  // no params for (B-59) switch a history segment to the bounded newest-first window.
  const filterRows = useCallback((rows: TripTableRow[]) => rows.filter((t) => matchesTripFilters(t, filters)), [filters]);
  const trips = useTripsBoard({
    segment,
    page,
    limit,
    search: debouncedSearch,
    useWindow: activeFilterCount > 0,
    filter: filterRows,
  });
  const unassigned = useUnassignedLoads();
  const autoAssign = useAutoAssignTrips();

  const driverOptions = useMemo(
    () =>
      (trips.driversLookup.data?.items ?? [])
        .map((d) => ({ id: d.id, name: `${d.firstName} ${d.lastName}` }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [trips.driversLookup.data],
  );
  const vehicleOptions = useMemo(
    () =>
      (trips.vehiclesLookup.data?.items ?? [])
        .map((v) => ({ id: v.id, unitNumber: v.unitNumber }))
        .sort((a, b) => a.unitNumber.localeCompare(b.unitNumber)),
    [trips.vehiclesLookup.data],
  );
  const terminalOptions = useMemo(
    () => Array.from(new Set((trips.driversLookup.data?.items ?? []).map((d) => d.homeTerminalName).filter(Boolean))).sort(),
    [trips.driversLookup.data],
  );
  const driverNameById = useMemo(() => new Map(driverOptions.map((d) => [d.id, d.name])), [driverOptions]);
  const vehicleUnitById = useMemo(() => new Map(vehicleOptions.map((v) => [v.id, v.unitNumber])), [vehicleOptions]);

  useRoom('fleet', {
    'trip.status_changed': (payload) => {
      // Patch every cached `/trips` page that holds the row (§16.3 — never invalidate the list).
      queryClient.setQueriesData<OffsetPage<TripRow> | { items: TripRow[] } | TripRow | undefined>({ queryKey: qkRoot.trips }, (prev) => {
        if (!prev || !('items' in prev) || !Array.isArray(prev.items)) return prev;
        return {
          ...prev,
          items: prev.items.map((t) => (t.id === payload.tripId ? { ...t, status: payload.status as TripRow['status'], etaAt: payload.eta } : t)),
        };
      });
      // §10 W-11 "invalidates the KPI cards" — the KPIs derive from these same cached pages, so
      // the patch above recomputes them on the next render; nothing to refetch.
    },
  });

  const counts = {
    active: trips.counts.active,
    scheduled: trips.counts.scheduled,
    completed: trips.counts.completed,
    onTimePct: trips.kpis.onTimePct,
    lateCount: trips.kpis.lateCount,
    unassignedCount: unassigned.data?.items.length ?? 0,
  };

  const filteredRows = trips.rows;

  const selectedTrip = useMemo(
    () => trips.activeRows.find((t) => t.id === selectedTripId) ?? filteredRows.find((t) => t.id === selectedTripId) ?? filteredRows[0] ?? null,
    [trips.activeRows, selectedTripId, filteredRows],
  );

  async function handleAutoAssign() {
    autoAssign.mutate(undefined, {
      onSuccess: (result) => {
        toast({
          kind: 'success',
          title: `${result.assigned.length} loads assigned · ${result.skipped} skipped (no driver with enough hours)`,
        });
      },
      onError: () => toast({ kind: 'error', title: 'Something went wrong.' }),
    });
  }

  const columns: ColumnDef<TripTableRow, unknown>[] = [
    {
      accessorKey: 'number',
      header: 'TRIP',
      cell: ({ row }) => <span className="font-semibold text-primary">{row.original.number}</span>,
    },
    {
      id: 'driverUnit',
      header: 'DRIVER / UNIT',
      cell: ({ row }) => {
        const driver = row.original.driver;
        const name = driver ? `${driver.firstName} ${driver.lastName}` : null;
        return (
          <span className="flex flex-col">
            <span className="text-text">{orDash(name, (v) => v)}</span>
            <span className="text-caption text-text-muted">{row.original.vehicle ? `Unit ${row.original.vehicle.unitNumber}` : '—'}</span>
          </span>
        );
      },
    },
    {
      id: 'route',
      header: 'ROUTE',
      cell: ({ row }) => (
        <span className="flex flex-col">
          <span className="text-text">{row.original.pickup?.name ?? '—'}</span>
          <span className="text-caption text-text-muted">{row.original.delivery ? `→ ${row.original.delivery.name}` : '—'}</span>
        </span>
      ),
    },
    {
      id: 'depart',
      header: 'DEPART',
      cell: ({ row }) => (
        <span className="tabular-nums text-text">
          {row.original.startedAt || row.original.plannedStartAt ? formatLocal(row.original.startedAt ?? row.original.plannedStartAt, 'time') : '—'}
        </span>
      ),
    },
    {
      id: 'eta',
      header: 'ETA',
      cell: ({ row }) => {
        const late = row.original.displayStatus === 'Late';
        return (
          <span className={late ? 'tabular-nums font-semibold text-danger' : 'tabular-nums font-semibold text-text'}>
            {row.original.etaAt ? formatLocal(row.original.etaAt, 'time') : '—'}
          </span>
        );
      },
    },
    {
      id: 'status',
      header: 'STATUS',
      cell: ({ row }) => {
        const status = row.original.displayStatus;
        const tone = status === 'Late' ? 'danger' : status === 'Loading' ? 'warning' : status === 'Cancelled' ? 'neutral' : 'success';
        return <Badge tone={tone}>{status}</Badge>;
      },
    },
  ];

  const unassignedColumns: ColumnDef<TripRow, unknown>[] = [
    { accessorKey: 'number', header: 'LOAD', cell: ({ row }) => <span className="font-semibold text-text">{row.original.number}</span> },
    {
      id: 'pickup',
      header: 'PICKUP',
      cell: ({ row }) => <span className="text-text">{row.original.stops.find((s) => s.type === 'PICKUP')?.name ?? '—'}</span>,
    },
    {
      id: 'delivery',
      header: 'DELIVERY',
      cell: ({ row }) => <span className="text-text">{row.original.stops.find((s) => s.type === 'DELIVERY')?.name ?? '—'}</span>,
    },
    {
      id: 'window',
      header: 'PICKUP WINDOW',
      cell: ({ row }) =>
        row.original.plannedStartAt ? (
          <span className="tabular-nums text-text-secondary">{formatLocal(row.original.plannedStartAt, 'dateTime')}</span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      id: 'weight',
      header: 'WEIGHT',
      cell: ({ row }) => <span className="tabular-nums text-right text-text">{row.original.weightLbs != null ? `${formatWeight(row.original.weightLbs)}` : '—'}</span>,
    },
    {
      id: 'assign',
      header: '',
      cell: ({ row }) => (
        <Can perm="trips" level="FULL">
          <Button variant="primary" size="sm" onClick={() => setAssignLoad(row.original)}>
            Assign driver
          </Button>
        </Can>
      ),
    },
  ];

  const isLoading = trips.isKpiLoading || unassigned.isLoading;

  return (
    <div className="flex flex-col gap-4 xl:max-h-content-h">
      <div className="flex items-center justify-between xl:shrink-0">
        <div>
          <h1 className="text-page-title text-text">Dispatch &amp; Trips</h1>
          <p className="text-page-sub text-text-muted">
            {counts.active} active trips · {counts.unassignedCount} unassigned loads · on-time {counts.onTimePct}%
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-input items-center gap-2 rounded-md border border-border bg-bg-surface px-3">
            <Search size={16} strokeWidth={1.75} className="text-text-muted" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search trip, driver, city…"
              className="w-56 bg-transparent text-body outline-none"
            />
          </div>
          <PeriodDropdown filters={filters} onApply={(patch) => applyFilters({ ...filters, ...patch })} />
          <Button
            variant="secondary"
            iconLeft={<Filter size={16} strokeWidth={1.75} />}
            onClick={() => {
              setFiltersRevision((r) => r + 1);
              setFiltersOpen(true);
            }}
          >
            Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
          </Button>
          <Can perm="trips" level="FULL">
            <Button variant="primary" iconLeft={<Plus size={16} strokeWidth={1.75} />} onClick={() => setCreateOpen(true)}>
              Create trip
            </Button>
          </Can>
        </div>
      </div>

      <div className="xl:shrink-0">
        {isLoading ? (
          <KpiRowSkeleton />
        ) : (
          <div className="grid grid-cols-4 gap-card-gap">
            <KpiCard label="On-time delivery" value={`${counts.onTimePct}%`} icon={MapPin} iconTone="success" hint={`last ${trips.kpis.onTimeWindow} deliveries`} />
            <KpiCard label="Active trips" value={counts.active} icon={MapPin} iconTone="info" chip={{ text: '6 arriving today', tone: 'info' }} />
            <KpiCard label="Running late" value={counts.lateCount} icon={MapPin} iconTone="warning" hint="avg 48 min" />
            <KpiCard label="Unassigned loads" value={counts.unassignedCount} icon={Users} iconTone="warning" hint="needs driver" />
          </div>
        )}
      </div>

      <div className="flex h-9 w-fit overflow-hidden rounded-md border border-border xl:shrink-0">
        {(
          [
            ['ACTIVE', `Active ${counts.active}`],
            ['SCHEDULED', `Scheduled ${counts.scheduled}`],
            ['COMPLETED', `Completed ${counts.completed}`],
            ['UNASSIGNED', `Unassigned ${counts.unassignedCount}`],
          ] as [Segment, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={segment === value}
            onClick={() => setSegment(value)}
            className={
              segment === value
                ? 'bg-bg-inverse px-3 text-body-strong text-text-inverse'
                : 'bg-bg-surface px-3 text-body text-text-secondary hover:bg-bg-subtle'
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="xl:shrink-0">
        {segment !== 'UNASSIGNED' && (
          <TripFilterChips
            filters={filters}
            driverById={driverNameById}
            vehicleById={vehicleUnitById}
            onRemove={(patch) => applyFilters({ ...filters, ...patch })}
            onClearAll={() => applyFilters(EMPTY_TRIP_FILTERS)}
          />
        )}
      </div>

      {segment === 'UNASSIGNED' ? (
        <Card padded={false} className="xl:flex xl:min-h-0 xl:flex-col">
          <div className="flex items-center justify-between p-card pb-0 xl:shrink-0">
            <SectionHeader title="Unassigned loads" subtitle={`${counts.unassignedCount} loads waiting for a driver`} />
            <Can perm="trips" level="FULL">
              <Button variant="secondary" iconLeft={<Users size={16} strokeWidth={1.75} />} onClick={handleAutoAssign} loading={autoAssign.isPending} className="mb-4">
                Auto-assign
              </Button>
            </Can>
          </div>
          {unassigned.isLoading ? (
            <LoadingState className="p-4" />
          ) : unassigned.isError ? (
            <ErrorState onRetry={() => unassigned.refetch()} />
          ) : (unassigned.data?.items.length ?? 0) === 0 ? (
            <EmptyState {...EMPTY_STATE_COPY.unassignedLoads} />
          ) : (
            <div className="xl:min-h-0 xl:overflow-y-auto">
              <DataTable data={unassigned.data?.items ?? []} columns={unassignedColumns} caption="Unassigned loads" getRowId={(r) => r.id} />
            </div>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-[1fr_348px] gap-card-gap xl:min-h-0 xl:grid-rows-[minmax(0,1fr)]">
          <Card padded={false} className="xl:flex xl:min-h-0 xl:flex-col">
            {trips.isLoading ? (
              <LoadingState className="p-4" />
            ) : trips.isError ? (
              <ErrorState onRetry={() => trips.refetch()} />
            ) : filteredRows.length === 0 ? (
              search || activeFilterCount > 0 ? (
                <EmptyState
                  {...searchEmptyState(search || 'these filters')}
                  actions={[
                    {
                      label: search ? 'Clear search' : 'Clear filters',
                      onClick: () => (search ? setSearch('') : applyFilters(EMPTY_TRIP_FILTERS)),
                    },
                  ]}
                />
              ) : (
                <EmptyState {...EMPTY_STATE_COPY.trips} actions={canFull ? [{ label: 'Create trip', onClick: () => setCreateOpen(true) }] : undefined} />
              )
            ) : (
              <>
                {/* Desktop only (xl:): the trips list scrolls inside the card so the page
                    itself never grows past the viewport — same pattern as Vehicles. */}
                <div className="xl:min-h-0 xl:overflow-y-auto">
                  <DataTable
                    data={filteredRows}
                    columns={columns}
                    caption="Active trips"
                    getRowId={(r) => r.id}
                    onRowClick={(row) => setSelectedTripId(row.id)}
                  />
                </div>
                <Pagination
                  page={Math.min(page, trips.totalPages)}
                  limit={limit}
                  total={trips.total}
                  totalPages={trips.totalPages}
                  itemLabel="trips"
                  onPageChange={setPage}
                  onLimitChange={(l) => {
                    setLimit(l);
                    setPage(1);
                  }}
                />
              </>
            )}
          </Card>

          <Card className="xl:min-h-0 xl:overflow-y-auto">
            {selectedTrip ? (
              <>
                <SectionHeader title={`Route · ${selectedTrip.number}`} subtitle={`${selectedTrip.pickup?.name ?? '—'} → ${selectedTrip.delivery?.name ?? '—'}`} />
                <div className="mt-3 flex h-32 items-center justify-center rounded-md bg-bg-subtle text-caption text-text-muted">
                  Route preview
                </div>
                <ol className="mt-4 flex flex-col gap-3">
                  {selectedTrip.stops.map((stop) => {
                    const done = stop.status === 'COMPLETED' || stop.status === 'ARRIVED';
                    const label =
                      stop.status === 'COMPLETED'
                        ? stop.departedAt
                          ? `${formatLocal(stop.departedAt, 'time')} · departed`
                          : 'completed'
                        : stop.scheduledAt
                          ? `${formatLocal(stop.scheduledAt, 'time')} · ETA`
                          : 'pending';
                    return (
                      <li key={stop.id} className="flex gap-2">
                        <span className={`mt-1 size-2 shrink-0 rounded-full ${done ? 'bg-success' : 'bg-info'}`} aria-hidden />
                        <span className="flex flex-col">
                          <span className="text-body-strong text-text">
                            {stop.type === 'PICKUP' ? 'Pickup' : stop.type === 'DELIVERY' ? 'Delivery' : stop.type === 'FUEL' ? 'Fuel stop' : stop.type}
                          </span>
                          <span className="text-caption text-text-secondary">{stop.name}</span>
                          <span className={`text-caption ${done ? 'text-success' : 'text-info'}`}>{label}</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </>
            ) : (
              <EmptyState title="No trip selected" description="Select an active trip to see its route timeline." />
            )}
          </Card>
        </div>
      )}

      {createOpen && <CreateTripModal onClose={() => setCreateOpen(false)} />}
      {assignLoad && <AssignLoadModal load={assignLoad} onClose={() => setAssignLoad(null)} />}
      <TripFiltersDrawer
        key={filtersRevision}
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onApply={applyFilters}
        driverOptions={driverOptions}
        vehicleOptions={vehicleOptions}
        terminalOptions={terminalOptions}
      />
    </div>
  );
}
