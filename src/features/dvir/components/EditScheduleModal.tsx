// owner: web-dvir-safety — WB-074 · W-09 Schedules tab, `…` `Edit`. `maintenance` FULL.
// `PATCH /maintenance-schedules/:id` (`endpoints.maintenanceSchedules.update`), a real endpoint.
import { useState } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { TOAST_COPY } from '@/shared/ui/copy';
import { useUpdateSchedule, type ScheduleTableRow } from '@/shared/api/dvir';
import { ApiError } from '@/shared/api/errors';

const inputClass = 'h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text';

export function EditScheduleModal({ schedule, onClose }: { schedule: ScheduleTableRow; onClose: () => void }) {
  const { toast } = useToast();
  const mutation = useUpdateSchedule(schedule.id);
  const [name, setName] = useState(schedule.name);
  const [intervalMi, setIntervalMi] = useState(schedule.intervalMi != null ? String(schedule.intervalMi) : '');
  const [intervalDays, setIntervalDays] = useState(schedule.intervalDays != null ? String(schedule.intervalDays) : '');
  const [lastServiceMi, setLastServiceMi] = useState(schedule.lastServiceMi != null ? String(schedule.lastServiceMi) : '');
  const [lastServiceAt, setLastServiceAt] = useState(schedule.lastServiceAt ? schedule.lastServiceAt.slice(0, 10) : '');
  const [enabled, setEnabled] = useState(schedule.enabled);
  const [serverError, setServerError] = useState<string | null>(null);

  const valid = name.trim() !== '' && (intervalMi.trim() !== '' || intervalDays.trim() !== '');

  function submit() {
    mutation.mutate(
      {
        name: name.trim(),
        intervalMi: intervalMi ? Number(intervalMi) : undefined,
        intervalDays: intervalDays ? Number(intervalDays) : undefined,
        lastServiceMi: lastServiceMi ? Number(lastServiceMi) : undefined,
        lastServiceAt: lastServiceAt ? new Date(lastServiceAt).toISOString() : undefined,
        enabled,
      },
      {
        onSuccess: () => {
          toast({ kind: 'success', ...TOAST_COPY.scheduleUpdated(schedule.name) });
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
      title="Edit schedule"
      subtitle={`Unit ${schedule.vehicle?.unitNumber ?? '—'}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button variant="primary" size="lg" disabled={!valid} loading={mutation.isPending} onClick={submit}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-label text-text">
            Name <span className="text-danger">*</span>
          </span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Oil & filter" className={inputClass} />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Interval (miles)</span>
            <input type="number" value={intervalMi} onChange={(e) => setIntervalMi(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Interval (days)</span>
            <input type="number" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} className={inputClass} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Last service odometer</span>
            <input type="number" value={lastServiceMi} onChange={(e) => setLastServiceMi(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Last service date</span>
            <input type="date" value={lastServiceAt} onChange={(e) => setLastServiceAt(e.target.value)} className={inputClass} />
          </label>
        </div>

        <label className="flex items-center gap-2 text-body text-text">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Schedule is active
        </label>

        {!valid && <p className="text-caption text-text-muted">Set a mileage interval, a day interval, or both.</p>}
        {serverError && <p className="text-body text-danger">{serverError}</p>}
      </div>
    </Modal>
  );
}
