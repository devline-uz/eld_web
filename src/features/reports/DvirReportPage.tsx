// owner: web-reports-transfer — W-14 Reports · DVIR report.
// Design: web/roles and screens/admin panel/Reports — inspection and defect history.jpg
// Route `/reports/dvir?from=&to=&unit=&defect=` · Perm `reports` READ (+ `dvir`) · not for DISPATCHER.
//
// Rows are the real DVIR, defect, driver and unit lists joined client-side (as W-09 does). Two
// things the backend cannot answer yet are left out, not faked (gap B-47): the `from`/`to` filter on
// `GET /dvir` (the newest 200 are read and the range applied to `submittedAt` in the carrier zone),
// and the expected-inspection schedule behind `Missing pre-trip`, `Not submitted` and `98% compliance`.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, Calendar, ClipboardCheck, Clock, Download, Wrench } from 'lucide-react';
import { useDynamicSubtitle } from '@/app/layouts/Topbar';
import { useAuth } from '@/shared/auth/AuthProvider';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import {
  useCarrierTransferConfig,
  useDvirReportRows,
  useGenerateReport,
  useReportVehicles,
  type DvirReportRow,
} from '@/shared/api/reports';
import type { DefectSeverity } from '@/shared/api/dvir';
import { formatCarrier } from '@/shared/format/datetime';
import { EMPTY } from '@/shared/format/empty';
import { formatNumber } from '@/shared/format/numbers';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge, SeverityBadge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { EMPTY_STATE_COPY } from '@/shared/ui/copy';
import { DataTable } from '@/shared/ui/DataTable';
import { DateRangePicker } from '@/shared/ui/DateRangePicker';
import { KpiCard, KpiRowSkeleton } from '@/shared/ui/KpiCard';
import { Pagination } from '@/shared/ui/Pagination';
import { EmptyState, ErrorState, ForbiddenState } from '@/shared/ui/states';
import { ActionAlert } from './components/ActionAlert';
import { ScheduleReportModal } from './components/ScheduleReportModal';
import { SelectMenu } from './components/SelectMenu';
import {
  CARRIER_TZ_FALLBACK,
  dateOfDayKey,
  dayKeyOf,
  rangeLabel,
  refusalText,
  visibleReportRoutes,
} from './reportMeta';
import { useExportWhenReady, useReportReadyToasts } from './useReportJobs';
import { useReportRange } from './useReportRange';

const TYPE_LABEL: Record<string, string> = { PRE_TRIP: 'Pre-trip', POST_TRIP: 'Post-trip', INTERMEDIATE: 'Intermediate' };
const SEVERITY_RANK: Record<DefectSeverity, number> = { CRITICAL: 3, MAJOR: 2, MINOR: 1 };
const DAY_MS = 86_400_000;

function worstSeverity(row: DvirReportRow): DefectSeverity | null {
  return row.defects.reduce<DefectSeverity | null>(
    (worst, d) => (!worst || SEVERITY_RANK[d.severity] > SEVERITY_RANK[worst] ? d.severity : worst),
    null,
  );
}

function StatusBadge({ row }: { row: DvirReportRow }) {
  if (row.vehicleCondition === 'SATISFACTORY') return <Badge tone="success" dot>No defects</Badge>;
  if (row.repairStatus === 'REPAIRED') return <Badge tone="info" dot>Fixed</Badge>;
  return <Badge tone="danger" dot>Not fixed</Badge>;
}

