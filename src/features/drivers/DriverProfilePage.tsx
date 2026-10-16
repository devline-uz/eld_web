// owner: web-vehicles-drivers — W-07 Driver profile (web/tz.md §10 W-07).
// Design: web/roles and screens/admin panel/Driver profile — HOS clocks, violations, logs.jpg
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, MoreHorizontal, Pencil, MessageSquare, UserPlus } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import { usePageHeader } from '@/app/layouts/Topbar';
import { useRoom } from '@/shared/realtime/useRoom';
import {
  useDeactivateDriver,
  useDriver,
  useDriverHos,
  useResetDriverPassword,
  useResendDriverEmailChange,
  useCancelDriverEmailChange,
  type DriverHosResponse,
  useSendDriverVerification,
} from '@/shared/api/drivers';
import { useCoDriverPairings, useEndCoDriverPairing, useVehicle } from '@/shared/api/vehicles';
import { client } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { coDriverPairingErrorMessage, formErrorMessage, openTripsOf } from '@/shared/api/errors';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { ConfirmDelete } from '@/shared/ui/Modal';
import { HosMeter } from '@/shared/ui/HosMeter';
import { useToast } from '@/shared/ui/Toast';
import { ErrorState, LoadingState, ForbiddenState, NotFoundState } from '@/shared/ui/states';
import { isNotFoundError, validRouteId } from '@/shared/lib/routeIds';
import { formatCarrier } from '@/shared/format/datetime';
import { useCarrierTimezone } from '@/shared/auth/useCarrierTimezone';
import { formatHosHours, formatRodsDateTime, hosClockNotes } from '@/shared/format/hos';
import { useDriverOpenViolations } from '@/shared/api/hosLogs';
import { orNone } from '@/shared/format/empty';
import { phoneForDisplay } from '@/shared/forms/phoneNumber';
import { qk, qkRoot } from '@/shared/api/queryKeys';
import { messagesHref } from '@/shared/lib/messagesHref';
import { EditDriverModal } from './components/EditDriverModal';
import { DriverDocumentsTab } from './components/DriverDocumentsTab';
import { DriverActivityTab } from './components/DriverActivityTab';
import { DRIVER_TOAST } from './lib/copy';
import { DVIR_HREF, tripsHrefForDriver } from './lib/links';
import { hosRulesetLabel } from '@/shared/lib/hosRuleset';

const TABS = ['overview', 'hos', 'dvirs', 'trips', 'documents', 'activity'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  overview: 'Overview',
  hos: 'HOS & logs',
  dvirs: 'DVIRs',
  trips: 'Trips',
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

/**
 * The four engine clocks. At 00:00 a clock says WHY: `limit exceeded` only while the driver is
 * driving; otherwise the 10-hour break / cycle / 30-minute break the driver needs (QA: an on-duty
 * driver with 0:00 driven today read "DRIVE 00:00 limit exceeded").
 */
function DriverHosMeters({ clocks }: { clocks: DriverHosResponse }) {
  const notes = hosClockNotes(clocks);
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-md border border-border p-3.5">
        <HosMeter
          label="Drive left"
          remainingSec={clocks.driveRemainingSec}
          limitSec={clocks.driveLimitSec}
          ofHint={`of ${formatHosHours(clocks.driveLimitSec)}`}
          zeroNote={notes.drive}
        />
      </div>
      <div className="rounded-md border border-border p-3.5">
        <HosMeter
          label="Shift left"
          remainingSec={clocks.shiftRemainingSec}
          limitSec={clocks.shiftLimitSec}
          ofHint={`of ${formatHosHours(clocks.shiftLimitSec)}`}
          zeroNote={notes.shift}
        />
      </div>
      <div className="rounded-md border border-border p-3.5">
        <HosMeter
          label="Cycle left"
          remainingSec={clocks.cycleRemainingSec}
          limitSec={clocks.cycleLimitSec}
          ofHint={`of ${formatHosHours(clocks.cycleLimitSec)}`}
          zeroNote={notes.cycle}
        />
      </div>
      <div className="rounded-md border border-border p-3.5">
        <HosMeter
          label="Break in"
          remainingSec={clocks.breakInSec}
          limitSec={clocks.breakLimitSec}
          ofHint={`of ${formatHosHours(clocks.breakLimitSec)} driving`}
          zeroNote={notes.break}
        />
      </div>
    </div>
  );
}

