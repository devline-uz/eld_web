// owner: web-hos-logs — ⭐ 11.11 Request a log edit (web/tz.md §11.11). `hosEdit` FULL.
//
// §395.30 in one sentence: a carrier may only SUGGEST. The proposal is stored with
// recordStatus = 3 and changes nothing until the driver accepts it in the mobile app. Two hard
// rules live here:
//   1. `Driving` is disabled while the chosen interval covers an automatic `D` record, and
//   2. when the server still answers `422 DRIVING_TIME_IMMUTABLE` the refusal is shown verbatim
//      and the request is NEVER retried or trimmed to make it pass.
import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { TOAST_COPY } from '@/shared/ui/copy';
import { cn } from '@/shared/ui/cn';
import { ApiError } from '@/shared/api/errors';
import { LIMITS, VALIDATION_MESSAGES } from '@/shared/forms/messages';
import {
  useCreateEditRequest,
  type LogEventView,
  type RodsDutyStatus,
  type RodsGraphSegment,
} from '@/shared/api/hosLogs';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;

interface Chip {
  value: RodsDutyStatus | 'YM' | 'PC';
  label: string;
  dot: string;
}

/** The six chips the design draws, in its order. */
const CHIPS: Chip[] = [
  { value: 'OFF', label: 'OFF duty', dot: 'bg-neutral' },
  { value: 'SB', label: 'Sleeper', dot: 'bg-violet' },
  { value: 'D', label: 'Driving', dot: 'bg-success' },
  { value: 'ON', label: 'ON duty', dot: 'bg-danger' },
  { value: 'YM', label: 'Yard move', dot: 'bg-danger' },
  { value: 'PC', label: 'Personal', dot: 'bg-neutral' },
];

export interface RequestLogEditModalProps {
  driverId: string;
  driverName: string;
  /** RODS day key, `2026-09-10`. */
  date: string;
  dateLabel: string;
  timezone: string;
  /** The record the proposal is made against — §395.30 needs an original. */
  event: LogEventView | null;
  /** Today's graph, used to keep the proposal off automatic driving time. */
  graph: RodsGraphSegment[];
  onClose: () => void;
}

