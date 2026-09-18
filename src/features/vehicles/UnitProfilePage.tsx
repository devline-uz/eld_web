// owner: web-vehicles-drivers — W-04 Unit profile (web/tz.md §10 W-04).
// Design: web/roles and screens/admin panel/Unit profile — telemetry, details, activity log.jpg
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, MoreHorizontal, Pencil, Truck, UserPlus, Wrench } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import { useDynamicSubtitle } from '@/app/layouts/Topbar';
import { useRoom } from '@/shared/realtime/useRoom';
import {
  useVehicle,
  useVehicleAssignedDriver,
  useVehicleDevice,
  useVehicleDtc,
  useVehicleActivities,
  totalVehicleMiles,
} from '@/shared/api/vehicles';
import { qk } from '@/shared/api/queryKeys';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { ErrorState, LoadingState, ForbiddenState } from '@/shared/ui/states';
import { formatOdometer, formatEngineHoursLong } from '@/shared/format/numbers';
import { formatLocal } from '@/shared/format/datetime';
import { useRelativeTime } from '@/shared/format/useRelativeTime';
import { AddVehicleModal } from './components/AddVehicleModal';
import { AssignDriverModal } from './components/AssignDriverModal';
import { CalibrateOdometerModal } from './components/CalibrateOdometerModal';
import { DeleteUnitModal } from './components/DeleteUnitModal';

const TABS = ['overview', 'diagnostics', 'trips', 'dvir', 'documents', 'activity'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  overview: 'Overview',
  diagnostics: 'Diagnostics',
  trips: 'Trips',
  dvir: 'DVIR',
  documents: 'Documents',
  activity: 'Activity',
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 last:border-b-0">
      <span className="shrink-0 text-body text-text-muted">{label}</span>
      <span className="min-w-0 break-words text-right text-body-strong text-text">{value}</span>
    </div>
  );
}

function TelemetryCell({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border p-3">
      <span className="text-caption text-text-muted">{label}</span>
      <span className={`text-card-title font-semibold tabular-nums ${danger ? 'text-danger' : 'text-text'}`}>{value}</span>
    </div>
  );
}

