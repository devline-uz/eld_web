// owner: web-vehicles-drivers — W-04 Unit profile (web/tz.md §10 W-04).
// Design: web/roles and screens/admin panel/Unit profile — telemetry, details, activity log.jpg
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { liveFleetHref } from '@/shared/lib/liveFleetHref';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, MoreHorizontal, Pencil, Truck, UserPlus, Wrench } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import { usePageHeader } from '@/app/layouts/Topbar';
import { useRoom } from '@/shared/realtime/useRoom';
import {
  useVehicle,
  useVehicleAssignedDriver,
  useDevicesForVehicle,
  useVehicleDtc,
  useVehicleActivities,
  useVehicleTelemetry,
  useCoDriverPairings,
  totalVehicleMiles,
  TELEMETRY_FRESH_MS,
  deviceConnection,
} from '@/shared/api/vehicles';
import { useDriversLookup } from '@/shared/api/lookups';
import { qk, qkRoot } from '@/shared/api/queryKeys';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { ErrorState, LoadingState, ForbiddenState, NotFoundState } from '@/shared/ui/states';
import { isNotFoundError, validRouteId } from '@/shared/lib/routeIds';
import { formatOdometer, formatEngineHoursLong } from '@/shared/format/numbers';
import { formatCarrier, formatCarrierDateTime, timezoneAbbreviation } from '@/shared/format/datetime';
import { useCarrierTimezone } from '@/shared/auth/useCarrierTimezone';
import { useNowTick, useRelativeTime } from '@/shared/format/useRelativeTime';
import { NO_DRIVER_LOGS_REASON } from './lib/copy';
import { AddVehicleModal } from './components/AddVehicleModal';
import { AssignDriverModal } from './components/AssignDriverModal';
import { AssignCoDriverModal } from './components/AssignCoDriverModal';
import { EndCoDriverPairingDialog } from './components/EndCoDriverPairingDialog';
import { CalibrateOdometerModal } from './components/CalibrateOdometerModal';
import { DeleteUnitModal } from './components/DeleteUnitModal';
import { activityDetails, activityLabel, activitySource, fuelLabel } from './lib/activity';

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

/** The later of two optional ISO instants (null when neither parses). */
function latestOf(a: string | null | undefined, b: string | null | undefined): string | null {
  const ta = a ? Date.parse(a) : NaN;
  const tb = b ? Date.parse(b) : NaN;
  if (Number.isNaN(ta)) return Number.isNaN(tb) ? null : (b as string);
  if (Number.isNaN(tb)) return a as string;
  return ta >= tb ? (a as string) : (b as string);
}

