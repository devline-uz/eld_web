// owner: web-dvir-safety — 11.17 Resolve defect (web/tz.md §11.17). `dvir` FULL, `md`.
import { useEffect, useRef, useState } from 'react';
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
import { ApiError, formErrorMessage } from '@/shared/api/errors';
import { useCarrierTransferConfig } from '@/shared/api/reports';
import { usePermission } from '@/shared/auth/usePermission';
import { formatCarrier, timezoneAbbreviation } from '@/shared/format/datetime';
import { blockCostKeys, getCostError, sanitizeCost } from '../lib/workOrderFieldGuards';
import { formatEnumLabel } from '@/shared/format/enumLabel';

/**
 * WB-137 — the `reported …` stamp is company context (§8.3), so it renders in `carrier.timezone`
 * through the shared en-US / 24-hour formatter, never the browser zone. `GET /carrier` sits behind
 * `carrierSettings`; without it the same Eastern fallback the reports use applies, and the zone
 * abbreviation is always printed so the reader knows which clock the time is on.
 */
const CARRIER_TZ_FALLBACK = 'America/New_York';

type Resolution = DefectResolutionType;

const inputClass = 'h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text';

/** `ResolveDefectDto` limits (eld_backend modules/service/dto/service.dto.ts). A value past one of
 * them used to go out and come back as a 422 the modal showed as a bare generic line. */
const RESOLVE_LIMITS = { resolutionNote: 500, correctedBy: 120, laborHours: 999 } as const;

/** `ResolveDefectDto` issue paths this form shows under their own field. */
const PLACED_FIELDS = ['resolutionNote', 'correctedBy', 'completedAt', 'laborHours', 'partsCostUsd'] as const;
type PlacedField = (typeof PLACED_FIELDS)[number];

const FIELD_LABELS: Record<string, string> = {
  resolutionType: 'Resolution',
  resolutionNote: 'Repair notes',
  correctedBy: 'Corrected by',
  completedAt: 'Completed on',
  laborHours: 'Labor hours',
  partsCostUsd: 'Parts cost',
  workOrderId: 'Work order',
};

