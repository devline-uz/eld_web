// owner: web-dashboard-fleet — W-01 Fleet Dashboard (web/tz.md §10 W-01).
// Design: web/roles and screens/admin panel/Fleet overview — KPIs, live map, duty mix, violation feed.jpg
import { lazy, Suspense, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock, MapPin, Truck, Users } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate } from 'react-router-dom';
import { client } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { qk } from '@/shared/api/queryKeys';
import { typedCachePolicy } from '@/shared/api/queryPolicy';
import type { OffsetPage } from '@/shared/api/types';
import { ApiError } from '@/shared/api/errors';
import { useLiveFleet, hasPosition, type LiveFleetUnit } from '@/shared/api/liveFleet';
import { usePermission } from '@/shared/auth/usePermission';
import { useDynamicSubtitle } from '@/app/layouts/Topbar';
import { useRoom } from '@/shared/realtime/useRoom';
// Direct file imports, not the `@/shared/ui` barrel: the barrel's `index.ts` re-exports every
// primitive, so importing through it pulls unrelated components (DateRangePicker, TableSettings…)
// into any test file's module graph and dilutes the coverage gate (web/decisions.md WD-021).
import { Avatar } from '@/shared/ui/Avatar';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { DataTable } from '@/shared/ui/DataTable';
import { EMPTY_STATE_COPY } from '@/shared/ui/copy';
import { EmptyState, ErrorState } from '@/shared/ui/states';
import { KpiCard, KpiRowSkeleton } from '@/shared/ui/KpiCard';
import { SeverityBadge, type Severity } from '@/shared/ui/Badge';
import { formatCarrier, timezoneAbbreviation } from '@/shared/format/datetime';
import { formatDuration } from '@/shared/format/duration';
import { formatNumber } from '@/shared/format/numbers';
import { formatTimeWithAge } from '@/shared/format/relative';

const DutyDonut = lazy(() => import('./components/DutyDonut'));

interface CarrierResponse {
  id: string;
  name: string;
  timezone?: string;
}

interface Violation {
  id: string;
  severity: Severity;
  driverId: string | null;
  driverName: string | null;
  vehicleId: string | null;
  unitNumber: string | null;
  event: string;
  locationLabel: string | null;
  occurredAt: string;
  date?: string;
}

const DUTY_ON_STATUSES: LiveFleetUnit['dutyStatus'][] = ['DRIVING', 'ON_DUTY', 'SLEEPER'];

function useCarrier() {
  return useQuery({
    queryKey: qk.carrier,
    queryFn: () => client.get<CarrierResponse>(endpoints.carrier.root),
    ...typedCachePolicy<CarrierResponse>('reference'),
  });
}

function useActiveVehicleCount() {
  return useQuery({
    queryKey: qk.vehicles({ status: 'ACTIVE', limit: 1 }),
    queryFn: () => client.get<OffsetPage<unknown>>(endpoints.vehicles.list, { params: { status: 'ACTIVE', limit: 1 } }),
    ...typedCachePolicy<OffsetPage<unknown>>('list'),
  });
}

function useAllVehicleCount() {
  return useQuery({
    queryKey: qk.vehicles({ limit: 1 }),
    queryFn: () => client.get<OffsetPage<unknown>>(endpoints.vehicles.list, { params: { limit: 1 } }),
    ...typedCachePolicy<OffsetPage<unknown>>('list'),
  });
}

function useUnassignedDriving() {
  return useQuery({
    queryKey: qk.unidentified({ status: 'PENDING' }),
    queryFn: () =>
      client.get<{ items: { durationSec: number }[]; total: number }>(endpoints.unidentified.list, {
        params: { status: 'PENDING' },
      }),
    ...typedCachePolicy<{ items: { durationSec: number }[]; total: number }>('list'),
  });
}

function useDashboardViolations() {
  return useQuery({
    queryKey: qk.violations({ window: '24h' }),
    queryFn: () => client.get<{ items: Violation[]; total: number }>(endpoints.violations.list, {
      params: { window: '24h' },
    }),
    ...typedCachePolicy<{ items: Violation[]; total: number }>('list'),
  });
}

