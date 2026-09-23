// owner: web-dvir-safety — 11.16 Create work order (web/tz.md §11.16). `maintenance` FULL, `lg`.
import { useMemo, useState } from 'react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { SeverityBadge } from '@/shared/ui/Badge';
import { useToast } from '@/shared/ui/Toast';
import { useDefectsList, useCreateWorkOrder, type WorkOrderPriority } from '@/shared/api/dvir';
import { useVehiclesPicker } from '@/shared/api/vehicles';
import { ApiError } from '@/shared/api/errors';
import { formatLocal } from '@/shared/format/datetime';

const PRIORITIES: { value: WorkOrderPriority; label: string }[] = [
  { value: 'URGENT', label: 'Critical — out of service' },
  { value: 'HIGH', label: 'High' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'LOW', label: 'Low' },
];

const inputClass = 'h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text';

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
  const [description, setDescription] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);

  const vehicle = useMemo(
    () => vehiclesQuery.data?.items.find((v) => v.id === selectedVehicleId) ?? null,
    [vehiclesQuery.data, selectedVehicleId],
  );

  const valid = selectedVehicleId !== '' && title.trim() !== '';
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
    description !== '';

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

  function submit() {
    // WB-148 — `Estimated labour` and the three trailing checkboxes (`Keep the unit out of
    // service`, `Notify the driver`, `Block dispatch assignment`) were collected, defaulted to
    // checked, and then never put on the wire: `CreateWorkOrderDto` has no labour-hours field and
    // no `keepOutOfService`/`notifyDriver`/`blockDispatchAssignment` flags (web/backend-gaps.md
    // B-42). Out-of-service state still follows only the "an open CRITICAL defect exists" rule,
    // and nothing notifies the driver from here — so the controls are gone rather than left
    // promising three effects the request cannot ask for. `Estimated parts cost` stays: it is a
    // real DTO field (`costUsd`).
    setServerError(null);
    mutation.mutate(
      {
        vehicleId: selectedVehicleId,
        title: title.trim(),
        description: description || undefined,
        priority,
        vendor: vendor || undefined,
        costUsd: partsCost ? Number(partsCost) : undefined,
        odometerMi: odometer ? Number(odometer) : undefined,
        dueAt: dueDate ? new Date(dueDate).toISOString() : undefined,
        defectIds: selectedDefects.length > 0 ? selectedDefects : undefined,
      },
      {
        onSuccess: (wo) => {
          toast({ kind: 'success', title: `Work order ${wo.number} created`, description: 'The unit and any attached defects were updated.' });
          onClose();
        },
        onError: (error) => setServerError(error instanceof ApiError ? error.userMessage : 'Something went wrong.'),
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
            <select value={selectedVehicleId} onChange={(e) => changeVehicle(e.target.value)} className={inputClass}>
              <option value="">Select a unit…</option>
              {(vehiclesQuery.data?.items ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  Unit {v.unitNumber}
                </option>
              ))}
            </select>
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
                      <span className="text-body-strong text-text">{d.category}</span>
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
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Brake repair" className={inputClass} />
        </label>

        <div className="grid grid-cols-3 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Assign to</span>
            <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Mike Rowan · Shop A" className={inputClass} />
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

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Estimated parts cost</span>
            <div className="flex items-center gap-2">
              <input type="number" value={partsCost} onChange={(e) => setPartsCost(e.target.value)} className={inputClass} />
              <span className="text-body text-text-muted">USD</span>
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Odometer at service</span>
            <div className="flex items-center gap-2">
              <input type="number" value={odometer} onChange={(e) => setOdometer(e.target.value)} className={inputClass} />
              <span className="text-body text-text-muted">mi</span>
            </div>
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-label text-text">Work to perform</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
