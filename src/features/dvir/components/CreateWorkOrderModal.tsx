// owner: web-dvir-safety — 11.16 Create work order (web/tz.md §11.16). `maintenance` FULL, `lg`.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Select } from '@/shared/ui/Select';
import { SeverityBadge } from '@/shared/ui/Badge';
import { useToast } from '@/shared/ui/Toast';
import { useDefectsList, useCreateWorkOrder, type WorkOrderPriority } from '@/shared/api/dvir';
import { useVehiclesPicker } from '@/shared/api/vehicles';
import { ApiError, formErrorMessage } from '@/shared/api/errors';
import { formatLocal } from '@/shared/format/datetime';
import {
  blockCostKeys,
  blockOdometerKeys,
  dueDateToIso,
  getCostError,
  getDueDateError,
  getLaborHoursError,
  getOdometerError,
  sanitizeCost,
  sanitizeOdometer,
  WORK_ORDER_FIELD_LABELS,
  WORK_ORDER_LIMITS,
} from '../lib/workOrderFieldGuards';
import { formatEnumLabel } from '@/shared/format/enumLabel';

const PRIORITIES: { value: WorkOrderPriority; label: string }[] = [
  { value: 'URGENT', label: 'Critical — out of service' },
  { value: 'HIGH', label: 'High' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'LOW', label: 'Low' },
];

const inputClass = 'h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text';

/** `CreateWorkOrderDto` issue paths this form shows under their own field. */
const PLACED_FIELDS = ['title', 'vendor', 'dueAt', 'costUsd', 'odometerMi', 'estimatedLaborHours', 'description'] as const;
type PlacedField = (typeof PLACED_FIELDS)[number];

