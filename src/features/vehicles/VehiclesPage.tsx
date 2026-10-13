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
import { usePageHeader } from '@/app/layouts/Topbar';
import { useLiveFleet, type LiveConnectivity } from '@/shared/api/liveFleet';
import {
  useVehiclesList,
  useVehicleCounts,
  useBulkVehicleStatus,
  joinVehicles,
  totalVehicleMiles,
  type CoDriverPairingRow,
  type VehicleTableRow,
} from '@/shared/api/vehicles';
import { useVehiclesLookup, useDriversLookup } from '@/shared/api/lookups';
import { client } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { Button } from '@/shared/ui/Button';
import { Badge, DutyBadge, type DutyStatus } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { DataTable } from '@/shared/ui/DataTable';
import { Pagination } from '@/shared/ui/Pagination';
import { Card } from '@/shared/ui/Card';
import { InventoryTabs } from '@/shared/ui/InventoryTabs';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';
import { EMPTY_STATE_COPY, TOAST_COPY, searchEmptyState } from '@/shared/ui/copy';
import { toCsv } from '@/shared/lib/csv';
import { formErrorMessage } from '@/shared/api/errors';
import { useToast } from '@/shared/ui/Toast';
import { formatOdometer } from '@/shared/format/numbers';
import { orUnassigned, orNotAssigned } from '@/shared/format/empty';
import { AddVehicleModal } from './components/AddVehicleModal';
import { DeleteUnitModal } from './components/DeleteUnitModal';
import { AssignDriverModal } from './components/AssignDriverModal';
import { CalibrateOdometerModal } from './components/CalibrateOdometerModal';
import { AssignCoDriverModal } from './components/AssignCoDriverModal';
import { EndCoDriverPairingDialog } from './components/EndCoDriverPairingDialog';
import { CoDriverMenuItems } from './components/CoDriverMenuItems';
import { ImportVehiclesModal } from './components/ImportVehiclesModal';
import { VehicleFiltersDrawer, VehicleFilterChips } from './components/VehicleFiltersDrawer';
import { MULTI_ASSIGN_REASON, NO_DRIVER_LOGS_REASON } from './lib/copy';
import {
  parseVehicleFilters,
  writeVehicleFilters,
  matchesVehicleFilters,
  EMPTY_VEHICLE_FILTERS,
  countActiveVehicleFilters,
  parseVehicleSort,
  sortVehicleRows,
  vehicleSortParam,
  VEHICLE_SORT_FIELDS,
} from './lib/filters';

type Segment = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'UNASSIGNED';
const SEGMENT_LABEL: Record<Segment, string> = { ALL: 'All', ACTIVE: 'Active', INACTIVE: 'Inactive', UNASSIGNED: 'Unassigned' };
const SEGMENT_NOUN: Record<Segment, string> = { ALL: '', ACTIVE: 'active', INACTIVE: 'inactive', UNASSIGNED: 'unassigned' };

