// owner: web-dvir-safety — 11.17 Resolve defect (web/tz.md §11.17). `dvir` FULL, `md`.
import { useState } from 'react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { SeverityBadge } from '@/shared/ui/Badge';
import { useToast } from '@/shared/ui/Toast';
import {
  useResolveDefect,
  useLinkDefectWorkOrder,
  useWorkOrdersList,
  type DefectResolutionType,
  type DefectTableRow,
} from '@/shared/api/dvir';
import { ApiError } from '@/shared/api/errors';
import { useCarrierTransferConfig } from '@/shared/api/reports';
import { usePermission } from '@/shared/auth/usePermission';
import { formatCarrier, timezoneAbbreviation } from '@/shared/format/datetime';

/**
 * WB-137 — the `reported …` stamp is company context (§8.3), so it renders in `carrier.timezone`
 * through the shared en-US / 24-hour formatter, never the browser zone. `GET /carrier` sits behind
 * `carrierSettings`; without it the same Eastern fallback the reports use applies, and the zone
 * abbreviation is always printed so the reader knows which clock the time is on.
 */
const CARRIER_TZ_FALLBACK = 'America/New_York';

type Resolution = DefectResolutionType;

const inputClass = 'h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text';

export function ResolveDefectModal({ defect, onClose }: { defect: DefectTableRow; onClose: () => void }) {
  const { toast } = useToast();
  const { can } = usePermission();
  const carrier = useCarrierTransferConfig(can('carrierSettings'));
  const carrierTz = carrier.data?.timezone ?? CARRIER_TZ_FALLBACK;
  const mutation = useResolveDefect(defect.id);
  const linkWorkOrder = useLinkDefectWorkOrder(defect.id);
  const workOrders = useWorkOrdersList({ vehicleId: defect.vehicleId, status: 'OPEN', limit: 50 });

  const initialWorkOrderId = defect.workOrderId ?? '';
  const [resolution, setResolution] = useState<Resolution>('REPAIRED');
  const [workOrderId, setWorkOrderId] = useState(initialWorkOrderId);
  const [notes, setNotes] = useState('');
  const [correctedBy, setCorrectedBy] = useState('');
  const [completedAt, setCompletedAt] = useState('');
  const [laborHours, setLaborHours] = useState('');
  const [partsCostUsd, setPartsCostUsd] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);

  const isDeferred = resolution === 'DEFERRED';
  const valid = notes.trim() !== '';
  // WB-150 — every control in this modal is plain state, so `isDirty` is an explicit comparison
  // against the values the modal opened with; a freshly opened, untouched form is never dirty.
  const isDirty =
    resolution !== 'REPAIRED' ||
    workOrderId !== initialWorkOrderId ||
    notes !== '' ||
    correctedBy !== '' ||
    completedAt !== '' ||
    laborHours !== '' ||
    partsCostUsd !== '';
  const isPending = mutation.isPending || linkWorkOrder.isPending;

  function submit() {
    // B-68 (shipped 2026-09-24, WD-121) — `resolutionType` carries the choice itself, so "No repair
    // needed" is `NOT_REQUIRED` and is never recorded as a repair; the WB-077 `[No repair needed]`
    // note tag is gone. B-70 (shipped) — `correctedBy`/`completedAt`/`laborHours`/`partsCostUsd`
    // are real `ResolveDefectPayload` fields now, sent only when filled in.
    const resolutionType = resolution;
    const resolutionNote = notes.trim();
    setServerError(null);

    const link =
      workOrderId !== initialWorkOrderId
        ? // `PATCH /defects/:id/work-order` is the real endpoint that carries the link — the
          // resolve DTO has no `workOrderId`, so the select is applied through it first: if it
          // fails nothing is resolved, and the banner says why.
          linkWorkOrder.mutateAsync(workOrderId === '' ? null : workOrderId)
        : Promise.resolve(null);

    void link
      .then(() =>
        mutation.mutateAsync({
          resolutionType,
          resolutionNote,
          correctedBy: correctedBy.trim() || undefined,
          completedAt: completedAt ? new Date(completedAt).toISOString() : undefined,
          laborHours: laborHours.trim() ? Number(laborHours) : undefined,
          partsCostUsd: partsCostUsd.trim() ? Number(partsCostUsd) : undefined,
        }),
      )
      .then(() => {
        toast({
          kind: 'success',
          title: 'Defect resolved',
          // WB-075 — there is no `returnToService` field on the resolve DTO; the backend
          // derives OUT_OF_SERVICE from whether any CRITICAL defect on the unit is still
          // OPEN (see the informational note above), so the toast states the consequence
          // conditionally instead of asserting an outcome the client cannot confirm.
          description:
            defect.outOfService && !isDeferred
              ? `Unit ${defect.vehicle?.unitNumber ?? ''} returns to service unless another critical defect is still open.`
              : undefined,
        });
        onClose();
      })
      .catch((error: unknown) => {
        setServerError(error instanceof ApiError ? error.userMessage : 'Something went wrong.');
      });
  }

  return (
    <Modal
      open
      onClose={onClose}
      isDirty={isDirty}
      title="Resolve defect"
      subtitle={`Unit ${defect.vehicle?.unitNumber ?? '—'} · ${defect.category} · reported ${formatCarrier(defect.createdAt, carrierTz, 'dateTime')} ${timezoneAbbreviation(carrierTz, defect.createdAt)}`}
      size="md"
      footer={
        <div className="flex w-full items-center justify-end">
          <div className="flex gap-2">
            <ModalCancelButton disabled={isPending} />
            <Button variant="primary" size="lg" disabled={!valid} loading={isPending} onClick={submit}>
              Mark as resolved
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-md bg-danger-soft p-3">
          <div className="flex items-center justify-between">
            <span className="text-body-strong text-text">{defect.category}</span>
            <span className="flex items-center gap-1">
              <SeverityBadge severity={defect.severity} />
              {defect.outOfService && <span className="text-caption text-danger">· out of service</span>}
            </span>
          </div>
          <p className="mt-1 text-body text-text-secondary">{defect.description}</p>
        </div>

        {defect.outOfService && (
          <p className="rounded-md bg-warning-soft p-3 text-body text-text">
            Unit {defect.vehicle?.unitNumber ?? ''} is out of service because of this defect. Marking it{' '}
            {isDeferred ? 'deferred keeps the unit out of service' : 'resolved returns the unit to service unless another critical defect is still open'}
            .
          </p>
        )}

        <div>
          <p id={`resolve-defect-${defect.id}-resolution`} className="mb-2 text-label font-semibold uppercase tracking-wide text-text-muted">
            Resolution
          </p>
          {/* Stage 3 — one native radio group (shared `name`): arrow keys move between options. */}
          <div
            role="radiogroup"
            aria-labelledby={`resolve-defect-${defect.id}-resolution`}
            className="flex flex-col gap-2"
          >
            {(
              [
                ['REPAIRED', 'Repaired', 'The defect was corrected and the unit is safe to operate'],
                ['NOT_REQUIRED', 'No repair needed', 'Inspected and found to be within specification'],
                ['DEFERRED', 'Deferred', 'Non-safety defect scheduled for a later service'],
              ] as [Resolution, string, string][]
            ).map(([value, label, desc]) => (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${
                  resolution === value ? 'border-primary bg-primary-soft' : 'border-border'
                }`}
              >
                <input
                  type="radio"
                  name={`resolve-defect-${defect.id}-resolution`}
                  value={value}
                  checked={resolution === value}
                  onChange={() => setResolution(value)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-body-strong text-text">{label}</span>
                  <span className="block text-caption text-text-muted">{desc}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-label text-text">Work order</span>
          <select value={workOrderId} onChange={(e) => setWorkOrderId(e.target.value)} className={inputClass}>
            <option value="">—</option>
            {workOrders.rows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.number}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Corrected by</span>
            <input value={correctedBy} onChange={(e) => setCorrectedBy(e.target.value)} placeholder="Mike Rowan · Shop A" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Completed on</span>
            <input type="date" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} className={inputClass} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Labor hours</span>
            <input type="number" min="0" step="0.1" value={laborHours} onChange={(e) => setLaborHours(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Parts cost</span>
            <div className="flex items-center gap-2">
              <input type="number" min="0" step="0.01" value={partsCostUsd} onChange={(e) => setPartsCostUsd(e.target.value)} className={inputClass} />
              <span className="text-body text-text-muted">USD</span>
            </div>
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-label text-text">
            Repair notes <span className="text-danger">*</span>
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="rounded-md border border-border bg-bg-surface px-3 py-2 text-body text-text"
          />
        </label>

        {serverError && (
          <p role="alert" className="rounded-md bg-danger-soft p-3 text-body text-danger">
            {serverError}
          </p>
        )}
      </div>
    </Modal>
  );
}
