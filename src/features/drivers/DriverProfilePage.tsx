// owner: web-vehicles-drivers — W-07 Driver profile (web/tz.md §10 W-07).
// Design: web/roles and screens/admin panel/Driver profile — HOS clocks, violations, logs.jpg
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, MoreHorizontal, Pencil, MessageSquare, UserPlus } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import { useDynamicSubtitle } from '@/app/layouts/Topbar';
import { useRoom } from '@/shared/realtime/useRoom';
import { useDeactivateDriver, useDriver, useDriverHos } from '@/shared/api/drivers';
import { useVehicle } from '@/shared/api/vehicles';
import { client } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { ApiError } from '@/shared/api/errors';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { ConfirmDelete } from '@/shared/ui/Modal';
import { HosMeter } from '@/shared/ui/HosMeter';
import { useToast } from '@/shared/ui/Toast';
import { ErrorState, LoadingState, ForbiddenState } from '@/shared/ui/states';
import { formatLocal } from '@/shared/format/datetime';
import { orNone } from '@/shared/format/empty';
import { qk, qkRoot } from '@/shared/api/queryKeys';
import { messagesHref } from '@/shared/lib/messagesHref';
import { EditDriverModal } from './components/EditDriverModal';
import { DRIVER_DOCUMENTS_REASON, DRIVER_TOAST, NO_PASSWORD_RESET } from './lib/copy';
import { DVIR_HREF, tripsHrefForDriver } from './lib/links';

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