export function CreateWorkOrderModal({ vehicleId, onClose }: { vehicleId?: string; onClose: () => void }) {
  const { toast } = useToast();
  const vehiclesQuery = useVehiclesPicker();
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicleId ?? '');
  const defects = useDefectsList({ status: 'OPEN', vehicleId: selectedVehicleId || undefined, limit: 200 });
  const mutation = useCreateWorkOrder();

  const [selectedDefects, setSelectedDefects] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [vendor, setVendor] = useState('');
  const [priority, setPriority] = useState<WorkOrderPriority>('NORMAL');
  const [dueDate, setDueDate] = useState('');
  const [partsCost, setPartsCost] = useState('');
  const [odometer, setOdometer] = useState('');
  const [estimatedLaborHours, setEstimatedLaborHours] = useState('');
  const [description, setDescription] = useState('');
  // B-42 (shipped 2026-09-24) — the three checkboxes are real `CreateWorkOrderDto` flags now;
  // default checked, matching the design.
  const [keepOutOfService, setKeepOutOfService] = useState(true);
  const [notifyDriver, setNotifyDriver] = useState(true);
  const [blockDispatchAssignment, setBlockDispatchAssignment] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  // A 422 from the server, mapped onto the field it is about; cleared as soon as that field changes.
  const [serverFieldErrors, setServerFieldErrors] = useState<Partial<Record<PlacedField, string>>>({});
  const clearServerError = (field: PlacedField) =>
    setServerFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  // The banner sits below the fold of this `lg` modal — bring it into view when it appears.
  const serverErrorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (serverError) serverErrorRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [serverError]);

  const vehicle = useMemo(
    () => vehiclesQuery.data?.items.find((v) => v.id === selectedVehicleId) ?? null,
    [vehiclesQuery.data, selectedVehicleId],
  );

  const partsCostError = getCostError(partsCost, 'Estimated parts cost');
  const odometerError = getOdometerError(odometer);
  const laborHoursError = getLaborHoursError(estimatedLaborHours);
  // Not an HOS screen, so "today" is the browser's local date — the same zone the date picker uses.
  const today = formatLocal(new Date(), 'yyyy-MM-dd');
  const dueDateError = getDueDateError(dueDate, today);
  const valid =
    selectedVehicleId !== '' && title.trim() !== '' && !partsCostError && !odometerError && !laborHoursError && !dueDateError;
  // Client-side message first; otherwise whatever the server said about that field.
  const titleFieldError = serverFieldErrors.title;
  const vendorFieldError = serverFieldErrors.vendor;
  const dueDateFieldError = dueDateError ?? serverFieldErrors.dueAt;
  const partsCostFieldError = partsCostError ?? serverFieldErrors.costUsd;
  const odometerFieldError = odometerError ?? serverFieldErrors.odometerMi;
  const laborHoursFieldError = laborHoursError ?? serverFieldErrors.estimatedLaborHours;
  const descriptionFieldError = serverFieldErrors.description;
  // WB-150 — plain state, so `isDirty` compares against what the modal opened with; a freshly
  // opened form (unit pre-selected from the row action, `Normal` priority) is never dirty.
  const isDirty =
    selectedVehicleId !== (vehicleId ?? '') ||
    selectedDefects.length > 0 ||
    title !== '' ||
    vendor !== '' ||
    priority !== 'NORMAL' ||
    dueDate !== '' ||
    partsCost !== '' ||
    odometer !== '' ||
    estimatedLaborHours !== '' ||
    description !== '' ||
    !keepOutOfService ||
    !notifyDriver ||
    !blockDispatchAssignment;

  // Stage 3 — the ticked defects belong to the unit they were listed for; switching the unit used
  // to keep them, so another vehicle's defect IDs could be submitted on this work order.
  function changeVehicle(next: string) {
    if (next === selectedVehicleId) return;
    setSelectedVehicleId(next);
    setSelectedDefects([]);
  }

  function toggleDefect(id: string) {
    setSelectedDefects((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  }

  const inFlight = useRef(false);

  function submit() {
    // B-42 (shipped 2026-09-24) — `estimatedLaborHours`, `keepOutOfService`, `notifyDriver` and
    // `blockDispatchAssignment` are real `CreateWorkOrderDto` fields now.
    // QA FE-004 — `isPending` only flips on the next render: two clicks in one tick both got
    // through and created two work orders. Same-tick ref guard, as in AddVehicleModal.
    if (inFlight.current || mutation.isPending) return;
    setServerError(null);
    if (!valid) return;
    inFlight.current = true;
    mutation.mutate(
      {
        vehicleId: selectedVehicleId,
        title: title.trim(),
        description: description || undefined,
        priority,
        vendor: vendor || undefined,
        costUsd: partsCost ? Number(partsCost) : undefined,
        odometerMi: odometer ? Number(odometer) : undefined,
        estimatedLaborHours: estimatedLaborHours ? Number(estimatedLaborHours) : undefined,
        dueAt: dueDateToIso(dueDate),
        defectIds: selectedDefects.length > 0 ? selectedDefects : undefined,
        keepOutOfService,
        notifyDriver,
        blockDispatchAssignment,
      },
      {
        onSettled: () => {
          inFlight.current = false;
        },
        onSuccess: (wo) => {
          toast({ kind: 'success', title: `Work order ${wo.number} created`, description: 'The unit and any attached defects were updated.' });
          onClose();
        },
        onError: (error) => {
          // A 422 used to land as a bare banner below the fold — nothing on the fields, nothing in
          // view. Each issue now goes on its own field; anything unplaceable is spelled out.
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
      title="Create work order"
      isDirty={isDirty}
      subtitle={vehicle ? `Unit ${vehicle.unitNumber} · ${[vehicle.make, vehicle.model].filter(Boolean).join(' ')} · ${defects.rows.length} open defects` : 'Select a unit'}
      size="lg"
      footer={
        <>
          <ModalCancelButton disabled={mutation.isPending} />
          <Button variant="primary" size="lg" disabled={!valid} loading={mutation.isPending} onClick={submit}>
            Create work order
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!vehicleId && (
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">
              Unit <span className="text-danger">*</span>
            </span>
            {/* Shared Select, not a native <select>: its menu shows 10 rows and scrolls. */}
            <Select
              aria-label="Unit"
              value={selectedVehicleId}
              options={(vehiclesQuery.data?.items ?? []).map((v) => ({ value: v.id, label: `Unit ${v.unitNumber}` }))}
              onChange={changeVehicle}
              placeholder="Select a unit…"
              searchable
              searchLabel="Search units"
              className={inputClass}
            />
          </label>
        )}

        <div>
          <p className="mb-2 text-label font-semibold uppercase tracking-wide text-text-muted">Defects to include</p>
          {defects.rows.length === 0 ? (
            <p className="text-body text-text-muted">No open defects on this unit.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {defects.rows.map((d) => (
                <label
                  key={d.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${
                    selectedDefects.includes(d.id) ? 'border-primary bg-primary-soft' : 'border-border'
                  }`}
                >
                  <input type="checkbox" checked={selectedDefects.includes(d.id)} onChange={() => toggleDefect(d.id)} className="mt-1" />
                  <span className="flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-body-strong text-text">{formatEnumLabel(d.category)}</span>
                      <SeverityBadge severity={d.severity} />
                    </span>
                    <span className="block text-caption text-text-muted">{d.description}</span>
                  </span>
                  <span className="tabular-nums text-caption text-text-muted">{formatLocal(d.createdAt, 'dateTime')}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-label text-text">
            Title <span className="text-danger">*</span>
          </span>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              clearServerError('title');
            }}
            maxLength={WORK_ORDER_LIMITS.title}
            placeholder="e.g. Brake repair"
            aria-invalid={titleFieldError ? true : undefined}
            aria-describedby={titleFieldError ? 'wo-title-error' : undefined}
            className={inputClass}
          />
          {titleFieldError && (
            <span id="wo-title-error" role="alert" className="text-caption text-danger">
              {titleFieldError}
            </span>
          )}
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Assign to</span>
            <input
              value={vendor}
              onChange={(e) => {
                setVendor(e.target.value);
                clearServerError('vendor');
              }}
              maxLength={WORK_ORDER_LIMITS.vendor}
              placeholder="Mike Rowan · Shop A"
              aria-invalid={vendorFieldError ? true : undefined}
              aria-describedby={vendorFieldError ? 'wo-vendor-error' : undefined}
              className={inputClass}
            />
            {vendorFieldError && (
              <span id="wo-vendor-error" role="alert" className="text-caption text-danger">
                {vendorFieldError}
              </span>
            )}
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
            <input
              type="date"
              min={today}
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                clearServerError('dueAt');
              }}
              aria-invalid={dueDateFieldError ? true : undefined}
              aria-describedby={dueDateFieldError ? 'wo-due-date-error' : undefined}
              className={inputClass}
            />
            {dueDateFieldError && (
              <span id="wo-due-date-error" role="alert" className="text-caption text-danger">
                {dueDateFieldError}
              </span>
            )}
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Estimated parts cost</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={WORK_ORDER_LIMITS.costUsd}
                step="0.01"
                inputMode="decimal"
                value={partsCost}
                onKeyDown={blockCostKeys}
                onChange={(e) => {
                  setPartsCost(sanitizeCost(e.target.value));
                  clearServerError('costUsd');
                }}
                aria-invalid={partsCostFieldError ? true : undefined}
                aria-describedby={partsCostFieldError ? 'wo-parts-cost-error' : undefined}
                className={inputClass}
              />
              <span className="text-body text-text-muted">USD</span>
            </div>
            {partsCostFieldError && (
              <span id="wo-parts-cost-error" role="alert" className="text-caption text-danger">
                {partsCostFieldError}
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
                aria-invalid={odometerFieldError ? true : undefined}
                aria-describedby={odometerFieldError ? 'wo-odometer-error' : undefined}
                className={inputClass}
              />
              <span className="text-body text-text-muted">mi</span>
            </div>
            {odometerFieldError && (
              <span id="wo-odometer-error" role="alert" className="text-caption text-danger">
                {odometerFieldError}
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
                aria-invalid={laborHoursFieldError ? true : undefined}
                aria-describedby={laborHoursFieldError ? 'wo-labor-hours-error' : undefined}
                className={inputClass}
              />
              <span className="text-body text-text-muted">h</span>
            </div>
            {laborHoursFieldError && (
              <span id="wo-labor-hours-error" role="alert" className="text-caption text-danger">
                {laborHoursFieldError}
              </span>
            )}
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-label text-text">Work to perform</span>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              clearServerError('description');
            }}
            maxLength={WORK_ORDER_LIMITS.description}
            rows={3}
            aria-invalid={descriptionFieldError ? true : undefined}
            aria-describedby={descriptionFieldError ? 'wo-description-error' : undefined}
            className="rounded-md border border-border bg-bg-surface px-3 py-2 text-body text-text"
          />
          {descriptionFieldError && (
            <span id="wo-description-error" role="alert" className="text-caption text-danger">
              {descriptionFieldError}
            </span>
          )}
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
