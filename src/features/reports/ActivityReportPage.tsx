// owner: web-reports-transfer — W-13 Reports · Activity report.
// Design: web/roles and screens/admin panel/Reports — duty totals and distance by driver.jpg
// Route `/reports/activity?from=&to=&terminal=` · Perm `reports` READ · every role.
//
// KPIs and one page of per-driver duty totals come from ONE `GET /reports/activity/summary` (B-46),
// the RODS engine's totals aggregated server-side, paged and sorted by the server — never one
// `GET /logs/:driverId/range` per driver (web/bugs.md WB-048, web/decisions.md WD-070). A `null`
// `vs prev.` delta renders `—`; `mi/day` is not drawn because the summary carries no driver-day count.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, Calendar, ChevronRight, Clock, Printer, Route, Upload, Users } from 'lucide-react';
import { useDynamicSubtitle } from '@/app/layouts/Topbar';
import { useAuth } from '@/shared/auth/AuthProvider';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import type { ApiError } from '@/shared/api/errors';
import {
  useActivitySummary,
  useCarrierTransferConfig,
  useReportDrivers,
  type ActivitySummaryItem,
} from '@/shared/api/reports';
import { EMPTY } from '@/shared/format/empty';
import { formatHosHours } from '@/shared/format/hos';
import { formatDistance, formatNumber } from '@/shared/format/numbers';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { EMPTY_STATE_COPY } from '@/shared/ui/copy';
import { DataTable } from '@/shared/ui/DataTable';
import { DateRangePicker } from '@/shared/ui/DateRangePicker';
import { KpiCard, KpiRowSkeleton, type KpiCardProps } from '@/shared/ui/KpiCard';
import { Pagination } from '@/shared/ui/Pagination';
import { EmptyState, ErrorState, ForbiddenState } from '@/shared/ui/states';
import { ActionAlert } from './components/ActionAlert';
import { ScheduleReportModal } from './components/ScheduleReportModal';
import { SelectMenu } from './components/SelectMenu';
import {
  ACTIVITY_EXPORT_SCOPE,
  CARRIER_TZ_FALLBACK,
  dateOfDayKey,
  dayKeyOf,
  rangeLabel,
  refusalText,
  visibleReportRoutes,
} from './reportMeta';
import { useExportWhenReady, useReportReadyToasts } from './useReportJobs';
import { useReportRange } from './useReportRange';

const hours = (sec: number) => `${formatNumber(Math.floor(sec / 3600))} h`;

/** The design draws `John Smith`; the summary sends `Smith, John`. The drivers list wins when loaded. */
function displayName(item: ActivitySummaryItem, nameOf: Map<string, string>): string {
  const known = nameOf.get(item.driverId);
  if (known) return known;
  const comma = item.name.indexOf(', ');
  return comma > 0 ? `${item.name.slice(comma + 2)} ${item.name.slice(0, comma)}` : item.name;
}

/** Server sort — the client never re-sorts one page in isolation. */
const SORT = 'name:asc';

/** `↑ 6% vs prev.` / `↓ 8 vs prev.`; a `null` delta (no prior period) is `—`, never `0`. */
function deltaChip(value: number | null | undefined, unit: '%' | '', upIsGood: boolean): NonNullable<KpiCardProps['chip']> {
  if (value === null || value === undefined) return { text: EMPTY.dash, tone: 'neutral' };
  const arrow = value > 0 ? '↑ ' : value < 0 ? '↓ ' : '';
  const good = value === 0 || (value > 0) === upIsGood;
  return { text: `${arrow}${formatNumber(Math.abs(value))}${unit} vs prev.`, tone: good ? 'success' : upIsGood ? 'neutral' : 'danger' };
}