export default function DvirReportPage() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const { user } = useAuth();
  const carrier = useCarrierTransferConfig(can('carrierSettings'));
  const timezone = carrier.data?.timezone ?? CARRIER_TZ_FALLBACK;
  const { from, to, params, setRange, setParam } = useReportRange(timezone);
  const unit = params.get('unit') ?? undefined;
  const defectType = params.get('defect');

  const data = useDvirReportRows(unit);
  const vehicles = useReportVehicles();
  const generate = useGenerateReport();
  const exportCsv = useExportWhenReady();
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  useReportReadyToasts();

  const inRange = useMemo(
    () =>
      data.rows.filter((r) => {
        const day = formatCarrier(r.submittedAt, timezone, 'yyyy-MM-dd');
        return day >= from && day <= to;
      }),
    [data.rows, timezone, from, to],
  );
  const categories = useMemo(
    () => [...new Set(inRange.flatMap((r) => r.defects.map((d) => d.category)))].sort(),
    [inRange],
  );
  const rows = useMemo(
    () => (defectType ? inRange.filter((r) => r.defects.some((d) => d.category === defectType)) : inRange),
    [inRange, defectType],
  );
  // Rows are paged client-side, so a shrinking list (a refetch, an invalidation from another
  // screen) can leave `page` past the last one and the table empty with no way back except
  // Previous. Step to the last page that still has rows, the way W-01 does.
  const totalPages = Math.max(1, Math.ceil(rows.length / limit));
  const currentPage = Math.min(page, totalPages);
  if (currentPage !== page) setPage(currentPage);
  const pageRows = rows.slice((currentPage - 1) * limit, currentPage * limit);

  const kpi = useMemo(() => {
    const withDefects = rows.filter((r) => r.vehicleCondition === 'DEFECTS_FOUND').length;
    const defects = rows.flatMap((r) => r.defects);
    const critical = defects.filter((d) => d.severity === 'CRITICAL').length;
    const fixed = defects.filter((d) => d.resolvedAt);
    const avgDays = fixed.length
      ? fixed.reduce((acc, d) => acc + (Date.parse(d.resolvedAt as string) - Date.parse(d.createdAt)), 0) / fixed.length / DAY_MS
      : null;
    return { withDefects, critical, avgDays };
  }, [rows]);

  useDynamicSubtitle(`${rangeLabel(from, to)} · ${rows.length} inspections · ${kpi.withDefects} with defects`);

  const columns = useMemo<ColumnDef<DvirReportRow, unknown>[]>(
    () => [
      {
        id: 'submittedAt',
        header: 'Date & time',
        cell: ({ row }) => <span className="tabular-nums">{formatCarrier(row.original.submittedAt, timezone, 'MMM dd, HH:mm')}</span>,
      },
      {
        id: 'unit',
        header: 'Unit',
        cell: ({ row }) =>
          row.original.vehicle ? (
            <span className="font-semibold tabular-nums text-text">{`#${row.original.vehicle.unitNumber}`}</span>
          ) : (
            <span className="text-text-muted">{EMPTY.unassigned}</span>
          ),
      },
      {
        id: 'driver',
        header: 'Driver',
        cell: ({ row }) => {
          const d = row.original.driver;
          if (!d) return <span className="text-text-muted">{EMPTY.unassigned}</span>;
          const name = `${d.firstName} ${d.lastName}`;
          return (
            <span className="flex items-center gap-2">
              <Avatar name={name} size="sm" />
              <span className="font-medium text-text">{name}</span>
            </span>
          );
        },
      },
      { id: 'type', header: 'Type', cell: ({ row }) => TYPE_LABEL[row.original.type] ?? row.original.type },
      {
        id: 'defects',
        header: 'Defects',
        cell: ({ row }) =>
          row.original.defects.length ? (
            row.original.defects.map((d) => d.category).join(' · ')
          ) : (
            <span className="text-text-muted">{EMPTY.none}</span>
          ),
      },
      {
        id: 'severity',
        header: 'Severity',
        cell: ({ row }) => {
          const worst = worstSeverity(row.original);
          return worst ? <SeverityBadge severity={worst} /> : <span className="text-text-muted">{EMPTY.dash}</span>;
        },
      },
      {
        id: 'correctedBy',
        header: 'Corrected by',
        cell: ({ row }) => {
          const r = row.original;
          if (r.mechanicName) return r.mechanicName;
          if (r.vehicleCondition === 'DEFECTS_FOUND' && r.repairStatus !== 'REPAIRED') {
            return <span className="text-warning">{EMPTY.unassigned}</span>;
          }
          return <span className="text-text-muted">{EMPTY.dash}</span>;
        },
      },
      {
        id: 'status',
        header: 'Status',
        meta: { numeric: true },
        cell: ({ row }) => (
          <span className="flex justify-end">
            <StatusBadge row={row.original} />
          </span>
        ),
      },
    ],
    [timezone],
  );

  if (data.error?.isForbidden) return <ForbiddenState screenName="Reports · DVIR report" />;

  const reportOptions = visibleReportRoutes((key) => can(key), user?.role).map((r) => ({ value: r.to, label: r.label }));
  const unitOptions = [
    { value: 'all', label: 'All units' },
    ...(vehicles.data?.items ?? []).map((v) => ({ value: v.id, label: `#${v.unitNumber}` })),
  ];
  const empty = EMPTY_STATE_COPY.dvir;

  return (
    <div className="flex flex-col gap-card-gap">
      <div className="flex flex-wrap items-center gap-2">
        <SelectMenu name="Report" value="/reports/dvir" options={reportOptions} onSelect={(next) => navigate(next)} />
        <DateRangePicker
          value={{ from: dateOfDayKey(from), to: dateOfDayKey(to) }}
          onChange={(range) => {
            setPage(1);
            setRange(dayKeyOf(range.from), dayKeyOf(range.to));
          }}
        />
        <SelectMenu
          name="Unit"
          value={unit ?? 'all'}
          options={unitOptions}
          onSelect={(value) => {
            setPage(1);
            setParam('unit', value === 'all' ? null : value);
          }}
        />
        <SelectMenu
          name="Defect type"
          value={defectType ?? 'all'}
          options={[{ value: 'all', label: 'All defect types' }, ...categories.map((c) => ({ value: c, label: c }))]}
          onSelect={(value) => {
            setPage(1);
            setParam('defect', value === 'all' ? null : value);
          }}
        />
        <div className="ml-auto flex items-center gap-2">
          <Can perm="reports" level="FULL">
            <Button variant="secondary" iconLeft={<Calendar size={16} strokeWidth={1.75} />} onClick={() => setScheduleOpen(true)}>
              Schedule
            </Button>
          </Can>
          <Button
            variant="secondary"
            iconLeft={<Download size={16} strokeWidth={1.75} />}
            loading={exportCsv.isPending}
            disabled={exportCsv.isPending}
            onClick={() => exportCsv.start({ kind: 'dvir', params: { from, to, ...(unit ? { vehicleId: unit } : {}) } })}
          >
            Export CSV
          </Button>
          <Button
            variant="primary"
            iconLeft={<Download size={16} strokeWidth={1.75} />}
            loading={generate.isPending}
            disabled={generate.isPending}
            onClick={() => {
              setPdfError(null);
              generate.mutate(
                { type: 'DVIR', format: 'PDF', params: { from, to, ...(unit ? { vehicleId: unit } : {}) } },
                { onError: (error) => setPdfError(refusalText(error)) },
              );
            }}
          >
            Download PDF
          </Button>
        </div>
      </div>

      <ActionAlert
        message={pdfError ?? exportCsv.error}
        onDismiss={() => {
          setPdfError(null);
          exportCsv.clearError();
        }}
      />

      {data.isLoading ? (
        <KpiRowSkeleton />
      ) : (
        <div className="grid grid-cols-4 gap-card-gap">
          <KpiCard label="Inspections submitted" value={data.isError ? EMPTY.dash : formatNumber(rows.length)} icon={ClipboardCheck} iconTone="info" />
          <KpiCard
            label="With defects"
            value={data.isError ? EMPTY.dash : formatNumber(kpi.withDefects)}
            chip={!data.isError && kpi.critical > 0 ? { text: `${kpi.critical} critical`, tone: 'danger' } : undefined}
            icon={Wrench}
            iconTone="warning"
          />
          <KpiCard
            label="Average time to fix"
            value={data.isError || kpi.avgDays === null ? EMPTY.dash : `${kpi.avgDays.toFixed(1)} days`}
            icon={Clock}
            iconTone="success"
          />
          <KpiCard label="Missing pre-trip" value={EMPTY.dash} icon={AlertTriangle} iconTone="danger" />
        </div>
      )}

      <Card padded={false}>
        <div className="p-card">
          <SectionHeader
            title="Inspection reports"
            subtitle="Driver and mechanic signatures are attached to every record"
            action={
              !data.isLoading && !data.isError ? (
                <Badge tone="neutral" className="tabular-nums">{`${rows.length} records · showing ${pageRows.length}`}</Badge>
              ) : undefined
            }
          />
        </div>
        {data.isError ? (
          <ErrorState title="Could not load inspections" description={refusalText(data.error)} onRetry={data.refetch} />
        ) : (
          <>
            <DataTable
              caption="Inspection reports"
              data={pageRows}
              columns={columns}
              getRowId={(r) => r.id}
              isLoading={data.isLoading}
              emptyState={<EmptyState title={empty.title} description={empty.description} />}
            />
            {rows.length > 0 && (
              <Pagination
                page={currentPage}
                limit={limit}
                total={rows.length}
                totalPages={totalPages}
                itemLabel="inspections"
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
          reportType="DVIR"
          params={{ from, to, ...(unit ? { vehicleId: unit } : {}) }}
          timezone={timezone}
        />
      </Can>
    </div>
  );
}
