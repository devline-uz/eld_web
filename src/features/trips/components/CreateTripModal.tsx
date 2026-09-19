// owner: web-dispatch-messaging — 11.10 Create trip (web/tz.md §11.10). `trips` FULL, size `lg`.
import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { addYears, endOfDay, format, startOfToday } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { DriverPicker, UnitPicker, type PickerOption } from '@/shared/ui/DriverPicker';
import { useToast } from '@/shared/ui/Toast';
import { cn } from '@/shared/ui/cn';
import { useDriversList } from '@/shared/api/drivers';
import { useVehiclesPicker } from '@/shared/api/vehicles';
import { useDriverHos } from '@/shared/api/drivers';
import { useCreateTrip, blocksAssignment, type CreateTripStopInput } from '@/shared/api/trips';
import { tripSchema } from '@/shared/forms/schemas';
import { requiredString } from '@/shared/forms/fields';
import { VALIDATION_MESSAGES } from '@/shared/forms/messages';
import { ApiError } from '@/shared/api/errors';
import { formatHosHours } from '@/shared/format/hos';

/** What `datetime-local` emits — `YYYY-MM-DDTHH:mm[:ss[.sss]]`, and never more than a 4-digit year. */
const LOCAL_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/;
/** Stands in for a date the browser itself rejected (Feb 30, a 5-digit year): its `value` is `''`,
 * which would otherwise read as "left blank" and hide the real problem. */
const BAD_DATE = 'invalid-date';
const INVALID_DATE_MESSAGE = 'Enter a valid date and time.';
const DISTANCE_MESSAGE = 'Enter a distance greater than 0.';
const RATE_MESSAGE = 'Enter a rate greater than 0.';
const RATE_DECIMALS_MESSAGE = 'Use at most 2 decimal places.';

/** Parses a local `datetime-local` value, or `null` if that calendar date doesn't exist. */
function parseLocalDateTime(value: string): Date | null {
  const m = LOCAL_DATETIME_RE.exec(value);
  if (!m) return null;
  const [year, month, day, hour, minute, second] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? '0'].map(
    Number,
  ) as [number, number, number, number, number, number];
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return null;
  const date = new Date(year, month - 1, day, hour, minute, second);
  // `Date` silently rolls Feb 29 2027 / Apr 31 over into March / May — a round-trip mismatch means
  // the day doesn't exist (leap years included).
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
    return null;
  return date;
}

/** The pickup window: today (local, not UTC) through the same day one year from now. Computed on
 * every call so a modal left open past midnight doesn't validate against yesterday. */
function pickupRange(): { min: Date; max: Date } {
  const min = startOfToday();
  return { min, max: endOfDay(addYears(min, 1)) };
}

const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

type Meridiem = 'AM' | 'PM';
const HOURS_12 = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

/** `12:00 AM` → `00`, `12:00 PM` → `12`, `01 PM` → `13`. */
function to24Hour(hour12: string, meridiem: Meridiem): string {
  const h = Number(hour12) % 12;
  return String(meridiem === 'PM' ? h + 12 : h).padStart(2, '0');
}

/** `00` → `12 AM`, `12` → `12 PM`, `13` → `01 PM`. */
function to12Hour(hour24: string): { hour: string; meridiem: Meridiem } {
  const h = Number(hour24);
  return { hour: String(h % 12 || 12).padStart(2, '0'), meridiem: h < 12 ? 'AM' : 'PM' };
}

/**
 * Date + 12-hour time (hour · minute · AM/PM). A native `datetime-local` follows the browser locale
 * and can't be forced into AM/PM, so the time half is three selects. The form value is unchanged —
 * the same zone-less `YYYY-MM-DDTHH:mm` (24-hour) the `datetime-local` used to emit, so validation
 * and the ISO payload don't move. A half-filled entry reports `BAD_DATE` ("Enter a valid date and time.").
 */