/** UI-004 — the secondary line under the STATUS badge: what the unit's ELD link says. */
const CONNECTIVITY_NOTE: Record<LiveConnectivity, string | undefined> = {
  NO_DEVICE: 'No device',
  ELD_OFFLINE: 'ELD offline',
  ONLINE: undefined,
};

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


  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  const filters = useMemo(() => parseVehicleFilters(params), [params]);
  const activeFilterCount = countActiveVehicleFilters(filters);
  // QA UI-007 — sorting is the server's (`GET /vehicles?sort=`), so it orders the whole fleet, not
  // just the 10 rows of the current page. Kept in the URL like the other list params.
  const sort = useMemo(() => parseVehicleSort(params.get('sort')), [params]);
  const sorting = useMemo(() => (sort ? [sort] : []), [sort]);

  // WD-073 — one `GET /vehicles` page per render. `q` and `status` are real `VehicleListQueryDto`
  // params; the UNASSIGNED segment (a driver-side join) and the 11.23 drawer groups (B-54) have
  // no server param, so only while one of them is active does the page fall back to the
  // reference-cached fleet window and filter in memory.
  const useWindow = segment === 'UNASSIGNED' || activeFilterCount > 0;
  const liveFleet = useLiveFleet();
  // UI-004 — the live snapshot per unit. The STATUS column's headline is the RECORD status
  // (`vehicle.status`); the live duty only refines an ACTIVE unit with a driver on it, and the
  // ELD link (`connectivity`) is a secondary line — never a reason to repaint the record status.
  const liveByVehicle = useMemo(
    () => new Map((liveFleet.data?.items ?? []).map((unit) => [unit.vehicleId, unit])),
    [liveFleet.data],
  );
  const dutyByVehicle = useMemo(() => {
    const map = new Map<string, DutyStatus>();
    // `/live/fleet` says INACTIVE for a unit with no ELD paired and nobody signed in, and for an
    // OUT_OF_SERVICE / INACTIVE record — neither is a duty status, so the drawer's duty filter and
    // the badge only see real driver-duty values.
    for (const unit of liveFleet.data?.items ?? []) {
      if (unit.dutyStatus !== 'INACTIVE') map.set(unit.vehicleId, unit.dutyStatus);
    }
    return map;
  }, [liveFleet.data]);

  const allVehicles = useVehiclesList({
    params: {
      page,
      limit,
      q: debouncedSearch.trim() || undefined,
      status: segment === 'ACTIVE' || segment === 'INACTIVE' ? segment : undefined,
      sort: vehicleSortParam(sort),
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
      return sortVehicleRows(
        out.filter((r) => matchesVehicleFilters(r, dutyByVehicle.get(r.id), filters)),
        sort,
      );
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
  const [coDriverVehicle, setCoDriverVehicle] = useState<VehicleTableRow | null>(null);
  const [endPairingTarget, setEndPairingTarget] = useState<{ row: VehicleTableRow; pairing: CoDriverPairingRow } | null>(null);
  // Co-driver name for the end-pairing confirm — the session-wide drivers lookup the table already joins.
  const driversLookup = useDriversLookup(Boolean(endPairingTarget));
  const endPairingCoDriver = endPairingTarget
    ? (driversLookup.data?.items.find((d) => d.id === endPairingTarget.pairing.coDriverId) ?? null)
    : null;
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
      toast({ kind: 'error', title: formErrorMessage(error) });
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
      toast({ kind: 'error', title: formErrorMessage(error, [], { ids: 'Selected units', status: 'Status' }) });
    },
  });

  const columns: ColumnDef<VehicleTableRow, unknown>[] = [
    {
      accessorKey: 'unitNumber',
      header: 'UNIT #',
      meta: { width: '9%' },
      cell: ({ row }) => <span className="tabular-nums font-semibold text-text">{row.original.unitNumber}</span>,
    },
    {
      id: 'status',
      header: 'STATUS',
      accessorFn: (row) => row.status,
      meta: { width: '13%' },
      cell: ({ row }) => {
        const duty = dutyByVehicle.get(row.original.id);
        const live = liveByVehicle.get(row.original.id);
        const link = live ? CONNECTIVITY_NOTE[live.connectivity] : undefined;
        const note = link ? <span className="block text-caption text-text-muted">{link}</span> : null;
        if (row.original.status === 'OUT_OF_SERVICE') return <span className="flex flex-col items-start gap-0.5"><Badge tone="danger" dot>Out of service</Badge>{note}</span>;
        if (row.original.status === 'INACTIVE') return <span className="flex flex-col items-start gap-0.5"><DutyBadge status="INACTIVE" />{note}</span>;
        // WD-073 — `/live/fleet` is the slowest call on this screen (~2 s server-side); the table
        // no longer waits for it. The duty badge fills in when the snapshot lands.
        if (!live && liveFleet.isLoading) return <span aria-label="Loading status" className="inline-block h-5 w-16 animate-pulse rounded-full bg-bg-subtle" />;
        // An ELD_OFFLINE "duty" is the link, not the driver's status — it reads as the note below.
        const headline = duty && duty !== 'ELD_OFFLINE' ? <DutyBadge status={duty} /> : <Badge tone="success" dot>Active</Badge>;
        return <span className="flex flex-col items-start gap-0.5">{headline}{note}</span>;
      },
    },
    {
      id: 'driver',
      header: 'DRIVER',
      meta: { width: '17%' },
      cell: ({ row }) => {
        const driver = row.original.driver;
        if (!driver) return <span className="text-text-muted">{orUnassigned(null)}</span>;
        const name = `${driver.firstName} ${driver.lastName}`;
        return (
          <span className="flex items-center gap-2">
            <Avatar name={name} size="sm" />
            <span className="truncate text-text">{name}</span>
          </span>
        );
      },
    },
    {
      id: 'makeModel',
      header: 'MAKE & MODEL',
      accessorFn: (row) => row.make,
      meta: { width: '14%' },
      cell: ({ row }) => <span className="text-text">{[row.original.make, row.original.model].filter(Boolean).join(' ') || '—'}</span>,
    },
    {
      accessorKey: 'year',
      header: 'YEAR',
      // No `year` in the API's sortable fields — sorting one page in memory misled (UI-007).
      enableSorting: false,
      meta: { width: '7%' },
      cell: ({ row }) => <span className="tabular-nums">{row.original.year ?? '—'}</span>,
    },
    {
      accessorKey: 'vin',
      header: 'VIN',
      meta: { width: '17%' },
      cell: ({ row }) => <span className="text-text-secondary">{row.original.vin}</span>,
    },
    {
      id: 'eldSerial',
      header: 'ELD SERIAL',
      meta: { width: '11%' },
      cell: ({ row }) => (
        <span className={row.original.eldDeviceStatus && row.original.eldDeviceStatus !== 'ASSIGNED' ? 'text-text-muted' : 'text-text'}>
          {orNotAssigned(row.original.eldSerial)}
        </span>
      ),
    },
    {
      id: 'odometer',
      header: 'ODOMETER',
      meta: { width: '12%' },
      // §4.3 — the displayed odometer is the ECU reading plus the calibration offset when the
      // device reports one, never the raw stored `odometerMi`: otherwise a successful
      // `Calibrate odometer` never changed the number in this column.
      cell: ({ row }) => (
        <span className="block tabular-nums text-right text-text">{formatOdometer(totalVehicleMiles(row.original))} mi</span>
      ),
    },
  ];

  const isLoading = allVehicles.isLoading;

  usePageHeader({
    title: 'Vehicles',
    subtitle: `${counts.all} units · ${counts.active} active · ${counts.inactive} inactive · ${counts.outOfService} out of service`,
  });

  return (
    <div className="flex flex-col gap-4 xl:max-h-content-h">
      <div className="flex flex-wrap items-center justify-between gap-3 xl:shrink-0">
        <InventoryTabs />
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="flex h-input w-full items-center gap-2 rounded-md border border-border bg-bg-surface px-3 sm:w-auto">
            <Search size={16} strokeWidth={1.75} className="text-text-muted" />
            <input
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setParam('q', e.target.value || null);
              }}
              placeholder="Search unit #, VIN, plate…"
              aria-label="Search unit #, VIN, plate"
              className="w-full min-w-0 bg-transparent text-body outline-none sm:w-56"
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
          {/* Export sends units out (`Upload`), Import brings them in (`Download`) — per the design. */}
          <Button
            variant="secondary"
            className="sm:w-btn-wide"
            iconLeft={<Upload size={16} strokeWidth={1.75} />}
            onClick={handleExport}
            loading={exporting}
          >
            Export Units
          </Button>
          <Can perm="vehicles" level="FULL">
            <Button variant="secondary" className="sm:w-btn-wide" iconLeft={<Download size={16} strokeWidth={1.75} />} onClick={() => setImportOpen(true)}>
              Import Units
            </Button>
            <Button
              variant="primary"
              className="sm:w-btn-add"
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

      <div className="flex h-9 w-fit max-w-full overflow-x-auto rounded-md border border-border xl:shrink-0">
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
                ? 'shrink-0 whitespace-nowrap bg-bg-inverse px-3 text-body-strong text-text-inverse'
                : 'shrink-0 whitespace-nowrap bg-bg-surface px-3 text-body text-text-secondary hover:bg-bg-subtle'
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
          debouncedSearch || activeFilterCount > 0 || segment !== 'ALL' ? (
            // QA UI-019 — the search was rarely the only thing narrowing the list: say which
            // filters/tab are on, and offer to clear each.
            <EmptyState
              {...searchEmptyState(debouncedSearch || 'these filters')}
              title={
                debouncedSearch
                  ? `Nothing matches "${debouncedSearch}"${activeFilterCount > 0 || segment !== 'ALL' ? ' with the current filters' : ''}`
                  : segment !== 'ALL' && activeFilterCount === 0
                    ? `No ${SEGMENT_NOUN[segment]} units`
                    : 'No units match these filters'
              }
              description={
                [
                  segment !== 'ALL' ? `Tab: ${SEGMENT_LABEL[segment]}` : null,
                  activeFilterCount > 0 ? `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} applied` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Check the spelling or try a unit number, VIN or plate.'
              }
              actions={[
                ...(segment !== 'ALL'
                  ? [{ label: 'Show all units', variant: 'secondary' as const, onClick: () => setParam('segment', null) }]
                  : []),
                ...(activeFilterCount > 0
                  ? [{ label: 'Clear filters', variant: 'secondary' as const, onClick: () => applyFilters(EMPTY_VEHICLE_FILTERS) }]
                  : []),
                ...(debouncedSearch
                  ? [
                      {
                        label: 'Clear search',
                        // Clearing the box without deleting `q` left the search in the URL, so a
                        // reload brought the empty result straight back.
                        onClick: () => {
                          setSearchInput('');
                          setParam('q', null);
                        },
                      },
                    ]
                  : []),
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
                className="table-fixed"
                sorting={sorting}
                onSortingChange={(next) => {
                  const first = next[0];
                  setParam('sort', first && first.id in VEHICLE_SORT_FIELDS ? `${first.id}:${first.desc ? 'desc' : 'asc'}` : null);
                }}
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
                          {/* B-7 team driving — pairing writes are `drivers` FULL. */}
                          <Can perm="drivers" level="FULL">
                            <CoDriverMenuItems
                              row={row}
                              onAssign={setCoDriverVehicle}
                              onEnd={(target, pairing) => setEndPairingTarget({ row: target, pairing })}
                            />
                          </Can>
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
        <div className="fixed inset-x-4 bottom-6 z-30 mx-auto flex min-h-14 w-fit flex-wrap items-center gap-3 py-2 sm:inset-x-0 sm:h-14 sm:min-w-bulk-bar sm:flex-nowrap sm:py-0 rounded-lg bg-bg-inverse px-4 shadow-pop">
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
      {coDriverVehicle?.driver && (
        <AssignCoDriverModal
          vehicle={coDriverVehicle}
          primaryDriver={coDriverVehicle.driver}
          onClose={() => setCoDriverVehicle(null)}
        />
      )}
      <EndCoDriverPairingDialog
        open={Boolean(endPairingTarget)}
        pairing={endPairingTarget?.pairing ?? null}
        coDriverName={endPairingCoDriver ? `${endPairingCoDriver.firstName} ${endPairingCoDriver.lastName}` : null}
        unitNumber={endPairingTarget?.row.unitNumber ?? ''}
        onClose={() => setEndPairingTarget(null)}
      />
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
