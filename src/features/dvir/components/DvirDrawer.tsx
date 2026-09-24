// owner: web-dvir-safety — 11.15 DVIR detail (web/tz.md §11.15). `dvir` READ; footer's
// `Create work order` needs `maintenance` FULL, mechanic sign-off needs `dvir` FULL.
import { useEffect, useState } from 'react';
import { EyeOff } from 'lucide-react';
import { Drawer } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { SeverityBadge } from '@/shared/ui/Badge';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import {
  useDvir,
  useMechanicSignoff,
  fetchDvirPdf,
  fetchAttachmentUrl,
  type AttachmentRow,
  type DvirDetail,
  type RepairStatus,
} from '@/shared/api/dvir';
import { LoadingState, ErrorState } from '@/shared/ui/states';
import { formatLocal } from '@/shared/format/datetime';
import { formatOdometer } from '@/shared/format/numbers';
import { orDash } from '@/shared/format/empty';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import { printDvir } from '../lib/printDvir';

const DVIR_TYPE_LABEL: Record<string, string> = {
  PRE_TRIP: 'Pre-trip',
  POST_TRIP: 'Post-trip',
  INTERMEDIATE: 'Intermediate',
};

const REPAIR_STATUS_LABEL: Record<RepairStatus, string> = {
  NOT_REQUIRED: 'No repair required',
  PENDING: 'Repair pending',
  REPAIRED: 'Repaired',
  DEFERRED: 'Deferred',
};

/** WB-076 — the sign-off box used to hardcode `repairStatus: 'REPAIRED'` for every DVIR, even
 * ones with no defects or with defects still OPEN. Derive a truthful default from the DVIR's
 * defect state and let the mechanic override it before submitting. */
function deriveRepairStatus(defects: DvirDetail['defects']): RepairStatus {
  if (defects.length === 0) return 'NOT_REQUIRED';
  if (defects.some((d) => d.status === 'OPEN' || d.status === 'IN_PROGRESS')) return 'PENDING';
  if (defects.every((d) => d.status === 'DEFERRED')) return 'DEFERRED';
  return 'REPAIRED';
}

/** B-41 (shipped 2026-09-24) — `GET /attachments/:id/presign`. Fetched at render time for the
 * thumbnail `src` itself and again at click time before opening it in a new tab, so an old URL
 * that outlived its 15-minute expiry is never reused. Never put in the query cache, never logged. */
function DvirPhotoThumbnail({ photo }: { photo: AttachmentRow }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    // The list keys each tile by `photo.id` (`key={photo.id}`), so a new photo remounts this
    // component instead of reusing it — no reset of `url`/`failed` is needed here.
    const controller = new AbortController();
    fetchAttachmentUrl(photo.id, controller.signal)
      .then((res) => setUrl(res.url))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setFailed(true);
      });
    return () => controller.abort();
  }, [photo.id]);

  function open() {
    if (opening) return;
    setOpening(true);
    fetchAttachmentUrl(photo.id)
      .then((res) => {
        window.open(res.url, '_blank', 'noopener,noreferrer');
      })
      .catch(() => setFailed(true))
      .finally(() => setOpening(false));
  }

  if (failed) {
    return (
      <div className="flex h-24 flex-col items-center justify-center gap-1 rounded-md bg-bg-subtle px-2 text-center text-text-muted">
        <EyeOff size={20} strokeWidth={1.75} />
        <span className="text-caption">Preview unavailable</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={!url || opening}
      aria-label="Open photo"
      className="h-24 overflow-hidden rounded-md bg-bg-subtle disabled:cursor-wait"
    >
      {url ? (
        <img src={url} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <div className="flex size-full animate-pulse items-center justify-center text-text-muted">
          <EyeOff size={20} strokeWidth={1.75} />
        </div>
      )}
    </button>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-body text-text-muted">{label}</span>
      <span className="text-body-strong text-text">{value}</span>
    </div>
  );
}