function DateTime12Input({
  label,
  value,
  onChange,
  onBlur,
  min,
  max,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  min: string;
  max: string;
  invalid: boolean;
}) {
  const [parts, setParts] = useState(() => {
    const m = LOCAL_DATETIME_RE.exec(value);
    if (!m) return { date: '', hour: '', minute: '', meridiem: 'AM' as Meridiem };
    const { hour, meridiem } = to12Hour(m[4]!);
    return { date: `${m[1]}-${m[2]}-${m[3]}`, hour, minute: m[5]!, meridiem };
  });

  function update(next: Partial<typeof parts>) {
    const p = { ...parts, ...next };
    setParts(p);
    if (!p.date && !p.hour && !p.minute) onChange('');
    else if (p.date === BAD_DATE || !p.date || !p.hour || !p.minute) onChange(BAD_DATE);
    else onChange(`${p.date}T${to24Hour(p.hour, p.meridiem)}:${p.minute}`);
  }

  // A browser-rejected date (Feb 30, a 5-digit year) reports `value === ''` with `validity.badInput`.
  const readDate = (e: React.SyntheticEvent<HTMLInputElement>) =>
    e.currentTarget.validity?.badInput ? BAD_DATE : e.currentTarget.value;
  const selectClass = cn(inputClass, 'min-w-0 flex-1 px-2 tabular-nums');

  return (
    <div
      // Date first, the time selects as one group: when the column is too narrow for both (the
      // two-column Stops grid), the group wraps under the date instead of squeezing it.
      className="flex flex-wrap gap-2"
      // Validate once focus leaves the whole group, not between the date and the hour.
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onBlur();
      }}
    >
      <input
        type="date"
        aria-label={`${label} date`}
        aria-invalid={invalid || undefined}
        min={min}
        max={max}
        value={parts.date === BAD_DATE ? '' : parts.date}
        onChange={(e) => update({ date: readDate(e) })}
        onBlur={(e) => {
          const date = readDate(e);
          if (date !== parts.date) update({ date });
        }}
        className={cn(inputClass, 'min-w-40 flex-1 basis-40 tabular-nums')}
      />
      <div className="flex grow gap-2">
        <select
          aria-label={`${label} hour`}
          aria-invalid={invalid || undefined}
          value={parts.hour}
          onChange={(e) => update({ hour: e.target.value })}
          className={selectClass}
        >
          <option value="">hh</option>
          {HOURS_12.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label} minute`}
          aria-invalid={invalid || undefined}
          value={parts.minute}
          onChange={(e) => update({ minute: e.target.value })}
          className={selectClass}
        >
          <option value="">mm</option>
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label} AM/PM`}
          aria-invalid={invalid || undefined}
          value={parts.meridiem}
          onChange={(e) => update({ meridiem: e.target.value as Meridiem })}
          className={selectClass}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}

const createTripSchema = tripSchema
  .extend({
    scheduledStart: requiredString().superRefine((value, ctx) => {
      if (!value) return;
      const start = parseLocalDateTime(value);
      const { min, max } = pickupRange();
      if (!start) ctx.addIssue({ code: z.ZodIssueCode.custom, message: INVALID_DATE_MESSAGE });
      else if (start < min)
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Pickup cannot be before today.' });
      else if (start > max)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Pickup must be within one year from today.',
        });
    }),
    scheduledEnd: z
      .string()
      .optional()
      .superRefine((value, ctx) => {
        if (!value) return;
        const end = parseLocalDateTime(value);
        if (!end) ctx.addIssue({ code: z.ZodIssueCode.custom, message: INVALID_DATE_MESSAGE });
        else if (end > pickupRange().max)
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Delivery must be within one year from today.',
          });
      }),
    shippingDocument: z.string().trim().max(60).optional(),
    weightLbs: z
      .number({ invalid_type_error: 'Enter a whole number.' })
      .int('Enter a whole number.')
      .min(0)
      .optional(),
    // Miles, like every `distanceMi` the API returns — fractional miles are allowed.
    // Required via refine, not `required_error`: a type error aborts the object and would silently
    // skip the delivery-vs-pickup check below until a distance was typed.
    distanceMi: z
      .number({ invalid_type_error: DISTANCE_MESSAGE })
      .positive(DISTANCE_MESSAGE)
      .optional()
      .refine((v) => v !== undefined, VALIDATION_MESSAGES.required),
    // USD, shown as `1,240.00` (formatMoney) — optional like the design, cents at most. Not in the
    // create payload yet (CreateTripPayload has no rate field), so it is validated but not sent.
    rateUsd: z
      .number({ invalid_type_error: RATE_MESSAGE })
      .positive(RATE_MESSAGE)
      .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, RATE_DECIMALS_MESSAGE)
      .optional(),
  })
  .refine(
    (v) => {
      const start = parseLocalDateTime(v.scheduledStart);
      const end = v.scheduledEnd ? parseLocalDateTime(v.scheduledEnd) : null;
      return !start || !end || end >= start;
    },
    { path: ['scheduledEnd'], message: 'Delivery cannot be before pickup.' },
  );