/** `null` when empty or 0–999 h (`ResolveDefectDto.laborHours`), otherwise the inline error. */
function getLaborHoursError(value: string): string | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) return 'Labor hours cannot be negative.';
  if (n > RESOLVE_LIMITS.laborHours) return `Labor hours cannot exceed ${RESOLVE_LIMITS.laborHours} hours.`;
  return null;
}

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
  // A 422 from the server, mapped onto the field it is about; cleared as soon as that field changes.
  const [serverFieldErrors, setServerFieldErrors] = useState<Partial<Record<PlacedField, string>>>({});
  const clearServerError = (field: PlacedField) =>
    setServerFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  // The banner sits at the bottom of this modal, below the fold — bring it into view when it appears.
  const serverErrorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (serverError) serverErrorRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [serverError]);

  const isDeferred = resolution === 'DEFERRED';
  const laborHoursError = getLaborHoursError(laborHours) ?? serverFieldErrors.laborHours;
  const partsCostError = getCostError(partsCostUsd, 'Parts cost') ?? serverFieldErrors.partsCostUsd;
  const notesMissing = notes.trim() === '';
  const valid = !notesMissing && !getLaborHoursError(laborHours) && !getCostError(partsCostUsd, 'Parts cost');
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
    if (!valid) return;

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
        // A 422 used to land as a bare banner below the fold — nothing on the fields. Each issue
        // now goes on its own field; anything unplaceable (`workOrderId`) is spelled out.
        const fieldErrors = error instanceof ApiError ? error.fieldErrors : {};
        const placed: Partial<Record<PlacedField, string>> = {};
        for (const field of PLACED_FIELDS) {
          if (fieldErrors[field]) placed[field] = fieldErrors[field];
        }
        setServerFieldErrors(placed);
        setServerError(formErrorMessage(error, PLACED_FIELDS, FIELD_LABELS));
      });
  }

  return (
    <Modal
      open
      onClose={onClose}
      isDirty={isDirty}
      title="Resolve defect"
      subtitle={`Unit ${defect.vehicle?.unitNumber ?? '—'} · ${formatEnumLabel(defect.category)} · reported ${formatCarrier(defect.createdAt, carrierTz, 'dateTime')} ${timezoneAbbreviation(carrierTz, defect.createdAt)}`}
      size="md"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          {/* The only required field is at the bottom of the form — say why the button is off. */}
          <span className="text-caption text-text-muted">{notesMissing ? 'Add repair notes to resolve.' : ''}</span>
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
            <span className="text-body-strong text-text">{formatEnumLabel(defect.category)}</span>
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
            <input
              value={correctedBy}
              maxLength={RESOLVE_LIMITS.correctedBy}
              onChange={(e) => {
                setCorrectedBy(e.target.value);
                clearServerError('correctedBy');
              }}
              placeholder="Mike Rowan · Shop A"
              aria-invalid={serverFieldErrors.correctedBy ? true : undefined}
              aria-describedby={serverFieldErrors.correctedBy ? 'resolve-corrected-by-error' : undefined}
              className={inputClass}
            />
            {serverFieldErrors.correctedBy && (
              <span id="resolve-corrected-by-error" role="alert" className="text-caption text-danger">
                {serverFieldErrors.correctedBy}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Completed on</span>
            <input
              type="date"
              value={completedAt}
              onChange={(e) => {
                setCompletedAt(e.target.value);
                clearServerError('completedAt');
              }}
              aria-invalid={serverFieldErrors.completedAt ? true : undefined}
              aria-describedby={serverFieldErrors.completedAt ? 'resolve-completed-at-error' : undefined}
              className={inputClass}
            />
            {serverFieldErrors.completedAt && (
              <span id="resolve-completed-at-error" role="alert" className="text-caption text-danger">
                {serverFieldErrors.completedAt}
              </span>
            )}
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Labor hours</span>
            <input
              type="number"
              min="0"
              max={RESOLVE_LIMITS.laborHours}
              step="0.1"
              value={laborHours}
              onKeyDown={blockCostKeys}
              onChange={(e) => {
                setLaborHours(sanitizeCost(e.target.value));
                clearServerError('laborHours');
              }}
              aria-invalid={laborHoursError ? true : undefined}
              aria-describedby={laborHoursError ? 'resolve-labor-hours-error' : undefined}
              className={inputClass}
            />
            {laborHoursError && (
              <span id="resolve-labor-hours-error" role="alert" className="text-caption text-danger">
                {laborHoursError}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Parts cost</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={partsCostUsd}
                onKeyDown={blockCostKeys}
                onChange={(e) => {
                  setPartsCostUsd(sanitizeCost(e.target.value));
                  clearServerError('partsCostUsd');
                }}
                aria-invalid={partsCostError ? true : undefined}
                aria-describedby={partsCostError ? 'resolve-parts-cost-error' : undefined}
                className={inputClass}
              />
              <span className="text-body text-text-muted">USD</span>
            </div>
            {partsCostError && (
              <span id="resolve-parts-cost-error" role="alert" className="text-caption text-danger">
                {partsCostError}
              </span>
            )}
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-label text-text">
            Repair notes <span className="text-danger">*</span>
          </span>
          <textarea
            value={notes}
            maxLength={RESOLVE_LIMITS.resolutionNote}
            onChange={(e) => {
              setNotes(e.target.value);
              clearServerError('resolutionNote');
            }}
            rows={3}
            aria-invalid={serverFieldErrors.resolutionNote ? true : undefined}
            aria-describedby={serverFieldErrors.resolutionNote ? 'resolve-notes-error' : undefined}
            className="rounded-md border border-border bg-bg-surface px-3 py-2 text-body text-text"
          />
          {serverFieldErrors.resolutionNote && (
            <span id="resolve-notes-error" role="alert" className="text-caption text-danger">
              {serverFieldErrors.resolutionNote}
            </span>
          )}
        </label>

        {serverError && (
          <p ref={serverErrorRef} role="alert" className="rounded-md bg-danger-soft p-3 text-body text-danger">
            {serverError}
          </p>
        )}
      </div>
    </Modal>
  );
}
