// owner: web-dvir-safety — WB-074 · W-09 Schedules tab, `…` `Edit`. `maintenance` FULL.
// `PATCH /maintenance-schedules/:id` (`endpoints.maintenanceSchedules.update`), a real endpoint.
// QA-B — without a `schedule` the same form creates one (`POST /maintenance-schedules`): the tab's
// empty state said "Create a schedule…" while no control on the screen could.
import { useId, useState, type KeyboardEvent } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { TOAST_COPY } from '@/shared/ui/copy';
import { useCreateSchedule, useUpdateSchedule, type ScheduleTableRow } from '@/shared/api/dvir';
import { useVehiclesPicker } from '@/shared/api/vehicles';
import { ApiError } from '@/shared/api/errors';
import { formatDistance, formatNumber } from '@/shared/format/numbers';
import { formatLocal } from '@/shared/format/datetime';
import { computeDue, overdueReasons } from '../lib/maintenanceDue';

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

/**
 * WD-115 — mirrors `Create/UpdateMaintenanceScheduleDto` (eld_backend `service.dto.ts`):
 * `intervalMi` int 1…2,000,000, `intervalDays` int 1…3,660, `lastServiceMi` int ≥ 0.
 */
const INTERVAL_MI_MAX = 2_000_000;
const INTERVAL_DAYS_MAX = 3660;

/** Number inputs accept `-`, `+` and exponent `e`; none can form a valid whole number here. */
function blockNonDigitKeys(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') e.preventDefault();
}

/** Field error for an optional whole-number input; `null` when empty or valid. */
function wholeNumberError(value: string, min: number, max: number | null, unit: string): string | null {
  const v = value.trim();
  if (v === '') return null;
  if (v.startsWith('-')) return "Can't be negative.";
  if (!WHOLE_NUMBER_RE.test(v)) return 'Enter a whole number.';
  const n = Number(v);
  if (n < min) return `Must be at least ${min}.`;
  if (max != null && n > max) return `Can't be more than ${formatNumber(max)} ${unit}.`;
  return null;
}

function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-caption text-danger">
      {message}
    </p>
  );
}

