// owner: web-vehicles-drivers — W-03 Vehicles (web/tz.md §10 W-03).
// Design: web/roles and screens/admin panel/Unit inventory — ELD serial, VIN, odometer.jpg
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { useMutation } from '@tanstack/react-query';
import { Search, Plus, Download, Filter, Upload, X } from 'lucide-react';
import { liveFleetHref } from '@/shared/lib/liveFleetHref';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import { useIsOffline, OFFLINE_TOOLTIP } from '@/shared/realtime/RealtimeProvider';
import { useDynamicSubtitle } from '@/app/layouts/Topbar';
import { useLiveFleet } from '@/shared/api/liveFleet';
import { useVehiclesList, useVehicleCounts, useBulkVehicleStatus, joinVehicles, totalVehicleMiles, type VehicleTableRow } from '@/shared/api/vehicles';
import { useVehiclesLookup } from '@/shared/api/lookups';
import { client } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { Button } from '@/shared/ui/Button';
import { Badge, DutyBadge, type DutyStatus } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { DataTable } from '@/shared/ui/DataTable';
import { Pagination } from '@/shared/ui/Pagination';
import { Card } from '@/shared/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';
import { EMPTY_STATE_COPY, TOAST_COPY, searchEmptyState } from '@/shared/ui/copy';
import { toCsv } from '@/shared/lib/csv';
import { ApiError } from '@/shared/api/errors';
import { useToast } from '@/shared/ui/Toast';
import { formatOdometer } from '@/shared/format/numbers';
import { orUnassigned, orNotAssigned } from '@/shared/format/empty';
import { AddVehicleModal } from './components/AddVehicleModal';
import { DeleteUnitModal } from './components/DeleteUnitModal';
import { AssignDriverModal } from './components/AssignDriverModal';
import { CalibrateOdometerModal } from './components/CalibrateOdometerModal';
import { ImportVehiclesModal } from './components/ImportVehiclesModal';
import { VehicleFiltersDrawer, VehicleFilterChips } from './components/VehicleFiltersDrawer';
import { MULTI_ASSIGN_REASON, NO_DRIVER_LOGS_REASON } from './lib/copy';
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

/** `?page=abc` is `NaN` and `?page=0` / `?page=-3` are pages no server can answer — both reached
 * `GET /vehicles` verbatim and rendered a `NaN–NaN of 57` footer. Anything that is not a positive
 * integer falls back to the default. */