/**
 * B-6 `GET /violations?driverId&status=OPEN` — the same OPEN rows the Drivers roster counts and
 * the dashboard lists (one source of truth), each linking to the log day it was filed on.
 */
function DriverOpenViolationsList({ driverId, timezone }: { driverId: string; timezone: string }) {
  const query = useDriverOpenViolations(driverId);
  if (query.isLoading) return <LoadingState rows={2} className="mt-3" />;
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="Could not load violations"
        description="The violations service did not respond. Your data is safe — try again in a moment."
        onRetry={() => void query.refetch()}
      />
    );
  }
  const items = query.data.items;
  if (items.length === 0) {
    return <p className="mt-3 text-body text-success">● No open violations</p>;
  }
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {items.map((violation) => (
        <li key={violation.id}>
          <Link
            to={`/hos-logs?${new URLSearchParams({ driverId, date: violation.logDate }).toString()}`}
            className="flex items-start justify-between gap-3 rounded-md bg-danger-soft p-3 hover:opacity-90"
          >
            <span className="min-w-0">
              <span className="block text-body-strong text-text">{violation.event}</span>
              <span className="block text-caption text-text-muted">{violation.detail}</span>
            </span>
            <span className="tabular shrink-0 text-caption text-text-muted">
              {formatRodsDateTime(violation.occurredAt, timezone)}
            </span>
          </Link>
        </li>
      ))}
      {query.data.total > items.length && (
        <li className="text-caption text-text-muted">{`${query.data.total - items.length} more in HOS Logs`}</li>
      )}
    </ul>
  );
}

function exemptionsList(driver: {
  allowPersonalConveyance: boolean;
  allowYardMove: boolean;
  adverseDrivingEnabled: boolean;
  shortHaulException: boolean;
  splitSleeperEnabled: boolean;
  eldExempt: boolean;
}): string {
  const flags = [
    driver.allowPersonalConveyance && 'Personal conveyance',
    driver.allowYardMove && 'Yard move',
    driver.adverseDrivingEnabled && 'Adverse driving',
    driver.shortHaulException && 'Short-haul (150 air-mile)',
    driver.splitSleeperEnabled && 'Split sleeper',
    driver.eldExempt && 'ELD exempt',
  ].filter(Boolean) as string[];
  return flags.length > 0 ? flags.join(', ') : '';
}

/** While a lookup is still loading, a placeholder — never a real-looking "Unassigned" / "—". */
function Pending() {
  return (
    <span className="inline-block h-3 w-16 animate-pulse rounded bg-bg-subtle align-middle" aria-label="Loading" role="status" />
  );
}

const STATUS_BADGE: Record<string, { tone: 'success' | 'neutral' | 'danger'; label: string }> = {
  ACTIVE: { tone: 'success', label: 'Active' },
  INACTIVE: { tone: 'neutral', label: 'Inactive' },
  TERMINATED: { tone: 'danger', label: 'Terminated' },
};

