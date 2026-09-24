// owner: web-reports-transfer — ⭐ W-15 Reports · FMCSA / DOT audit pack.
// Design: web/roles and screens/admin panel/Reports — FMCSA : DOT pack and eRODS transfer.jpg
// Route `/reports/fmcsa?from=&to=&driver=` (+ `transfer=1&driverId=&date=` opens 11.14) ·
// Perm `reportsTransfer` · ADMIN and FLEET_MANAGER only — the route is not registered for the others.
//
// KPIs are real: `Daily logs included` / `Uncertified logs` come from ONE request — the picked driver's
// `GET /logs/:driverId/range`, or `GET /reports/activity/summary` for all drivers; never one range call
// per driver (web/bugs.md WB-048, WD-070). `DVIRs included` the inspections in range, `Unassigned
// segments` the PENDING unidentified segments. B-48 (shipped): `All units ▾` sends `vehicleId` (the
// pack keeps only drivers who operated that unit) and the six "contains" rows are real `include[]`
// options — all six ticked sends no `include` at all, i.e. the full pack (web/decisions.md WD-091).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ClipboardCheck, Eye, FileText, PenLine, Send } from 'lucide-react';
import { useDynamicSubtitle } from '@/app/layouts/Topbar';
import { useAuth } from '@/shared/auth/AuthProvider';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import {
  useReportDrivers,
  fetchReportDownload,
  useTransferConfig,
  useDvirReportRows,
  usePackRodsCounts,
  usePendingUnassignedCount,
  useQueueReport,
  useReport,
  useReportsList,
  useReportVehicles,
  type FmcsaPackSection,
  type ReportRow,
  type TransferMethod,
  type TransferRow,
} from '@/shared/api/reports';
import type { ApiError } from '@/shared/api/errors';
import { inspectorEmail } from '@/shared/forms/fields';
import { LIMITS } from '@/shared/forms/messages';
import { formatCarrier } from '@/shared/format/datetime';
import { EMPTY } from '@/shared/format/empty';
import { formatNumber } from '@/shared/format/numbers';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { cn } from '@/shared/ui/cn';
import { DateRangePicker } from '@/shared/ui/DateRangePicker';
import { KpiCard, KpiRowSkeleton } from '@/shared/ui/KpiCard';
import { ForbiddenState } from '@/shared/ui/states';
import { ActionAlert } from './components/ActionAlert';
import { PreviousTransfersCard } from './components/PreviousTransfersCard';
import { SelectMenu } from './components/SelectMenu';
import { SendLogsModal, type SendLogsInitial } from './components/SendLogsModal';
import {
  daysInRange,
  CARRIER_TZ_FALLBACK,
  dateOfDayKey,
  dayKeyOf,
  rangeLabel,
  refusalText,
  saveFile,
  shiftDayKey,
  visibleReportRoutes,
} from './reportMeta';
import { TEST_BANNER_TEXT, transferRangeFor } from './sendLogs';
import { useAnnounceReport, useGuardedMutate, useReportReadyToasts } from './useReportJobs';
import { useReportRange } from './useReportRange';

const PACK_CONTENTS: { section: FmcsaPackSection; name: string; description: string }[] = [
  { section: 'RODS', name: 'Records of duty status (RODS)', description: 'Graph grid + event list for every driver and day' },
  { section: 'UNIDENTIFIED', name: 'Unidentified driving records', description: 'All unassigned segments and their resolution' },
  { section: 'EDITS', name: 'Driver log edits and annotations', description: 'Original value, edited value, reason and approver' },
  { section: 'ELD_ID', name: 'Vehicle and ELD identification', description: 'VIN, unit number, ELD serial and firmware version' },
  { section: 'DVIR', name: 'DVIRs and defect corrections', description: 'Pre-trip, post-trip and mechanic signatures' },
  // WB-177 / WD-091 — ticked by default although the image draws it unticked: §395.8 malfunction
  // and data-diagnostic records belong in an audit pack and FMCSA outranks the screenshot. The
  // operator can still untick it now that `include[]` is real (B-48).
  { section: 'MALFUNCTIONS', name: 'Malfunction and diagnostic events', description: 'Power, engine sync, timing and data-recording events' },
];
const ALL_SECTIONS: FmcsaPackSection[] = PACK_CONTENTS.map((c) => c.section);