function positiveIntParam(raw: string | null, fallback: number): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
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
  const page = positiveIntParam(params.get('page'), 1);
  const limit = positiveIntParam(params.get('limit'), 10);

  useDynamicSubtitle(null);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  const filters = useMemo(() => parseVehicleFilters(params), [params]);
  const activeFilterCount = countActiveVehicleFilters(filters);

  // WD-073 — one `GET /vehicles` page per render. `q` and `status` are real `VehicleListQueryDto`
  // params; the UNASSIGNED segment (a driver-side join) and the 11.23 drawer groups (B-54) have
  // no server param, so only while one of them is active does the page fall back to the
  // reference-cached fleet window and filter in memory.
  const useWindow = segment === 'UNASSIGNED' || activeFilterCount > 0;
  const liveFleet = useLiveFleet();
  const dutyByVehicle = useMemo(() => {
    const map = new Map<string, DutyStatus>();
    for (const unit of liveFleet.data?.items ?? []) map.set(unit.vehicleId, unit.dutyStatus);
    return map;
  }, [liveFleet.data]);

  const allVehicles = useVehiclesList({
    params: {
      page,
      limit,
      q: debouncedSearch.trim() || undefined,
      status: segment === 'ACTIVE' || segment === 'INACTIVE' ? segment : undefined,
    },
    useWindow,
    filter: (rows) => {
      let out = rows;
      if (segment === 'ACTIVE') out = out.filter((r) => r.status === 'ACTIVE');
      if (segment === 'INACTIVE') out = out.filter((r) => r.status === 'INACTIVE');
      if (segment === 'UNASSIGNED') out = out.filter((r) => !r.driver);
      if (debouncedSearch.trim()) {
        const needle = debouncedSearch.trim().toLowerCase();
        out = out.filter(
          (r) =>
            r.unitNumber.toLowerCase().includes(needle) ||
            r.vin.toLowerCase().includes(needle) ||
            (r.licensePlate ?? '').toLowerCase().includes(needle),
        );
      }
      return out.filter((r) => matchesVehicleFilters(r, dutyByVehicle.get(r.id), filters));
    },
  });
  const counts = useVehicleCounts();

  // Drawer option lists come from the whole fleet, which is only loaded once the drawer opens
  // (or a filter is already active) — never on a plain page visit.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const fleetForOptions = useVehiclesLookup(filtersOpen || useWindow);
  const optionRows = useMemo(
    () =>
      allVehicles.fleetRows.length > 0
        ? allVehicles.fleetRows
        : joinVehicles(fleetForOptions.data?.items ?? [], allVehicles.driversLookup.data?.items ?? [], allVehicles.devicesLookup.data?.items ?? []),
    [allVehicles.fleetRows, fleetForOptions.data, allVehicles.driversLookup.data, allVehicles.devicesLookup.data],
  );
  const eldDeviceOptions = useMemo(
    () => Array.from(new Set(optionRows.map((r) => r.eldDeviceModel).filter((v): v is string => Boolean(v)))).sort(),
    [optionRows],
  );
  const makeOptions = useMemo(
    () => Array.from(new Set(optionRows.map((r) => r.make).filter((v): v is string => Boolean(v)))).sort(),
    [optionRows],
  );
  const terminalOptions = useMemo(
    () => Array.from(new Set(optionRows.map((r) => r.driver?.homeTerminalName).filter((v): v is string => Boolean(v)))).sort(),
    [optionRows],
  );

  const total = allVehicles.total;
  const totalPages = allVehicles.totalPages;
  const pageRows = allVehicles.rows;
  const lastPage = Math.max(1, totalPages);

  // A `page` past the end of the list (a bookmark, the back button, or units deleted since the
  // link was made) asks the server for a slice it cannot answer: the card rendered an empty table
  // body under a `51–60 of 47 vehicles` footer. Snap back to the last page that exists.
  useEffect(() => {
    if (allVehicles.isLoading || page <= lastPage) return;
    setParam('page', String(lastPage));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, lastPage, allVehicles.isLoading]);

  const [addOpen, setAddOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<VehicleTableRow | null>(null);
  const [deleteVehicle, setDeleteVehicle] = useState<VehicleTableRow | null>(null);
  const [assignVehicle, setAssignVehicle] = useState<VehicleTableRow | null>(null);
  const [calibrateVehicle, setCalibrateVehicle] = useState<VehicleTableRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [filtersRevision, setFiltersRevision] = useState(0);
  const [selection, setSelection] = useState<string[]>([]);

  function applyFilters(next: typeof filters) {
    setParams(writeVehicleFilters(params, next), { replace: true });
  }

  /** The selected units, resolved from the rows this screen has actually loaded. */
  const selectedRows = useMemo(() => {
    const byId = new Map<string, VehicleTableRow>();
    for (const row of [...allVehicles.fleetRows, ...allVehicles.rows]) byId.set(row.id, row);
    return selection.map((id) => byId.get(id)).filter((r): r is VehicleTableRow => Boolean(r));
  }, [selection, allVehicles.fleetRows, allVehicles.rows]);

  function saveBlob(blob: Blob, fileName: string) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    // A failing `GET /vehicles/export` used to reject into an unhandled promise: the button did
    // nothing and said nothing. Every failure is now visible, and a second click while the first
    // request is still open is ignored instead of downloading the file twice.
    if (exporting) return;
    setExporting(true);
    try {
      const data = await client.get(endpoints.vehicles.export);
      saveBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'vehicles-export.json');
    } catch (error) {
      toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' });
    } finally {
      setExporting(false);
    }
  }

  /** Bulk-bar `Export` used to call `handleExport()`, which dumps the whole fleet — the selection
   * was ignored. `GET /vehicles/export` has no id filter (its rows carry no id at all), so the
   * selected units are serialized from the rows already on screen instead of asking the server
   * for a slice it cannot answer. */
  function handleExportSelection() {
    const rows = selectedRows;
    const csv = toCsv([
      ['unitNumber', 'status', 'driver', 'make', 'model', 'year', 'vin', 'eldSerial', 'odometerMi'],
      ...rows.map((r) => [
        r.unitNumber,
        r.status,
        r.driver ? `${r.driver.firstName} ${r.driver.lastName}` : '',
        r.make,
        r.model,
        r.year,
        r.vin,
        r.eldSerial ?? '',
        totalVehicleMiles(r),
      ]),
    ]);
    saveBlob(new Blob([csv], { type: 'text/csv' }), 'vehicles-selected.csv');
  }

  // B-71 shipped — `PATCH /vehicles/bulk-status`, one atomic-per-row request; `failed` is read,
  // never hidden. Replaces the earlier per-id `PATCH /vehicles/:id` fan-out.
  const bulkStatus = useBulkVehicleStatus();
  const setInactiveMutation = useMutation({
    mutationFn: (ids: string[]) => bulkStatus.mutateAsync({ ids, status: 'INACTIVE' }),
    onSuccess: (result, ids) => {
      if (result.updated.length > 0) setSelection([]);
      if (result.failed.length === 0) {
        toast({ kind: 'success', ...TOAST_COPY.unitsSetInactive(result.updated.length) });
        return;
      }
      toast({
        kind: 'error',
        ...TOAST_COPY.unitsSetInactiveFailed(result.failed.length, ids.length),
        description: result.failed[0]?.error ?? TOAST_COPY.unitsSetInactiveFailed(result.failed.length, ids.length).description,
      });
    },
    onError: (error) => {
      toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' });
    },
  });

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
        // WD-073 — `/live/fleet` is the slowest call on this screen (~2 s server-side); the table
        // no longer waits for it. The duty badge fills in when the snapshot lands.
        if (!duty && liveFleet.isLoading) return <span aria-label="Loading status" className="inline-block h-5 w-16 animate-pulse rounded-full bg-bg-subtle" />;
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
      // §4.3 — the displayed odometer is the ECU reading plus the calibration offset when the
      // device reports one, never the raw stored `odometerMi`: otherwise a successful
      // `Calibrate odometer` never changed the number in this column.
      cell: ({ row }) => (
        <span className="block tabular-nums text-right text-text">{formatOdometer(totalVehicleMiles(row.original))} mi</span>
      ),
    },
  ];

  const isLoading = allVehicles.isLoading;

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
              aria-label="Search unit #, VIN, plate"
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
            Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
          </Button>
          {/* Export pulls a file down (`Download`), Import pushes one up (`Upload`) — the two
              icons used to be the wrong way round. */}
          <Button
            variant="secondary"
            className="w-btn-wide"
            iconLeft={<Download size={16} strokeWidth={1.75} />}
            onClick={handleExport}
            loading={exporting}
          >
            Export Units
          </Button>
          <Can perm="vehicles" level="FULL">
            <Button variant="secondary" className="w-btn-wide" iconLeft={<Upload size={16} strokeWidth={1.75} />} onClick={() => setImportOpen(true)}>
              Import Units
            </Button>
            <Button
              variant="primary"
              className="w-btn-add"
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
          debouncedSearch || activeFilterCount > 0 ? (
            <EmptyState
              {...searchEmptyState(debouncedSearch || 'these filters')}
              actions={[
                {
                  label: debouncedSearch ? 'Clear search' : 'Clear filters',
                  // Clearing the box without deleting `q` left the search in the URL, so a
                  // reload brought the empty result straight back.
                  onClick: () => {
                    if (!debouncedSearch) return applyFilters(EMPTY_VEHICLE_FILTERS);
                    setSearchInput('');
                    setParam('q', null);
                  },
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
                          {/* `?driverId=` with an empty value reached W-06 as a driver id no
                              lookup can answer. A driverless unit says so instead. */}
                          <DropdownMenu.Item
                            disabled={!row.driver}
                            title={row.driver ? undefined : NO_DRIVER_LOGS_REASON}
                            onSelect={() => {
                              if (row.driver) navigate(`/hos-logs?driverId=${row.driver.id}`);
                            }}
                            className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle data-[disabled]:cursor-not-allowed data-[disabled]:text-text-muted"
                          >
                            Open HOS logs
                          </DropdownMenu.Item>
                          <DropdownMenu.Item onSelect={() => navigate(liveFleetHref(row.id))} className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
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
              page={Math.min(page, lastPage)}
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
          <span className="text-body-strong text-text-inverse">
            {selection.length} vehicle{selection.length === 1 ? '' : 's'} selected
          </span>
          {/* `POST /vehicles/:id/assign-driver` assigns one driver to one unit, and a driver can
              hold a single unit — so this opens the 11.4 modal for the one selected unit and says
              why it cannot act on several. */}
          <Button
            variant="ghost"
            className="text-text-inverse hover:bg-white/10"
            disabled={selection.length !== 1}
            title={selection.length !== 1 ? MULTI_ASSIGN_REASON : undefined}
            onClick={() => {
              const row = selectedRows[0];
              if (row) setAssignVehicle(row);
            }}
          >
            Assign driver
          </Button>
          <Button variant="ghost" className="text-text-inverse hover:bg-white/10" onClick={handleExportSelection}>
            Export
          </Button>
          <Button
            variant="ghost"
            className="text-text-inverse hover:bg-white/10"
            loading={setInactiveMutation.isPending}
            disabled={isOffline}
            title={isOffline ? OFFLINE_TOOLTIP : undefined}
            onClick={() => setInactiveMutation.mutate(selection)}
          >
            Set inactive
          </Button>
          {/* Stage 3 — was a bare `×` glyph; now a 32×32 target like the other icon buttons. */}
          <button
            type="button"
            aria-label="Clear selection"
            onClick={() => setSelection([])}
            className="ml-auto flex size-btn-sm items-center justify-center rounded-md text-text-inverse hover:bg-white/10"
          >
            <X size={16} strokeWidth={1.75} aria-hidden="true" />
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
