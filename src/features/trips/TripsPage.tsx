// owner: web-dispatch-messaging — W-11 Dispatch & Trips (web/tz.md §10 W-11) + 11.10 Create trip.
// Design: web/roles and screens/admin panel/Active trips, route timeline, unassigned loads.jpg
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Search, Plus, Filter, Users, MapPin } from 'lucide-react';
import { usePermission } from '@/shared/auth/usePermission';
import { Can } from '@/shared/auth/Can';
import { useDynamicSubtitle } from '@/app/layouts/Topbar';
import { useRoom } from '@/shared/realtime/useRoom';
import { useQueryClient } from '@tanstack/react-query';
import {
  useTripsList,
  useUnassignedLoads,
  useAutoAssignTrips,
  type TripTableRow,
  type TripRow,
} from '@/shared/api/trips';
import { qk } from '@/shared/api/queryKeys';
import type { OffsetPage } from '@/shared/api/types';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { KpiCard, KpiRowSkeleton } from '@/shared/ui/KpiCard';
import { DataTable } from '@/shared/ui/DataTable';
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

const ACTIVE_STATUSES: TripRow['status'][] = ['ASSIGNED', 'IN_PROGRESS'];

export default function TripsPage() {
  const { can } = usePermission();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canFull = can('trips', 'FULL');
  useDynamicSubtitle(null);

  const [segment, setSegment] = useState<Segment>('ACTIVE');
  const [search, setSearch] = useState('');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignLoad, setAssignLoad] = useState<TripRow | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersRevision, setFiltersRevision] = useState(0);
  const [params, setParams] = useSearchParams();

  const trips = useTripsList();
  const unassigned = useUnassignedLoads();
  const autoAssign = useAutoAssignTrips();

  const filters = useMemo(() => parseTripFilters(params), [params]);
  function applyFilters(next: typeof filters) {
    setParams(writeTripFilters(params, next), { replace: true });
  }

  const driverOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const t of trips.rows) if (t.driver) byId.set(t.driver.id, `${t.driver.firstName} ${t.driver.lastName}`);
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [trips.rows]);
  const vehicleOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const t of trips.rows) if (t.vehicle) byId.set(t.vehicle.id, t.vehicle.unitNumber);
    return Array.from(byId, ([id, unitNumber]) => ({ id, unitNumber })).sort((a, b) => a.unitNumber.localeCompare(b.unitNumber));
  }, [trips.rows]);
  const terminalOptions = useMemo(
    () => Array.from(new Set(trips.rows.map((t) => t.driver?.homeTerminalName).filter((v): v is string => Boolean(v)))).sort(),
    [trips.rows],
  );
  const driverNameById = useMemo(() => new Map(driverOptions.map((d) => [d.id, d.name])), [driverOptions]);
  const vehicleUnitById = useMemo(() => new Map(vehicleOptions.map((v) => [v.id, v.unitNumber])), [vehicleOptions]);

  useRoom('fleet', {
    'trip.status_changed': (payload) => {
      queryClient.setQueryData<OffsetPage<TripRow> | undefined>(qk.trips({ limit: 500 }), (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((t) => (t.id === payload.tripId ? { ...t, status: payload.status as TripRow['status'], etaAt: payload.eta } : t)),
        };
      });
      // §10 W-11 "invalidates the KPI cards" — here the KPIs are a `useMemo` over this exact
      // query's `rows`, so the `setQueryData` patch above already recomputes them on the next
      // render; there is no separate KPI query to invalidate, and no reason to refetch the list.
    },
  });

  const counts = useMemo(() => {
    const active = trips.rows.filter((t) => ACTIVE_STATUSES.includes(t.status));
    const scheduled = trips.rows.filter((t) => t.status === 'PLANNED');
    const completed = trips.rows.filter((t) => t.status === 'DELIVERED');
    const delivered = completed.length;
    const onTimeDelivered = completed.filter((t) => t.onTime !== false).length;
    const late = active.filter((t) => t.displayStatus === 'Late');
    return {
      active,
      scheduled,
      completed,
      onTimePct: delivered > 0 ? Math.round((onTimeDelivered / delivered) * 100) : 0,
      lateCount: late.length,
      unassignedCount: unassigned.data?.items.length ?? 0,
    };
  }, [trips.rows, unassigned.data]);

  const segmentRows = useMemo(() => {
    switch (segment) {
      case 'ACTIVE':
        return counts.active;
      case 'SCHEDULED':
        return counts.scheduled;
      case 'COMPLETED':
        return counts.completed;
      case 'UNASSIGNED':
        return [];
    }
  }, [segment, counts]);

  const filteredRows = useMemo(() => {
    let rows = segmentRows;
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      rows = rows.filter((t) => {
        const driverName = t.driver ? `${t.driver.firstName} ${t.driver.lastName}` : '';
        return (
          t.number.toLowerCase().includes(needle) ||
          driverName.toLowerCase().includes(needle) ||
          (t.pickup?.name ?? '').toLowerCase().includes(needle) ||
          (t.delivery?.name ?? '').toLowerCase().includes(needle)
        );
      });
    }
    rows = rows.filter((t) => matchesTripFilters(t, filters));
    return rows;
  }, [segmentRows, search, filters]);

  const selectedTrip = useMemo(
    () => trips.rows.find((t) => t.id === selectedTripId) ?? filteredRows[0] ?? null,
    [trips.rows, selectedTripId, filteredRows],
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

  const isLoading = trips.isLoading || unassigned.isLoading;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title text-text">Dispatch &amp; Trips</h1>
          <p className="text-page-sub text-text-muted">
            {counts.active.length} active trips · {counts.unassignedCount} unassigned loads · on-time {counts.onTimePct}%
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-input items-center gap-2 rounded-md border border-border bg-bg-surface px-3">
            <Search size={16} strokeWidth={1.75} className="text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
            Filters{countActiveTripFilters(filters) > 0 ? ` · ${countActiveTripFilters(filters)}` : ''}
          </Button>
          <Can perm="trips" level="FULL">
            <Button variant="primary" iconLeft={<Plus size={16} strokeWidth={1.75} />} onClick={() => setCreateOpen(true)}>
              Create trip
            </Button>
          </Can>
        </div>
      </div>

      {isLoading ? (
        <KpiRowSkeleton />
      ) : (
        <div className="grid grid-cols-4 gap-card-gap">
          <KpiCard label="On-time delivery" value={`${counts.onTimePct}%`} icon={MapPin} iconTone="success" chip={{ text: '↑ 3% vs last wk', tone: 'success' }} />
          <KpiCard label="Active trips" value={counts.active.length} icon={MapPin} iconTone="info" chip={{ text: '6 arriving today', tone: 'info' }} />
          <KpiCard label="Running late" value={counts.lateCount} icon={MapPin} iconTone="warning" hint="avg 48 min" />
          <KpiCard label="Unassigned loads" value={counts.unassignedCount} icon={Users} iconTone="warning" hint="needs driver" />
        </div>
      )}

      <div className="flex h-9 w-fit overflow-hidden rounded-md border border-border">
        {(
          [
            ['ACTIVE', `Active ${counts.active.length}`],
            ['SCHEDULED', `Scheduled ${counts.scheduled.length}`],
            ['COMPLETED', `Completed ${counts.completed.length}`],
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

      {segment !== 'UNASSIGNED' && (
        <TripFilterChips
          filters={filters}
          driverById={driverNameById}
          vehicleById={vehicleUnitById}
          onRemove={(patch) => applyFilters({ ...filters, ...patch })}
          onClearAll={() => applyFilters(EMPTY_TRIP_FILTERS)}
        />
      )}

      {segment === 'UNASSIGNED' ? (
        <Card padded={false}>
          <div className="flex items-center justify-between p-card pb-0">
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
            <DataTable data={unassigned.data?.items ?? []} columns={unassignedColumns} caption="Unassigned loads" getRowId={(r) => r.id} />
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-[1fr_348px] gap-card-gap">
          <Card padded={false}>
            <div className="flex items-center justify-between p-card pb-0">
              <SectionHeader title="Active trips" subtitle={`${segmentRows.length} trips in progress`} />
            </div>
            {trips.isLoading ? (
              <LoadingState className="p-4" />
            ) : trips.isError ? (
              <ErrorState onRetry={() => trips.refetch()} />
            ) : filteredRows.length === 0 ? (
              search || countActiveTripFilters(filters) > 0 ? (
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
              <DataTable
                data={filteredRows}
                columns={columns}
                caption="Active trips"
                getRowId={(r) => r.id}
                onRowClick={(row) => setSelectedTripId(row.id)}
              />
            )}
          </Card>

          <Card>
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
