// owner: web-settings-admin — W-20 Settings · ELD devices (web/tz.md §10 W-20).
// Design: web/roles and screens/admin panel/Settings — ELD devices, firmware, heartbeats.jpg
import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Search, Download, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { KpiCard } from '@/shared/ui/KpiCard';
import { DataTable } from '@/shared/ui/DataTable';
import { Pagination } from '@/shared/ui/Pagination';
import { Card } from '@/shared/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';
import { searchEmptyState } from '@/shared/ui/copy';
import { formatRelative } from '@/shared/format/relative';
import { orDash, orNotAssigned } from '@/shared/format/empty';
import { client } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { useVehiclesPicker } from '@/shared/api/vehicles';
import {
  useDevicesList,
  useUnpairDevice,
  useRemoveDevice,
  type DeviceRow,
  type DeviceStatus,
  type BleState,
} from '@/shared/api/settingsAdmin';
import { RegisterDeviceModal } from './components/RegisterDeviceModal';

type Segment = 'ALL' | 'CONNECTED' | 'DISCONNECTED' | 'UNASSIGNED';

const BLE_TONE: Record<BleState, 'success' | 'warning' | 'neutral'> = {
  CONNECTED: 'success',
  OUT_OF_RANGE: 'warning',
  DISCONNECTED: 'neutral',
};
const BLE_LABEL: Record<BleState, string> = {
  CONNECTED: 'Connected',
  OUT_OF_RANGE: 'Out of range',
  DISCONNECTED: 'Disconnected',
};

