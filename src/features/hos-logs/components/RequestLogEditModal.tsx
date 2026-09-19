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
import * as inputFilters from '@/shared/forms/inputFilters';
import { geocodingEnabled, PLACE_QUERY_MIN, usePlaceSearch, type Place } from '@/shared/map/geocode';
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
  const statusDefault: RodsDutyStatus = event?.status ?? 'ON';
  const [status, setStatus] = useState<RodsDutyStatus>(statusDefault);
  // WB-070 / B-39 — `CreateEditRequestDto.location` needs lat/lon, so a typed name is geocoded and
  // only a place picked from the suggestions is sent. Without a geocoder key the field stays
  // read-only and says it is not sent, instead of looking like a correction.
  const locationDefault = event?.locationName ?? '';
  const [locationText, setLocationText] = useState(locationDefault);
  const [place, setPlace] = useState<Place | null>(null);
  const locationChanged = locationText.trim() !== locationDefault.trim();
  const placeSearch = usePlaceSearch(locationText, locationChanged && !place);
  const odometerDefault =
    event?.totalVehicleMiles === null || event?.totalVehicleMiles === undefined
      ? ''
      : String(event.totalVehicleMiles);
  const [odometer, setOdometer] = useState(odometerDefault);
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

  /** §395.30 — an automatic `D` record inside the interval can only stay `Driving` (WB-059). */
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
      setFieldErrors({ startAt: VALIDATION_MESSAGES.time });
      return;
    }
    if (endTime && !endIso) {
      setFieldErrors({ endAt: VALIDATION_MESSAGES.time });
      return;
    }
    // Both times sit on the same RODS day, so an end at or before the start is never a real interval.
    if (endIso && Date.parse(endIso) <= Date.parse(startIso)) {
      setFieldErrors({ endAt: VALIDATION_MESSAGES.timeOrder });
      return;
    }
    if (odometer && Number(odometer) > LIMITS.odometerMax) {
      setFieldErrors({ odometerMi: VALIDATION_MESSAGES.odometer });
      return;
    }
    if (engineHours && !Number.isFinite(Number(engineHours))) {
      setFieldErrors({ engineHours: VALIDATION_MESSAGES.engineHours });
      return;
    }
    if (locationChanged && locationText.trim() && !place) {
      setFieldErrors({ location: VALIDATION_MESSAGES.placePick });
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
        // `LocationDto` needs lat/lon — only a geocoded place carries them; an untouched field
        // sends nothing rather than a half-filled location (gap B-39).
        location: place ? { lat: place.lat, lon: place.lon, name: place.name } : undefined,
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

  // WB-069 — every controlled field counts, so Esc on a changed status/odometer/engine-hours goes
  // through 11.30 Discard changes instead of silently dropping the edit.
  const isDirty =
    reason.length > 0 ||
    startTime !== startDefault ||
    endTime.length > 0 ||
    status !== statusDefault ||
    odometer !== odometerDefault ||
    engineHours.length > 0 ||
    locationChanged;

  // WB-067 — `Before` is the ORIGINAL record: its status and start, and the end of the graph
  // segment it opened. The typed `End time` belongs to `After` only.
  const originalEnd = useMemo(() => {
    if (!event) return null;
    const at = Date.parse(event.eventDateTime);
    const segment =
      graph.find((candidate) => Date.parse(candidate.startAt) === at) ??
      graph.find((candidate) => Date.parse(candidate.startAt) <= at && Date.parse(candidate.endAt) > at);
    return segment ? formatInTimeZone(new Date(segment.endAt), timezone, 'HH:mm') : null;
  }, [event, graph, timezone]);

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
            onChange={(e) => setStartTime(inputFilters.time24(e.target.value))}
            inputMode="numeric"
            placeholder="14:26:58"
            className={cn(inputClass, 'tabular')}
          />
        </Field>
        <Field label="End time" error={fieldErrors.endAt}>
          <input
            value={endTime}
            onChange={(e) => setEndTime(inputFilters.time24(e.target.value))}
            inputMode="numeric"
            placeholder="15:30:00"
            className={cn(inputClass, 'tabular')}
          />
        </Field>
      </div>

      <fieldset className="mt-4">
        <legend className="text-label text-text">Duty status</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {CHIPS.map((chip) => {
            // WB-059 — §395.30: automatic driving time can never be shortened, deleted or
            // restatused, so while the interval covers it every NON-driving status (`OFF`/`SB`/`ON`)
            // is refused and `D` stays the one selectable chip. `YM`/`PC` have no representation in
            // CreateEditRequestDto at all (gap B-39, WB-021) — always disabled rather than silently
            // sending something else. The server's `DRIVING_TIME_IMMUTABLE` stays the final word.
            const restatesDriving =
              touchesAutomaticDriving && (chip.value === 'OFF' || chip.value === 'SB' || chip.value === 'ON');
            const disabled = restatesDriving || chip.value === 'YM' || chip.value === 'PC';
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
        {geocodingEnabled ? (
          <Field
            label="Location"
            hint={place ? undefined : `Type ${PLACE_QUERY_MIN}+ letters and pick a place from the list.`}
            error={fieldErrors.location}
          >
            <input
              value={locationText}
              onChange={(e) => {
                setLocationText(e.target.value);
                setPlace(null);
              }}
              role="combobox"
              aria-expanded={Boolean(placeSearch.data?.length) && !place}
              aria-autocomplete="list"
              aria-invalid={Boolean(fieldErrors.location)}
              autoComplete="off"
              className={inputClass}
            />
            {!place && locationChanged && (placeSearch.data?.length ?? 0) > 0 && (
              <ul
                role="listbox"
                className="absolute top-full z-10 mt-1 w-full rounded-md border border-border bg-bg-surface py-1 shadow-pop"
              >
                {placeSearch.data!.map((candidate) => (
                  <li key={`${candidate.lat},${candidate.lon}`} role="option" aria-selected={false}>
                    <button
                      type="button"
                      onClick={() => {
                        setPlace(candidate);
                        setLocationText(candidate.name);
                        setFieldErrors(({ location: _, ...rest }) => rest);
                      }}
                      className="w-full px-3 py-1.5 text-left text-body text-text hover:bg-bg-subtle"
                    >
                      {candidate.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {placeSearch.isError && !place && (
              <span className="text-caption text-danger">Place search is unavailable right now.</span>
            )}
          </Field>
        ) : (
          <Field label="Location" hint="Not sent with the request — a location correction needs coordinates.">
            <input readOnly value={locationDefault} className={cn(inputClass, 'bg-bg-subtle')} />
          </Field>
        )}
        <Field label="Odometer" suffix="mi" error={fieldErrors.odometerMi}>
          <input
            value={odometer}
            onChange={(e) => setOdometer(inputFilters.digits(e.target.value, LIMITS.odometerDigits))}
            inputMode="numeric"
            className={cn(inputClass, 'tabular')}
          />
        </Field>
        <Field label="Engine hours" suffix="h" error={fieldErrors.engineHours}>
          <input
            value={engineHours}
            onChange={(e) =>
              setEngineHours(
                inputFilters.decimal(e.target.value, LIMITS.engineHoursIntDigits, LIMITS.engineHoursFracDigits),
              )
            }
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
            {event?.status ?? '—'} {startDefault ? startDefault.slice(0, 5) : '—'} → {originalEnd ?? '—'}
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
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  suffix?: string;
  hint?: string;
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
      {hint && <span className="text-caption text-text-muted">{hint}</span>}
      {error && <span className="text-caption text-danger">{error}</span>}
    </label>
  );
}