export default function DriverProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermission();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'overview';

  const driverQuery = useDriver(id);
  const hosQuery = useDriverHos(id);
  const vehicleQuery = useVehicle(driverQuery.data?.assignedVehicleId ?? undefined);
  const fleetManagerQuery = useDriverFleetManager(driverQuery.data?.fleetManagerId ?? null);

  useDynamicSubtitle(driverQuery.data ? `Drivers › ${driverQuery.data.firstName} ${driverQuery.data.lastName}` : null);
  useRoom(id ? `driver:${id}` : null, {});

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  // WB-183 — the row menu's `Deactivate driver` had no handler at all; it now confirms first
  // (§5.9 destructive confirm) and then really writes `PATCH /drivers/:id { status: 'INACTIVE' }`.
  const deactivate = useDeactivateDriver();

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
        toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' });
      },
    });
  }

  if (!can('drivers')) return <ForbiddenState screenName="Driver profile" />;
  if (driverQuery.isLoading) return <LoadingState rows={8} />;
  if (driverQuery.isError || !driverQuery.data) return <ErrorState onRetry={() => driverQuery.refetch()} />;

  const driver = driverQuery.data;
  const name = `${driver.firstName} ${driver.lastName}`;
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
      <div className="flex items-center gap-1 text-caption text-text-muted">
        <Link to="/drivers" className="hover:text-text">
          Drivers
        </Link>
        <ChevronRight size={12} strokeWidth={1.75} />
        <span>
          {name} · @{driver.username}
          {vehicleQuery.data ? ` · Unit ${vehicleQuery.data.unitNumber}` : ''}
        </span>
      </div>

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-4">
            <Avatar name={name} size="xl" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-page-title text-text">{name}</h1>
                {driver.status === 'ACTIVE' && <Badge tone="success" dot>Active</Badge>}
              </div>
              <p className="mt-1 text-body text-text-muted">
                {vehicleQuery.data ? `Unit ${vehicleQuery.data.unitNumber} · ` : ''}
                CDL {driver.cdlState}-{driver.cdlNumber} · {driver.homeTerminalName} terminal
                {driver.email ? ` · ${driver.email}` : ''}
                {driver.phone ? ` · ${driver.phone}` : ''}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canMessage && (
              <Button variant="secondary" iconLeft={<MessageSquare size={16} strokeWidth={1.75} />} onClick={() => navigate(messagesHref(driver.id))}>
                Message
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate(`/hos-logs?driverId=${driver.id}`)}>
              View logs
            </Button>
            {canAssignTrip && (
              <Button variant="primary" iconLeft={<UserPlus size={16} strokeWidth={1.75} />} onClick={() => navigate(tripsHrefForDriver(driver.id))}>
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
                  <DropdownMenu.Content align="end" className="z-50 min-w-40 rounded-md border border-border bg-bg-surface p-1 shadow-pop">
                    {/* ⛔ GAP B-81 — no carrier-side password reset for a driver account. */}
                    <DropdownMenu.Item disabled className="rounded-md px-2 py-1.5 text-body text-text-muted outline-none data-[disabled]:cursor-not-allowed">
                      Reset app password
                    </DropdownMenu.Item>
                    <p className="max-w-56 px-2 pb-1 text-caption text-text-muted">{NO_PASSWORD_RESET}</p>
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-9 w-fit overflow-hidden rounded-md border border-border">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tab === t}
              disabled={t === 'documents'}
              // B-94 — disabled with its reason on screen (tooltip, "Soon" badge, caption), WB-236.
              title={t === 'documents' ? DRIVER_DOCUMENTS_REASON : undefined}
              aria-describedby={t === 'documents' ? 'driver-documents-reason' : undefined}
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
        <p id="driver-documents-reason" className="text-caption text-text-muted">
          {DRIVER_DOCUMENTS_REASON}
        </p>
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-[1fr_348px] gap-4">
          <div className="flex flex-col gap-4">
            <Card>
              <SectionHeader title="Hours of service · right now" subtitle="Property-carrying · 70 hr / 8 day cycle" />
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
                <div className="mt-3 grid grid-cols-4 gap-3">
                  <div className="rounded-md border border-border p-3.5">
                    <HosMeter label="Drive left" remainingSec={hosQuery.data.driveRemainingSec} limitSec={hosQuery.data.driveLimitSec} ofHint="limit exceeded" />
                  </div>
                  <div className="rounded-md border border-border p-3.5">
                    <HosMeter label="Shift left" remainingSec={hosQuery.data.shiftRemainingSec} limitSec={hosQuery.data.shiftLimitSec} ofHint="of 14:00" />
                  </div>
                  <div className="rounded-md border border-border p-3.5">
                    <HosMeter label="Cycle left" remainingSec={hosQuery.data.cycleRemainingSec} limitSec={hosQuery.data.cycleLimitSec} ofHint="of 70:00" />
                  </div>
                  <div className="rounded-md border border-border p-3.5">
                    <HosMeter label="Break in" remainingSec={hosQuery.data.breakInSec} limitSec={hosQuery.data.breakLimitSec} ofHint="of 08:00 driving" />
                  </div>
                </div>
              )}
            </Card>

            <Card>
              <SectionHeader
                title="Violations & alerts"
                subtitle="Last 8 days"
                action={
                  // WB-186 — the button had no handler. Per-driver violations are rendered by
                  // W-08, so `View all` opens this driver's log there, exactly like the sentence
                  // below it says.
                  <Button variant="link" onClick={() => navigate(`/hos-logs?driverId=${driver.id}`)}>
                    View all ›
                  </Button>
                }
              />
              {/* ⛔ GAP B-6 — no GET /violations; per-driver violations only surface inside the
                  logs response, which HOS Logs (W-08, owned elsewhere) already renders. */}
              <p className="mt-3 text-body text-text-muted">Open HOS Logs to review violations for this driver.</p>
            </Card>

            <Card>
              <SectionHeader title="Recent daily logs" subtitle="Last 8 days available" action={<Button variant="link" onClick={() => navigate(`/hos-logs?driverId=${driver.id}`)}>Open HOS logs ›</Button>} />
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
                  <Button variant="ghost" size="sm" iconLeft={<Pencil size={14} strokeWidth={1.75} />} onClick={() => setEditOpen(true)}>
                    Edit
                  </Button>
                </Can>
              }
            />
            <div className="mt-2">
              <DetailRow label="Username" value={driver.username} />
              {/* ⛔ GAP B-29/B-31 — no verification state on Driver.email yet. */}
              <DetailRow label="Email" value={driver.email ?? '—'} />
              <DetailRow label="Phone" value={driver.phone ?? '—'} />
              <DetailRow label="CDL number" value={driver.cdlNumber} />
              <DetailRow label="CDL state" value={driver.cdlState} />
              <DetailRow label="Home terminal" value={driver.homeTerminalName} />
              <DetailRow label="Fleet manager" value={fleetManagerQuery.data?.name ?? '—'} />
              {/* ⛔ GAP B-7 — no /co-driver-pairings endpoint. */}
              <DetailRow label="Co-driver" value="—" />
              <DetailRow label="Assigned unit" value={vehicleQuery.data?.unitNumber ?? 'Unassigned'} />
              <DetailRow label="App version" value={driver.appVersion ? `${driver.appVersion} · ${driver.appPlatform ?? ''}` : '—'} />
              <DetailRow label="Registered on" value={formatLocal(driver.registeredAt, 'shortDate')} />
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
            . It cannot be filtered to one driver yet — look for {driver.firstName} {driver.lastName} in the
            DRIVER column.
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
      {tab === 'activity' && (
        <Card>
          <p className="text-body text-text-muted">No activity recorded.</p>
        </Card>
      )}

      {editOpen && <EditDriverModal driver={driver} onClose={() => setEditOpen(false)} />}
      <ConfirmDelete
        open={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        onConfirm={runDeactivate}
        title="Deactivate this driver?"
        description="They can no longer sign in to the mobile app. Their logs, DVIRs and certifications stay available for audits."
        confirmLabel="Deactivate"
        loading={deactivate.isPending}
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
      const user = await client.get<{ firstName?: string; lastName?: string; fullName?: string }>(endpoints.users.detail(userId));
      const name = user.fullName ?? [user.firstName, user.lastName].filter(Boolean).join(' ');
      return name ? { name } : null;
    },
    enabled: Boolean(userId),
  });
}