export default function DevicesPage() {
  const { can } = usePermission();
  const canFull = can('devices', 'FULL');
  const [segment, setSegment] = useState<Segment>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [registerOpen, setRegisterOpen] = useState(false);

  const statusFilter: DeviceStatus | undefined = segment === 'UNASSIGNED' ? 'UNASSIGNED' : undefined;
  // A new search term or segment re-pages the list from the start, and the page is clamped to the
  // narrowed result — `GET /devices?page=3` for a 1-page result answers an empty page, which this
  // screen renders as "No results for …" / "No devices registered yet" although matches exist.
  // Adjusted during render, not in an effect (react.dev "you might not need an effect").
  const listKey = JSON.stringify([search, segment]);
  const [prevListKey, setPrevListKey] = useState(listKey);
  const requestedPage = listKey === prevListKey ? page : 1;
  if (listKey !== prevListKey) setPrevListKey(listKey);
  const devicesQuery = useDevicesList({ page: requestedPage, limit, q: search || undefined, status: statusFilter });
  const totalPages = devicesQuery.data?.totalPages ?? 1;
  const currentPage = devicesQuery.isLoading ? requestedPage : Math.min(requestedPage, Math.max(1, totalPages));
  if (currentPage !== page) setPage(currentPage);
  const unpairDevice = useUnpairDevice();
  const removeDevice = useRemoveDevice();

  // WB-041 — the UNIT column must show the unit number (`#101`), not the raw vehicle UUID.
  // Mirrors `joinVehicles` in shared/api/vehicles.ts (id -> unitNumber), sharing its
  // `reference`-cached picker query rather than duplicating the fetch.
  const vehiclesQuery = useVehiclesPicker();
  const unitNumberByVehicleId = useMemo(
    () => new Map((vehiclesQuery.data?.items ?? []).map((v) => [v.id, v.unitNumber])),
    [vehiclesQuery.data],
  );

  const rows = useMemo(() => devicesQuery.data?.items ?? [], [devicesQuery.data]);

  const connected = rows.filter((d) => d.bleState === 'CONNECTED').length;
  const disconnected = rows.filter((d) => d.bleState === 'DISCONNECTED').length;
  const outdated = rows.filter((d) => d.firmwareOutdated).length;
  const total = devicesQuery.data?.total ?? rows.length;

  const filteredBySegment = useMemo(() => {
    if (segment === 'CONNECTED') return rows.filter((d) => d.bleState === 'CONNECTED');
    if (segment === 'DISCONNECTED') return rows.filter((d) => d.bleState === 'DISCONNECTED');
    return rows;
  }, [rows, segment]);

  async function handleExport() {
    const data = await client.get(endpoints.devices.export);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'devices-export.json';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const columns: ColumnDef<DeviceRow, unknown>[] = [
    { accessorKey: 'serial', header: 'SERIAL', cell: ({ row }) => <span className="text-body-strong text-text">{row.original.serial}</span> },
    { accessorKey: 'model', header: 'MODEL', cell: ({ row }) => <span className="text-text">{row.original.model === 'PT30' ? 'Pacific Track' : 'Pacific Track'}</span> },
    {
      id: 'firmware',
      header: 'FIRMWARE',
      cell: ({ row }) => (
        <span className={row.original.firmwareOutdated ? 'text-warning' : 'text-text'}>{row.original.firmwareVersion ?? '—'}</span>
      ),
    },
    {
      id: 'unit',
      header: 'UNIT',
      cell: ({ row }) => {
        // `unitNumber` already carries its own leading `#` (e.g. `#101`) — see VehiclesPage.
        const unitNumber = row.original.vehicleId ? unitNumberByVehicleId.get(row.original.vehicleId) : null;
        return <span className="text-text">{orDash(unitNumber, (n) => n)}</span>;
      },
    },
    {
      id: 'driver',
      header: 'DRIVER',
      cell: () => <span className="text-text-muted">Unassigned</span>,
    },
    {
      id: 'lastSync',
      header: 'LAST SYNC',
      cell: ({ row }) => <span className="tabular-nums text-text-secondary">{orNotAssigned(row.original.lastHeartbeatAt ? formatRelative(row.original.lastHeartbeatAt) : null)}</span>,
    },
    {
      id: 'bleState',
      header: 'BLE STATE',
      cell: ({ row }) => <Badge tone={BLE_TONE[row.original.bleState]}>{BLE_LABEL[row.original.bleState]}</Badge>,
    },
    {
      id: 'queued',
      header: 'QUEUED',
      meta: { numeric: true },
      cell: ({ row }) => {
        const queued = row.original.storedEventsCount;
        if (row.original.vehicleId === null) return <span className="text-right text-text-muted">—</span>;
        return (
          <span className={`block text-right tabular-nums ${(queued ?? 0) > 100 ? 'text-danger' : 'text-text'}`}>{queued ?? 0}</span>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title text-text">Settings · ELD devices</h1>
          <p className="text-page-sub text-text-muted">
            {total} registered · {connected} connected · {disconnected} disconnected
          </p>
        </div>
        <Can perm="devices" level="FULL">
          <Button variant="primary" iconLeft={<Plus size={16} strokeWidth={1.75} />} onClick={() => setRegisterOpen(true)}>
            Register device
          </Button>
        </Can>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Connected now" value={connected} chip={{ text: total ? `${Math.round((connected / total) * 100)}%` : '0%', tone: 'success' }} icon={Wifi} iconTone="success" />
        <KpiCard label="Disconnected > 24 h" value={disconnected} chip={{ text: 'needs action', tone: 'danger' }} icon={WifiOff} iconTone="danger" />
        <KpiCard label="Firmware out of date" value={outdated} chip={{ text: 'L113 available', tone: 'info' }} icon={RefreshCw} iconTone="info" />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex h-9 w-fit overflow-hidden rounded-md border border-border">
          {(
            [
              ['ALL', `All ${total}`],
              ['CONNECTED', `Connected ${connected}`],
              ['DISCONNECTED', `Disconnected ${disconnected}`],
              ['UNASSIGNED', 'Unassigned'],
            ] as [Segment, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={segment === value}
              onClick={() => setSegment(value)}
              className={segment === value ? 'bg-bg-inverse px-3 text-body-strong text-text-inverse' : 'bg-bg-surface px-3 text-body text-text-secondary hover:bg-bg-subtle'}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-input items-center gap-2 rounded-md border border-border bg-bg-surface px-3">
            <Search size={16} strokeWidth={1.75} className="text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search serial or unit…"
              className="w-56 bg-transparent text-body outline-none"
            />
          </div>
          <Button variant="secondary" iconLeft={<Download size={16} strokeWidth={1.75} />} onClick={handleExport}>
            Export
          </Button>
        </div>
      </div>

      <Card padded={false}>
        {devicesQuery.isLoading ? (
          <LoadingState className="p-4" />
        ) : devicesQuery.isError ? (
          <ErrorState onRetry={() => devicesQuery.refetch()} />
        ) : filteredBySegment.length === 0 ? (
          search ? (
            <EmptyState {...searchEmptyState(search)} actions={[{ label: 'Clear search', onClick: () => setSearch('') }]} />
          ) : (
            <EmptyState title="No devices registered yet" description="Register a Pacific Track PT30/PT40 to start recording hours of service." />
          )
        ) : (
          <>
            <DataTable
              data={filteredBySegment}
              columns={columns}
              caption="ELD devices"
              getRowId={(r) => r.id}
              rowActions={
                canFull
                  ? (row) => (
                      <>
                        <DropdownMenu.Item className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
                          Pair to unit
                        </DropdownMenu.Item>
                        {row.vehicleId && (
                          <DropdownMenu.Item
                            onSelect={() => unpairDevice.mutate(row.id)}
                            className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle"
                          >
                            Unpair
                          </DropdownMenu.Item>
                        )}
                        <DropdownMenu.Item className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
                          Update firmware
                        </DropdownMenu.Item>
                        {/* ⛔ GAP B-8 — `View diagnostics` needs `GET /devices/:id/diagnostics`,
                            which does not exist on the live API; omitted here rather than shown
                            disabled. */}
                        <DropdownMenu.Separator className="my-1 h-px bg-border" />
                        <DropdownMenu.Item
                          onSelect={() => removeDevice.mutate(row.id)}
                          className="cursor-pointer rounded-md px-2 py-1.5 text-body text-danger outline-none hover:bg-danger-soft"
                        >
                          Retire device
                        </DropdownMenu.Item>
                      </>
                    )
                  : undefined
              }
            />
            <Pagination
              page={currentPage}
              limit={limit}
              total={devicesQuery.data?.total ?? 0}
              totalPages={totalPages}
              itemLabel="devices"
              onPageChange={setPage}
              onLimitChange={(l) => {
                setLimit(l);
                setPage(1);
              }}
            />
          </>
        )}
      </Card>

      {registerOpen && <RegisterDeviceModal onClose={() => setRegisterOpen(false)} />}
    </div>
  );
}