type CreateTripValues = z.infer<typeof createTripSchema>;

/** `datetime-local` gives a zone-less `YYYY-MM-DDTHH:mm` in the dispatcher's local time — send ISO. */
function toIso(local: string | undefined): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Backend payload field → form field, so a 422 lands under the input the user actually typed in. */
const SERVER_FIELD_MAP: Record<string, keyof CreateTripValues> = {
  number: 'reference',
  driverId: 'driverId',
  vehicleId: 'vehicleId',
  shippingDocument: 'shippingDocument',
  weightLbs: 'weightLbs',
  plannedStartAt: 'scheduledStart',
  plannedEndAt: 'scheduledEnd',
  notes: 'notes',
};

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label text-text">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      {children}
      {error && <span className="text-caption text-danger">{error}</span>}
    </label>
  );
}

const inputClass = 'h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text';

export function CreateTripModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [estimatedDriveHours, setEstimatedDriveHours] = useState<string>('');

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors, isDirty },
  } = useForm<CreateTripValues>({
    resolver: zodResolver(createTripSchema),
    mode: 'onBlur',
    defaultValues: {
      reference: '',
      driverId: '',
      vehicleId: '',
      origin: '',
      destination: '',
      scheduledStart: '',
      scheduledEnd: '',
      shippingDocument: '',
    },
  });

  // The form is the single source of truth for the assignment — a parallel useState drifted out of
  // sync ("Pick another driver" cleared the picker but the old driver was still submitted).
  const driverId = useWatch({ control, name: 'driverId' }) || null;
  const vehicleId = useWatch({ control, name: 'vehicleId' }) || null;
  const scheduledStart = useWatch({ control, name: 'scheduledStart' });

  // Native min/max also stop the picker offering (and Chrome typing) a 5-digit year.
  const { min: pickupMin, max: pickupMax } = pickupRange();
  const pickupMinInput = toLocalInput(pickupMin);
  const pickupMaxInput = toLocalInput(pickupMax);
  const deliveryMinInput =
    scheduledStart && parseLocalDateTime(scheduledStart) ? scheduledStart : pickupMinInput;

  /** The stop window's date + 12-hour time; a browser-rejected date submits the `BAD_DATE` sentinel
   * so zod says "invalid date", not "required" (or nothing, for the optional delivery). */
  function renderWindow(name: 'scheduledStart' | 'scheduledEnd', label: string, min: string) {
    return (
      <Controller
        name={name}
        control={control}
        render={({ field, fieldState }) => (
          <DateTime12Input
            label={label}
            value={field.value ?? ''}
            onChange={field.onChange}
            onBlur={field.onBlur}
            min={min.slice(0, 10)}
            max={pickupMaxInput.slice(0, 10)}
            invalid={!!fieldState.error}
          />
        )}
      />
    );
  }

  const createMutation = useCreateTrip();
  const submitting = createMutation.isPending;

  const driversQuery = useDriversList({ limit: 200 });
  const vehiclesQuery = useVehiclesPicker();
  const driverHos = useDriverHos(driverId ?? undefined);

  const driverOptions: PickerOption[] = useMemo(
    () =>
      (driversQuery.data?.items ?? []).map((d) => ({
        id: d.id,
        name: `${d.firstName} ${d.lastName}`,
        context: d.homeTerminalName,
      })),
    [driversQuery.data],
  );
  const unitOptions: PickerOption[] = useMemo(
    () =>
      (vehiclesQuery.data?.items ?? []).map((v) => ({
        id: v.id,
        name: `#${v.unitNumber}`,
        context: [v.make, v.model].filter(Boolean).join(' '),
      })),
    [vehiclesQuery.data],
  );

  const selectedDriver = driversQuery.data?.items.find((d) => d.id === driverId) ?? null;
  const selectedDriverOption = driverOptions.find((o) => o.id === driverId);
  const selectedUnitOption = unitOptions.find((o) => o.id === vehicleId);

  // B-31 — always "not blocking" today: `DriverRow` (the real endpoint this modal reads) has no
  // e-mail verification field at all; the check lives here, in one place, so the day a verified
  // flag exists this is the only line that changes (web/backend-gaps.md B-29/B-31).
  const assignmentBlocked = blocksAssignment(
    selectedDriver as { emailVerified?: boolean | null } | null,
  );

  const estimatedDriveSec =
    Number(estimatedDriveHours) > 0 ? Math.round(Number(estimatedDriveHours) * 3600) : 0;
  const showHosWarning =
    !driverHos.isLoading &&
    !driverHos.isError &&
    driverHos.data &&
    estimatedDriveSec > driverHos.data.driveRemainingSec;

  function onSubmit(values: CreateTripValues) {
    // mutate() returns immediately, so RHF's isSubmitting never covered the request — guard on the
    // mutation itself or a double click creates two trips.
    if (submitting || assignmentBlocked) return;
    const plannedStartAt = toIso(values.scheduledStart);
    const plannedEndAt = toIso(values.scheduledEnd);
    const stops: CreateTripStopInput[] = [
      { sequence: 1, type: 'PICKUP', name: values.origin, scheduledAt: plannedStartAt },
      { sequence: 2, type: 'DELIVERY', name: values.destination, scheduledAt: plannedEndAt },
    ];
    createMutation.mutate(
      {
        number: values.reference,
        driverId: values.driverId || undefined,
        vehicleId: values.vehicleId || undefined,
        shippingDocument: values.shippingDocument || undefined,
        weightLbs: values.weightLbs,
        plannedStartAt,
        plannedEndAt,
        notes: values.notes || undefined,
        stops,
      },
      {
        onSuccess: (trip) => {
          toast({ kind: 'success', title: `Trip ${trip.number} created` });
          onClose();
        },
        onError: (error) => {
          if (error instanceof ApiError) {
            // `details` may be `{ fields: {...} }` or flat, and uses backend names (`number`,
            // `plannedStartAt`) — `fieldErrors` normalises the shape, the map renames.
            let mapped = 0;
            for (const [field, message] of Object.entries(error.fieldErrors)) {
              const formField = SERVER_FIELD_MAP[field];
              if (!formField) continue;
              setError(formField, { message });
              mapped += 1;
            }
            if (mapped > 0) return;
          }
          toast({
            kind: 'error',
            title: error instanceof ApiError ? error.userMessage : 'Something went wrong.',
          });
        },
      },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Create trip"
      subtitle="Dispatch a load to a driver and unit"
      size="lg"
      isDirty={isDirty}
      footer={
        <>
          {/* The create endpoint has no draft / "send now" flag yet, so these can't do anything —
              disabled rather than silently ignored (and the toast no longer claims "sent"). */}
          <label
            className="mr-auto flex items-center gap-2 text-body text-text-muted"
            title="Not available yet"
          >
          </label>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="secondary" size="lg" disabled title="Not available yet">
            Save as draft
          </Button>
          <Button
            type="submit"
            form="create-trip-form"
            variant="primary"
            size="lg"
            disabled={submitting || assignmentBlocked}
            loading={submitting}
          >
            Create trip
          </Button>
        </>
      }
    >
      <form
        id="create-trip-form"
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-3 gap-3">
          <Field label="Trip / load ID" required error={errors.reference?.message}>
            <input {...register('reference')} placeholder="TR-4834" className={inputClass} />
          </Field>
          <Field label="Customer">
            <input placeholder="Customer" className={inputClass} />
          </Field>
          <Field label="Reference / BOL" error={errors.shippingDocument?.message}>
            <input {...register('shippingDocument')} placeholder="4834-A" className={inputClass} />
          </Field>
        </div>

        <div>
          <h3 className="text-nav-section font-semibold uppercase tracking-wide text-text-muted">
            Stops
          </h3>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Field label="Pickup location" required error={errors.origin?.message}>
              <input {...register('origin')} className={inputClass} />
            </Field>
            <Field label="Pickup window" required error={errors.scheduledStart?.message}>
              {renderWindow('scheduledStart', 'Pickup', pickupMinInput)}
            </Field>
            <Field label="Delivery location" required error={errors.destination?.message}>
              <input {...register('destination')} className={inputClass} />
            </Field>
            <Field label="Delivery window" error={errors.scheduledEnd?.message}>
              {renderWindow('scheduledEnd', 'Delivery', deliveryMinInput)}
            </Field>
          </div>
          <button
            type="button"
            className="mt-2 w-full rounded-md border border-dashed border-border py-2 text-body text-text-secondary hover:bg-bg-subtle"
          >
            + Add an intermediate stop
          </button>
        </div>

        <div>
          <h3 className="text-nav-section font-semibold uppercase tracking-wide text-text-muted">
            Assignment
          </h3>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <Field label="Driver" required error={errors.driverId?.message}>
              <DriverPicker
                value={selectedDriverOption}
                options={driverOptions}
                onSelect={(o) =>
                  setValue('driverId', o.id, { shouldValidate: true, shouldDirty: true })
                }
                placeholder="Select a driver"
              />
              {driverId && (
                <span className="text-caption text-text-muted">
                  {driverHos.isLoading
                    ? 'Loading drive time…'
                    : driverHos.isError || !driverHos.data
                      ? 'Drive time unavailable'
                      : `${formatHosHours(driverHos.data.driveRemainingSec)} drive time left today`}
                </span>
              )}
            </Field>
            <Field label="Unit" required error={errors.vehicleId?.message}>
              <UnitPicker
                value={selectedUnitOption}
                options={unitOptions}
                onSelect={(o) =>
                  setValue('vehicleId', o.id, { shouldValidate: true, shouldDirty: true })
                }
                placeholder="Select a unit"
              />
            </Field>
            <Field label="Trailer">
              <input placeholder="Not set" className={inputClass} />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Field label="Distance" required error={errors.distanceMi?.message}>
            <input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              // type=number still lets `e`, `+`, `-` through (and Firefox any letter) — digits and one
              // decimal point only.
              onKeyDown={(e) => {
                if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !/[\d.]/.test(e.key))
                  e.preventDefault();
              }}
              onPaste={(e) => {
                if (!/^\d*\.?\d*$/.test(e.clipboardData.getData('text').trim())) e.preventDefault();
              }}
              {...register('distanceMi', {
                setValueAs: (v) => (v === '' || v == null ? undefined : Number(v)),
              })}
              placeholder="mi"
              className={inputClass}
            />
          </Field>
          <Field label="Estimated drive time">
            <input
              type="number"
              min={0}
              step={0.5}
              inputMode="decimal"
              value={estimatedDriveHours}
              onChange={(e) => setEstimatedDriveHours(e.target.value)}
              placeholder="h"
              className={inputClass}
            />
          </Field>
          <Field label="Weight" error={errors.weightLbs?.message}>
            <input
              type="number"
              min={0}
              step={1}
              // valueAsNumber turns an empty box into NaN, which z.number() rejects — an optional
              // field left blank used to block the whole form.
              {...register('weightLbs', {
                setValueAs: (v) => (v === '' || v == null ? undefined : Number(v)),
              })}
              placeholder="lbs"
              className={inputClass}
            />
          </Field>
          <Field label="Rate" error={errors.rateUsd?.message}>
            <input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              // Same guard as Distance: digits and one decimal point only.
              onKeyDown={(e) => {
                if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !/[\d.]/.test(e.key))
                  e.preventDefault();
              }}
              onPaste={(e) => {
                if (!/^\d*\.?\d*$/.test(e.clipboardData.getData('text').trim())) e.preventDefault();
              }}
              {...register('rateUsd', {
                setValueAs: (v) => (v === '' || v == null ? undefined : Number(v)),
              })}
              placeholder="USD"
              className={inputClass}
            />
          </Field>
        </div>

        {showHosWarning && driverHos.data && selectedDriver && (
          <div className="flex items-start justify-between gap-3 rounded-md bg-warning-soft p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle
                size={16}
                strokeWidth={1.75}
                className="mt-0.5 shrink-0 text-warning"
              />
              <p className="text-body text-warning">
                {selectedDriver.firstName} {selectedDriver.lastName} has{' '}
                {formatHosHours(driverHos.data.driveRemainingSec)} of drive time left. This trip
                needs {estimatedDriveHours}h — a 10-hour reset will be required before delivery.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setValue('driverId', '', { shouldDirty: true })}
            >
              Pick another driver
            </Button>
          </div>
        )}

        {assignmentBlocked && (
          <p className="rounded-md bg-danger-soft p-3 text-body text-danger">
            This driver&apos;s e-mail is not verified. Verify it before assigning a trip.
          </p>
        )}
      </form>
    </Modal>
  );
}