export default function DriverProfilePage() {
  const { id: routeId } = useParams<{ id: string }>();
  // LIVE-019 — a malformed id is never sent (it came back 422/404 and read as an outage).
  const id = validRouteId(routeId);
  const carrierTz = useCarrierTimezone();
  const navigate = useNavigate();
  const { can } = usePermission();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'overview';

  const driverQuery = useDriver(id);
  const hosQuery = useDriverHos(id);
  const vehicleQuery = useVehicle(driverQuery.data?.assignedVehicleId ?? undefined);
  const fleetManagerQuery = useDriverFleetManager(driverQuery.data?.fleetManagerId ?? null);
  const coDriverPairingQuery = useCoDriverPairings(
    { driverId: id, active: true, limit: 1 },
    Boolean(id),
  );
  const coDriverPairing = coDriverPairingQuery.data?.items[0] ?? null;
  const coDriverPartnerId = coDriverPairing
    ? coDriverPairing.primaryDriverId === id
      ? coDriverPairing.coDriverId
      : coDriverPairing.primaryDriverId
    : undefined;
  const coDriverQuery = useDriver(coDriverPartnerId);

  // Design: the top bar carries the driver's name and the `Drivers › …` breadcrumb (the only
  // breadcrumb on the page); the profile card below repeats the name as its own heading.
  const headerDriver = driverQuery.data;
  const headerUnit = vehicleQuery.data?.unitNumber;
  const headerName = headerDriver ? `${headerDriver.firstName} ${headerDriver.lastName}` : null;
  const breadcrumb = useMemo(
    () =>
      headerDriver ? (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1">
          <Link to="/drivers" className="hover:text-text">
            Drivers
          </Link>
          <ChevronRight size={12} strokeWidth={1.75} aria-hidden="true" />
          <span className="truncate">
            {headerDriver.firstName} {headerDriver.lastName} · @{headerDriver.username}
            {headerUnit ? ` · Unit ${headerUnit}` : ''}
          </span>
        </nav>
      ) : null,
    [headerDriver, headerUnit],
  );
  usePageHeader({ title: headerName, subtitle: breadcrumb });
  useRoom(id ? `driver:${id}` : null, {});

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [endPairingOpen, setEndPairingOpen] = useState(false);
  const endPairing = useEndCoDriverPairing();
  // WB-183 — the row menu's `Deactivate driver` had no handler at all; it now confirms first
  // (§5.9 destructive confirm) and then really writes `PATCH /drivers/:id { status: 'INACTIVE' }`.
  const deactivate = useDeactivateDriver();
  const resetPassword = useResetDriverPassword();
  const sendVerification = useSendDriverVerification();
  const resendEmailChange = useResendDriverEmailChange(id ?? '');
  const cancelEmailChange = useCancelDriverEmailChange(id ?? '');

  function runResendEmailChange() {
    if (!id || resendEmailChange.isPending) return;
    resendEmailChange.mutate(undefined, {
      onSuccess: (result) => toast({ kind: 'success', ...DRIVER_TOAST.emailChangeResent(result.pendingEmail) }),
      onError: (error) => toast({ kind: 'error', title: formErrorMessage(error) }),
    });
  }

  function runCancelEmailChange() {
    if (!id || cancelEmailChange.isPending) return;
    cancelEmailChange.mutate(undefined, {
      onSuccess: () => toast({ kind: 'success', ...DRIVER_TOAST.emailChangeCancelled() }),
      onError: (error) => toast({ kind: 'error', title: formErrorMessage(error) }),
    });
  }

  function runResetPassword() {
    if (!id || resetPassword.isPending) return;
    resetPassword.mutate(id, {
      onSuccess: (result) => toast({ kind: 'success', ...DRIVER_TOAST.passwordReset(result) }),
      onError: (error) =>
        toast({
          kind: 'error',
          title: formErrorMessage(error),
        }),
    });
  }

  function runSendVerification(email: string) {
    if (!id || sendVerification.isPending) return;
    sendVerification.mutate(id, {
      onSuccess: () => toast({ kind: 'success', ...DRIVER_TOAST.verificationSent(email) }),
      onError: (error) =>
        toast({
          kind: 'error',
          title: formErrorMessage(error),
        }),
    });
  }

  function runDeactivate() {
    if (!id || deactivate.isPending) return;
    deactivate.mutate(id, {
      onSuccess: () => {
        setConfirmDeactivate(false);
        void queryClient.invalidateQueries({ queryKey: qkRoot.drivers });
        toast({ kind: 'success', ...DRIVER_TOAST.driversDeactivated(1) });
      },
      onError: (error) => {
        setConfirmDeactivate(false);
        // BE-013 — a driver with open trips is refused with 409 `details.openTrips`: name them.
        const trips = openTripsOf(error);
        toast({
          kind: 'error',
          title: trips
            ? `${driverQuery.data ? `${driverQuery.data.firstName} ${driverQuery.data.lastName}` : 'This driver'} still has open trips`
            : formErrorMessage(error),
          ...(trips ? { description: `Reassign or cancel ${trips.map((t) => t.number).join(', ')} first.` } : {}),
        });
      },
    });
  }

  if (!can('drivers')) return <ForbiddenState screenName="Driver profile" />;
  if (!id || isNotFoundError(driverQuery.error)) {
    return <NotFoundState title="Driver not found" backLabel="Back to drivers" onBack={() => navigate('/drivers')} />;
  }
  if (driverQuery.isLoading) return <LoadingState rows={8} />;
  // F3-03 — a failed background refetch keeps the loaded driver on screen.
  if (!driverQuery.data) return <ErrorState onRetry={() => driverQuery.refetch()} />;

  const driver = driverQuery.data;
  const name = `${driver.firstName} ${driver.lastName}`;
  const statusBadge = STATUS_BADGE[driver.status] as (typeof STATUS_BADGE)[string] | undefined;
  const canFull = can('drivers', 'FULL');
  const canMessage = can('messaging');
  const canAssignTrip = can('trips');

  function setTab(next: Tab) {
    const nextParams = new URLSearchParams(params);
    nextParams.set('tab', next);
    setParams(nextParams, { replace: true });
  }

  // Dispatcher/Viewer with nothing left in the row menu render no `…` button at all — a mock
  // artefact in the design shows an empty trigger instead (web/tz.md §10 W-07 note).
  const hasRowMenu = canFull;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <Avatar name={name} size="xl" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-page-title text-text">{name}</h2>
                {statusBadge && (
                  <Badge tone={statusBadge.tone} dot>
                    {statusBadge.label}
                  </Badge>
                )}
                {driver.email && !driver.emailVerifiedAt && (
                  <Badge tone="warning" dot>
                    Email not verified
                  </Badge>
                )}
              </div>
              <p className="mt-1 break-words text-body text-text-muted">
                {vehicleQuery.data ? `Unit ${vehicleQuery.data.unitNumber} · ` : ''}
                CDL {driver.cdlState}-{driver.cdlNumber} · {driver.homeTerminalName} terminal
                {driver.email ? ` · ${driver.email}` : ''}
                {driver.phone ? ` · ${phoneForDisplay(driver.phone)}` : ''}
              </p>
              {driver.pendingEmail && (
                <div
                  role="status"
                  className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-warning-soft px-3 py-2 text-body text-text"
                >
                  <span className="break-all">
                    Pending: {driver.pendingEmail} — awaiting confirmation
                  </span>
                  {canFull && (
                    <span className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={resendEmailChange.isPending}
                        disabled={resendEmailChange.isPending || cancelEmailChange.isPending}
                        onClick={runResendEmailChange}
                      >
                        Resend
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={cancelEmailChange.isPending}
                        disabled={resendEmailChange.isPending || cancelEmailChange.isPending}
                        onClick={runCancelEmailChange}
                      >
                        Cancel change
                      </Button>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
            {canMessage && (
              <Button
                variant="secondary"
                iconLeft={<MessageSquare size={16} strokeWidth={1.75} />}
                onClick={() => navigate(messagesHref(driver.id))}
              >
                Message
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate(`/hos-logs?driverId=${driver.id}`)}>
              View logs
            </Button>
            {canAssignTrip && (
              <Button
                variant="primary"
                iconLeft={<UserPlus size={16} strokeWidth={1.75} />}
                onClick={() => navigate(tripsHrefForDriver(driver.id))}
              >
                Assign trip
              </Button>
            )}
            {hasRowMenu && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button variant="secondary" iconOnly aria-label="More">
                    <MoreHorizontal size={16} strokeWidth={1.75} />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    className="z-50 min-w-48 rounded-md border border-border bg-bg-surface p-1 shadow-pop"
                  >
                    {/* B-81 shipped — `POST /drivers/:id/reset-password`. */}
                    <DropdownMenu.Item
                      onSelect={runResetPassword}
                      className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle"
                    >
                      Reset app password
                    </DropdownMenu.Item>
                    {driver.email && !driver.emailVerifiedAt && (
                      <DropdownMenu.Item
                        onSelect={() => runSendVerification(driver.email as string)}
                        className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle"
                      >
                        Resend verification email
                      </DropdownMenu.Item>
                    )}
                    <DropdownMenu.Item
                      onSelect={() => setConfirmDeactivate(true)}
                      className="cursor-pointer rounded-md px-2 py-1.5 text-body text-danger outline-none hover:bg-danger-soft"
                    >
                      Deactivate driver
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
          </div>
        </div>
      </Card>

      <div className="flex h-9 w-fit max-w-full overflow-x-auto rounded-md border border-border">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className={
              tab === t
                ? 'shrink-0 whitespace-nowrap bg-bg-inverse px-3 text-body-strong text-text-inverse'
                : 'shrink-0 whitespace-nowrap bg-bg-surface px-3 text-body text-text-secondary hover:bg-bg-subtle'
            }
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_348px] gap-4">
          <div className="flex flex-col gap-4">
            <Card>
              <SectionHeader
                title="Hours of service · right now"
                // UI-005 — the driver's own ruleset (clocks response, else the driver row), never a constant.
                subtitle={hosRulesetLabel(hosQuery.data?.hosRuleset ?? driverQuery.data?.hosRuleset, hosQuery.data?.cycleLimitSec)}
              />
              {hosQuery.isLoading ? (
                <LoadingState rows={4} className="mt-3" />
              ) : hosQuery.isError || !hosQuery.data ? (
                // WB-185 — the card used to print the internal gap id ("backend gap B-2") at the
                // end user. `GET /drivers/:id/hos` shipped: a failure here is an ordinary error
                // state, in the same words every other card uses, with a retry.
                <ErrorState
                  title="HOS clocks unavailable"
                  description="The hours-of-service service did not respond. Your data is safe — try again in a moment."
                  onRetry={() => void hosQuery.refetch()}
                />
              ) : (
                <DriverHosMeters clocks={hosQuery.data} />
              )}
            </Card>

            <Card>
              <SectionHeader
                title="Violations & alerts"
                subtitle="Open (unresolved)"
                action={
                  // WB-186 — the button had no handler. Per-driver violations are rendered by
                  // W-08, so `View all` opens this driver's log there, exactly like the sentence
                  // below it says.
                  <Button
                    variant="link"
                    onClick={() => navigate(`/hos-logs?driverId=${driver.id}`)}
                  >
                    View all ›
                  </Button>
                }
              />
              <DriverOpenViolationsList driverId={driver.id} timezone={driver.homeTerminalTimezone} />
            </Card>

            <Card>
              <SectionHeader
                title="Recent daily logs"
                subtitle="Last 8 days available"
                action={
                  <Button
                    variant="link"
                    onClick={() => navigate(`/hos-logs?driverId=${driver.id}`)}
                  >
                    Open HOS logs ›
                  </Button>
                }
              />
              <p className="mt-3 text-body text-text-muted">
                Daily totals and certification status come from{' '}
                <Link to={`/hos-logs?driverId=${driver.id}`} className="text-primary">
                  HOS Logs
                </Link>
                .
              </p>
            </Card>
          </div>

          <Card>
            <SectionHeader
              title="Driver profile"
              action={
                <Can perm="drivers" level="FULL">
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={<Pencil size={14} strokeWidth={1.75} />}
                    onClick={() => setEditOpen(true)}
                  >
                    Edit
                  </Button>
                </Can>
              }
            />
            <div className="mt-2">
              <DetailRow label="Username" value={driver.username} />
              <DetailRow
                label={driver.email && !driver.emailVerifiedAt ? 'Email · not verified' : 'Email'}
                value={driver.email ?? '—'}
              />
              <DetailRow label="Phone" value={driver.phone ? phoneForDisplay(driver.phone) : '—'} />
              <DetailRow label="CDL number" value={driver.cdlNumber} />
              <DetailRow label="CDL state" value={driver.cdlState} />
              <DetailRow label="Home terminal" value={driver.homeTerminalName} />
              <DetailRow
                label="Fleet manager"
                value={driver.fleetManagerId && fleetManagerQuery.isLoading ? <Pending /> : (fleetManagerQuery.data?.name ?? '—')}
              />
              <DetailRow
                label="Co-driver"
                value={
                  <span className="inline-flex flex-wrap items-center justify-end gap-2">
                    <span>
                      {coDriverPairingQuery.isLoading || (coDriverPartnerId && coDriverQuery.isLoading) ? (
                        <Pending />
                      ) : coDriverQuery.data ? (
                        `${coDriverQuery.data.firstName} ${coDriverQuery.data.lastName}`
                      ) : (
                        '—'
                      )}
                    </span>
                    {/* B-7 — assigning a co-driver lives on the unit profile (it pairs with the
                        unit's primary driver); ending the active pairing works from either side. */}
                    {coDriverPairing && (
                      <Can perm="drivers" level="FULL">
                        <Button variant="ghost" size="sm" onClick={() => setEndPairingOpen(true)}>
                          End pairing
                        </Button>
                      </Can>
                    )}
                  </span>
                }
              />
              <DetailRow
                label="Assigned unit"
                value={
                  driver.assignedVehicleId && vehicleQuery.isLoading ? (
                    <Pending />
                  ) : (
                    vehicleQuery.data?.unitNumber ?? (driver.assignedVehicleId ? '—' : 'Unassigned')
                  )
                }
              />
              <DetailRow
                label="App version"
                value={
                  driver.appVersion ? `${driver.appVersion} · ${driver.appPlatform ?? ''}` : '—'
                }
              />
              <DetailRow
                label="Registered on"
                value={formatCarrier(driver.registeredAt, carrierTz, 'shortDate')}
              />
              <DetailRow label="Exemptions" value={orNone(exemptionsList(driver) || null)} />
            </div>
          </Card>
        </div>
      )}

      {tab === 'hos' && (
        <Card>
          <p className="text-body text-text-muted">
            Full HOS graph grid lives on{' '}
            <Link to={`/hos-logs?driverId=${driver.id}`} className="text-primary">
              HOS Logs
            </Link>
            .
          </p>
        </Card>
      )}
      {tab === 'dvirs' && (
        <Card>
          {/* WB-180 — the link used to carry `?driverId=`, which W-09 never reads: it landed on an
              unfiltered board that looked filtered. `GET /dvir` has no driver param and the screen
              has no driver filter (gap B-80), so the link is plain and says so. */}
          <p className="text-body text-text-muted">
            DVIR history lives on{' '}
            <Link to={DVIR_HREF} className="text-primary">
              DVIR &amp; Maintenance
            </Link>
            . It cannot be filtered to one driver yet — look for {driver.firstName}{' '}
            {driver.lastName} in the DRIVER column.
          </p>
        </Card>
      )}
      {tab === 'trips' && (
        <Card>
          <p className="text-body text-text-muted">
            Trip history for this driver lives on{' '}
            <Link to={tripsHrefForDriver(driver.id)} className="text-primary">
              Dispatch &amp; Trips
            </Link>
            .
          </p>
        </Card>
      )}
      {tab === 'documents' && <DriverDocumentsTab driverId={driver.id} />}
      {tab === 'activity' && <DriverActivityTab driverId={driver.id} />}

      {editOpen && <EditDriverModal driver={driver} onClose={() => setEditOpen(false)} />}
      <ConfirmDelete
        open={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        onConfirm={runDeactivate}
        title="Deactivate this driver?"
        description="They are signed out of the mobile app at once and can no longer sign in, message or be dispatched. Their unit and any co-driver pairing are released. Logs, DVIRs and certifications stay available for audits."
        confirmLabel="Deactivate"
        loading={deactivate.isPending}
      />
      <ConfirmDelete
        open={endPairingOpen && Boolean(coDriverPairing)}
        onClose={() => setEndPairingOpen(false)}
        loading={endPairing.isPending}
        onConfirm={() => {
          if (!coDriverPairing) return;
          endPairing.mutate(coDriverPairing.id, {
            onSuccess: () => {
              toast({ kind: 'success', title: 'Co-driver pairing ended' });
              setEndPairingOpen(false);
            },
            onError: (error) => {
              toast({ kind: 'error', title: coDriverPairingErrorMessage(error) });
              setEndPairingOpen(false);
            },
          });
        }}
        title="End co-driver pairing?"
        description="The two drivers stop team driving on this unit from now. Logs recorded during the pairing stay in place."
        confirmLabel="End pairing"
      />
    </div>
  );
}

/** Small local hook — resolves the fleet manager's display name via `GET /users/:id`. Not worth
 * its own composition module for a single optional field. */
function useDriverFleetManager(userId: string | null) {
  return useQuery<{ name: string } | null>({
    queryKey: qk.user(userId ?? ''),
    queryFn: async () => {
      if (!userId) return null;
      const user = await client.get<{ firstName?: string; lastName?: string; fullName?: string }>(
        endpoints.users.detail(userId),
      );
      const name = user.fullName ?? [user.firstName, user.lastName].filter(Boolean).join(' ');
      return name ? { name } : null;
    },
    enabled: Boolean(userId),
  });
}
