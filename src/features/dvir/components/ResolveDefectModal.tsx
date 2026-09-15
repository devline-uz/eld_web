// owner: web-dvir-safety — 11.17 Resolve defect (web/tz.md §11.17). `dvir` FULL, `md`.
import { useState } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { SeverityBadge } from '@/shared/ui/Badge';
import { useToast } from '@/shared/ui/Toast';
import { useResolveDefect, useWorkOrdersList, type DefectTableRow } from '@/shared/api/dvir';
import { ApiError } from '@/shared/api/errors';
import { formatLocal } from '@/shared/format/datetime';

type Resolution = 'REPAIRED' | 'NO_REPAIR' | 'DEFERRED';

const inputClass = 'h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text';

export function ResolveDefectModal({ defect, onClose }: { defect: DefectTableRow; onClose: () => void }) {
  const { toast } = useToast();
  const mutation = useResolveDefect(defect.id);
  const workOrders = useWorkOrdersList({ vehicleId: defect.vehicleId, status: 'OPEN', limit: 50 });

  const [resolution, setResolution] = useState<Resolution>('REPAIRED');
  const [correctedBy, setCorrectedBy] = useState('');
  const [completedOn, setCompletedOn] = useState('');
  const [laborHours, setLaborHours] = useState('');
  const [partsCost, setPartsCost] = useState('');
  const [workOrderId, setWorkOrderId] = useState('');
  const [notes, setNotes] = useState('');
  const [returnToService, setReturnToService] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);

  const isDeferred = resolution === 'DEFERRED';
  const valid = correctedBy.trim() !== '' && notes.trim() !== '';

  function submit() {
    mutation.mutate(
      {
        status: resolution === 'DEFERRED' ? 'DEFERRED' : 'REPAIRED',
        resolutionNote: notes.trim(),
      },
      {
        onSuccess: () => {
          toast({
            kind: 'success',
            title: 'Defect resolved',
            description:
              defect.outOfService && returnToService && !isDeferred
                ? `Unit ${defect.vehicle?.unitNumber ?? ''} returned to service.`
                : undefined,
          });
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
      title="Resolve defect"
      subtitle={`Unit ${defect.vehicle?.unitNumber ?? '—'} · ${defect.category} · reported ${formatLocal(defect.createdAt, 'dateTime')}`}
      size="md"
      footer={
        <div className="flex w-full items-center justify-between">
          <label className="flex items-center gap-2 text-body text-text">
            <input
              type="checkbox"
              checked={returnToService && !isDeferred}
              disabled={isDeferred}
              onChange={(e) => setReturnToService(e.target.checked)}
            />
            Return unit {defect.vehicle?.unitNumber ?? ''} to service
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button variant="primary" size="lg" disabled={!valid} loading={mutation.isPending} onClick={submit}>
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

        <div>
          <p className="mb-2 text-label font-semibold uppercase tracking-wide text-text-muted">Resolution</p>
          <div className="flex flex-col gap-2">
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
                <input type="radio" checked={resolution === value} onChange={() => setResolution(value)} className="mt-1" />
                <span>
                  <span className="block text-body-strong text-text">{label}</span>
                  <span className="block text-caption text-text-muted">{desc}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">
              Corrected by <span className="text-danger">*</span>
            </span>
            <input value={correctedBy} onChange={(e) => setCorrectedBy(e.target.value)} placeholder="Mike Rowan · Shop A" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Completed on</span>
            <input type="datetime-local" value={completedOn} onChange={(e) => setCompletedOn(e.target.value)} className={inputClass} />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Labour hours</span>
            <div className="flex items-center gap-2">
              <input type="number" value={laborHours} onChange={(e) => setLaborHours(e.target.value)} className={inputClass} />
              <span className="text-body text-text-muted">h</span>
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Parts cost</span>
            <div className="flex items-center gap-2">
              <input type="number" value={partsCost} onChange={(e) => setPartsCost(e.target.value)} className={inputClass} />
              <span className="text-body text-text-muted">USD</span>
            </div>
          </label>
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

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-border p-3">
            <p className="text-caption text-text-muted">Mechanic signature</p>
            <p className="mt-1 text-body-strong text-text">{correctedBy || '—'}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-caption text-text-muted">Driver acknowledgement</p>
            <p className="mt-1 text-body text-text-muted">Pending</p>
          </div>
        </div>

        {serverError && <p className="text-body text-danger">{serverError}</p>}
      </div>
    </Modal>
  );
}