export default function UnitProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = usePermission();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'overview';

  const vehicleQuery = useVehicle(id);
  const driverQuery = useVehicleAssignedDriver(id);
  const deviceQuery = useVehicleDevice(id);
  const dtcQuery = useVehicleDtc(tab === 'diagnostics' ? id : undefined);
  const activitiesQuery = useVehicleActivities(tab === 'overview' || tab === 'activity' ? id : undefined);

  useDynamicSubtitle(vehicleQuery.data ? `Vehicles › Unit ${vehicleQuery.data.unitNumber}` : null);

  useRoom(id ? `vehicle:${id}` : null, {
    'telemetry.point': () => void queryClient.invalidateQueries({ queryKey: qk.vehicle(id ?? '') }),
    'device.ble_state': () => void queryClient.invalidateQueries({ queryKey: qk.vehicleDevice(id ?? '') }),
    'eld.events_ingested': () => void queryClient.invalidateQueries({ queryKey: qk.vehicleActivities(id ?? '') }),
  });

  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [calibrateOpen, setCalibrateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const updatedAgo = useRelativeTime(vehicleQuery.dataUpdatedAt ? new Date(vehicleQuery.dataUpdatedAt).toISOString() : null, 'short');

  if (!can('vehicles')) return <ForbiddenState screenName="Unit profile" />;
  if (vehicleQuery.isLoading) return <LoadingState rows={8} />;
  if (vehicleQuery.isError || !vehicleQuery.data) return <ErrorState onRetry={() => vehicleQuery.refetch()} />;

  const vehicle = vehicleQuery.data;
  const driver = driverQuery.data;
  const device = deviceQuery.data;
  const activeDtcCount = dtcQuery.data?.items.filter((d) => !d.clearedAt).length ?? 0;
  const total = totalVehicleMiles(vehicle);

  function setTab(next: Tab) {
    const nextParams = new URLSearchParams(params);
    nextParams.set('tab', next);
    setParams(nextParams, { replace: true });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 text-caption text-text-muted">
        <Link to="/vehicles" className="hover:text-text">
          Vehicles
        </Link>
        <ChevronRight size={12} strokeWidth={1.75} />
        <span>
          Unit {vehicle.unitNumber} · {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ')}
        </span>
      </div>

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Truck size={24} strokeWidth={1.75} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-page-title text-text">Unit {vehicle.unitNumber}</h1>
                {vehicle.status === 'OUT_OF_SERVICE' && <Badge tone="danger" dot>Out of service</Badge>}
                {device?.bleState === 'CONNECTED' && <Badge tone="info" dot>BLE connected</Badge>}
                {activeDtcCount > 0 && <Badge tone="warning" dot>{activeDtcCount} active DTCs</Badge>}
              </div>
              <p className="mt-1 text-body text-text-muted">
                {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ')} · VIN {vehicle.vin}
                {vehicle.licensePlate ? ` · Plate ${vehicle.plateState ?? ''} ${vehicle.licensePlate}` : ''} · {vehicle.fuelType}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="secondary" onClick={() => navigate(`/hos-logs?driverId=${driver?.id ?? ''}`)}>
              View logs
            </Button>
            <Button variant="secondary" onClick={() => navigate('/live-fleet')}>
              Track on map
            </Button>
            <Can perm="vehicles" level="FULL">
              {/* WB-104 — never disable this silently: an OUT_OF_SERVICE unit still opens
                  `AssignDriverModal`, which states the CRITICAL-defect refusal verbatim (§4),
                  exactly like the row action on the Vehicles table. */}
              <Button variant="primary" iconLeft={<UserPlus size={16} strokeWidth={1.75} />} onClick={() => setAssignOpen(true)}>
                Assign driver
              </Button>
            </Can>
            <Can perm="vehicles" level="FULL">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button variant="secondary" iconOnly aria-label="More">
                    <MoreHorizontal size={16} strokeWidth={1.75} />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content align="end" className="z-50 min-w-40 rounded-md border border-border bg-bg-surface p-1 shadow-pop">
                    <DropdownMenu.Item onSelect={() => setEditOpen(true)} className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
                      Edit unit
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onSelect={() => setDeleteOpen(true)} className="cursor-pointer rounded-md px-2 py-1.5 text-body text-danger outline-none hover:bg-danger-soft">
                      Delete unit
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </Can>
          </div>
        </div>
      </Card>

      <div className="flex h-9 w-fit overflow-hidden rounded-md border border-border">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            disabled={t === 'documents'}
            onClick={() => setTab(t)}
            className={
              tab === t
                ? 'bg-bg-inverse px-3 text-body-strong text-text-inverse'
                : t === 'documents'
                  ? 'cursor-not-allowed bg-bg-surface px-3 text-body text-text-muted'
                  : 'bg-bg-surface px-3 text-body text-text-secondary hover:bg-bg-subtle'
            }
          >
            {TAB_LABEL[t]}
            {t === 'documents' && <Badge tone="neutral" className="ml-1.5">Soon</Badge>}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-[1fr_348px] gap-4">
          <div className="flex flex-col gap-4">
            <Card>
              <SectionHeader
                title="Live status"
                subtitle={vehicleQuery.dataUpdatedAt ? `Updated ${updatedAgo}` : undefined}
                action={
                  <Can perm="vehicles" level="FULL">
                    <Button variant="secondary" size="sm" onClick={() => setCalibrateOpen(true)}>
                      Calibrate odometer
                    </Button>
                  </Can>
                }
              />
              {/* ⛔ GAP — no `GET /vehicles/:id/telemetry` read; live cells fall back to the last
                  odometer/engine-hours known from the vehicle row itself. */}
              <div className="mt-4 grid grid-cols-4 gap-3">
                <TelemetryCell label="Odometer" value={`${formatOdometer(total)} mi`} />
                <TelemetryCell label="Engine hours" value={formatEngineHoursLong(Number(vehicle.engineHours))} />
                <TelemetryCell label="Fuel level" value="—" />
                <TelemetryCell label="Coolant temp" value="—" />
                <TelemetryCell label="Oil level" value="—" />
                <TelemetryCell label="Battery" value="—" />
                <TelemetryCell label="DEF level" value="—" />
                <TelemetryCell label="Bus type" value={vehicle.busType ?? '—'} />
              </div>
              <p className="mt-2 text-caption text-text-muted">
                ECU {vehicle.deviceOdometerMi != null ? formatOdometer(vehicle.deviceOdometerMi) : '—'} + offset{' '}
                {vehicle.odometerOffsetMi >= 0 ? '+' : ''}
                {formatOdometer(vehicle.odometerOffsetMi)}
              </p>
            </Card>

            <Card>
              <SectionHeader
                title="Upcoming maintenance"
                action={
                  <Can perm="maintenance" level="FULL">
                    <Button variant="secondary" size="sm" iconLeft={<Wrench size={14} strokeWidth={1.75} />}>
                      New work order
                    </Button>
                  </Can>
                }
              />
              {/* This card reads GET /maintenance-schedules?vehicleId= — owned by features/dvir. */}
              <p className="mt-3 text-body text-text-muted">No services scheduled.</p>
            </Card>

            <Card padded={false}>
              <div className="p-card pb-0">
                <SectionHeader title="Unit activity" subtitle="Last 30 days" />
              </div>
              {activitiesQuery.isLoading ? (
                <LoadingState className="p-4" />
              ) : activitiesQuery.isError ? (
                <ErrorState onRetry={() => activitiesQuery.refetch()} />
              ) : (activitiesQuery.data?.items.length ?? 0) === 0 ? (
                <p className="p-4 text-body text-text-muted">No activity recorded.</p>
              ) : (
                <table className="w-full text-body">
                  <thead>
                    <tr className="border-t border-border text-table-head text-text-muted">
                      <th className="p-3 text-left font-semibold">TIME STAMP</th>
                      <th className="p-3 text-left font-semibold">ACTIVITY</th>
                      <th className="p-3 text-left font-semibold">DRIVER</th>
                      <th className="p-3 text-left font-semibold">SOURCE</th>
                      <th className="p-3 text-left font-semibold">DETAILS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activitiesQuery.data?.items.map((a) => (
                      <tr key={a.id} className="border-t border-border">
                        <td className="p-3 tabular-nums">{formatLocal(a.occurredAt, 'dateTime')}</td>
                        <td className="p-3">{a.activity}</td>
                        <td className="p-3">{a.driverName ?? '—'}</td>
                        <td className={`p-3 ${a.source.startsWith('ELD') ? 'text-text-muted' : 'text-text'}`}>{a.source}</td>
                        <td className="p-3 text-text-secondary">{a.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>

          <Card>
            <SectionHeader
              title="Unit details"
              action={
                <Can perm="vehicles" level="FULL">
                  <Button variant="ghost" size="sm" iconLeft={<Pencil size={14} strokeWidth={1.75} />} onClick={() => setEditOpen(true)}>
                    Edit
                  </Button>
                </Can>
              }
            />
            <div className="mt-2">
              <DetailRow label="Unit number" value={vehicle.unitNumber} />
              <DetailRow label="ELD device" value={device?.serial ?? 'Not assigned'} />
              <DetailRow label="Activated on" value={vehicle.activatedAt ? formatLocal(vehicle.activatedAt, 'shortDate') : '—'} />
              <DetailRow label="VIN" value={vehicle.vin} />
              <DetailRow label="Make / model" value={[vehicle.make, vehicle.model].filter(Boolean).join(' ') || '—'} />
              <DetailRow label="Year" value={vehicle.year ?? '—'} />
              <DetailRow label="License plate" value={vehicle.licensePlate ?? '—'} />
              <DetailRow label="Issuing state" value={vehicle.plateState ?? '—'} />
              <DetailRow label="Fuel type" value={vehicle.fuelType} />
              <DetailRow label="Sleeper berth" value={vehicle.sleeperBerth ? 'Available' : 'Not available'} />
              <DetailRow label="Primary driver" value={driver ? `${driver.firstName} ${driver.lastName}` : 'Unassigned'} />
              {/* ⛔ GAP B-7 — no /co-driver-pairings endpoint; always "—" until it lands. */}
              <DetailRow label="Co-driver" value="—" />
            </div>
          </Card>
        </div>
      )}

      {tab === 'diagnostics' && (
        <Card padded={false}>
          <div className="p-card pb-0">
            <SectionHeader title="Diagnostic trouble codes" />
          </div>
          {dtcQuery.isLoading ? (
            <LoadingState className="p-4" />
          ) : dtcQuery.isError ? (
            <ErrorState onRetry={() => dtcQuery.refetch()} />
          ) : (dtcQuery.data?.items.length ?? 0) === 0 ? (
            <p className="p-4 text-body text-text-muted">No diagnostic trouble codes reported.</p>
          ) : (
            <table className="w-full text-body">
              <thead>
                <tr className="border-t border-border text-table-head text-text-muted">
                  <th className="p-3 text-left font-semibold">SPN</th>
                  <th className="p-3 text-left font-semibold">FMI</th>
                  <th className="p-3 text-left font-semibold">DESCRIPTION</th>
                  <th className="p-3 text-left font-semibold">SOURCE</th>
                  <th className="p-3 text-left font-semibold">OCCURRENCES</th>
                  <th className="p-3 text-left font-semibold">FIRST SEEN</th>
                  <th className="p-3 text-left font-semibold">LAST SEEN</th>
                  <th className="p-3 text-left font-semibold">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {dtcQuery.data?.items.map((d) => (
                  <tr key={d.id} className="border-t border-border">
                    <td className="p-3 tabular-nums">{d.spn}</td>
                    <td className="p-3 tabular-nums">{d.fmi}</td>
                    <td className="p-3">{d.description ?? '—'}</td>
                    <td className="p-3">{d.source}</td>
                    <td className="p-3 tabular-nums">{d.occurrence}</td>
                    <td className="p-3 tabular-nums">{formatLocal(d.firstSeenAt, 'dateTime')}</td>
                    <td className="p-3 tabular-nums">{formatLocal(d.lastSeenAt, 'dateTime')}</td>
                    <td className="p-3">
                      {d.clearedAt ? <Badge tone="success">Cleared</Badge> : <Badge tone="warning">Active</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'trips' && (
        <Card>
          <p className="text-body text-text-muted">
            Trip history for this unit lives on{' '}
            <Link to={`/trips?vehicleId=${vehicle.id}`} className="text-primary">
              Dispatch &amp; Trips
            </Link>
            .
          </p>
        </Card>
      )}

      {tab === 'dvir' && (
        <Card>
          <p className="text-body text-text-muted">
            DVIR history for this unit lives on{' '}
            <Link to={`/dvir?vehicleId=${vehicle.id}`} className="text-primary">
              DVIR &amp; Maintenance
            </Link>
            .
          </p>
        </Card>
      )}

      {tab === 'activity' && (
        <Card padded={false}>
          <div className="p-card pb-0">
            <SectionHeader title="Unit activity" subtitle="Full history" />
          </div>
          {activitiesQuery.isLoading ? (
            <LoadingState className="p-4" />
          ) : (activitiesQuery.data?.items.length ?? 0) === 0 ? (
            <p className="p-4 text-body text-text-muted">No activity recorded.</p>
          ) : (
            <ul className="divide-y divide-border">
              {activitiesQuery.data?.items.map((a) => (
                <li key={a.id} className="flex flex-col gap-0.5 p-3">
                  <span className="tabular-nums text-caption text-text-muted">{formatLocal(a.occurredAt, 'dateTime')}</span>
                  <span className="text-body text-text">{a.activity}</span>
                  <span className="text-caption text-text-muted">
                    {a.driverName ?? '—'} · {a.source} · {a.details}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {editOpen && <AddVehicleModal vehicle={vehicle} onClose={() => setEditOpen(false)} />}
      {assignOpen && <AssignDriverModal vehicle={vehicle} onClose={() => setAssignOpen(false)} />}
      {calibrateOpen && <CalibrateOdometerModal vehicle={vehicle} onClose={() => setCalibrateOpen(false)} />}
      {deleteOpen && (
        <DeleteUnitModal
          vehicle={vehicle}
          eldSerial={device?.serial ?? null}
          onClose={() => {
            setDeleteOpen(false);
            navigate('/vehicles');
          }}
        />
      )}
    </div>
  );
}
