// owner: web-dvir-safety — 11.15 DVIR detail (web/tz.md §11.15). `dvir` READ; footer's
// `Create work order` needs `maintenance` FULL, mechanic sign-off needs `dvir` FULL.
import { useState } from 'react';
import { EyeOff } from 'lucide-react';
import { Drawer } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { SeverityBadge } from '@/shared/ui/Badge';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import { useDvir, useMechanicSignoff, type DvirDetail, type RepairStatus } from '@/shared/api/dvir';
import { LoadingState, ErrorState } from '@/shared/ui/states';
import { formatLocal } from '@/shared/format/datetime';
import { formatOdometer } from '@/shared/format/numbers';
import { orDash } from '@/shared/format/empty';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import { printDvir } from '../lib/printDvir';

/** B-75 — there is no per-DVIR PDF endpoint. */
const EXPORT_PDF_REASON = 'PDF export is not available yet.';
/** B-41 — no attachment presign endpoint, so a photo cannot be fetched or opened. */
const PHOTO_REASON = 'Photos were uploaded by the driver but cannot be shown here yet.';

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
            {/* B-75 — no `GET /dvir/:id/pdf`; the button had no `onClick` at all. Disabled with
                the reason on screen rather than pretending to produce a file. */}
            <Button variant="secondary" disabled title={EXPORT_PDF_REASON}>
              Export PDF
            </Button>
            <span className="text-caption text-text-muted">{EXPORT_PDF_REASON}</span>
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
              <>
                <div className="grid grid-cols-2 gap-2">
                  {dvir.photos.map((photo) => (
                    // ⛔ GAP B-41 — no `GET /attachments/:id/presign` endpoint exists yet
                    // (web/backend-gaps.md), so nothing can be fetched or opened. The tile used
                    // to be a `<button>` that looked clickable and did nothing; it is now plain
                    // static markup that says why there is no preview.
                    <div
                      key={photo.id}
                      className="flex h-24 flex-col items-center justify-center gap-1 rounded-md bg-bg-subtle px-2 text-center text-text-muted"
                    >
                      <EyeOff size={20} strokeWidth={1.75} />
                      <span className="text-caption">No preview</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-caption text-text-muted">{PHOTO_REASON}</p>
              </>
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