/** `include` for the request: omitted for the full pack (the backend default), else the ticked sections in drawn order. */
function packInclude(selected: ReadonlySet<FmcsaPackSection>): FmcsaPackSection[] | undefined {
  if (selected.size === ALL_SECTIONS.length) return undefined;
  return ALL_SECTIONS.filter((s) => selected.has(s));
}

const sameSections = (a: unknown, b: FmcsaPackSection[] | undefined): boolean => {
  const left = Array.isArray(a) ? [...(a as string[])].sort().join(',') : '';
  const right = b ? [...b].sort().join(',') : '';
  return left === right;
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function packMatches(
  report: ReportRow,
  from: string,
  to: string,
  driverId: string | null,
  vehicleId: string | null,
  include: FmcsaPackSection[] | undefined,
): boolean {
  const p = report.params as { from?: string; to?: string; driverId?: string; vehicleId?: string; include?: unknown };
  return (
    p.from === from &&
    p.to === to &&
    (p.driverId ?? null) === driverId &&
    (p.vehicleId ?? null) === vehicleId &&
    sameSections(p.include, include)
  );
}

export default function FmcsaPackPage() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const { user } = useAuth();
  // B-45 (shipped) — `GET /carrier/transfer-config` is `reports` READ, so FLEET_MANAGER reads the
  // real carrier zone and eRODS mode too.
  const carrier = useTransferConfig();
  const timezone = carrier.data?.timezone ?? CARRIER_TZ_FALLBACK;
  const erodsMode = carrier.data?.erodsMode;
  const testMode = erodsMode !== 'PRODUCTION';
  const { from, to, params, setRange, setParam, update } = useReportRange(timezone);
  const driverFilter = params.get('driver');
  const unitFilter = params.get('unit');
  const [sections, setSections] = useState<ReadonlySet<FmcsaPackSection>>(() => new Set(ALL_SECTIONS));
  const include = useMemo(() => packInclude(sections), [sections]);

  useReportReadyToasts();
  const announce = useAnnounceReport();

  const totals = usePackRodsCounts(from, to, driverFilter, daysInRange(from, to));
  const dvirs = useDvirReportRows(unitFilter ?? undefined, from);
  const unassigned = usePendingUnassignedCount(from, to);
  const drivers = useReportDrivers();
  const vehicles = useReportVehicles();
  const packs = useReportsList({ type: 'FMCSA_PACK', limit: 10 });
  // WB-146 — single-flight: `isPending` alone still lets a real double click queue two packs.
  const queue = useGuardedMutate(useQueueReport());
  const [packId, setPackId] = useState<string | null>(null);
  const trackedPack = useReport(packId);
  const [actionError, setActionError] = useState<string | null>(null);

  const kpi = useMemo(() => {
    const inRange = dvirs.rows.filter((r) => {
      const day = formatCarrier(r.submittedAt, timezone, 'yyyy-MM-dd');
      return day >= from && day <= to && (!driverFilter || r.driverId === driverFilter);
    });
    return {
      ...totals.counts,
      dvirs: inRange.length,
      dvirsWithDefects: inRange.filter((r) => r.vehicleCondition === 'DEFECTS_FOUND').length,
    };
  }, [totals.counts, dvirs.rows, timezone, from, to, driverFilter]);
  const pendingSegments = unassigned.data?.total ?? 0;

  const latestPack = useMemo(() => {
    const tracked = trackedPack.data;
    if (tracked && packMatches(tracked, from, to, driverFilter, unitFilter, include)) return tracked;
    return (packs.data?.items ?? []).find((r) => packMatches(r, from, to, driverFilter, unitFilter, include));
  }, [trackedPack.data, packs.data, from, to, driverFilter, unitFilter, include]);

  // A pack generated here is announced once READY, even if `report.ready` never arrived.
  useEffect(() => {
    if (trackedPack.data) announce(trackedPack.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- announce is idempotent per report id
  }, [trackedPack.data?.status]);

  const driverName = driverFilter
    ? (() => {
        const d = drivers.data?.items.find((x) => x.id === driverFilter);
        return d ? `${d.firstName} ${d.lastName}` : 'one driver';
      })()
    : 'all drivers';
  useDynamicSubtitle(`${rangeLabel(from, to)} · ${driverName} · ready for roadside or terminal audit`);

  // Data transfer card — collected here, sent from 11.14.
  const [method, setMethod] = useState<TransferMethod>('WEB_SERVICES');
  const [recipient, setRecipient] = useState('');
  const [comment, setComment] = useState('');
  const recipientError =
    method === 'EMAIL' && recipient.length > 0 && !inspectorEmail().safeParse(recipient).success
      ? inspectorEmail().safeParse(recipient).error?.issues[0]?.message
      : undefined;

  // 11.14 — opened by `Send to inspector`, `Retry`, or the `transfer=1` deep link.
  const deepLink = params.get('transfer') === '1';
  const [modal, setModal] = useState<{ key: number; initial: SendLogsInitial } | null>(null);
  // Stable identity — `PreviousTransfersCard` memoises its columns on it.
  const retryTransfer = useCallback(
    (row: TransferRow) =>
      setModal({
        key: Date.now(),
        initial: {
          driverId: row.driverId,
          from: row.rangeStart.slice(0, 10),
          to: row.rangeEnd.slice(0, 10),
          method: row.method,
          outputFileComment: row.outputFileComment,
        },
      }),
    [],
  );
  const modalState =
    modal ??
    (deepLink
      ? {
          key: 0,
          initial: (() => {
            const date = params.get('date');
            const end = date && DAY_RE.test(date) ? date : undefined;
            return {
              driverId: params.get('driverId') ?? undefined,
              ...(end ? { to: end, from: shiftDayKey(end, -(LIMITS.transferRangeDays - 1)) } : {}),
            };
          })(),
        }
      : null);
  const closeModal = () => {
    setModal(null);
    if (deepLink) update({ transfer: null, driverId: null, date: null });
  };

  if (totals.error?.isForbidden || (drivers.error as ApiError | null)?.isForbidden) return <ForbiddenState screenName="Reports · FMCSA / DOT audit pack" />;

  const reportOptions = visibleReportRoutes((key) => can(key), user?.role).map((r) => ({ value: r.to, label: r.label }));
  const driverOptions = [
    { value: 'all', label: 'All drivers' },
    ...(drivers.data?.items ?? []).map((d) => ({ value: d.id, label: `${d.firstName} ${d.lastName}` })),
  ];
  const unitOptions = [
    { value: 'all', label: 'All units' },
    ...(vehicles.data?.items ?? []).map((v) => ({ value: v.id, label: `#${v.unitNumber}` })),
  ];
  const toggleSection = (section: FmcsaPackSection) =>
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  const noSections = sections.size === 0;
  const kpiLoading = totals.isLoading || dvirs.isLoading || unassigned.isLoading;

  return (
    <div className="flex flex-col gap-card-gap">
      <div className="flex flex-wrap items-center gap-2">
        <SelectMenu name="Report" value="/reports/fmcsa" options={reportOptions} onSelect={(next) => navigate(next)} />
        <DateRangePicker
          value={{ from: dateOfDayKey(from), to: dateOfDayKey(to) }}
          onChange={(range) => setRange(dayKeyOf(range.from), dayKeyOf(range.to))}
        />
        <SelectMenu
          name="Driver"
          value={driverFilter ?? 'all'}
          options={driverOptions}
          onSelect={(value) => setParam('driver', value === 'all' ? null : value)}
        />
        {/* B-48 — `vehicleId` keeps only the drivers who operated that unit in the range. */}
        <SelectMenu
          name="Unit"
          value={unitFilter ?? 'all'}
          options={unitOptions}
          onSelect={(value) => setParam('unit', value === 'all' ? null : value)}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="secondary"
            iconLeft={<Eye size={16} strokeWidth={1.75} />}
            disabled={latestPack?.status !== 'READY'}
            onClick={() => {
              if (!latestPack) return;
              setActionError(null);
              fetchReportDownload(latestPack.id)
                .then((file) => saveFile(file.downloadUrl, file.fileName))
                .catch((error: unknown) => setActionError(refusalText(error)));
            }}
          >
            Preview
          </Button>
          <Can perm="reportsTransfer" level="FULL">
            <Button
              variant="primary"
              iconLeft={<FileText size={16} strokeWidth={1.75} />}
              loading={queue.isPending || (trackedPack.data ? trackedPack.data.status === 'QUEUED' || trackedPack.data.status === 'RUNNING' : Boolean(packId))}
              disabled={queue.isPending || noSections}
              aria-describedby={noSections ? 'pack-sections-error' : undefined}
              onClick={() => {
                setActionError(null);
                queue.mutate(
                  {
                    kind: 'fmcsaPack',
                    params: {
                      from,
                      to,
                      ...(driverFilter ? { driverId: driverFilter } : {}),
                      ...(unitFilter ? { vehicleId: unitFilter } : {}),
                      ...(include ? { include } : {}),
                    },
                  },
                  {
                    onSuccess: (queued) => setPackId(queued.reportId),
                    onError: (error) => setActionError(refusalText(error)),
                  },
                );
              }}
            >
              Generate pack
            </Button>
          </Can>
        </div>
      </div>

      <ActionAlert message={actionError} onDismiss={() => setActionError(null)} />

      {kpiLoading ? (
        <KpiRowSkeleton />
      ) : (
        <div className="grid grid-cols-4 gap-card-gap">
          <KpiCard
            label="Daily logs included"
            value={totals.isError ? EMPTY.dash : formatNumber(kpi.dailyLogs)}
            chip={totals.isError ? undefined : { text: `${formatNumber(kpi.drivers)} drivers`, tone: 'neutral' }}
            icon={FileText}
            iconTone="info"
          />
          <KpiCard
            label="DVIRs included"
            // A capped DVIR walk (WB-096, gap B-47) is a lower bound, never a silent short count.
            value={dvirs.isError ? EMPTY.dash : `${formatNumber(kpi.dvirs)}${dvirs.complete ? '' : '+'}`}
            chip={dvirs.isError ? undefined : { text: `${formatNumber(kpi.dvirsWithDefects)} with defects`, tone: 'neutral' }}
            icon={ClipboardCheck}
            iconTone="success"
          />
          <KpiCard
            label="Unassigned segments"
            value={unassigned.isError ? EMPTY.dash : formatNumber(pendingSegments)}
            chip={!unassigned.isError && pendingSegments > 0 ? { text: 'must be resolved', tone: 'danger' } : undefined}
            icon={AlertTriangle}
            iconTone="danger"
          />
          <KpiCard
            label="Uncertified logs"
            value={totals.isError ? EMPTY.dash : formatNumber(kpi.uncertified)}
            chip={!totals.isError && kpi.uncertified > 0 ? { text: `${formatNumber(kpi.uncertifiedDrivers)} drivers`, tone: 'warning' } : undefined}
            icon={PenLine}
            iconTone="warning"
          />
        </div>
      )}

      {unitFilter && (
        // The RODS counts come from the fleet-wide activity summary, which has no unit filter; the
        // pack itself is narrowed server-side. Said out loud rather than shown as a unit count.
        <p className="text-caption text-text-muted" role="note">
          Daily log and uncertified counts are not narrowed to the unit; the pack keeps only drivers who operated it.
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_var(--spacing-side-panel)] items-start gap-card-gap">
        <Card>
          <SectionHeader
            title="What the pack contains"
            subtitle="FMCSA 49 CFR §395.8 output file format"
            action={
              latestPack?.status === 'READY' ? (
                <Badge tone="success" dot>Validated</Badge>
              ) : latestPack?.status === 'FAILED' ? (
                <Badge tone="danger" dot>Validation failed</Badge>
              ) : undefined
            }
          />
          <ul className="mt-4 flex flex-col gap-3">
            {PACK_CONTENTS.map((item) => (
              <li key={item.section}>
                <label className="flex cursor-pointer items-start gap-3">
                  {/* Choosing sections only shapes what `Generate pack` requests — READ roles see them read-only (§12.2). */}
                  <input
                    type="checkbox"
                    checked={sections.has(item.section)}
                    onChange={() => toggleSection(item.section)}
                    readOnly={!can('reportsTransfer', 'FULL')}
                    disabled={!can('reportsTransfer', 'FULL')}
                    aria-label={item.name}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-body font-medium text-text">{item.name}</span>
                    <span className="block text-card-sub text-text-muted">{item.description}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {noSections && (
            <p id="pack-sections-error" role="alert" className="mt-2 text-card-sub text-danger">
              Select at least one section.
            </p>
          )}
          {!kpiLoading && !totals.isError && !unassigned.isError && (pendingSegments > 0 || kpi.uncertified > 0) && (
            <div className="mt-4 flex items-center gap-3 rounded-md bg-warning-soft px-4 py-3 text-body text-warning">
              <AlertTriangle size={18} strokeWidth={1.75} className="shrink-0" />
              <p className="flex-1">
                {`${formatNumber(pendingSegments)} unassigned driving segments and ${formatNumber(kpi.uncertified)} uncertified logs will be flagged in the pack. Resolve them before a roadside inspection.`}
              </p>
              <Button variant="secondary" onClick={() => navigate('/hos-logs?unassigned=1')}>
                Resolve now ›
              </Button>
            </div>
          )}
        </Card>

        <Card>
          <SectionHeader title="Data transfer" subtitle="How the pack reaches the safety official" />
          <div className="mt-4 flex flex-col gap-3">
            {testMode && (
              <div role="status" className="flex gap-2 rounded-md border border-warning bg-warning-soft px-3 py-2 text-card-sub text-warning">
                <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                <p>
                  <span className="font-semibold">eRODS · TEST mode</span> — {TEST_BANNER_TEXT}
                </p>
              </div>
            )}
            <div role="radiogroup" aria-label="Transfer method" className="flex flex-col gap-2">
              {(
                [
                  { value: 'WEB_SERVICES', title: 'Web services (eRODS)', description: 'FMCSA-hosted endpoint · preferred method' },
                  { value: 'EMAIL', title: 'Email to inspector', description: 'Encrypted attachment to a fmcsa.dot.gov address' },
                ] as const
              ).map((m) => (
                <label
                  key={m.value}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3',
                    method === m.value ? 'border-primary bg-primary-soft' : 'border-border bg-bg-surface',
                  )}
                >
                  <input type="radio" name="pack-transfer-method" checked={method === m.value} onChange={() => setMethod(m.value)} className="mt-1" />
                  <span>
                    <span className="block text-body-strong text-text">{m.title}</span>
                    <span className="block text-card-sub text-text-muted">{m.description}</span>
                  </span>
                </label>
              ))}
            </div>
            {method === 'EMAIL' && (
              <label className="flex flex-col gap-1.5 text-body-strong text-text">
                <span>
                  Inspector email address <span className="text-danger">*</span>
                </span>
                <input
                  type="email"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="name@fmcsa.dot.gov"
                  aria-invalid={Boolean(recipientError) || undefined}
                  aria-describedby="pack-recipient-error"
                  className="h-btn rounded-md border border-border bg-bg-surface px-3 text-body font-normal"
                />
                {recipientError && (
                  <span id="pack-recipient-error" className="text-card-sub font-normal text-danger">
                    {recipientError}
                  </span>
                )}
              </label>
            )}
            <label className="flex flex-col gap-1.5 text-body-strong text-text">
              <span className="flex justify-between">
                Output file comment
                <span
                  className={cn(
                    'text-card-sub font-normal tabular-nums',
                    comment.length > LIMITS.outputFileCommentMax ? 'text-danger' : 'text-text-muted',
                  )}
                >
                  {`${comment.length}/${LIMITS.outputFileCommentMax}`}
                </span>
              </span>
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="ROADSIDE INSPECTION 2025-09-10"
                aria-describedby="pack-comment-hint"
                className="h-btn rounded-md border border-border bg-bg-surface px-3 text-body font-normal"
              />
              <span id="pack-comment-hint" className="text-card-sub font-normal text-text-muted">
                Given to you by the safety official. Max 60 characters.
              </span>
            </label>
            {/* B-95 — sending is `POST /transfers`, gated on `dataTransfer` FULL. */}
            <Can perm="dataTransfer" level="FULL">
              <Button
                variant="primary"
                size="lg"
                className="w-full justify-center"
                iconLeft={<Send size={16} strokeWidth={1.75} />}
                // WB-178 — the button used to open 11.14 prefilled with an address this very
                // card had already rejected; the modal re-validated and refused, so the only
                // result was an extra click. An empty field is still fine (11.14 collects it).
                disabled={Boolean(recipientError)}
                aria-describedby={recipientError ? 'pack-recipient-error' : undefined}
                onClick={() =>
                  setModal({
                    key: Date.now(),
                    initial: {
                      ...transferRangeFor(from, to),
                      ...(driverFilter ? { driverId: driverFilter } : {}),
                      method,
                      recipient,
                      outputFileComment: comment,
                    },
                  })
                }
              >
                Send to inspector
              </Button>
            </Can>
            <p className="text-card-sub text-text-muted">A copy is stored in Reports › Recently generated for 24 months.</p>
          </div>
        </Card>
      </div>

      <PreviousTransfersCard timezone={timezone} onRetry={retryTransfer} />

      <Can perm="dataTransfer" level="FULL">
        {modalState && (
          <SendLogsModal
            key={modalState.key}
            open
            onClose={closeModal}
            initial={modalState.initial}
            erodsMode={erodsMode}
            eldIdentifier={carrier.data?.eldIdentifier}
            timezone={timezone}
          />
        )}
      </Can>
    </div>
  );
}
