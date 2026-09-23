// owner: web-dvir-safety — 11.17 Resolve defect (web/tz.md §11.17). `dvir` FULL, `md`.
import { useState } from 'react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { SeverityBadge } from '@/shared/ui/Badge';
import { useToast } from '@/shared/ui/Toast';
import { useResolveDefect, useLinkDefectWorkOrder, useWorkOrdersList, type DefectTableRow } from '@/shared/api/dvir';
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

type Resolution = 'REPAIRED' | 'NO_REPAIR' | 'DEFERRED';

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
  const [serverError, setServerError] = useState<string | null>(null);

  const isDeferred = resolution === 'DEFERRED';
  const valid = notes.trim() !== '';
  // WB-150 — every control in this modal is plain state, so `isDirty` is an explicit comparison
  // against the values the modal opened with; a freshly opened, untouched form is never dirty.
  const isDirty = resolution !== 'REPAIRED' || workOrderId !== initialWorkOrderId || notes !== '';
  const isPending = mutation.isPending || linkWorkOrder.isPending;

  function submit() {
    // WB-077 — `PATCH /defects/:id/resolve` (`DefectResolveDto`) only accepts
    // `status: 'REPAIRED' | 'DEFERRED'` and `resolutionNote`; there is no `NOT_REQUIRED` value and
    // no separate `resolutionType` field to carry "inspected, no repair needed"
    // (web/backend-gaps.md B-68). The only place the distinction survives is the free-text note,
    // so it is tagged there rather than written to the audit trail as an indistinguishable
    // completed repair.
    //
    // WB-151 — the modal used to also collect `Corrected by *`, `Completed on`, `Labour hours` and
    // `Parts cost` and then send none of them: the DTO has no field for any of the four
    // (`resolvedById` is taken from the caller's token server-side, `resolvedAt` from the clock).
    // Collecting a *required* mechanic name and dropping it is worse than not asking, so the four
    // inputs — and the "Mechanic signature" card that only mirrored `Corrected by` — are gone
    // until the DTO can carry them (web/backend-gaps.md, shape in the report).
    const status = resolution === 'DEFERRED' ? 'DEFERRED' : 'REPAIRED';
    const resolutionNote = resolution === 'NO_REPAIR' ? `[No repair needed] ${notes.trim()}` : notes.trim();
    setServerError(null);

    const link =
      workOrderId !== initialWorkOrderId
        ? // `PATCH /defects/:id/work-order` is the real endpoint that carries the link — the
          // resolve DTO has no `workOrderId`, so the select is applied through it first: if it
          // fails nothing is resolved, and the banner says why.
          linkWorkOrder.mutateAsync(workOrderId === '' ? null : workOrderId)
        : Promise.resolve(null);

    void link
      .then(() => mutation.mutateAsync({ status, resolutionNote }))
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
                ['NO_REPAIR', 'No repair needed', 'Inspected and found to be within specification'],
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
