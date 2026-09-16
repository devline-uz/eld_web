// owner: web-vehicles-drivers — W-03 Vehicles (web/tz.md §10 W-03).
// Design: web/roles and screens/admin panel/Unit inventory — ELD serial, VIN, odometer.jpg
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Search, Plus, Download, Filter, MoreHorizontal } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import { useIsOffline, OFFLINE_TOOLTIP } from '@/shared/realtime/RealtimeProvider';
import { useDynamicSubtitle } from '@/app/layouts/Topbar';
import { useLiveFleet } from '@/shared/api/liveFleet';
import { useVehiclesList, type VehicleTableRow } from '@/shared/api/vehicles';
import { client } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { Button } from '@/shared/ui/Button';
import { Badge, DutyBadge, type DutyStatus } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { DataTable } from '@/shared/ui/DataTable';
import { Pagination } from '@/shared/ui/Pagination';
import { Card } from '@/shared/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';
import { EMPTY_STATE_COPY, searchEmptyState } from '@/shared/ui/copy';
import { useToast } from '@/shared/ui/Toast';
import { formatOdometer } from '@/shared/format/numbers';
import { orUnassigned, orNotAssigned } from '@/shared/format/empty';
import { AddVehicleModal } from './components/AddVehicleModal';
import { DeleteUnitModal } from './components/DeleteUnitModal';
import { AssignDriverModal } from './components/AssignDriverModal';
import { CalibrateOdometerModal } from './components/CalibrateOdometerModal';
import { ImportVehiclesModal } from './components/ImportVehiclesModal';
import { VehicleFiltersDrawer, VehicleFilterChips } from './components/VehicleFiltersDrawer';
import { parseVehicleFilters, writeVehicleFilters, matchesVehicleFilters, EMPTY_VEHICLE_FILTERS, countActiveVehicleFilters } from './lib/filters';

type Segment = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'UNASSIGNED';

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useMemo(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return debounced;
}

