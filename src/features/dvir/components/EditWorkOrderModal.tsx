// owner: web-dvir-safety — WB-074 · W-09 Work orders tab, `…` `Edit`. `maintenance` FULL.
// The vehicle and attached defects are not editable here — only the fields `CreateWorkOrderModal`
// also collects (`PATCH /work-orders/:id`, `endpoints.workOrders.update`, a real endpoint).
import { useState } from 'react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { TOAST_COPY } from '@/shared/ui/copy';
import { useUpdateWorkOrder, type WorkOrderPriority, type WorkOrderTableRow } from '@/shared/api/dvir';
import { ApiError } from '@/shared/api/errors';

const PRIORITIES: { value: WorkOrderPriority; label: string }[] = [
  { value: 'URGENT', label: 'Critical — out of service' },
  { value: 'HIGH', label: 'High' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'LOW', label: 'Low' },
];

const inputClass = 'h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text';

export function EditWorkOrderModal({ workOrder, onClose }: { workOrder: WorkOrderTableRow; onClose: () => void }) {
  const { toast } = useToast();
  const mutation = useUpdateWorkOrder(workOrder.id);
  const [title, setTitle] = useState(workOrder.title);
  const [vendor, setVendor] = useState(workOrder.vendor ?? '');
  const [priority, setPriority] = useState<WorkOrderPriority>(workOrder.priority);
  const [dueDate, setDueDate] = useState(workOrder.dueAt ? workOrder.dueAt.slice(0, 10) : '');
  const [cost, setCost] = useState(workOrder.costUsd != null ? String(workOrder.costUsd) : '');
  const [odometer, setOdometer] = useState(workOrder.odometerMi != null ? String(workOrder.odometerMi) : '');
  const [description, setDescription] = useState(workOrder.description ?? '');
  const [serverError, setServerError] = useState<string | null>(null);

  const valid = title.trim() !== '';
  // WB-150 — plain state, so `isDirty` compares against the row the modal opened with.
  const isDirty =
    title !== workOrder.title ||
    vendor !== (workOrder.vendor ?? '') ||
    priority !== workOrder.priority ||
    dueDate !== (workOrder.dueAt ? workOrder.dueAt.slice(0, 10) : '') ||
    cost !== (workOrder.costUsd != null ? String(workOrder.costUsd) : '') ||
    odometer !== (workOrder.odometerMi != null ? String(workOrder.odometerMi) : '') ||
    description !== (workOrder.description ?? '');

  function submit() {
    // WB-149 — an emptied field used to send `undefined`, which a PATCH reads as "leave it
    // alone", so clearing `Assign to`, a cost, an odometer, a due date or the description was
    // silently discarded and the old value survived. Every one of those columns is nullable on
    // `WorkOrderRow`, so an emptied field now sends an explicit `null` and actually clears.
    setServerError(null);
    mutation.mutate(
      {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        vendor: vendor.trim() || null,
        costUsd: cost.trim() ? Number(cost) : null,
        odometerMi: odometer.trim() ? Number(odometer) : null,
        dueAt: dueDate ? new Date(dueDate).toISOString() : null,
      },
      {
        onSuccess: () => {
          toast({ kind: 'success', ...TOAST_COPY.workOrderUpdated(workOrder.number) });
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
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
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
            <span className="text-label text-text">Parts cost</span>
            <div className="flex items-center gap-2">
              <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} className={inputClass} />
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