export default function ActivityReportPage() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const { user } = useAuth();
  const carrier = useCarrierTransferConfig(can('carrierSettings'));
  const timezone = carrier.data?.timezone ?? CARRIER_TZ_FALLBACK;
  const { from, to, params, setRange, setParam } = useReportRange(timezone);
  const terminal = params.get('terminal');

  const exportCsv = useExportWhenReady();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  useReportReadyToasts();

  // ACTIVE drivers only, as before; the backend otherwise includes every status with a log in range.
  const summary = useActivitySummary({ from, to, page, limit, sort: SORT, status: 'ACTIVE', ...(terminal ? { terminal } : {}) });
  const error = summary.error as ApiError | null;
  // One drivers read (≤ 200 rows) for names and the terminal options. The terminal FILTER is the
  // server's (`GET /reports/activity/summary?terminal=`, B-46/D-078): rows, total and pages all come
  // from that one filtered answer, so the pager and the table always agree (web/bugs.md WB-098).
  const drivers = useReportDrivers();
  const nameOf = useMemo(
    () => new Map((drivers.data?.items ?? []).map((d) => [d.id, `${d.firstName} ${d.lastName}`])),
    [drivers.data],
  );
  const terminals = useMemo(() => {
    const known = new Set(
      (drivers.data?.items ?? [])
        .filter((d) => d.status === 'ACTIVE')
        .map((d) => d.homeTerminalName)
        .filter((t): t is string => Boolean(t)),
    );
    // A deep-linked terminal outside the first 200 drivers still shows as the selected option.
    if (terminal) known.add(terminal);
    return [...known].sort();
  }, [drivers.data, terminal]);
  const rows = summary.data?.items ?? [];
  const total = summary.data?.total ?? 0;
  const totalPages = summary.data?.totalPages ?? 1;
  // The server can answer a page that no longer exists (drivers deactivated, the range narrowed
  // between two requests) with an empty `items`: step back to the last page that still has rows
  // instead of leaving the table blank with no reachable page button.
  if (summary.data && total > 0 && page > totalPages) setPage(Math.max(1, totalPages));
  const kpis = summary.data?.kpis;
  const onDutyPct =
    kpis && kpis.drivingSec + kpis.onDutySec > 0
      ? Math.round((kpis.onDutySec / (kpis.drivingSec + kpis.onDutySec)) * 100)
      : null;

  useDynamicSubtitle(`${rangeLabel(from, to)} · ${formatNumber(total)} drivers · duty totals and distance`);

  const columns = useMemo<ColumnDef<ActivitySummaryItem, unknown>[]>(
    () => [
      {
        id: 'driver',
        header: 'Driver',
        cell: ({ row }) => {
          const name = displayName(row.original, nameOf);
          return (
            <span className="flex items-center gap-2">
              <Avatar name={name} size="sm" />
              <span className="font-medium text-text">{name}</span>
            </span>
          );
        },
      },
      { id: 'days', header: 'Days', meta: { numeric: true }, cell: ({ row }) => <Num>{row.original.days}</Num> },
      { id: 'off', header: 'Off', meta: { numeric: true }, cell: ({ row }) => <Num className="text-text-muted">{formatHosHours(row.original.offSec)}</Num> },
      { id: 'sb', header: 'SB', meta: { numeric: true }, cell: ({ row }) => <Num className="text-violet">{formatHosHours(row.original.sbSec)}</Num> },
      { id: 'driving', header: 'Driving', meta: { numeric: true }, cell: ({ row }) => <Num className="font-semibold text-success">{formatHosHours(row.original.drivingSec)}</Num> },
      { id: 'on', header: 'On', meta: { numeric: true }, cell: ({ row }) => <Num className="text-danger">{formatHosHours(row.original.onSec)}</Num> },
      { id: 'distance', header: 'Distance', meta: { numeric: true }, cell: ({ row }) => <Num className="font-semibold text-text">{formatDistance(row.original.distanceMi)}</Num> },
      {
        id: 'violations',
        header: 'Violations',
        meta: { numeric: true },
        cell: ({ row }) => (
          <span className="flex justify-end">
            {row.original.violations > 0 ? (
              <Badge tone="danger" className="tabular-nums">{row.original.violations}</Badge>
            ) : (
              <Badge tone="success">None</Badge>
            )}
          </span>
        ),
      },
      {
        id: 'certified',
        header: 'Certified',
        meta: { numeric: true },
        cell: ({ row }) => {
          const { certifiedDays: c, days: d } = row.original;
          return <Num className={c < d ? 'text-warning' : 'text-success'}>{`${c} / ${d}`}</Num>;
        },
      },
      {
        id: 'open',
        header: '',
        cell: ({ row }) => (
          <span className="flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<ChevronRight size={14} strokeWidth={1.75} />}
              aria-label={`Open logs for ${displayName(row.original, nameOf)}`}
              onClick={() => navigate(`/hos-logs?driverId=${row.original.driverId}&date=${to}`)}
            >
              Open logs
            </Button>
          </span>
        ),
      },
    ],
    [navigate, to, nameOf],
  );

  if (error?.isForbidden) return <ForbiddenState screenName="Reports · Activity report" />;

  const reportOptions = visibleReportRoutes((key) => can(key), user?.role).map((r) => ({ value: r.to, label: r.label }));
  const empty = EMPTY_STATE_COPY.drivers;

  return (
    <div className="flex flex-col gap-card-gap">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <SelectMenu name="Report" value="/reports/activity" options={reportOptions} onSelect={(next) => navigate(next)} />
        <DateRangePicker
          value={{ from: dateOfDayKey(from), to: dateOfDayKey(to) }}
          onChange={(range) => {
            setPage(1);
            setRange(dayKeyOf(range.from), dayKeyOf(range.to));
          }}
        />
        <SelectMenu
          name="Terminal"
          value={terminal ?? 'all'}
          options={[{ value: 'all', label: 'All terminals' }, ...terminals.map((t) => ({ value: t, label: t }))]}
          onSelect={(value) => {
            setPage(1);
            setParam('terminal', value === 'all' ? null : value);
          }}
        />
        <SelectMenu name="Group by" value="driver" options={[{ value: 'driver', label: 'Group by driver' }]} disabled />
        <div className="ml-auto flex items-center gap-2">
          <Can perm="reports" level="FULL">
            <Button variant="secondary" iconLeft={<Calendar size={16} strokeWidth={1.75} />} onClick={() => setScheduleOpen(true)}>
              Schedule
            </Button>
          </Can>
          <Button
            variant="secondary"
            iconLeft={<Upload size={16} strokeWidth={1.75} />}
            loading={exportCsv.isPending}
            disabled={exportCsv.isPending}
            aria-describedby={terminal ? 'activity-export-scope' : undefined}
            onClick={() => exportCsv.start({ kind: 'activity', params: { from, to } })}
          >
            Export CSV
          </Button>
          <Button variant="secondary" iconLeft={<Printer size={16} strokeWidth={1.75} />} onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      {terminal && (
        // `GET /reports/activity` takes only `from`/`to`/`driverId`: the file cannot be narrowed to a
        // terminal or to ACTIVE drivers, so say so instead of exporting something else (WB-097).
        <p id="activity-export-scope" className="text-caption text-text-muted print:hidden">
          {ACTIVITY_EXPORT_SCOPE}
        </p>
      )}

      <ActionAlert message={exportCsv.error} onDismiss={exportCsv.clearError} />

      {summary.isLoading ? (
        <KpiRowSkeleton />
      ) : (
        <div className="grid grid-cols-4 gap-card-gap">
          <KpiCard
            label="Total driving"
            value={summary.isError || !kpis ? EMPTY.dash : hours(kpis.drivingSec)}
            chip={summary.isError || !kpis ? undefined : deltaChip(kpis.drivingDeltaPct, '%', true)}
            icon={Clock}
            iconTone="success"
          />
          <KpiCard
            label="Total on-duty"
            value={summary.isError || !kpis ? EMPTY.dash : hours(kpis.onDutySec)}
            chip={!summary.isError && onDutyPct !== null ? { text: `${onDutyPct}% of total`, tone: 'neutral' } : undefined}
            icon={Users}
            iconTone="danger"
          />
          <KpiCard
            label="Distance driven"
            value={summary.isError || !kpis ? EMPTY.dash : formatDistance(kpis.distanceMi)}
            icon={Route}
            iconTone="info"
          />
          <KpiCard
            label="Violations"
            value={summary.isError || !kpis ? EMPTY.dash : formatNumber(kpis.violations)}
            chip={summary.isError || !kpis ? undefined : deltaChip(kpis.violationsDelta, '', false)}
            icon={AlertTriangle}
            iconTone="danger"
          />
        </div>
      )}

      <Card padded={false}>
        <div className="p-card">
          <SectionHeader
            title="Duty totals by driver"
            subtitle="Totals are calculated from certified and uncertified logs"
            action={
              !summary.isLoading && !summary.isError ? (
                <Badge tone="neutral" className="tabular-nums">{`${formatNumber(total)} drivers · showing ${rows.length}`}</Badge>
              ) : undefined
            }
          />
        </div>
        {summary.isError ? (
          <ErrorState title="Could not load duty totals" description={refusalText(error)} onRetry={() => void summary.refetch()} />
        ) : (
          <>
            <DataTable
              caption="Duty totals by driver"
              data={rows}
              columns={columns}
              getRowId={(r) => r.driverId}
              isLoading={summary.isLoading}
              emptyState={<EmptyState title={empty.title} description={empty.description} />}
            />
            {total > 0 && (
              <Pagination
                page={page}
                limit={limit}
                total={total}
                totalPages={Math.max(1, totalPages)}
                itemLabel="drivers"
                onPageChange={setPage}
                onLimitChange={(next) => {
                  setLimit(next);
                  setPage(1);
                }}
              />
            )}
          </>
        )}
      </Card>

      <Can perm="reports" level="FULL">
        <ScheduleReportModal
          open={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          reportType="ACTIVITY"
          params={{ from, to }}
          timezone={timezone}
        />
      </Can>
    </div>
  );
}

function Num({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`block text-right tabular-nums ${className ?? ''}`}>{children}</span>;
}