/** WD-112 — names the interval(s) that trip, e.g. `… — due at 12,000 mi, the unit is at 15,000 mi.` */
function overdueWarning(
  due: ReturnType<typeof computeDue>,
  reasons: ReturnType<typeof overdueReasons>,
  currentOdometerMi: number | null,
): string {
  const parts: string[] = [];
  if (reasons.miles && due.nextDueMi != null && currentOdometerMi != null)
    parts.push(`due at ${formatDistance(due.nextDueMi)}, the unit is at ${formatDistance(currentOdometerMi)}`);
  if (reasons.days && due.nextDueAt) parts.push(`due on ${formatLocal(due.nextDueAt, 'shortDate')}`);
  return `This schedule will be Overdue as soon as it is saved — ${parts.join('; ')}.`;
}

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

  const odometerErrorId = useId();
  const intervalMiErrorId = useId();
  const intervalDaysErrorId = useId();
  // WD-112 — the unit's odometer as the server reads it (`vehicle.odometerMi`). Unknown while the
  // vehicles lookup loads (or before a unit is picked): then neither check below runs.
  const unitVehicleId = schedule ? schedule.vehicleId : vehicleId;
  const unit = (vehiclesQuery.data?.items ?? []).find((v) => v.id === unitVehicleId) ?? schedule?.vehicle ?? null;
  const currentOdometerMi = unit ? unit.odometerMi : null;

  // WD-115 — per-field errors; re-checked on every change, so a pasted or programmatic value
  // (`-5`, `1.5`) is caught even though the key handler blocks typing `-`/`+`/`e`.
  const intervalMiError = wholeNumberError(intervalMi, 1, INTERVAL_MI_MAX, 'mi');
  const intervalDaysError = wholeNumberError(intervalDays, 1, INTERVAL_DAYS_MAX, 'days');
  const lastServiceMiFormatError = wholeNumberError(lastServiceMi, 0, null, 'mi');
  const numbersValid = !intervalMiError && !intervalDaysError && !lastServiceMiFormatError;
  const lastServiceMiAhead =
    currentOdometerMi != null &&
    lastServiceMi.trim() !== '' &&
    !lastServiceMiFormatError &&
    Number(lastServiceMi) > currentOdometerMi;
  const lastServiceMiError =
    lastServiceMiFormatError ??
    (lastServiceMiAhead && currentOdometerMi != null
      ? `Can't be greater than the unit's current odometer (${formatDistance(currentOdometerMi)}).`
      : null);
  const valid =
    (!isCreate || vehicleId !== '') &&
    name.trim() !== '' &&
    (intervalMi.trim() !== '' || intervalDays.trim() !== '') &&
    numbersValid &&
    !lastServiceMiAhead;

  // WD-112 — non-blocking preview of the state the server will compute on save, with the same
  // inputs it uses: an emptied last-service field is not sent, so on edit the stored value stays
  // (`dto.lastServiceMi ?? schedule.lastServiceMi`), on create it is null.
  const preview = (() => {
    if (!numbersValid || lastServiceMiAhead) return null;
    const mi = intervalMi.trim() ? Number(intervalMi) : null;
    const days = intervalDays.trim() ? Number(intervalDays) : null;
    if (mi == null && days == null) return null;
    if (mi != null && currentOdometerMi == null) return null;
    const lastMi = lastServiceMi.trim() ? Number(lastServiceMi) : (schedule?.lastServiceMi ?? null);
    const lastAt = lastServiceAt ? new Date(lastServiceAt) : schedule?.lastServiceAt ? new Date(schedule.lastServiceAt) : null;
    const due = computeDue({
      intervalMi: mi,
      intervalDays: days,
      lastServiceMi: lastMi,
      lastServiceAt: lastAt,
      currentOdometerMi: currentOdometerMi ?? 0,
      now: new Date(),
    });
    return due.state === 'OVERDUE' ? { due, reasons: overdueReasons(due) } : null;
  })();
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
    if (!valid) return;
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
          <div className="flex flex-col gap-1">
            <label className="flex flex-col gap-1">
              <span className="text-label text-text">Interval (miles)</span>
              <input
                type="number"
                min={1}
                max={INTERVAL_MI_MAX}
                step={1}
                inputMode="numeric"
                value={intervalMi}
                onKeyDown={blockNonDigitKeys}
                onChange={(e) => setIntervalMi(e.target.value)}
                aria-invalid={intervalMiError ? true : undefined}
                aria-describedby={intervalMiError ? intervalMiErrorId : undefined}
                className={inputClass}
              />
            </label>
            <FieldError id={intervalMiErrorId} message={intervalMiError} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="flex flex-col gap-1">
              <span className="text-label text-text">Interval (days)</span>
              <input
                type="number"
                min={1}
                max={INTERVAL_DAYS_MAX}
                step={1}
                inputMode="numeric"
                value={intervalDays}
                onKeyDown={blockNonDigitKeys}
                onChange={(e) => setIntervalDays(e.target.value)}
                aria-invalid={intervalDaysError ? true : undefined}
                aria-describedby={intervalDaysError ? intervalDaysErrorId : undefined}
                className={inputClass}
              />
            </label>
            <FieldError id={intervalDaysErrorId} message={intervalDaysError} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="flex flex-col gap-1">
              <span className="text-label text-text">Last service odometer</span>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={lastServiceMi}
                onKeyDown={blockNonDigitKeys}
                onChange={(e) => setLastServiceMi(e.target.value)}
                aria-invalid={lastServiceMiError ? true : undefined}
                aria-describedby={lastServiceMiError ? odometerErrorId : undefined}
                className={inputClass}
              />
            </label>
            <FieldError id={odometerErrorId} message={lastServiceMiError} />
          </div>
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
        {preview && (
          <div role="status" className="flex items-start gap-2 rounded-md bg-warning-soft p-3 text-body text-text-secondary">
            <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warning" aria-hidden />
            <span>{overdueWarning(preview.due, preview.reasons, currentOdometerMi)}</span>
          </div>
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