export default function UnitProfilePage() {
  // LIVE-007 — company context: carrier zone, the same instant as on the DVIR, reports and audit pages.
  const carrierTz = useCarrierTimezone();
  const { id: routeId } = useParams<{ id: string }>();
  // LIVE-019 — a malformed id never reaches the API (every query below stays disabled).
  const id = validRouteId(routeId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = usePermission();
  const [params, setParams] = useSearchParams();
  // CODE-085 — the DTC list (`GET /vehicles/:id/dtc`) needs `maintenance` READ, which DISPATCHER no
  // longer has: the tab is hidden and a deep link to it falls back to the overview.
  const canDiagnostics = can('maintenance');
  const visibleTabs = TABS.filter((t) => t !== 'diagnostics' || canDiagnostics);
  const requestedTab = params.get('tab') as Tab | null;
  const tab: Tab = requestedTab && visibleTabs.includes(requestedTab) ? requestedTab : 'overview';

  const vehicleQuery = useVehicle(id);
  const driverQuery = useVehicleAssignedDriver(id);
  // CODE-085 — `/devices` needs `devices` READ; without it only the serial on the vehicle row shows.
  const deviceQuery = useDevicesForVehicle(id, can('devices'));
  const dtcQuery = useVehicleDtc(tab === 'diagnostics' && canDiagnostics ? id : undefined);
  const activitiesQuery = useVehicleActivities(tab === 'overview' || tab === 'activity' ? id : undefined);
  const telemetryQuery = useVehicleTelemetry(tab === 'overview' ? id : undefined, { limit: 1 });
  const coDriverQuery = useCoDriverPairings({ vehicleId: id, active: true, limit: 1 }, Boolean(id));
  const driversLookupQuery = useDriversLookup(Boolean(coDriverQuery.data?.items.length));

  // Design: the top bar carries `Unit …` and the `Vehicles › …` breadcrumb (the only breadcrumb
  // on the page); the unit card below repeats the unit number as its own heading.
  const headerVehicle = vehicleQuery.data;
  const breadcrumb = useMemo(
    () =>
      headerVehicle ? (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1">
          <Link to="/vehicles" className="hover:text-text">
            Vehicles
          </Link>
          <ChevronRight size={12} strokeWidth={1.75} aria-hidden="true" />
          <span className="truncate">
            Unit {headerVehicle.unitNumber} ·{' '}
            {[headerVehicle.make, headerVehicle.model, headerVehicle.year].filter(Boolean).join(' ')}
          </span>
        </nav>
      ) : null,
    [headerVehicle],
  );
  usePageHeader({ title: headerVehicle ? `Unit ${headerVehicle.unitNumber}` : null, subtitle: breadcrumb });

  useRoom(id ? `vehicle:${id}` : null, {
    // `vehicleTelemetry` nests under `['vehicles', id, ...]`, so invalidating the vehicle root covers it.
    'telemetry.point': () => void queryClient.invalidateQueries({ queryKey: qk.vehicle(id ?? '') }),
    'device.ble_state': () => void queryClient.invalidateQueries({ queryKey: qkRoot.devices }),
    'eld.events_ingested': () => void queryClient.invalidateQueries({ queryKey: qk.vehicleActivities(id ?? '') }),
  });

  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [calibrateOpen, setCalibrateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [assignCoDriverOpen, setAssignCoDriverOpen] = useState(false);
  const [endPairingOpen, setEndPairingOpen] = useState(false);

  // UI-003 — "Updated …" is when the unit last said something (newest telemetry point, else the
  // ELD's last contact), never when the browser last refetched the vehicle record.
  const latestTelemetry = telemetryQuery.data?.items[0] ?? null;
  const pairedDevice = deviceQuery.data?.items[0] ?? null;
  const lastSignalAt = latestOf(latestTelemetry?.time, pairedDevice?.lastSeenAt ?? pairedDevice?.lastHeartbeatAt);
  const updatedAgo = useRelativeTime(lastSignalAt, 'short');
  const now = useNowTick();

  if (!can('vehicles')) return <ForbiddenState screenName="Unit profile" />;
  if (!id || isNotFoundError(vehicleQuery.error)) {
    return <NotFoundState title="Unit not found" backLabel="Back to vehicles" onBack={() => navigate('/vehicles')} />;
  }
  if (vehicleQuery.isLoading) return <LoadingState rows={8} />;
  // F3-03 — a failed background refetch keeps the loaded unit on screen.
  if (!vehicleQuery.data) {
    return <ErrorState title="Could not load this unit" onRetry={() => vehicleQuery.refetch()} />;
  }

  const vehicle = vehicleQuery.data;
  const driver = driverQuery.data;
  const device = deviceQuery.data?.items[0] ?? null;
  const activeDtcCount = dtcQuery.data?.items.filter((d) => !d.clearedAt).length ?? 0;
  const total = totalVehicleMiles(vehicle);
  const telemetry = telemetryQuery.data?.items[0] ?? null;
  const coDriverPairing = coDriverQuery.data?.items[0] ?? null;
  const coDriver = coDriverPairing
    ? (driversLookupQuery.data?.items.find((d) => d.id === coDriverPairing.coDriverId) ?? null)
    : null;
  const coDriverName = coDriver ? `${coDriver.firstName} ${coDriver.lastName}` : null;
  const num = (v: number | string | null | undefined) => (v == null ? null : typeof v === 'string' ? Number(v) : v);
  // LIVE-008 — the ECU's engine hours from the newest telemetry point; `Vehicle.engineHours` is a
  // manual field ingest never fills, so it is only a fallback when it was actually set.
  const storedEngineHours = num(vehicle.engineHours);
  const engineHours = num(telemetry?.engineHours) ?? (storedEngineHours ? storedEngineHours : null);

  function setTab(next: Tab) {
    const nextParams = new URLSearchParams(params);
    nextParams.set('tab', next);
    setParams(nextParams, { replace: true });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Truck size={24} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-page-title text-text">Unit {vehicle.unitNumber}</h2>
                {vehicle.status === 'OUT_OF_SERVICE' && <Badge tone="danger" dot>Out of service</Badge>}
                {/* UI-003 — the EFFECTIVE link (`connection`: stored CONNECTED and heard from within
                    30 min), not the raw `bleState` a silent box keeps reporting. */}
                {device && deviceConnection(device) === 'CONNECTED' && <Badge tone="info" dot>BLE connected</Badge>}
                {activeDtcCount > 0 && <Badge tone="warning" dot>{activeDtcCount} active DTCs</Badge>}
              </div>
              <p className="mt-1 break-words text-body text-text-muted">
                {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ')} · VIN {vehicle.vin}
                {vehicle.licensePlate ? ` · Plate ${vehicle.plateState ?? ''} ${vehicle.licensePlate}` : ''} · {fuelLabel(vehicle.fuelType)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
            {/* An unassigned unit used to navigate to `?driverId=` — a driver id W-06 cannot
                resolve. It now says why there is nothing to open. */}
            <Button
              variant="secondary"
              disabled={!driver}
              title={driver ? undefined : NO_DRIVER_LOGS_REASON}
              onClick={() => driver && navigate(`/hos-logs?driverId=${driver.id}`)}
            >
              View logs
            </Button>
            <Button variant="secondary" onClick={() => navigate(liveFleetHref(vehicle.id))}>
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

      <div className="flex h-9 w-fit max-w-full overflow-x-auto rounded-md border border-border">
        {visibleTabs.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            disabled={t === 'documents'}
            onClick={() => setTab(t)}
            className={
              tab === t
                ? 'shrink-0 whitespace-nowrap bg-bg-inverse px-3 text-body-strong text-text-inverse'
                : t === 'documents'
                  ? 'shrink-0 cursor-not-allowed whitespace-nowrap bg-bg-surface px-3 text-body text-text-muted'
                  : 'shrink-0 whitespace-nowrap bg-bg-surface px-3 text-body text-text-secondary hover:bg-bg-subtle'
            }
          >
            {TAB_LABEL[t]}
            {t === 'documents' && <Badge tone="neutral" className="ml-1.5">Soon</Badge>}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_348px] gap-4">
          <div className="flex flex-col gap-4">
            <Card>
              <SectionHeader
                title="Live status"
                subtitle={lastSignalAt ? `Updated ${updatedAgo}` : undefined}
                action={
                  <div className="flex items-center gap-2">
                    {/* UI-003 — a speed older than 30 min is not the truck's speed now. */}
                    {telemetry?.speedMph != null && now - Date.parse(telemetry.time) <= TELEMETRY_FRESH_MS && (
                      <Badge tone={telemetry.speedMph > 0 ? 'success' : 'neutral'} dot>
                        {Math.round(telemetry.speedMph)} mph
                      </Badge>
                    )}
                    <Can perm="vehicles" level="FULL">
                      <Button variant="secondary" size="sm" onClick={() => setCalibrateOpen(true)}>
                        Calibrate odometer
                      </Button>
                    </Can>
                  </div>
                }
              />
              {/* `GET /vehicles/:id/telemetry?limit=1` (Phase 13) — newest point for the live cells. */}
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <TelemetryCell label="Odometer" value={`${formatOdometer(total)} mi`} />
                <TelemetryCell label="Engine hours" value={engineHours != null ? formatEngineHoursLong(engineHours) : '—'} />
                <TelemetryCell label="Fuel level" value={telemetry?.fuelPct != null ? `${telemetry.fuelPct}%` : '—'} />
                <TelemetryCell
                  label="Coolant temp"
                  value={telemetry?.coolantTempC != null ? `${telemetry.coolantTempC} °C` : '—'}
                  danger={telemetry?.coolantTempC != null && telemetry.coolantTempC > 100}
                />
                <TelemetryCell label="Oil level" value="—" />
                <TelemetryCell label="Battery" value={num(telemetry?.voltage) != null ? `${num(telemetry?.voltage)} V` : '—'} />
                <TelemetryCell label="DEF level" value={telemetry?.defPct != null ? `${telemetry.defPct}%` : '—'} />
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
                    {/* 11.18 lives in `features/dvir`, which this feature may not import
                        (house rule: no cross-feature imports). W-09 opens the modal pre-filled
                        with this unit from `?newWorkOrder=<vehicleId>`. */}
                    <Button
                      variant="secondary"
                      size="sm"
                      iconLeft={<Wrench size={14} strokeWidth={1.75} />}
                      onClick={() => navigate(`/dvir?newWorkOrder=${vehicle.id}`)}
                    >
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
                <div className="overflow-x-auto">
                <table className="w-full text-body min-w-lg lg:min-w-0">
                  <thead>
                    <tr className="border-t border-border text-table-head text-text-muted">
                      <th className="p-3 text-left font-semibold">TIME STAMP ({timezoneAbbreviation(carrierTz)})</th>
                      <th className="p-3 text-left font-semibold">ACTIVITY</th>
                      <th className="p-3 text-left font-semibold">DRIVER</th>
                      <th className="p-3 text-left font-semibold">SOURCE</th>
                      <th className="p-3 text-left font-semibold">DETAILS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activitiesQuery.data?.items.map((a) => (
                      <tr key={a.id} className="border-t border-border">
                        <td className="p-3 tabular-nums">{formatCarrierDateTime(a.occurredAt, carrierTz)}</td>
                        <td className="p-3">{activityLabel(a.activity)}</td>
                        <td className="p-3">{a.driverName ?? '—'}</td>
                        <td className={`p-3 ${a.source.startsWith('ELD') ? 'text-text-muted' : 'text-text'}`}>{activitySource(a.source)}</td>
                        <td className="p-3 text-text-secondary">{activityDetails(a.details)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
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
              <DetailRow label="ELD device" value={device?.serial ?? vehicle.eldSerial ?? 'Not assigned'} />
              <DetailRow label="Activated on" value={vehicle.activatedAt ? formatCarrier(vehicle.activatedAt, carrierTz, 'shortDate') : '—'} />
              <DetailRow label="VIN" value={vehicle.vin} />
              <DetailRow label="Make / model" value={[vehicle.make, vehicle.model].filter(Boolean).join(' ') || '—'} />
              <DetailRow label="Year" value={vehicle.year ?? '—'} />
              <DetailRow label="License plate" value={vehicle.licensePlate ?? '—'} />
              <DetailRow label="Issuing state" value={vehicle.plateState ?? '—'} />
              <DetailRow label="Fuel type" value={fuelLabel(vehicle.fuelType)} />
              <DetailRow label="Sleeper berth" value={vehicle.sleeperBerth ? 'Available' : 'Not available'} />
              <DetailRow label="Primary driver" value={driver ? `${driver.firstName} ${driver.lastName}` : 'Unassigned'} />
              {/* B-7 — the active pairing (`GET /co-driver-pairings?vehicleId=&active=true`). Pairing
                  writes are `drivers` FULL; a co-driver needs a primary driver to pair with. */}
              <DetailRow
                label="Co-driver"
                value={
                  <span className="inline-flex flex-wrap items-center justify-end gap-2">
                    <span>{coDriverName ?? '—'}</span>
                    <Can perm="drivers" level="FULL">
                      {coDriverPairing ? (
                        <Button variant="ghost" size="sm" onClick={() => setEndPairingOpen(true)}>
                          End pairing
                        </Button>
                      ) : (
                        driver &&
                        coDriverQuery.isSuccess && (
                          <Button
                            variant="ghost"
                            size="sm"
                            iconLeft={<UserPlus size={14} strokeWidth={1.75} />}
                            onClick={() => setAssignCoDriverOpen(true)}
                          >
                            Assign co-driver
                          </Button>
                        )
                      )}
                    </Can>
                  </span>
                }
              />
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
            <div className="overflow-x-auto">
            <table className="w-full text-body min-w-lg lg:min-w-0">
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
                    <td className="p-3 tabular-nums">{formatCarrierDateTime(d.firstSeenAt, carrierTz)}</td>
                    <td className="p-3 tabular-nums">{formatCarrierDateTime(d.lastSeenAt, carrierTz)}</td>
                    <td className="p-3">
                      {d.clearedAt ? <Badge tone="success">Cleared</Badge> : <Badge tone="warning">Active</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'trips' && (
        <Card>
          <p className="text-body text-text-muted">
            Trip history for this unit lives on{' '}
            {/* F3-17 — Trips filters by unit on `fUnit`; `vehicleId` was ignored. */}
            <Link to={`/trips?fUnit=${encodeURIComponent(vehicle.id)}`} className="text-primary">
              Dispatch &amp; Trips
            </Link>
            .
          </p>
        </Card>
      )}

      {tab === 'dvir' && (
        <Card>
          {can('dvir') ? (
            <p className="text-body text-text-muted">
              DVIR history for this unit lives on{' '}
              {/* F3-17 — DVIR has no unit filter; its `?q=` search matches the unit number. */}
              <Link to={`/dvir?q=${encodeURIComponent(vehicle.unitNumber)}`} className="text-primary">
                DVIR &amp; Maintenance
              </Link>
              .
            </p>
          ) : (
            // CODE-085 — no link to a screen this role would get /403 on.
            <p className="text-body text-text-muted">Your role does not include DVIR access.</p>
          )}
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
                  <span className="tabular-nums text-caption text-text-muted">{formatCarrierDateTime(a.occurredAt, carrierTz)}</span>
                  <span className="text-body text-text">{activityLabel(a.activity)}</span>
                  <span className="text-caption text-text-muted">
                    {a.driverName ?? '—'} · {activitySource(a.source)} · {activityDetails(a.details)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {editOpen && <AddVehicleModal vehicle={vehicle} onClose={() => setEditOpen(false)} />}
      {assignOpen && <AssignDriverModal vehicle={vehicle} onClose={() => setAssignOpen(false)} />}
      {assignCoDriverOpen && driver && (
        <AssignCoDriverModal vehicle={vehicle} primaryDriver={driver} onClose={() => setAssignCoDriverOpen(false)} />
      )}
      <EndCoDriverPairingDialog
        open={endPairingOpen}
        pairing={coDriverPairing}
        coDriverName={coDriverName}
        unitNumber={vehicle.unitNumber}
        onClose={() => setEndPairingOpen(false)}
      />
      {calibrateOpen && <CalibrateOdometerModal vehicle={vehicle} onClose={() => setCalibrateOpen(false)} />}
      {deleteOpen && (
        <DeleteUnitModal
          vehicle={vehicle}
          eldSerial={device?.serial ?? vehicle.eldSerial ?? null}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => navigate('/vehicles')}
        />
      )}
    </div>
  );
}