export default function DashboardPage() {
  const { can } = usePermission();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const carrier = useCarrier();
  const active = useActiveVehicleCount();
  const total = useAllVehicleCount();
  const fleet = useLiveFleet();
  const unassigned = useUnassignedDriving();
  const violations = useDashboardViolations();

  // Real-time: `fleet` + `violations` (web/tz.md §7.5). `safety.event_created` and
  // `trip.status_changed` exist today and patch this screen point-wise; everything else (the KPI
  // counts, the violations table) rides the 30s `cachePolicy('live')` poll until §7.4 ships.
  useRoom('fleet', {
    'safety.event_created': () => void queryClient.invalidateQueries({ queryKey: qk.violations() }),
    'trip.status_changed': () => void queryClient.invalidateQueries({ queryKey: qk.liveFleet() }),
  });
  useRoom('violations', {
    'safety.event_created': () => void queryClient.invalidateQueries({ queryKey: qk.violations() }),
  });

  const carrierTz = carrier.data?.timezone ?? 'America/New_York';
  const subtitle = carrier.data
    ? `${carrier.data.name} · Today, ${formatCarrier(new Date(), carrierTz, 'MMM d yyyy')} · ${timezoneAbbreviation(carrierTz)}`
    : null;
  useDynamicSubtitle(subtitle);

  const units = fleet.data?.items ?? [];
  const onDutyCount = units.filter((u) => DUTY_ON_STATUSES.includes(u.dutyStatus)).length;
  const movingCount = units.filter((u) => u.dutyStatus === 'DRIVING').length;
  const idleCount = units.filter((u) => u.dutyStatus === 'IDLE').length;
  const offlineCount = units.filter((u) => u.dutyStatus === 'ELD_OFFLINE').length;

  const unassignedTotalSec = useMemo(
    () => (unassigned.data?.items ?? []).reduce((sum, s) => sum + (s.durationSec ?? 0), 0),
    [unassigned.data],
  );

  const kpiLoading = active.isLoading || total.isLoading || fleet.isLoading || unassigned.isLoading;

  const columns: ColumnDef<Violation, unknown>[] = [
    {
      id: 'severity',
      header: 'SEVERITY',
      accessorFn: (row) => row.severity,
      cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
      size: 120,
    },
    {
      id: 'driver',
      header: 'DRIVER',
      accessorFn: (row) => row.driverName ?? '',
      cell: ({ row }) =>
        row.original.driverName ? (
          <span className="flex items-center gap-2">
            <Avatar name={row.original.driverName} size="sm" />
            {row.original.driverName}
          </span>
        ) : (
          <span className="text-text-muted">Unassigned</span>
        ),
      size: 200,
    },
    {
      id: 'unit',
      header: 'UNIT',
      accessorFn: (row) => row.unitNumber ?? '',
      cell: ({ row }) => <span className="tabular-nums font-semibold">{row.original.unitNumber ?? '—'}</span>,
      size: 80,
    },
    { id: 'event', header: 'EVENT', accessorFn: (row) => row.event, size: 320 },
    {
      id: 'location',
      header: 'LOCATION',
      accessorFn: (row) => row.locationLabel ?? '',
      cell: ({ row }) => row.original.locationLabel ?? '—',
      size: 220,
    },
    {
      id: 'time',
      header: 'TIME',
      accessorFn: (row) => row.occurredAt,
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatTimeWithAge(formatCarrier(row.original.occurredAt, carrierTz, 'time'), row.original.occurredAt)}
        </span>
      ),
      size: 140,
    },
  ];

  return (
    <div className="flex flex-col gap-card-gap">
      {kpiLoading ? (
        <KpiRowSkeleton />
      ) : (
        <div className="grid grid-cols-4 gap-card-gap">
          <KpiCard
            label="Active vehicles"
            value={active.isError ? '—' : formatNumber(active.data?.total)}
            hint={total.isError ? undefined : `of ${formatNumber(total.data?.total)}`}
            icon={Truck}
            iconTone="info"
          />
          <KpiCard
            label="Drivers on duty"
            value={fleet.isError ? '—' : formatNumber(onDutyCount)}
            icon={Users}
            iconTone="success"
          />
          <KpiCard
            label="HOS violations · 24h"
            value={violations.isError ? '—' : formatNumber(violations.data?.total)}
            icon={AlertTriangle}
            iconTone="danger"
          />
          <KpiCard
            label="Unassigned driving"
            value={unassigned.isError ? '—' : formatDuration(unassignedTotalSec)}
            chip={
              unassigned.isError
                ? undefined
                : { text: `${formatNumber(unassigned.data?.total)} segments`, tone: 'warning' }
            }
            icon={Clock}
            iconTone="warning"
          />
        </div>
      )}

      <div className="grid grid-cols-[1fr_348px] gap-card-gap">
        <Card padded={false}>
          <div className="border-b border-border p-card">
            <SectionHeader
              title="Live fleet"
              subtitle={
                fleet.isError
                  ? undefined
                  : `${movingCount} moving · ${idleCount} idle · ${offlineCount} ELD offline`
              }
              action={
                <button
                  type="button"
                  onClick={() => navigate('/live-fleet')}
                  className="flex h-btn items-center gap-1.5 rounded-md border border-border px-3 text-body text-text hover:bg-bg-subtle"
                >
                  <MapPin size={16} strokeWidth={1.75} aria-hidden="true" />
                  Open map view
                </button>
              }
            />
          </div>
          <div className="p-card pt-4">
            {fleet.isLoading ? (
              <div className="h-map-preview animate-pulse rounded-md bg-bg-subtle" />
            ) : fleet.isError ? (
              <ErrorState
                title="Could not load the fleet"
                onRetry={() => void fleet.refetch()}
              />
            ) : units.length === 0 ? (
              <EmptyState title={EMPTY_STATE_COPY.liveFleet.title} description={EMPTY_STATE_COPY.liveFleet.description} />
            ) : (
              <Suspense fallback={<div className="h-map-preview animate-pulse rounded-md bg-bg-subtle" />}>
                <LazyDashboardMap units={units.filter(hasPosition)} />
              </Suspense>
            )}
          </div>
        </Card>

        <Card>
          <SectionHeader
            title="Duty status · now"
            subtitle={fleet.isError ? undefined : `${units.length} drivers · ${onDutyCount} on duty`}
          />
          <div className="mt-4">
            {fleet.isLoading ? (
              <div className="h-40 animate-pulse rounded-md bg-bg-subtle" />
            ) : fleet.isError ? (
              <ErrorState title="Could not load duty status" onRetry={() => void fleet.refetch()} />
            ) : (
              <Suspense fallback={<div className="h-40 animate-pulse rounded-md bg-bg-subtle" />}>
                <DutyDonut units={units} onSegmentClick={(status) => navigate(`/drivers?status=${status}`)} />
              </Suspense>
            )}
          </div>
        </Card>
      </div>

      <Card padded={false}>
        <div className="flex items-center justify-between border-b border-border p-card">
          <SectionHeader title="HOS violations & alerts" subtitle="Last 24 hours" />
          <button
            type="button"
            onClick={() => navigate('/hos-logs')}
            className="text-body text-primary hover:underline"
          >
            View all ›
          </button>
        </div>
        {violations.isLoading ? (
          <DataTable data={[]} columns={columns} caption="HOS violations and alerts" isLoading />
        ) : violations.isError ? (
          <div className="p-card">
            <ErrorState
              title="Could not load violations"
              description={
                violations.error instanceof ApiError
                  ? violations.error.userMessage
                  : 'The telematics service did not respond. Your data is safe — try again in a moment.'
              }
              onRetry={() => void violations.refetch()}
            />
          </div>
        ) : (violations.data?.items.length ?? 0) === 0 ? (
          <div className="p-card">
            <EmptyState title="No violations in the last 24 hours" />
          </div>
        ) : (
          <DataTable
            data={violations.data!.items}
            columns={columns}
            caption="HOS violations and alerts"
            getRowId={(row) => row.id}
            onRowClick={(row) => navigate(`/hos-logs?driverId=${row.driverId}&date=${row.date ?? ''}`)}
            rowActions={
              can('hosEdit', 'FULL')
                ? (row) => (
                    <div className="flex flex-col text-body">
                      <button className="rounded px-2 py-1.5 text-left hover:bg-bg-subtle">Open HOS logs</button>
                      <button className="rounded px-2 py-1.5 text-left hover:bg-bg-subtle">Send message</button>
                      <button className="rounded px-2 py-1.5 text-left hover:bg-bg-subtle">Resolve</button>
                      {!row.driverId && (
                        <button className="rounded px-2 py-1.5 text-left hover:bg-bg-subtle">Assign to driver</button>
                      )}
                    </div>
                  )
                : undefined
            }
          />
        )}
      </Card>

    </div>
  );
}

const LazyDashboardMap = lazy(() => import('./components/DashboardMapPreview'));
