// owner: web-reports-transfer — W-12 Reports · IFTA.
// Design: web/roles and screens/admin panel/IFTA by jurisdiction and the report library.jpg
// Route `/reports/ifta?quarter=2026-Q3` · Perm `reports` READ · not for DISPATCHER (WB-002).
//
// Gap B-46 — KPI row and `Miles by jurisdiction` read `GET /reports/ifta/summary?quarter=`.
// Fuel / MPG / tax fields may be `null` (no receipts or rates on the server): they render `—`,
// never `0`. The error state appears only when that request actually fails.
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, FileText, Fuel, Route, TrendingUp, Upload } from 'lucide-react';
import { useDynamicSubtitle } from '@/app/layouts/Topbar';
import { useAuth } from '@/shared/auth/AuthProvider';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import {
  useTransferConfig,
  useGenerateReport,
  useIftaSummary,
  useReportVehicles,
  type IftaJurisdictionRow,
  type IftaKpis,
} from '@/shared/api/reports';
import { EMPTY } from '@/shared/format/empty';
import { formatJurisdiction } from '@/shared/format/jurisdiction';
import { formatFuel, formatMoney, formatMpg, formatNumber, formatPercent } from '@/shared/format/numbers';
import { Button } from '@/shared/ui/Button';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { cn } from '@/shared/ui/cn';
import { DataTable } from '@/shared/ui/DataTable';
import { KpiCard, KpiRowSkeleton, type KpiChip } from '@/shared/ui/KpiCard';
import { EmptyState, ErrorState } from '@/shared/ui/states';
import { ActionAlert } from './components/ActionAlert';
import { RecentlyGeneratedCard } from './components/RecentlyGeneratedCard';
import { ReportLibraryCard } from './components/ReportLibraryCard';
import { ScheduleReportModal } from './components/ScheduleReportModal';
import { SelectMenu } from './components/SelectMenu';
import {
  CARRIER_TZ_FALLBACK,
  previousQuarters,
  quarterLabel,
  quarterOf,
  quarterSpanLabel,
  refusalText,
  todayKey,
  visibleReportRoutes,
} from './reportMeta';
import { useExportWhenReady, useGuardedMutate, useReportReadyToasts, useTrackedReport } from './useReportJobs';
import { useNavigate } from 'react-router-dom';

const QUARTER_RE = /^\d{4}-Q[1-4]$/;

type IftaTableRow = IftaJurisdictionRow & { isTotal?: boolean };

const TOTAL_ROW_ID = '__totals';

/** `—` muted for a value the server did not send (§8.4). */
function Cell({ text, className }: { text: string; className?: string }) {
  return <span className={cn(text === EMPTY.dash ? 'text-text-muted' : className)}>{text}</span>;
}

/** W-12 columns — all numeric, right-aligned and tabular (DataTable `meta.numeric`). */
const IFTA_COLUMNS: ColumnDef<IftaTableRow, unknown>[] = [
  {
    id: 'jurisdiction',
    header: 'Jurisdiction',
    enableSorting: false,
    cell: ({ row }) => <span className="font-semibold text-text">{formatJurisdiction(row.original.jurisdiction)}</span>,
  },
  { id: 'totalMiles', header: 'Total miles', enableSorting: false, meta: { numeric: true }, cell: ({ row }) => <Cell text={formatNumber(row.original.totalMiles)} /> },
  { id: 'taxableMiles', header: 'Taxable miles', enableSorting: false, meta: { numeric: true }, cell: ({ row }) => <Cell text={formatNumber(row.original.taxableMiles)} /> },
  { id: 'fuelGal', header: 'Fuel (gal)', enableSorting: false, meta: { numeric: true }, cell: ({ row }) => <Cell text={formatNumber(row.original.fuelGal)} /> },
  { id: 'mpg', header: 'MPG', enableSorting: false, meta: { numeric: true }, cell: ({ row }) => <Cell text={formatMpg(row.original.mpg)} /> },
  {
    id: 'taxDueUsd',
    header: 'Tax due',
    enableSorting: false,
    meta: { numeric: true },
    cell: ({ row }) => <Cell text={formatMoney(row.original.taxDueUsd)} className="font-semibold text-text" />,
  },
];

