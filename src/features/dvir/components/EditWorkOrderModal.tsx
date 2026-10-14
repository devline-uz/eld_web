// owner: web-dvir-safety — WB-074 · W-09 Work orders tab, `…` `Edit`. `maintenance` FULL.
// The vehicle and attached defects are not editable here — only the fields `CreateWorkOrderModal`
// also collects (`PATCH /work-orders/:id`, `endpoints.workOrders.update`, a real endpoint).
import { useEffect, useRef, useState } from 'react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { useCarrierTimezone } from '@/shared/auth/useCarrierTimezone';
import { TOAST_COPY } from '@/shared/ui/copy';
import { useUpdateWorkOrder, type WorkOrderPriority, type WorkOrderTableRow } from '@/shared/api/dvir';
import { ApiError, formErrorMessage } from '@/shared/api/errors';
import {
  blockCostKeys,
  blockOdometerKeys,
  dueDateToIso,
  getCostError,
  getLaborHoursError,
  getOdometerError,
  isoToDueDate,
  sanitizeCost,
  sanitizeOdometer,
  WORK_ORDER_FIELD_LABELS,
  WORK_ORDER_LIMITS,
} from '../lib/workOrderFieldGuards';

const PRIORITIES: { value: WorkOrderPriority; label: string }[] = [
  { value: 'URGENT', label: 'Critical — out of service' },
  { value: 'HIGH', label: 'High' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'LOW', label: 'Low' },
];

const inputClass = 'h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text';

/** `UpdateWorkOrderDto` issue paths this form shows under their own field. */
const PLACED_FIELDS = ['costUsd', 'odometerMi', 'estimatedLaborHours'] as const;
type PlacedField = (typeof PLACED_FIELDS)[number];

