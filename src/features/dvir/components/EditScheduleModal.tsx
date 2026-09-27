// owner: web-dvir-safety — WB-074 · W-09 Schedules tab, `…` `Edit`. `maintenance` FULL.
// `PATCH /maintenance-schedules/:id` (`endpoints.maintenanceSchedules.update`), a real endpoint.
// QA-B — without a `schedule` the same form creates one (`POST /maintenance-schedules`): the tab's
// empty state said "Create a schedule…" while no control on the screen could.
import { useState } from 'react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { TOAST_COPY } from '@/shared/ui/copy';
import { useCreateSchedule, useUpdateSchedule, type ScheduleTableRow } from '@/shared/api/dvir';
import { useVehiclesPicker } from '@/shared/api/vehicles';
import { ApiError } from '@/shared/api/errors';

const inputClass = 'h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text';

const EMPTY_SCHEDULE = {
  name: '',
  intervalMi: null,
  intervalDays: null,
  lastServiceMi: null,
  lastServiceAt: null,
  enabled: true,
} as const;

/** Whole miles/days only — `MaintenanceSchedule*Dto` uses `z.number().int()`. */
const WHOLE_NUMBER_RE = /^\d+$/;

export function EditScheduleModal({ schedule, onClose }: { schedule?: ScheduleTableRow; onClose: () => void }) {
  const { toast } = useToast();
  const isCreate = !schedule;
  const initial = schedule ?? EMPTY_SCHEDULE;
  const updateMutation = useUpdateSchedule(schedule?.id ?? '');
  const createMutation = useCreateSchedule();
  const mutation = isCreate ? createMutation : updateMutation;
  const vehiclesQuery = useVehiclesPicker();
  const [vehicleId, setVehicleId] = useState('');
  const [name, setName] = useState<string>(initial.name);
  const [intervalMi, setIntervalMi] = useState(initial.intervalMi != null ? String(initial.intervalMi) : '');
  const [intervalDays, setIntervalDays] = useState(initial.intervalDays != null ? String(initial.intervalDays) : '');
  const [lastServiceMi, setLastServiceMi] = useState(initial.lastServiceMi != null ? String(initial.lastServiceMi) : '');
  const [lastServiceAt, setLastServiceAt] = useState(initial.lastServiceAt ? initial.lastServiceAt.slice(0, 10) : '');
  const [enabled, setEnabled] = useState<boolean>(initial.enabled);
  const [serverError, setServerError] = useState<string | null>(null);

  const numbersValid = [intervalMi, intervalDays, lastServiceMi].every((v) => v.trim() === '' || WHOLE_NUMBER_RE.test(v.trim()));
  const intervalsPositive = [intervalMi, intervalDays].every((v) => v.trim() === '' || Number(v) >= 1);
  const valid =
    (!isCreate || vehicleId !== '') &&
    name.trim() !== '' &&
    (intervalMi.trim() !== '' || intervalDays.trim() !== '') &&
    numbersValid &&
    intervalsPositive;
  // WB-150 — plain state, so `isDirty` compares against the row the modal opened with.
  const isDirty =
    vehicleId !== '' ||
    name !== initial.name ||
    intervalMi !== (initial.intervalMi != null ? String(initial.intervalMi) : '') ||
    intervalDays !== (initial.intervalDays != null ? String(initial.intervalDays) : '') ||
    lastServiceMi !== (initial.lastServiceMi != null ? String(initial.lastServiceMi) : '') ||
    lastServiceAt !== (initial.lastServiceAt ? initial.lastServiceAt.slice(0, 10) : '') ||
    enabled !== initial.enabled;

  function submit() {
    // WB-149 — an emptied interval or last-service field used to send `undefined`, which a PATCH
    // reads as "leave it alone": dropping a mileage interval in favour of a day interval silently
    // kept both. All four columns are nullable on `MaintenanceScheduleRow`, so an emptied field
    // now sends `null`. `name` and "at least one interval" stay required (`valid`), because the
    // row cannot hold a null name or a schedule with no interval at all.
    setServerError(null);
    const onError = (error: unknown) =>
      setServerError(error instanceof ApiError ? error.userMessage : 'Something went wrong.');
    // `lastServiceMi`/`lastServiceAt` are not nullable in `UpdateMaintenanceScheduleDto` — sending
    // `null` for an emptied field was answered 422, so an empty one is left out instead.
    const lastService = {
      lastServiceMi: lastServiceMi.trim() ? Number(lastServiceMi) : undefined,
      lastServiceAt: lastServiceAt ? new Date(lastServiceAt).toISOString() : undefined,
    };
    if (isCreate) {
      createMutation.mutate(
        {
          vehicleId,
          name: name.trim(),
          intervalMi: intervalMi.trim() ? Number(intervalMi) : undefined,
          intervalDays: intervalDays.trim() ? Number(intervalDays) : undefined,
          ...lastService,
          enabled,
        },
        {
          onSuccess: () => {
            toast({ kind: 'success', title: `${name.trim()} scheduled` });
            onClose();
          },
          onError,
        },
      );
      return;
    }
    updateMutation.mutate(
      {
        name: name.trim(),
        intervalMi: intervalMi.trim() ? Number(intervalMi) : null,
        intervalDays: intervalDays.trim() ? Number(intervalDays) : null,
        ...lastService,
        enabled,
      },
      {
        onSuccess: () => {
          toast({ kind: 'success', ...TOAST_COPY.scheduleUpdated(initial.name) });
          onClose();
        },
        onError,
      },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isCreate ? 'New schedule' : 'Edit schedule'}
      isDirty={isDirty}
      subtitle={isCreate ? 'Preventive service by mileage or date' : `Unit ${schedule?.vehicle?.unitNumber ?? '—'}`}
      size="md"
      footer={
        <>
          <ModalCancelButton disabled={mutation.isPending} />
          <Button variant="primary" size="lg" disabled={!valid} loading={mutation.isPending} onClick={submit}>
            {isCreate ? 'Create schedule' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {isCreate && (
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">
              Unit <span className="text-danger">*</span>
            </span>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className={inputClass}>
              <option value="">Select a unit…</option>
              {(vehiclesQuery.data?.items ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  Unit {v.unitNumber}
                </option>
              ))}
            </select>
          </label>
        )}
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

        {intervalMi.trim() === '' && intervalDays.trim() === '' && (
          <p className="text-caption text-text-muted">Set a mileage interval, a day interval, or both.</p>
        )}
        {(!numbersValid || !intervalsPositive) && (
          <p role="alert" className="text-caption text-danger">
            Intervals and odometer must be whole numbers; intervals start at 1.
          </p>
        )}
        {serverError && (
          <p role="alert" className="rounded-md bg-danger-soft p-3 text-body text-danger">
            {serverError}
          </p>
        )}
      </div>
    </Modal>
  );
}