/** `↑ 0.2 vs Q2` — only when both quarters have an MPG; the delta is one-decimal like MPG itself. */
function mpgDeltaChip(kpis: IftaKpis, quarter: string): KpiChip | undefined {
  if (kpis.fleetMpg === null || kpis.fleetMpgPrev === null) return undefined;
  const delta = Math.round((kpis.fleetMpg - kpis.fleetMpgPrev) * 10) / 10;
  const prev = (previousQuarters(quarter, 2)[1] ?? quarter).slice(-2);
  if (delta === 0) return { text: `${formatMpg(0)} vs ${prev}`, tone: 'neutral' };
  return { text: `${delta > 0 ? '↑' : '↓'} ${formatMpg(Math.abs(delta))} vs ${prev}`, tone: delta > 0 ? 'success' : 'danger' };
}

export default function IftaReportPage() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  // B-45 (shipped) — `GET /carrier/transfer-config` is `reports` READ, so FLEET_MANAGER reads the
  // real carrier zone and eRODS mode too.
  const carrier = useTransferConfig();
  const timezone = carrier.data?.timezone ?? CARRIER_TZ_FALLBACK;
  const current = quarterOf(todayKey(timezone));
  const requested = params.get('quarter') ?? '';
  const quarter = QUARTER_RE.test(requested) ? requested : current;

  const summary = useIftaSummary(quarter);
  const vehicles = useReportVehicles();
  const units = summary.data?.unitCount ?? vehicles.data?.total;
  const kpis = summary.data?.kpis;
  const tableRows: IftaTableRow[] = summary.data?.rows.length
    ? [...summary.data.rows, { ...summary.data.totals, jurisdiction: 'Total', isTotal: true }]
    : [];
  useDynamicSubtitle(
    `${quarterLabel(quarter)} · ${quarterSpanLabel(quarter)}${typeof units === 'number' ? ` · ${units} units` : ''}`,
  );
  useReportReadyToasts();

  // WB-146 — every queueing click goes through the single-flight guard, not just the disabled attribute.
  const generate = useGuardedMutate(useGenerateReport());
  // WB-166 — the queued job is followed to READY/FAILED so `Generate report` confirms on screen
  // without depending on a `report.ready` socket frame.
  const csvJob = useTrackedReport();
  const exportCsv = useExportWhenReady();
  // B-96 (shipped 2026-09-24) — `Download IFTA PDF` uses the READ shortcut (`format=PDF`), same as
  // Export CSV, no longer `POST /reports/generate` (`reports` FULL).
  const exportPdf = useExportWhenReady({ announce: true });
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const reportOptions = visibleReportRoutes((key) => can(key), user?.role).map((r) => ({ value: r.to, label: r.label }));
  const quarterOptions = previousQuarters(current, 5).map((q) => ({ value: q, label: quarterLabel(q) }));

  const generateCsv = () => {
    setActionError(null);
    generate.mutate(
      { type: 'IFTA', format: 'CSV', params: { quarter } },
      {
        onSuccess: (queued) => csvJob.track(queued.reportId),
        onError: (error) => setActionError(refusalText(error)),
      },
    );
  };

  return (
    <div className="flex flex-col gap-card-gap">
      <div className="flex flex-wrap items-center gap-2">
        <SelectMenu name="Report" value="/reports/ifta" options={reportOptions} onSelect={(to) => navigate(to)} />
        <SelectMenu
          name="Quarter"
          value={quarter}
          options={quarterOptions}
          onSelect={(q) => setParams({ quarter: q }, { replace: true })}
        />
        {/* No jurisdiction list and no vehicle-group model on the backend (B-46, web/tz.md §20.4 Q4). */}
        <SelectMenu name="Jurisdiction" value="all" options={[{ value: 'all', label: 'All jurisdictions' }]} disabled />
        <SelectMenu name="Vehicle group" value="all" options={[{ value: 'all', label: 'All vehicle groups' }]} disabled />
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="secondary"
            iconLeft={<Upload size={16} strokeWidth={1.75} />}
            loading={exportCsv.isPending}
            disabled={exportCsv.isPending}
            onClick={() => exportCsv.start({ kind: 'ifta', params: { quarter } })}
          >
            Export CSV
          </Button>
          <Can perm="reports" level="FULL">
            <Button
              variant="primary"
              iconLeft={<FileText size={16} strokeWidth={1.75} />}
              loading={generate.isPending || csvJob.isPending}
              disabled={generate.isPending || csvJob.isPending}
              onClick={generateCsv}
            >
              Generate report
            </Button>
          </Can>
        </div>
      </div>

      <ActionAlert
        message={actionError ?? csvJob.error ?? exportCsv.error}
        onDismiss={() => {
          setActionError(null);
          csvJob.clearError();
          exportCsv.clearError();
        }}
      />

      {summary.isLoading ? (
        <KpiRowSkeleton />
      ) : (
        <div className="grid grid-cols-4 gap-card-gap">
          <KpiCard
            label="Total miles"
            value={kpis ? formatNumber(kpis.totalMiles) : EMPTY.dash}
            chip={kpis && quarter === current ? { text: `${quarter.slice(-2)} to date`, tone: 'neutral' } : undefined}
            icon={Route}
            iconTone="info"
          />
          <KpiCard
            label="Taxable miles"
            value={kpis ? formatNumber(kpis.taxableMiles) : EMPTY.dash}
            chip={kpis && kpis.taxablePct !== null ? { text: formatPercent(kpis.taxablePct), tone: 'success' } : undefined}
            icon={FileText}
            iconTone="success"
          />
          <KpiCard
            label="Fuel purchased"
            value={formatFuel(kpis?.fuelGal)}
            chip={kpis && kpis.receiptCount !== null ? { text: `${formatNumber(kpis.receiptCount)} receipts`, tone: 'neutral' } : undefined}
            icon={Fuel}
            iconTone="warning"
          />
          <KpiCard
            label="Fleet MPG"
            value={formatMpg(kpis?.fleetMpg)}
            chip={kpis ? mpgDeltaChip(kpis, quarter) : undefined}
            icon={TrendingUp}
            iconTone="violet"
          />
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_var(--spacing-side-panel)] items-start gap-card-gap">
        <Card padded={false}>
          <div className="p-card">
            <SectionHeader
              title="Miles by jurisdiction"
              subtitle={`${quarterLabel(quarter)} · IFTA-ready`}
              action={
                <Button
                  variant="secondary"
                  iconLeft={<Download size={16} strokeWidth={1.75} />}
                  loading={exportPdf.isPending}
                  disabled={exportPdf.isPending}
                  onClick={() => exportPdf.start({ kind: 'ifta', params: { quarter, format: 'PDF' } })}
                >
                  Download IFTA PDF
                </Button>
              }
            />
          </div>
          {exportPdf.error && (
            <div className="px-card pb-3">
              <ActionAlert message={exportPdf.error} onDismiss={() => exportPdf.clearError()} />
            </div>
          )}
          {summary.isError ? (
            <ErrorState
              title="Could not load jurisdiction totals"
              description={refusalText(summary.error)}
              onRetry={() => void summary.refetch()}
            />
          ) : (
            <DataTable
              caption="Miles by jurisdiction"
              data={tableRows}
              columns={IFTA_COLUMNS}
              getRowId={(r) => (r.isTotal ? TOTAL_ROW_ID : r.jurisdiction)}
              rowClassName={(r) => (r.isTotal ? 'bg-bg-subtle font-semibold' : undefined)}
              isLoading={summary.isLoading}
              emptyState={
                <EmptyState
                  icon={<Route size={24} strokeWidth={1.75} />}
                  title="No jurisdiction miles for this quarter"
                  description="Miles appear here once units drive in the selected quarter."
                />
              }
            />
          )}
        </Card>
        <ReportLibraryCard timezone={timezone} />
      </div>

      <RecentlyGeneratedCard timezone={timezone} onSchedule={() => setScheduleOpen(true)} onGenerate={generateCsv} />

      <Can perm="reports" level="FULL">
        <ScheduleReportModal
          open={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          reportType="IFTA"
          params={{ quarter }}
          timezone={timezone}
        />
      </Can>
    </div>
  );
}
