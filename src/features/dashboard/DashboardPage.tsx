// owner: web-dashboard-fleet — W-01 Fleet Dashboard (web/tz.md §10 W-01).
// Design: web/roles and screens/admin panel/Fleet overview — KPIs, live map, duty mix, violation feed.jpg
import { lazy, Suspense } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock, MapPin, Truck, Users } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate } from 'react-router-dom';
import { qk } from '@/shared/api/queryKeys';
import { ApiError } from '@/shared/api/errors';
import { hasPosition, type LiveFleetUnit } from '@/shared/api/liveFleet';
import { useDashboardSummary } from '@/shared/api/dashboardSummary';
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
import { SeverityBadge } from '@/shared/ui/Badge';
import { formatCarrier, timezoneAbbreviation } from '@/shared/format/datetime';
import { formatDuration } from '@/shared/format/duration';
import { formatNumber } from '@/shared/format/numbers';
import { formatTimeWithAge } from '@/shared/format/relative';
import type { DashboardViolation } from '@/shared/api/dashboardSummary';

const DutyDonut = lazy(() => import('./components/DutyDonut'));

export default function DashboardPage() {
  const { can } = usePermission();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Perf plan item 3 (WD-074) — one call (`GET /dashboard/summary`) replaces the 6 the KPI row,
  // map preview, duty donut, violations panel and carrier subtitle each used to fire on open.
  const summary = useDashboardSummary();

  // Real-time: `fleet` + `violations` (web/tz.md §7.5). `safety.event_created` and
  // `trip.status_changed` exist today and patch this screen point-wise; everything else (the KPI
  // counts, the violations table) rides the 30s `cachePolicy('live')` poll until §7.4 ships.
  useRoom('fleet', {
    'safety.event_created': () => void queryClient.invalidateQueries({ queryKey: qk.dashboardSummary }),
    'trip.status_changed': () => void queryClient.invalidateQueries({ queryKey: qk.dashboardSummary }),
  });
  useRoom('violations', {
    'safety.event_created': () => void queryClient.invalidateQueries({ queryKey: qk.dashboardSummary }),
  });

  const carrierTz = summary.data?.carrier.timezone ?? 'America/New_York';
  const subtitle = summary.data
    ? `${summary.data.carrier.name} · Today, ${formatCarrier(new Date(), carrierTz, 'MMM d yyyy')} · ${timezoneAbbreviation(carrierTz)}`
    : null;
  useDynamicSubtitle(subtitle);

  const units: LiveFleetUnit[] = summary.data?.liveFleet.items ?? [];
  const counts = summary.data?.liveFleet.counts;
  const onDutyCount = counts?.onDuty ?? 0;
  const movingCount = counts?.moving ?? 0;
  const idleCount = counts?.idle ?? 0;
  const offlineCount = counts?.offline ?? 0;

  const unassignedTotalSec = summary.data?.unidentified.totalDurationSec ?? 0;

  const kpiLoading = summary.isLoading;
  const activeVehicles = summary.data?.vehicles.active;
  const totalVehicles = summary.data?.vehicles.total;
  const violationsTotal = summary.data?.violations.total;
  const violationItems = summary.data?.violations.items ?? [];
  const unidentifiedTotal = summary.data?.unidentified.total;

  const columns: ColumnDef<DashboardViolation, unknown>[] = [
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
            value={summary.isError ? '—' : formatNumber(activeVehicles)}
            hint={summary.isError ? undefined : `of ${formatNumber(totalVehicles)}`}
            icon={Truck}
            iconTone="info"
          />
          <KpiCard
            label="Drivers on duty"
            value={summary.isError ? '—' : formatNumber(onDutyCount)}
            icon={Users}
            iconTone="success"
          />
          <KpiCard
            label="HOS violations · 24h"
            value={summary.isError ? '—' : formatNumber(violationsTotal)}
            icon={AlertTriangle}
            iconTone="danger"
          />
          <KpiCard
            label="Unassigned driving"
            value={summary.isError ? '—' : formatDuration(unassignedTotalSec)}
            chip={
              summary.isError
                ? undefined
                : { text: `${formatNumber(unidentifiedTotal)} segments`, tone: 'warning' }
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
                summary.isError
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
            {summary.isLoading ? (
              <div className="h-map-preview animate-pulse rounded-md bg-bg-subtle" />
            ) : summary.isError ? (
              <ErrorState
                title="Could not load the fleet"
                onRetry={() => void summary.refetch()}
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
            subtitle={summary.isError ? undefined : `${units.length} drivers · ${onDutyCount} on duty`}
          />
          <div className="mt-4">
            {summary.isLoading ? (
              <div className="h-40 animate-pulse rounded-md bg-bg-subtle" />
            ) : summary.isError ? (
              <ErrorState title="Could not load duty status" onRetry={() => void summary.refetch()} />
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
        {summary.isLoading ? (
          <DataTable data={[]} columns={columns} caption="HOS violations and alerts" isLoading />
        ) : summary.isError ? (
          <div className="p-card">
            <ErrorState
              title="Could not load violations"
              description={
                summary.error instanceof ApiError
                  ? summary.error.userMessage
                  : 'The telematics service did not respond. Your data is safe — try again in a moment.'
              }
              onRetry={() => void summary.refetch()}
            />
          </div>
        ) : violationItems.length === 0 ? (
          <div className="p-card">
            <EmptyState title="No violations in the last 24 hours" />
          </div>
        ) : (
          <DataTable
            data={violationItems}
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