export function EditWorkOrderModal({ workOrder, onClose }: { workOrder: WorkOrderTableRow; onClose: () => void }) {
  const carrierTz = useCarrierTimezone();
  const { toast } = useToast();
  const mutation = useUpdateWorkOrder(workOrder.id);
  const [title, setTitle] = useState(workOrder.title);
  const [vendor, setVendor] = useState(workOrder.vendor ?? '');
  const [priority, setPriority] = useState<WorkOrderPriority>(workOrder.priority);
  const [dueDate, setDueDate] = useState(isoToDueDate(workOrder.dueAt, carrierTz));
  const [cost, setCost] = useState(workOrder.costUsd != null ? String(workOrder.costUsd) : '');
  const [odometer, setOdometer] = useState(workOrder.odometerMi != null ? String(workOrder.odometerMi) : '');
  const [estimatedLaborHours, setEstimatedLaborHours] = useState(
    workOrder.estimatedLaborHours != null ? String(workOrder.estimatedLaborHours) : '',
  );
  const [description, setDescription] = useState(workOrder.description ?? '');
  // B-42 (shipped 2026-09-24) — real `UpdateWorkOrderDto` flags; default from the row (the
  // create modal's own default only applies when the work order is created).
  const [keepOutOfService, setKeepOutOfService] = useState(workOrder.keepOutOfService ?? true);
  const [notifyDriver, setNotifyDriver] = useState(workOrder.notifyDriver ?? true);
  const [blockDispatchAssignment, setBlockDispatchAssignment] = useState(workOrder.blockDispatchAssignment ?? true);
  const [serverError, setServerError] = useState<string | null>(null);
  // A 422 from the server, mapped onto the field it is about; cleared as soon as that field changes.
  const [serverFieldErrors, setServerFieldErrors] = useState<Partial<Record<PlacedField, string>>>({});
  const clearServerError = (field: PlacedField) =>
    setServerFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  const serverErrorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (serverError) serverErrorRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [serverError]);

  const costError = getCostError(cost, 'Parts cost') ?? serverFieldErrors.costUsd;
  const odometerError = getOdometerError(odometer) ?? serverFieldErrors.odometerMi;
  const laborHoursError = getLaborHoursError(estimatedLaborHours) ?? serverFieldErrors.estimatedLaborHours;
  const valid =
    title.trim() !== '' && !getCostError(cost, 'Parts cost') && !getOdometerError(odometer) && !getLaborHoursError(estimatedLaborHours);
  // WB-150 — plain state, so `isDirty` compares against the row the modal opened with.
  const isDirty =
    title !== workOrder.title ||
    vendor !== (workOrder.vendor ?? '') ||
    priority !== workOrder.priority ||
    dueDate !== isoToDueDate(workOrder.dueAt, carrierTz) ||
    cost !== (workOrder.costUsd != null ? String(workOrder.costUsd) : '') ||
    odometer !== (workOrder.odometerMi != null ? String(workOrder.odometerMi) : '') ||
    estimatedLaborHours !== (workOrder.estimatedLaborHours != null ? String(workOrder.estimatedLaborHours) : '') ||
    description !== (workOrder.description ?? '') ||
    keepOutOfService !== (workOrder.keepOutOfService ?? true) ||
    notifyDriver !== (workOrder.notifyDriver ?? true) ||
    blockDispatchAssignment !== (workOrder.blockDispatchAssignment ?? true);

  function submit() {
    // WB-149 — an emptied field used to send `undefined`, which a PATCH reads as "leave it
    // alone", so clearing `Assign to`, a cost, an odometer, a due date or the description was
    // silently discarded and the old value survived. Every one of those columns is nullable on
    // `WorkOrderRow`, so an emptied field now sends an explicit `null` and actually clears.
    setServerError(null);
    if (!valid) return;
    mutation.mutate(
      {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        vendor: vendor.trim() || null,
        costUsd: cost.trim() ? Number(cost) : null,
        odometerMi: odometer.trim() ? Number(odometer) : null,
        estimatedLaborHours: estimatedLaborHours.trim() ? Number(estimatedLaborHours) : undefined,
        dueAt: dueDateToIso(dueDate, carrierTz) ?? null,
        keepOutOfService,
        notifyDriver,
        blockDispatchAssignment,
      },
      {
        onSuccess: () => {
          toast({ kind: 'success', ...TOAST_COPY.workOrderUpdated(workOrder.number) });
          onClose();
        },
        onError: (error) => {
          const fieldErrors = error instanceof ApiError ? error.fieldErrors : {};
          const placed: Partial<Record<PlacedField, string>> = {};
          for (const field of PLACED_FIELDS) {
            if (fieldErrors[field]) placed[field] = fieldErrors[field];
          }
          setServerFieldErrors(placed);
          setServerError(formErrorMessage(error, PLACED_FIELDS, WORK_ORDER_FIELD_LABELS));
        },
      },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit work order ${workOrder.number}`}
      isDirty={isDirty}
      subtitle={`Unit ${workOrder.vehicle?.unitNumber ?? '—'}`}
      size="lg"
      footer={
        <>
          <ModalCancelButton disabled={mutation.isPending} />
          <Button variant="primary" size="lg" disabled={!valid} loading={mutation.isPending} onClick={submit}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-label text-text">
            Title <span className="text-danger">*</span>
          </span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={WORK_ORDER_LIMITS.title} className={inputClass} />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Assign to</span>
            <input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              maxLength={WORK_ORDER_LIMITS.vendor}
              placeholder="Mike Rowan · Shop A"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">
              Priority <span className="text-danger">*</span>
            </span>
            <select value={priority} onChange={(e) => setPriority(e.target.value as WorkOrderPriority)} className={inputClass}>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Due date</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Parts cost</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={WORK_ORDER_LIMITS.costUsd}
                step="0.01"
                inputMode="decimal"
                value={cost}
                onKeyDown={blockCostKeys}
                onChange={(e) => {
                  setCost(sanitizeCost(e.target.value));
                  clearServerError('costUsd');
                }}
                aria-invalid={costError ? true : undefined}
                aria-describedby={costError ? 'wo-edit-cost-error' : undefined}
                className={inputClass}
              />
              <span className="text-body text-text-muted">USD</span>
            </div>
            {costError && (
              <span id="wo-edit-cost-error" role="alert" className="text-caption text-danger">
                {costError}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Odometer at service</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={WORK_ORDER_LIMITS.odometerMi}
                step="1"
                inputMode="numeric"
                value={odometer}
                onKeyDown={blockOdometerKeys}
                onChange={(e) => {
                  setOdometer(sanitizeOdometer(e.target.value));
                  clearServerError('odometerMi');
                }}
                aria-invalid={odometerError ? true : undefined}
                aria-describedby={odometerError ? 'wo-edit-odometer-error' : undefined}
                className={inputClass}
              />
              <span className="text-body text-text-muted">mi</span>
            </div>
            {odometerError && (
              <span id="wo-edit-odometer-error" role="alert" className="text-caption text-danger">
                {odometerError}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Estimated labor</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max={WORK_ORDER_LIMITS.estimatedLaborHours}
                step="0.1"
                value={estimatedLaborHours}
                onKeyDown={blockCostKeys}
                onChange={(e) => {
                  setEstimatedLaborHours(sanitizeCost(e.target.value));
                  clearServerError('estimatedLaborHours');
                }}
                aria-invalid={laborHoursError ? true : undefined}
                aria-describedby={laborHoursError ? 'wo-edit-labor-hours-error' : undefined}
                className={inputClass}
              />
              <span className="text-body text-text-muted">h</span>
            </div>
            {laborHoursError && (
              <span id="wo-edit-labor-hours-error" role="alert" className="text-caption text-danger">
                {laborHoursError}
              </span>
            )}
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-label text-text">Work to perform</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={WORK_ORDER_LIMITS.description}
            rows={3}
            className="rounded-md border border-border bg-bg-surface px-3 py-2 text-body text-text"
          />
        </label>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={keepOutOfService} onChange={(e) => setKeepOutOfService(e.target.checked)} />
            <span className="text-body text-text">Keep the unit out of service until this work order closes</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={notifyDriver} onChange={(e) => setNotifyDriver(e.target.checked)} />
            <span className="text-body text-text">Notify the driver</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={blockDispatchAssignment} onChange={(e) => setBlockDispatchAssignment(e.target.checked)} />
            <span className="text-body text-text">Block dispatch assignment until resolved</span>
          </label>
        </div>

        {serverError && (
          <p ref={serverErrorRef} role="alert" className="rounded-md bg-danger-soft p-3 text-body text-danger">
            {serverError}
          </p>
        )}
      </div>
    </Modal>
  );
}