export default function VehiclesPage() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const isOffline = useIsOffline();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const canFull = can('vehicles', 'FULL');

  const segment = (params.get('segment') as Segment) ?? 'ALL';
  const q = params.get('q') ?? '';
  const [searchInput, setSearchInput] = useState(q);
  const debouncedSearch = useDebounced(searchInput, 300);
  const page = Number(params.get('page') ?? '1');
  const limit = Number(params.get('limit') ?? '10');

  useDynamicSubtitle(null);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  // 69 rows total, well within a single client-side page — resolves per-row DRIVER/ELD SERIAL
  // joins and the segment counts without an N+1 fan-out (web/backend-gaps.md contract deviations).
  const allVehicles = useVehiclesList({ limit: 500 });
  const liveFleet = useLiveFleet();

  const dutyByVehicle = useMemo(() => {
    const map = new Map<string, DutyStatus>();
    for (const unit of liveFleet.data?.items ?? []) map.set(unit.vehicleId, unit.dutyStatus);
    return map;
  }, [liveFleet.data]);

  const filters = useMemo(() => parseVehicleFilters(params), [params]);

  const eldDeviceOptions = useMemo(
    () => Array.from(new Set(allVehicles.rows.map((r) => r.eldDeviceModel).filter((v): v is string => Boolean(v)))).sort(),
    [allVehicles.rows],
  );
  const makeOptions = useMemo(
    () => Array.from(new Set(allVehicles.rows.map((r) => r.make).filter((v): v is string => Boolean(v)))).sort(),
    [allVehicles.rows],
  );
  const terminalOptions = useMemo(
    () => Array.from(new Set(allVehicles.rows.map((r) => r.driver?.homeTerminalName).filter((v): v is string => Boolean(v)))).sort(),
    [allVehicles.rows],
  );

  const filtered = useMemo(() => {
    let rows = allVehicles.rows;
    if (segment === 'ACTIVE') rows = rows.filter((r) => r.status === 'ACTIVE');
    if (segment === 'INACTIVE') rows = rows.filter((r) => r.status === 'INACTIVE');
    if (segment === 'UNASSIGNED') rows = rows.filter((r) => !r.driver);
    if (debouncedSearch.trim()) {
      const needle = debouncedSearch.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.unitNumber.toLowerCase().includes(needle) ||
          r.vin.toLowerCase().includes(needle) ||
          (r.licensePlate ?? '').toLowerCase().includes(needle),
      );
    }
    rows = rows.filter((r) => matchesVehicleFilters(r, dutyByVehicle.get(r.id), filters));
    return rows;
  }, [allVehicles.rows, segment, debouncedSearch, filters, dutyByVehicle]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const pageRows = filtered.slice((page - 1) * limit, page * limit);

  const counts = useMemo(
    () => ({
      all: allVehicles.rows.length,
      active: allVehicles.rows.filter((r) => r.status === 'ACTIVE').length,
      inactive: allVehicles.rows.filter((r) => r.status === 'INACTIVE').length,
      unassigned: allVehicles.rows.filter((r) => !r.driver).length,
    }),
    [allVehicles.rows],
  );

  const [addOpen, setAddOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<VehicleTableRow | null>(null);
  const [deleteVehicle, setDeleteVehicle] = useState<VehicleTableRow | null>(null);
  const [assignVehicle, setAssignVehicle] = useState<VehicleTableRow | null>(null);
  const [calibrateVehicle, setCalibrateVehicle] = useState<VehicleTableRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersRevision, setFiltersRevision] = useState(0);
  const [selection, setSelection] = useState<string[]>([]);

  function applyFilters(next: typeof filters) {
    setParams(writeVehicleFilters(params, next), { replace: true });
  }

  async function handleExport() {
    const data = await client.get(endpoints.vehicles.export);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'vehicles-export.json';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const columns: ColumnDef<VehicleTableRow, unknown>[] = [
    {
      accessorKey: 'unitNumber',
      header: 'UNIT #',
      cell: ({ row }) => <span className="tabular-nums font-semibold text-text">{row.original.unitNumber}</span>,
    },
    {
      id: 'status',
      header: 'STATUS',
      cell: ({ row }) => {
        const duty = dutyByVehicle.get(row.original.id);
        if (row.original.status === 'OUT_OF_SERVICE') return <Badge tone="danger" dot>Out of service</Badge>;
        if (row.original.status === 'INACTIVE') return <DutyBadge status="INACTIVE" />;
        return duty ? <DutyBadge status={duty} /> : <Badge tone="success" dot>Active</Badge>;
      },
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
      id: 'makeModel',
      header: 'MAKE & MODEL',
      cell: ({ row }) => <span className="text-text">{[row.original.make, row.original.model].filter(Boolean).join(' ') || '—'}</span>,
    },
    { accessorKey: 'year', header: 'YEAR', cell: ({ row }) => <span className="tabular-nums">{row.original.year ?? '—'}</span> },
    {
      accessorKey: 'vin',
      header: 'VIN',
      cell: ({ row }) => <span className="text-text-secondary">{row.original.vin}</span>,
    },
    {
      id: 'eldSerial',
      header: 'ELD SERIAL',
      cell: ({ row }) => (
        <span className={row.original.eldDeviceStatus && row.original.eldDeviceStatus !== 'ASSIGNED' ? 'text-text-muted' : 'text-text'}>
          {orNotAssigned(row.original.eldSerial)}
        </span>
      ),
    },
    {
      id: 'odometer',
      header: 'ODOMETER',
      cell: ({ row }) => (
        <span className="block tabular-nums text-right text-text">{formatOdometer(row.original.odometerMi)} mi</span>
      ),
    },
  ];

  const isLoading = allVehicles.isLoading || liveFleet.isLoading;

  return (
    <div className="flex flex-col gap-4 xl:max-h-content-h">
      <div className="flex items-center justify-between xl:shrink-0">
        <div>
          <h1 className="text-page-title text-text">Vehicles</h1>
          <p className="text-page-sub text-text-muted">
            {counts.all} units · {counts.active} active · {counts.inactive} inactive
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-input items-center gap-2 rounded-md border border-border bg-bg-surface px-3">
            <Search size={16} strokeWidth={1.75} className="text-text-muted" />
            <input
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setParam('q', e.target.value || null);
              }}
              placeholder="Search unit #, VIN, plate…"
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
            Filters{countActiveVehicleFilters(filters) > 0 ? ` · ${countActiveVehicleFilters(filters)}` : ''}
          </Button>
          <Button variant="secondary" iconLeft={<Download size={16} strokeWidth={1.75} />} onClick={handleExport}>
            Export
          </Button>
          <Can perm="vehicles" level="FULL">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button variant="secondary" iconOnly aria-label="More">
                  <MoreHorizontal size={16} strokeWidth={1.75} />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" className="z-50 min-w-44 rounded-md border border-border bg-bg-surface p-1 shadow-pop">
                  <DropdownMenu.Item
                    onSelect={() => setImportOpen(true)}
                    className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle"
                  >
                    Import from CSV
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <Button
              variant="primary"
              iconLeft={<Plus size={16} strokeWidth={1.75} />}
              onClick={() => setAddOpen(true)}
              disabled={isOffline}
              title={isOffline ? OFFLINE_TOOLTIP : undefined}
            >
              Add vehicle
            </Button>
          </Can>
        </div>
      </div>

      <div className="flex h-9 w-fit overflow-hidden rounded-md border border-border xl:shrink-0">
        {(
          [
            ['ALL', `All ${counts.all}`],
            ['ACTIVE', `Active ${counts.active}`],
            ['INACTIVE', `Inactive ${counts.inactive}`],
            ['UNASSIGNED', `Unassigned ${counts.unassigned}`],
          ] as [Segment, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={segment === value}
            onClick={() => setParam('segment', value === 'ALL' ? null : value)}
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
        <VehicleFilterChips
          filters={filters}
          onRemove={(patch) => applyFilters({ ...filters, ...patch })}
          onClearAll={() => applyFilters(EMPTY_VEHICLE_FILTERS)}
        />
      </div>

      <Card padded={false} className="xl:flex xl:min-h-0 xl:flex-col">
        {isLoading ? (
          <LoadingState className="p-4" />
        ) : allVehicles.isError ? (
          <ErrorState onRetry={() => allVehicles.refetch()} />
        ) : total === 0 ? (
          debouncedSearch || countActiveVehicleFilters(filters) > 0 ? (
            <EmptyState
              {...searchEmptyState(debouncedSearch || 'these filters')}
              actions={[
                {
                  label: debouncedSearch ? 'Clear search' : 'Clear filters',
                  onClick: () => (debouncedSearch ? setSearchInput('') : applyFilters(EMPTY_VEHICLE_FILTERS)),
                },
              ]}
            />
          ) : (
            <EmptyState
              {...EMPTY_STATE_COPY.vehicles}
              actions={
                canFull
                  ? [
                      { label: 'Import CSV', variant: 'secondary', onClick: () => setImportOpen(true) },
                      { label: 'Add vehicle', onClick: () => setAddOpen(true) },
                    ]
                  : undefined
              }
            />
          )
        ) : (
          <>
            {/* Desktop only (xl:): the results list scrolls inside the card so the page itself
                never grows past the viewport — same max-height + overflow-y-auto idea as the
                W-16 Messages driver-search list. */}
            <div className="xl:min-h-0 xl:overflow-y-auto">
              <DataTable
                data={pageRows}
                columns={columns}
                caption="Vehicles"
                getRowId={(r) => r.id}
                selectable={canFull}
                selection={selection}
                onSelectionChange={setSelection}
                onRowClick={(row) => navigate(`/vehicles/${row.id}`)}
                rowActions={
                  canFull
                    ? (row) => (
                        <>
                          <DropdownMenu.Item onSelect={() => navigate(`/vehicles/${row.id}`)} className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
                            View unit profile
                          </DropdownMenu.Item>
                          <DropdownMenu.Item onSelect={() => navigate(`/hos-logs?driverId=${row.driver?.id ?? ''}`)} className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
                            Open HOS logs
                          </DropdownMenu.Item>
                          <DropdownMenu.Item onSelect={() => navigate('/live-fleet')} className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
                            Track on map
                          </DropdownMenu.Item>
                          <DropdownMenu.Item onSelect={() => setAssignVehicle(row)} className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
                            Assign driver
                          </DropdownMenu.Item>
                          <DropdownMenu.Item onSelect={() => setCalibrateVehicle(row)} className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
                            Calibrate odometer
                          </DropdownMenu.Item>
                          <DropdownMenu.Item onSelect={() => navigate(`/vehicles/${row.id}/histories`)} className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
                            View histories
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator className="my-1 h-px bg-border" />
                          <DropdownMenu.Item onSelect={() => setEditVehicle(row)} className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
                            Edit unit
                          </DropdownMenu.Item>
                          <DropdownMenu.Item onSelect={() => setDeleteVehicle(row)} className="cursor-pointer rounded-md px-2 py-1.5 text-body text-danger outline-none hover:bg-danger-soft">
                            Delete unit
                          </DropdownMenu.Item>
                        </>
                      )
                    : undefined
                }
              />
            </div>
            <Pagination
              page={page}
              limit={limit}
              total={total}
              totalPages={totalPages}
              itemLabel="vehicles"
              onPageChange={(p) => setParam('page', String(p))}
              onLimitChange={(l) => setParam('limit', String(l))}
            />
          </>
        )}
      </Card>

      {selection.length > 0 && canFull && (
        <div className="fixed inset-x-0 bottom-6 z-30 mx-auto flex h-14 w-fit min-w-bulk-bar items-center gap-3 rounded-lg bg-bg-inverse px-4 shadow-pop">
          <span className="text-body-strong text-text-inverse">{selection.length} vehicles selected</span>
          <Button variant="ghost" className="text-text-inverse hover:bg-white/10">
            Assign driver
          </Button>
          <Button variant="ghost" className="text-text-inverse hover:bg-white/10" onClick={handleExport}>
            Export
          </Button>
          <Button
            variant="ghost"
            className="text-text-inverse hover:bg-white/10"
            onClick={() => toast({ kind: 'success', title: `${selection.length} units set inactive` })}
          >
            Set inactive
          </Button>
          <button type="button" aria-label="Clear selection" onClick={() => setSelection([])} className="ml-auto text-text-inverse">
            ×
          </button>
        </div>
      )}

      {addOpen && <AddVehicleModal onClose={() => setAddOpen(false)} />}
      {editVehicle && <AddVehicleModal vehicle={editVehicle} onClose={() => setEditVehicle(null)} />}
      {deleteVehicle && (
        <DeleteUnitModal vehicle={deleteVehicle} eldSerial={deleteVehicle.eldSerial} onClose={() => setDeleteVehicle(null)} />
      )}
      {assignVehicle && <AssignDriverModal vehicle={assignVehicle} onClose={() => setAssignVehicle(null)} />}
      {calibrateVehicle && <CalibrateOdometerModal vehicle={calibrateVehicle} onClose={() => setCalibrateVehicle(null)} />}
      {importOpen && <ImportVehiclesModal onClose={() => setImportOpen(false)} />}
      <VehicleFiltersDrawer
        key={filtersRevision}
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onApply={applyFilters}
        eldDeviceOptions={eldDeviceOptions}
        makeOptions={makeOptions}
        terminalOptions={terminalOptions}
      />
    </div>
  );
}
