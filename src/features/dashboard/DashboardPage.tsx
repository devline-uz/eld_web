// owner: web-dashboard-fleet — W-01 Fleet Dashboard (web/tz.md §10 W-01).
// Design: web/roles and screens/admin panel/Fleet overview — KPIs, live map, duty mix, violation feed.jpg
import { lazy, Suspense, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock, MapPin, Truck, Users } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate } from 'react-router-dom';
import { client } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { qk } from '@/shared/api/queryKeys';
import { typedCachePolicy } from '@/shared/api/queryPolicy';
import type { OffsetPage } from '@/shared/api/types';
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
import { Pagination } from '@/shared/ui/Pagination';
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


/** Rows per page the violations table opens with — the first option of the shared select. */
const VIOLATIONS_PAGE_SIZE = 10;

/** B-6 `GET /violations` is server-paginated (`page`, `limit ≤ 200` → `OffsetPage`). */
function useDashboardViolations(page: number, limit: number) {
  return useQuery({
    queryKey: qk.violations({ window: '24h', page, limit }),
    queryFn: () =>
      client.get<OffsetPage<DashboardViolation>>(endpoints.violations.list, {
        params: { window: '24h', page, limit },
      }),
    ...typedCachePolicy<OffsetPage<DashboardViolation>>('list'),
    // Changing page keeps the current rows on screen instead of flashing the table skeleton.
    placeholderData: keepPreviousData,
  });
}

export default function DashboardPage() {
  const { can } = usePermission();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Perf plan item 3 (WD-074) — one call (`GET /dashboard/summary`) feeds the KPI row, map
  // preview, duty donut and carrier subtitle. The violations table keeps its own server-paginated
  // query (B-6) so page/limit work; that is the only other request on open.
  const summary = useDashboardSummary();
  const [violationsPage, setViolationsPage] = useState(1);
  const [violationsLimit, setViolationsLimit] = useState(VIOLATIONS_PAGE_SIZE);
  const violations = useDashboardViolations(violationsPage, violationsLimit);
  const violationsTotal = violations.data?.total ?? 0;
  const violationsTotalPages =
    violations.data?.totalPages ?? Math.max(1, Math.ceil(violationsTotal / violationsLimit));
  // A resolve or the 24h window rolling over can shrink the list under the current page: step back
  // to the last page that still has rows rather than showing the empty state.
  if (violations.data && violationsTotal > 0 && violationsPage > violationsTotalPages) {
    setViolationsPage(violationsTotalPages);
  }

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
  const violationItems = violations.data?.items ?? [];
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
        ) : violationItems.length === 0 ? (
          <div className="p-card">
            <EmptyState title="No violations in the last 24 hours" />
          </div>
        ) : (
          <>
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
            <Pagination
              page={violationsPage}
              limit={violationsLimit}
              total={violationsTotal}
              totalPages={violationsTotalPages}
              itemLabel="violations"
              onPageChange={setViolationsPage}
              onLimitChange={(limit) => {
                setViolationsLimit(limit);
                setViolationsPage(1);
              }}
            />
          </>
        )}
      </Card>

    </div>
  );
}

const LazyDashboardMap = lazy(() => import('./components/DashboardMapPreview'));