export function DvirDrawer({
  dvirId,
  onClose,
  onCreateWorkOrder,
}: {
  dvirId: string;
  onClose: () => void;
  onCreateWorkOrder: (vehicleId: string) => void;
}) {
  const { can } = usePermission();
  const { toast } = useToast();
  const { data, driver, vehicle, isLoading, isError, refetch } = useDvir(dvirId);
  const signoff = useMechanicSignoff(dvirId);
  const [signoffError, setSignoffError] = useState<string | null>(null);
  const [mechanicName, setMechanicName] = useState('');
  const [repairStatus, setRepairStatus] = useState<RepairStatus | null>(null);
  const canFull = can('dvir', 'FULL');
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const dvir: DvirDetail | undefined = data;
  const openDefects = (dvir?.defects ?? []).filter((d) => d.status === 'OPEN');
  const unresolvedCritical = openDefects.some((d) => d.severity === 'CRITICAL');
  const defaultRepairStatus = deriveRepairStatus(dvir?.defects ?? []);
  // Stage 3 — a typed mechanic name / changed repair status used to vanish silently on close.
  const signoffDirty =
    mechanicName.trim() !== '' || (repairStatus !== null && repairStatus !== defaultRepairStatus);

  return (
    <Drawer
      open
      onClose={onClose}
      isDirty={signoffDirty}
      title={`DVIR #${dvirId.slice(0, 8)}`}
      subtitle={
        dvir
          ? `Unit ${vehicle?.unitNumber ?? '—'} · ${DVIR_TYPE_LABEL[dvir.type] ?? dvir.type} · ${formatLocal(dvir.submittedAt, 'dateTime')}`
          : undefined
      }
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            {/* `window.print()` printed the whole application; this prints the inspection alone. */}
            <Button
              variant="secondary"
              disabled={!dvir}
              onClick={() => {
                if (!dvir) return;
                printDvir({
                  title: `DVIR #${dvirId.slice(0, 8)}`,
                  subtitle: `Unit ${vehicle?.unitNumber ?? '—'} · ${DVIR_TYPE_LABEL[dvir.type] ?? dvir.type} · ${formatLocal(dvir.submittedAt, 'dateTime')}`,
                  rows: [
                    ['Driver', driver ? `${driver.firstName} ${driver.lastName}` : '—'],
                    ['Type', DVIR_TYPE_LABEL[dvir.type] ?? dvir.type],
                    ['Submitted', formatLocal(dvir.submittedAt, 'dateTime')],
                    ['Location', dvir.locationName ?? '—'],
                    ['Odometer', `${formatOdometer(dvir.odometerMi)} mi`],
                    ['Trailer', dvir.trailerId ? dvir.trailerId : 'bobtail: yes'],
                  ],
                  defects: dvir.defects.map((d) => ({
                    category: d.category,
                    severity: d.severity,
                    description: d.description,
                  })),
                  driverSignature: {
                    name: driver ? `${driver.firstName} ${driver.lastName}` : '—',
                    signedAt: formatLocal(dvir.submittedAt, 'dateTime'),
                  },
                  mechanic: {
                    name: dvir.mechanicName ?? 'Not signed',
                    signedAt: dvir.mechanicSignedAt ? formatLocal(dvir.mechanicSignedAt, 'dateTime') : 'Pending',
                  },
                });
              }}
            >
              Print
            </Button>
            {/* B-75 (shipped 2026-09-24) — `GET /dvir/:id/pdf`. Fetched at click time, never cached. */}
            <Button
              variant="secondary"
              disabled={!dvir}
              loading={pdfLoading}
              onClick={() => {
                if (!dvir) return;
                setPdfError(null);
                setPdfLoading(true);
                fetchDvirPdf(dvir.id)
                  .then((blob) => {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `dvir-${dvir.id.slice(0, 8)}.pdf`;
                    link.click();
                    URL.revokeObjectURL(url);
                  })
                  .catch((error: unknown) => setPdfError(error instanceof ApiError ? error.userMessage : 'Something went wrong.'))
                  .finally(() => setPdfLoading(false));
              }}
            >
              Export PDF
            </Button>
            {pdfError && <span className="text-caption text-danger">{pdfError}</span>}
          </div>
          <Can perm="maintenance" level="FULL">
            {dvir && (
              <Button variant="primary" onClick={() => onCreateWorkOrder(dvir.vehicleId)}>
                Create work order
              </Button>
            )}
          </Can>
        </div>
      }
    >
      {isLoading ? (
        <LoadingState />
      ) : isError || !dvir ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="flex flex-col gap-5">
          {unresolvedCritical && (
            <div className="rounded-md bg-danger-soft p-3 text-body text-danger">
              ⚠ Defects not corrected — unit is out of service
            </div>
          )}

          <section>
            <h3 className="mb-1 text-label font-semibold uppercase tracking-wide text-text-muted">Inspection</h3>
            <Row label="Driver" value={driver ? `${driver.firstName} ${driver.lastName}` : '—'} />
            <Row label="Type" value={DVIR_TYPE_LABEL[dvir.type] ?? dvir.type} />
            <Row label="Submitted" value={<span className="tabular-nums">{formatLocal(dvir.submittedAt, 'dateTime')}</span>} />
            <Row label="Location" value={orDash(dvir.locationName, (v) => v)} />
            <Row label="Odometer" value={<span className="tabular-nums">{formatOdometer(dvir.odometerMi)} mi</span>} />
            <Row label="Trailer" value={dvir.trailerId ? dvir.trailerId : 'bobtail: yes'} />
          </section>

          <section>
            <h3 className="mb-2 text-label font-semibold uppercase tracking-wide text-text-muted">
              Defects · {dvir.defects.length}
            </h3>
            {dvir.defects.length === 0 ? (
              <p className="text-body text-text-muted">None</p>
            ) : (
              <div className="flex flex-col gap-2">
                {dvir.defects.map((d) => (
                  <div key={d.id} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-body-strong text-text">{d.category}</span>
                      <SeverityBadge severity={d.severity} />
                    </div>
                    <p className="mt-1 text-body text-text-secondary">{d.description}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-label font-semibold uppercase tracking-wide text-text-muted">
              Photos · {dvir.photos?.length ?? 0}
            </h3>
            {!dvir.photos || dvir.photos.length === 0 ? (
              <p className="text-body text-text-muted">None</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {dvir.photos.map((photo) => (
                  <DvirPhotoThumbnail key={photo.id} photo={photo} />
                ))}
              </div>
            )}
          </section>

          <section className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-border p-3">
              <p className="text-caption text-text-muted">Driver signature</p>
              <p className="mt-1 font-serif text-card-title italic text-text">
                {driver ? `${driver.firstName} ${driver.lastName}` : '—'}
              </p>
              <p className="tabular-nums text-caption text-text-muted">{formatLocal(dvir.submittedAt, 'dateTime')}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-caption text-text-muted">Mechanic signature</p>
              <p className="mt-1 text-card-title text-text-muted">{dvir.mechanicName ?? 'Not signed'}</p>
              <p className="text-caption text-text-muted">
                {dvir.mechanicSignedAt ? formatLocal(dvir.mechanicSignedAt, 'dateTime') : 'Pending'}
              </p>
              {canFull && !dvir.mechanicSignedAt && (
                <div className="mt-2 flex flex-col gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-caption text-text-secondary">Mechanic name</span>
                    <input
                      value={mechanicName}
                      onChange={(e) => setMechanicName(e.target.value)}
                      placeholder="Mechanic name"
                      disabled={signoff.isPending}
                      className="h-8 rounded-md border border-border bg-bg-surface px-2 text-body text-text"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-caption text-text-secondary">Repair status</span>
                    <select
                      value={repairStatus ?? defaultRepairStatus}
                      onChange={(e) => setRepairStatus(e.target.value as RepairStatus)}
                      disabled={signoff.isPending}
                      className="h-8 rounded-md border border-border bg-bg-surface px-2 text-body text-text"
                    >
                    {(Object.keys(REPAIR_STATUS_LABEL) as RepairStatus[]).map((status) => (
                      <option key={status} value={status}>
                        {REPAIR_STATUS_LABEL[status]}
                      </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!mechanicName.trim()}
                    loading={signoff.isPending}
                    onClick={() =>
                      signoff.mutate(
                        { mechanicName: mechanicName.trim(), repairStatus: repairStatus ?? defaultRepairStatus },
                        {
                          onSuccess: () => {
                            // Signed — nothing left unsaved, so closing no longer asks to discard.
                            setMechanicName('');
                            setRepairStatus(null);
                            toast({ kind: 'success', title: 'Mechanic sign-off recorded' });
                          },
                          onError: (error) =>
                            setSignoffError(error instanceof ApiError ? error.userMessage : 'Something went wrong.'),
                        },
                      )
                    }
                  >
                    Sign off
                  </Button>
                </div>
              )}
              {signoffError && <p className="mt-1 text-caption text-danger">{signoffError}</p>}
            </div>
          </section>
        </div>
      )}
    </Drawer>
  );
}