export function RequestLogEditModal({
  driverId,
  driverName,
  date,
  dateLabel,
  timezone,
  event,
  graph,
  onClose,
}: RequestLogEditModalProps) {
  const { toast } = useToast();
  const mutation = useCreateEditRequest(driverId);

  const startDefault = event ? formatInTimeZone(new Date(event.eventDateTime), timezone, 'HH:mm:ss') : '';
  const [startTime, setStartTime] = useState(startDefault);
  const [endTime, setEndTime] = useState('');
  const [status, setStatus] = useState<RodsDutyStatus>(event?.status ?? 'ON');
  const [location, setLocation] = useState(event?.locationName ?? '');
  const [odometer, setOdometer] = useState(
    event?.totalVehicleMiles === null || event?.totalVehicleMiles === undefined
      ? ''
      : String(event.totalVehicleMiles),
  );
  const [engineHours, setEngineHours] = useState('');
  const [reason, setReason] = useState('');
  // The backend's CreateEditRequestDto has no notify flag; the proposal always reaches the
  // driver's app (gap B-39). The checkbox is kept because the design draws it and it states the
  // default truthfully.
  const [notifyDriver, setNotifyDriver] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const startIso = useMemo(
    () => (TIME_RE.test(startTime) ? fromZonedTime(`${date}T${startTime}`, timezone).toISOString() : null),
    [date, startTime, timezone],
  );
  const endIso = useMemo(
    () => (TIME_RE.test(endTime) ? fromZonedTime(`${date}T${endTime}`, timezone).toISOString() : null),
    [date, endTime, timezone],
  );

  /** §395.30 — an automatic `D` record inside the interval makes `Driving` impossible. */
  const touchesAutomaticDriving = useMemo(() => {
    if (!startIso) return false;
    const from = Date.parse(startIso);
    const to = endIso ? Date.parse(endIso) : from;
    return graph.some(
      (segment) =>
        segment.status === 'D' &&
        segment.special === 'NONE' &&
        Date.parse(segment.startAt) < Math.max(to, from + 1) &&
        Date.parse(segment.endAt) > from,
    );
  }, [graph, startIso, endIso]);

  const reasonTooShort = reason.trim().length < LIMITS.annotationMin;

  function submit() {
    setBanner(null);
    setFieldErrors({});
    if (!event) {
      setBanner('Select a record in `Log events` to propose an edit against.');
      return;
    }
    if (!startIso) {
      setFieldErrors({ startAt: 'Enter a time as HH:MM:SS.' });
      return;
    }
    if (endTime && !endIso) {
      setFieldErrors({ endAt: 'Enter a time as HH:MM:SS.' });
      return;
    }
    if (reasonTooShort) {
      setFieldErrors({ reason: VALIDATION_MESSAGES.annotation });
      return;
    }
    mutation.mutate(
      {
        originalEventId: event.id,
        proposedStatus: status,
        proposedStart: startIso,
        proposedEnd: endIso ?? undefined,
        odometerMi: odometer ? Number(odometer) : undefined,
        engineHours: engineHours ? Number(engineHours) : undefined,
        // `LocationDto` needs lat/lon, and the free-text box only carries a name — sending a
        // half-filled location would write a worse record than sending none (gap B-39).
        reason: reason.trim(),
      },
      {
        onSuccess: () => {
          toast({ kind: 'success', ...TOAST_COPY.editRequestSent(driverName) });
          onClose();
        },
        onError: (error) => {
          if (error instanceof ApiError) {
            // ⛔ Verbatim, once. No retry, no client-side trimming of the interval (§14.3).
            setBanner(error.userMessage);
            setFieldErrors(error.fieldErrors);
            return;
          }
          setBanner('Something went wrong.');
        },
      },
    );
  }

  const isDirty = reason.length > 0 || startTime !== startDefault || endTime.length > 0;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Request a log edit"
      subtitle={`${driverName} · ${dateLabel} · driver approval required`}
      isDirty={isDirty}
      footer={
        <div className="flex w-full items-center justify-between">
          <label className="flex items-center gap-2 text-body text-text-secondary">
            <input
              type="checkbox"
              checked={notifyDriver}
              onChange={(e) => setNotifyDriver(e.target.checked)}
            />
            Notify the driver immediately
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="lg" onClick={submit} loading={mutation.isPending}>
              Send edit request
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex items-start gap-2 rounded-md bg-warning-soft p-3 text-body text-text-secondary">
        <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warning" />
        <p>
          Under 49 CFR §395.30 a carrier may only suggest an edit. The driver must review and accept
          it in the mobile app before the log changes.
        </p>
      </div>

      {banner && (
        <p role="alert" className="mt-4 rounded-md bg-danger-soft p-3 text-body text-danger">
          {banner}
        </p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Field label="Date">
          <input readOnly value={dateLabel} className={cn(inputClass, 'bg-bg-subtle')} />
        </Field>
        <Field label="Start time" error={fieldErrors.startAt}>
          <input
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            placeholder="14:26:58"
            className={cn(inputClass, 'tabular')}
          />
        </Field>
        <Field label="End time" error={fieldErrors.endAt}>
          <input
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            placeholder="15:30:00"
            className={cn(inputClass, 'tabular')}
          />
        </Field>
      </div>

      <fieldset className="mt-4">
        <legend className="text-label text-text">Duty status</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {CHIPS.map((chip) => {
            // `D` is refused while the interval covers automatic driving time; `YM`/`PC` have no
            // representation in CreateEditRequestDto at all (gap B-39) — both render disabled
            // rather than silently sending something else.
            const disabled =
              (chip.value === 'D' && touchesAutomaticDriving) || chip.value === 'YM' || chip.value === 'PC';
            const selected = chip.value === status;
            return (
              <button
                key={chip.value}
                type="button"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => setStatus(chip.value as RodsDutyStatus)}
                className={cn(
                  'flex h-input items-center gap-2 rounded-md border px-3 text-body',
                  selected ? 'border-primary text-text' : 'border-border text-text-secondary',
                  disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                <span aria-hidden className={cn('size-2 rounded-full', chip.dot)} />
                {chip.label}
              </button>
            );
          })}
        </div>
        {touchesAutomaticDriving && (
          <p className="mt-2 text-caption text-danger">
            Driving time can never be shortened, deleted or restatused (49 CFR §395.30).
          </p>
        )}
      </fieldset>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Field label="Location">
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Odometer" suffix="mi" error={fieldErrors.odometerMi}>
          <input
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
            inputMode="numeric"
            className={cn(inputClass, 'tabular')}
          />
        </Field>
        <Field label="Engine hours" suffix="h" error={fieldErrors.engineHours}>
          <input
            value={engineHours}
            onChange={(e) => setEngineHours(e.target.value)}
            inputMode="decimal"
            className={cn(inputClass, 'tabular')}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Reason for the edit" required error={fieldErrors.reason}>
          <textarea
            value={reason}
            maxLength={LIMITS.annotationMax}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={Boolean(fieldErrors.reason)}
            className="min-h-20 rounded-md border border-border bg-bg-surface p-3 text-body text-text"
          />
        </Field>
        <p className="mt-1 text-caption text-text-muted">
          Stored with the record and shown to the driver and to any safety official.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-md bg-bg-subtle p-3">
          <p className="text-table-head font-semibold uppercase tracking-wide text-text-muted">Before</p>
          <p className="tabular mt-1 text-body text-text">
            {event?.status ?? '—'} {startDefault ? startDefault.slice(0, 5) : '—'} →{' '}
            {endTime ? endTime.slice(0, 5) : '—'}
          </p>
        </div>
        <div className="rounded-md bg-bg-subtle p-3">
          <p className="text-table-head font-semibold uppercase tracking-wide text-text-muted">After</p>
          <p className="tabular mt-1 text-body text-primary">
            {status} {startTime ? startTime.slice(0, 5) : '—'} → {endTime ? endTime.slice(0, 5) : '—'}{' '}
            (annotated)
          </p>
        </div>
      </div>
    </Modal>
  );
}

const inputClass = 'h-input w-full rounded-md border border-border bg-bg-surface px-3 text-body text-text';

function Field({
  label,
  required,
  suffix,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  suffix?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label text-text">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      <span className="relative flex flex-col">
        {children}
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-2.5 text-body text-text-muted">
            {suffix}
          </span>
        )}
      </span>
      {error && <span className="text-caption text-danger">{error}</span>}
    </label>
  );
}
