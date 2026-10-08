// owner: web-dispatch-messaging — 11.10 Create trip (web/tz.md §11.10). `trips` FULL, size `lg`.
// With a `trip` prop the same form edits that trip (`PATCH /trips/:id`): only the fields
// `UpdateTripDto` accepts stay editable, and only the ones the dispatcher changed are sent. The
// trip ID, stops and the driver / unit / trailer assignment render read-only — those change
// through the Assign flow (`POST /trips/:id/assign`) or not at all.
import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { addYears, endOfDay, format, startOfToday } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import type { Place } from '@/shared/map/geocode';
import { PlaceInput } from './PlaceInput';
import {
  DriverPicker,
  UnitPicker,
  TrailerPicker,
  type PickerOption,
} from '@/shared/ui/DriverPicker';
import { useToast } from '@/shared/ui/Toast';
import { useDriversList } from '@/shared/api/drivers';
import { useVehiclesPicker } from '@/shared/api/vehicles';
import { useDriverHos } from '@/shared/api/drivers';
import {
  useCreateTrip,
  useUpdateTrip,
  blocksAssignment,
  isTripNumberTaken,
  isTripNotEditable,
  isTripNotFound,
  tripScheduleConflict,
  type CreateTripStopInput,
  type TripRow,
  type UpdateTripPayload,
} from '@/shared/api/trips';
import { useTrailersPage } from '@/shared/api/trailers';
import { tripSchema } from '@/shared/forms/schemas';
import { requiredString } from '@/shared/forms/fields';
import { ApiError } from '@/shared/api/errors';
import { formatHosHours } from '@/shared/format/hos';
import {
  TRAILER_LOOKUP_ERROR,
  TRIP_FIELD_NOT_CLEARABLE,
  TRIP_NOT_EDITABLE,
  TRIP_NOT_FOUND,
  TRIP_NUMBER_TAKEN,
  scheduleConflictField,
  scheduleConflictMessage,
  scheduleConflictWindowHint,
  tripUpdatedToast,
} from '../lib/copy';

/** Rows the trailer picker loads per search (`ListQueryDto` caps `limit` at 200). */
const TRAILER_PICKER_LIMIT = 50;

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

/** An ISO instant as the `datetime-local` value the form edits (browser zone); `''` for none. */
const isoToLocalInput = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : toLocalInput(d);
};

/** Decimal columns serialise as strings (`"412.50"`) — the form edits numbers. */
function toNumber(value: number | string | null | undefined): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** The windows an edited trip already had, as form values. Left untouched, they are not held to
 * the "from today" / "within one year" rules — a trip planned last week must stay editable. */
interface OriginalWindows {
  start: string;
  end: string;
}

function buildTripSchema(original?: OriginalWindows) {
  const base = tripSchema.extend({
    // Edit mode: the pickup window is only required if the trip had one (PATCH cannot clear it).
    scheduledStart: (original && !original.start ? z.string() : requiredString()).superRefine(
      (value, ctx) => {
        if (!value || value === original?.start) return;
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
      },
    ),
    scheduledEnd: z
      .string()
      .optional()
      .superRefine((value, ctx) => {
        if (!value || value === original?.end) return;
        const end = parseLocalDateTime(value);
        if (!end) ctx.addIssue({ code: z.ZodIssueCode.custom, message: INVALID_DATE_MESSAGE });
        else if (end > pickupRange().max)
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Delivery must be within one year from today.',
          });
      }),
    shippingDocument: z.string().trim().max(60).optional(),
    customer: z.string().trim().max(200).optional(),
    trailerId: z.string().optional(),
    weightLbs: z
      .number({ invalid_type_error: 'Enter a whole number.' })
      .int('Enter a whole number.')
      .min(0)
      .optional(),
    // Miles — fractional miles are allowed, optional like the design; B-73 (shipped) saves it.
    distanceMi: z
      .number({ invalid_type_error: DISTANCE_MESSAGE })
      .positive(DISTANCE_MESSAGE)
      .optional(),
    // USD, shown as `1,240.00` (formatMoney) — optional like the design, cents at most; B-73
    // (shipped) saves it.
    rateUsd: z
      .number({ invalid_type_error: RATE_MESSAGE })
      .positive(RATE_MESSAGE)
      .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, RATE_DECIMALS_MESSAGE)
      .optional(),
  });
  // Edit mode renders the trip ID, stops and assignment read-only, so they are never required.
  const shaped = original
    ? base.extend({
        reference: z.string(),
        driverId: z.string(),
        vehicleId: z.string(),
        origin: z.string(),
        destination: z.string(),
      })
    : base;
  return shaped.refine(
    (v) => {
      const start = parseLocalDateTime(v.scheduledStart);
      const end = v.scheduledEnd ? parseLocalDateTime(v.scheduledEnd) : null;
      // Strictly after — the API refuses `plannedEndAt <= plannedStartAt` (422).
      return !start || !end || end > start;
    },
    { path: ['scheduledEnd'], message: 'Delivery must be after pickup.' },
  );
}

const createTripSchema = buildTripSchema();
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
  trailerId: 'trailerId',
  shippingDocument: 'shippingDocument',
  customer: 'customer',
  weightLbs: 'weightLbs',
  distanceMi: 'distanceMi',
  rateUsd: 'rateUsd',
  plannedStartAt: 'scheduledStart',
  plannedEndAt: 'scheduledEnd',
};

/** Form fields edit mode renders read-only (they change through Assign, or never). */
const READ_ONLY_IN_EDIT = new Set<keyof CreateTripValues>([
  'reference',
  'driverId',
  'vehicleId',
  'trailerId',
  'origin',
  'destination',
]);

/** Human labels for the payload fields this modal has no visible input for (`notes`, `stops`) —
 * a 422 on one of them used to be `setError`-ed onto a field nothing renders, so it vanished. */
const SERVER_FIELD_LABEL: Record<string, string> = {
  number: 'Trip / load ID',
  driverId: 'Driver',
  vehicleId: 'Unit',
  trailerId: 'Trailer',
  notes: 'Notes',
  stops: 'Stops',
  commodity: 'Commodity',
};

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label text-text">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      {children}
      {hint && !error && <span className="text-caption text-text-muted">{hint}</span>}
      {error && (
        <span role="alert" className="text-caption text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

const inputClass = 'h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text';

/** Edit mode — a value the PATCH cannot change, shown where its input would be. */
function ReadOnlyValue({ value }: { value: string }) {
  return (
    <span
      aria-readonly="true"
      className="flex h-input items-center truncate rounded-md border border-border bg-bg-subtle px-3 text-body text-text-secondary"
    >
      {value || '—'}
    </span>
  );
}

/** Coordinates of a place the dispatcher picked from the suggestions; free text has none. */
type Coords = { latitude: number; longitude: number };

/** B-… — the API rejects out-of-range values and (0, 0) is a geocoder miss, so never send them. */
function validCoords(c: Coords | null): Coords | null {
  if (!c) return null;
  const { latitude, longitude } = c;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

const toCoords = (place: Place): Coords => ({ latitude: place.lat, longitude: place.lon });

interface IntermediateStop {
  key: number;
  name: string;
  coords: Coords | null;
  scheduledAt: string;
}

/** `estimatedDriveSec` as the hours the form shows (two decimals at most); `''` for none. */
const secToHours = (sec: number | null | undefined): string =>
  sec && sec > 0 ? String(Math.round((sec / 3600) * 100) / 100) : '';

export function CreateTripModal({
  onClose,
  trip,
}: {
  onClose: () => void;
  /** Edit this trip instead of creating one. */ trip?: TripRow;
}) {
  const { toast } = useToast();
  const editing = trip !== undefined;
  // Computed once: what the edited trip held when the modal opened — the PATCH diff and the
  // "unchanged window skips the date-range rules" check both compare against it.
  const [original] = useState(() =>
    trip
      ? {
          start: isoToLocalInput(trip.plannedStartAt),
          end: isoToLocalInput(trip.plannedEndAt),
          hours: secToHours(trip.estimatedDriveSec),
        }
      : null,
  );
  const schema = useMemo(
    () => (original ? buildTripSchema(original) : createTripSchema),
    [original],
  );
  const tripStops = useMemo(
    () => [...(trip?.stops ?? [])].sort((a, b) => a.sequence - b.sequence),
    [trip],
  );
  const [estimatedDriveHours, setEstimatedDriveHours] = useState<string>(original?.hours ?? '');
  // `+ Add an intermediate stop` had no handler at all. `CreateTripPayload.stops` is real, so the
  // extra stops are collected here and sent between the pickup and the delivery.
  const [intermediateStops, setIntermediateStops] = useState<IntermediateStop[]>([]);
  const nextStopKey = useRef(1);
  const [originCoords, setOriginCoords] = useState<Coords | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<Coords | null>(null);
  /** Rule 6 — a 422 detail with no visible input, and any other rejection, lands here. */
  const [banner, setBanner] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors, isDirty },
  } = useForm<CreateTripValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    // Every registered field is listed: a field registered without a default reaches
    // `_formValues` as a key that `_defaultValues` does not have, which made `isDirty` true at
    // mount and popped "Discard changes?" on an untouched form.
    defaultValues: trip
      ? {
          reference: trip.number,
          driverId: trip.driverId ?? '',
          vehicleId: trip.vehicleId ?? '',
          trailerId: trip.trailerId ?? '',
          origin: tripStops.find((s) => s.type === 'PICKUP')?.name ?? '',
          destination: tripStops.find((s) => s.type === 'DELIVERY')?.name ?? '',
          scheduledStart: original?.start ?? '',
          scheduledEnd: original?.end ?? '',
          shippingDocument: trip.shippingDocument ?? '',
          customer: trip.customer ?? '',
          notes: trip.notes ?? '',
          distanceMi: toNumber(trip.distanceMi),
          weightLbs: toNumber(trip.weightLbs),
          rateUsd: toNumber(trip.rateUsd),
        }
      : {
          reference: '',
          driverId: '',
          vehicleId: '',
          trailerId: '',
          origin: '',
          destination: '',
          scheduledStart: '',
          scheduledEnd: '',
          shippingDocument: '',
          customer: '',
          notes: '',
          distanceMi: undefined,
          weightLbs: undefined,
          rateUsd: undefined,
        },
  });

  // The form is the single source of truth for the assignment — a parallel useState drifted out of
  // sync ("Pick another driver" cleared the picker but the old driver was still submitted).
  const origin = useWatch({ control, name: 'origin' }) ?? '';
  const destination = useWatch({ control, name: 'destination' }) ?? '';
  /** Wires a location field to RHF + the place suggestions; typing drops the picked coordinates. */
  function registerPlace(field: 'origin' | 'destination', setCoords: (c: Coords | null) => void) {
    const reg = register(field);
    return {
      name: reg.name,
      inputRef: reg.ref,
      onBlur: reg.onBlur,
      onTextChange: (text: string) => {
        setCoords(null);
        setValue(field, text, { shouldDirty: true, shouldValidate: Boolean(errors[field]) });
      },
      onPick: (place: Place) => {
        setCoords(toCoords(place));
        setValue(field, place.name, { shouldDirty: true, shouldValidate: true });
      },
    };
  }

  const driverId = useWatch({ control, name: 'driverId' }) || null;
  const vehicleId = useWatch({ control, name: 'vehicleId' }) || null;
  const trailerId = useWatch({ control, name: 'trailerId' }) || null;
  const scheduledStart = useWatch({ control, name: 'scheduledStart' });

  // Native min/max also stop the picker offering (and Chrome typing) a 5-digit year.
  const { min: pickupMin, max: pickupMax } = pickupRange();
  // An edited trip whose window already passed keeps it selectable (the browser greys out dates
  // below `min`); the zod rule above still refuses moving it to another past date.
  const pickupMinInput =
    original?.start && original.start < toLocalInput(pickupMin)
      ? original.start
      : toLocalInput(pickupMin);
  const pickupMaxInput = toLocalInput(pickupMax);
  const deliveryMinInput =
    scheduledStart && parseLocalDateTime(scheduledStart) ? scheduledStart : pickupMinInput;

  /** `register` for the stop windows: a browser-rejected date (Feb 30, a 5-digit year) reports
   * `value === ''` with `validity.badInput` — submit the `BAD_DATE` sentinel instead so zod says
   * "invalid date", not "required" (or nothing, for the optional delivery). */
  function registerDate(name: 'scheduledStart' | 'scheduledEnd') {
    const field = register(name);
    // RHF reads a non-DOM event's `target.value` as-is, so the sentinel reaches the form without
    // writing it back into the input (which would wipe what the user typed).
    const withBadInput =
      (handler: typeof field.onChange) => (e: React.SyntheticEvent<HTMLInputElement>) =>
        handler(
          e.currentTarget.validity?.badInput
            ? { type: e.type, target: { name, value: BAD_DATE } }
            : e,
        );
    return { ...field, onChange: withBadInput(field.onChange), onBlur: withBadInput(field.onBlur) };
  }

  const createMutation = useCreateTrip();
  const updateMutation = useUpdateTrip(trip?.id ?? '');
  // Both footer buttons post through the same mutation — this tracks which one is in flight so
  // only that button shows `loading` and both are disabled while either request is out.
  const [pendingIntent, setPendingIntent] = useState<'create' | 'draft' | null>(null);
  const submitting = createMutation.isPending && pendingIntent === 'create';
  const savingDraft = createMutation.isPending && pendingIntent === 'draft';

  // `estimatedDriveHours` is the one editable value that lives outside react-hook-form, so it has
  // to join `formState.isDirty` — otherwise a real edit closed without the 11.30 confirm.
  const dirty =
    isDirty || estimatedDriveHours !== (original?.hours ?? '') || intermediateStops.length > 0;

  // QA fix — only ACTIVE drivers can be dispatched (`?status=ACTIVE`).
  const driversQuery = useDriversList({ limit: 200, status: 'ACTIVE' });
  const vehiclesQuery = useVehiclesPicker();
  // Trailers are searched on the server (`q` over number + VIN) — the fleet can exceed one 200-row
  // page, so the picker shows the first page of ACTIVE trailers and says so until the user types.
  const [trailerSearch, setTrailerSearch] = useState('');
  const [debouncedTrailerSearch, setDebouncedTrailerSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTrailerSearch(trailerSearch.trim()), 250);
    return () => clearTimeout(timer);
  }, [trailerSearch]);
  const trailersQuery = useTrailersPage({
    page: 1,
    limit: TRAILER_PICKER_LIMIT,
    status: 'ACTIVE',
    sort: 'number:asc',
    q: debouncedTrailerSearch || undefined,
  });
  // The chosen trailer is remembered here: a later search can drop it from the result page.
  const [pickedTrailer, setPickedTrailer] = useState<PickerOption | undefined>(undefined);
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
  const trailerOptions: PickerOption[] = useMemo(
    () =>
      (trailersQuery.data?.items ?? []).map((t) => ({
        id: t.id,
        name: `#${t.number}`,
        context: t.vin ?? '',
      })),
    [trailersQuery.data],
  );

  const selectedDriver = (driversQuery.data?.items ?? []).find((d) => d.id === driverId) ?? null;
  const selectedDriverOption = driverOptions.find((o) => o.id === driverId);
  const selectedUnitOption = unitOptions.find((o) => o.id === vehicleId);
  const selectedTrailerOption = trailerId ? pickedTrailer : undefined;
  const trailerTotal = trailersQuery.data?.total ?? 0;
  const trailerShown = trailersQuery.data?.items?.length ?? 0;

  // B-31 — always "not blocking" today: `DriverRow` (the real endpoint this modal reads) has no
  // e-mail verification field at all; the check lives here, in one place, so the day a verified
  // flag exists this is the only line that changes (web/backend-gaps.md B-29/B-31).
  // Editing never (re)assigns anyone, so the gate only applies to create.
  const assignmentBlocked =
    !editing && blocksAssignment(selectedDriver as { emailVerified?: boolean | null } | null);

  const estimatedDriveSec =
    Number(estimatedDriveHours) > 0 ? Math.round(Number(estimatedDriveHours) * 3600) : 0;
  const showHosWarning =
    !driverHos.isLoading &&
    !driverHos.isError &&
    driverHos.data &&
    estimatedDriveSec > driverHos.data.driveRemainingSec;

  function onSubmit(values: CreateTripValues, draft: boolean) {
    // mutate() returns immediately, so RHF's isSubmitting never covered the request — guard on the
    // mutation itself or a double click creates two trips.
    if (createMutation.isPending || assignmentBlocked) return;
    setBanner(null);
    setPendingIntent(draft ? 'draft' : 'create');
    const plannedStartAt = toIso(values.scheduledStart);
    const plannedEndAt = toIso(values.scheduledEnd);
    const named = intermediateStops.filter((stop) => stop.name.trim() !== '');
    const stops: CreateTripStopInput[] = [
      {
        sequence: 1,
        type: 'PICKUP',
        name: values.origin,
        scheduledAt: plannedStartAt,
        ...validCoords(originCoords),
      },
      ...named.map((stop, index) => ({
        sequence: index + 2,
        // `StopType` has no INTERMEDIATE member; CHECKPOINT is the API's stop between the
        // pickup and the delivery (WD — see decisions.md).
        type: 'CHECKPOINT' as const,
        name: stop.name.trim(),
        scheduledAt: toIso(stop.scheduledAt),
        ...validCoords(stop.coords),
      })),
      {
        sequence: named.length + 2,
        type: 'DELIVERY' as const,
        name: values.destination,
        scheduledAt: plannedEndAt,
        ...validCoords(destinationCoords),
      },
    ];
    createMutation.mutate(
      {
        number: values.reference,
        driverId: values.driverId || undefined,
        vehicleId: values.vehicleId || undefined,
        trailerId: values.trailerId || undefined,
        shippingDocument: values.shippingDocument || undefined,
        customer: values.customer || undefined,
        weightLbs: values.weightLbs,
        distanceMi: values.distanceMi,
        rateUsd: values.rateUsd,
        estimatedDriveSec: estimatedDriveSec > 0 ? estimatedDriveSec : undefined,
        plannedStartAt,
        plannedEndAt,
        notes: values.notes || undefined,
        stops,
        draft,
      },
      {
        onSuccess: (trip) => {
          toast({
            kind: 'success',
            title: draft ? `Trip ${trip.number} saved as draft` : `Trip ${trip.number} created`,
          });
          onClose();
        },
        onSettled: () => setPendingIntent(null),
        onError: (error) => {
          // 409 — the unit already has a live trip in this range: say which one, next to the
          // Unit field (and point at the pickup window), in the dispatcher's own time zone.
          const conflict = tripScheduleConflict(error);
          if (conflict) {
            setError(scheduleConflictField(conflict), { message: scheduleConflictMessage(conflict) });
            setError('scheduledStart', { message: scheduleConflictWindowHint(conflict) });
            return;
          }
          // 409 — the trip / load ID is already used: under that input, not the generic banner.
          if (isTripNumberTaken(error)) {
            setError('reference', { message: TRIP_NUMBER_TAKEN }, { shouldFocus: true });
            return;
          }
          if (applyServerFieldErrors(error)) return;
          showGenericError(error);
        },
      },
    );
  }

  /** A 422's `details` under the inputs they name; `true` if anything was shown. */
  function applyServerFieldErrors(error: unknown): boolean {
    if (!(error instanceof ApiError)) return false;
    // `details` may be `{ fields: {...} }` or flat, and uses backend names (`number`,
    // `plannedStartAt`) — `fieldErrors` normalises the shape, the map renames.
    let mapped = 0;
    const unmapped: string[] = [];
    for (const [field, message] of Object.entries(error.fieldErrors)) {
      const formField = SERVER_FIELD_MAP[field];
      // Edit mode renders the trip ID / assignment read-only — their errors go to the banner.
      if (formField && !(editing && READ_ONLY_IN_EDIT.has(formField))) {
        setError(formField, { message });
        mapped += 1;
        continue;
      }
      // No input renders this field's error — rule 6 says it belongs in the banner.
      const label = SERVER_FIELD_LABEL[field];
      unmapped.push(label ? `${label}: ${message}` : message);
    }
    if (unmapped.length > 0) setBanner(unmapped.join(' '));
    return mapped > 0 || unmapped.length > 0;
  }

  function showGenericError(error: unknown) {
    const message = error instanceof ApiError ? error.userMessage : 'Something went wrong.';
    setBanner(message);
    toast({ kind: 'error', title: message });
  }

  /** Edit mode — `PATCH /trips/:id` with only the editable fields that differ from the trip. */
  function onSubmitEdit(values: CreateTripValues) {
    if (!trip || !original || updateMutation.isPending) return;
    setBanner(null);
    const patch: UpdateTripPayload = {};
    let blocked = false;

    // Text: an emptied box is a real edit — `UpdateTripDto` takes `''`.
    const customer = (values.customer ?? '').trim();
    if (customer !== (trip.customer ?? '')) patch.customer = customer;
    const shippingDocument = (values.shippingDocument ?? '').trim();
    if (shippingDocument !== (trip.shippingDocument ?? ''))
      patch.shippingDocument = shippingDocument;

    // Dates and numbers can change but not be cleared (no nullable fields on the DTO).
    const dates = [
      ['scheduledStart', 'plannedStartAt', original.start],
      ['scheduledEnd', 'plannedEndAt', original.end],
    ] as const;
    for (const [field, key, before] of dates) {
      const after = values[field] ?? '';
      if (after === before) continue;
      if (!after) {
        setError(field, { message: TRIP_FIELD_NOT_CLEARABLE });
        blocked = true;
      } else patch[key] = toIso(after);
    }
    const numbers = [
      ['weightLbs', toNumber(trip.weightLbs)],
      ['distanceMi', toNumber(trip.distanceMi)],
      ['rateUsd', toNumber(trip.rateUsd)],
    ] as const;
    for (const [field, before] of numbers) {
      const after = values[field];
      if (after === before) continue;
      if (after === undefined) {
        setError(field, { message: TRIP_FIELD_NOT_CLEARABLE });
        blocked = true;
      } else patch[field] = after;
    }
    if (estimatedDriveHours !== original.hours) {
      if (estimatedDriveSec > 0) patch.estimatedDriveSec = estimatedDriveSec;
      else if (original.hours) {
        setBanner(`Estimated drive time: ${TRIP_FIELD_NOT_CLEARABLE}`);
        blocked = true;
      }
    }
    if (blocked) return;
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }

    updateMutation.mutate(patch, {
      onSuccess: () => {
        toast({ kind: 'success', title: tripUpdatedToast(trip.number) });
        onClose();
      },
      onError: (error) => {
        // 409 — the new window overlaps another trip on this unit. The unit itself is read-only
        // here, so the full message lands under the pickup window the dispatcher just moved.
        const conflict = tripScheduleConflict(error);
        if (conflict) {
          setError(
            'scheduledStart',
            { message: scheduleConflictMessage(conflict) },
            { shouldFocus: true },
          );
          return;
        }
        // 409 — the trip was delivered / cancelled since the board loaded: nothing here can be saved.
        if (isTripNotEditable(error)) {
          toast({ kind: 'error', title: TRIP_NOT_EDITABLE });
          onClose();
          return;
        }
        if (isTripNotFound(error)) {
          toast({ kind: 'error', title: TRIP_NOT_FOUND });
          onClose();
          return;
        }
        if (applyServerFieldErrors(error)) return;
        showGenericError(error);
      },
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={trip ? `Edit trip ${trip.number}` : 'Create trip'}
      subtitle={
        trip ? 'Change the schedule, load details and rate' : 'Dispatch a load to a driver and unit'
      }
      size="lg"
      isDirty={dirty}
      footer={
        trip ? (
          <>
            <ModalCancelButton disabled={updateMutation.isPending} />
            <Button
              type="submit"
              form="create-trip-form"
              variant="primary"
              size="lg"
              disabled={updateMutation.isPending || !dirty}
              loading={updateMutation.isPending}
            >
              Save changes
            </Button>
          </>
        ) : (
          <>
            <ModalCancelButton disabled={submitting || savingDraft} />
            {/* B-73 (shipped) — `draft: true` saves the trip as `DRAFT`; it shows in the `Scheduled`
              segment with a `Publish` action (`PATCH { status: 'PLANNED' }`). */}
            <Button
              variant="secondary"
              size="lg"
              disabled={submitting || savingDraft}
              loading={savingDraft}
              onClick={handleSubmit((values) => onSubmit(values, true))}
            >
              Save as draft
            </Button>
            <Button
              type="submit"
              form="create-trip-form"
              variant="primary"
              size="lg"
              disabled={submitting || savingDraft || assignmentBlocked}
              loading={submitting}
            >
              Create trip
            </Button>
          </>
        )
      }
    >
      <form
        id="create-trip-form"
        noValidate
        onSubmit={handleSubmit((values) =>
          editing ? onSubmitEdit(values) : onSubmit(values, false),
        )}
        className="flex flex-col gap-4"
      >
        {banner && (
          <p role="alert" className="rounded-md bg-danger-soft p-3 text-body text-danger">
            {banner}
          </p>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Trip / load ID" required={!editing} error={errors.reference?.message}>
            <input
              {...register('reference')}
              placeholder="TR-4834"
              aria-invalid={errors.reference ? true : undefined}
              readOnly={editing}
              aria-readonly={editing || undefined}
              className={
                editing
                  ? `${inputClass} cursor-not-allowed bg-bg-subtle text-text-secondary`
                  : inputClass
              }
            />
          </Field>
          <Field label="Customer" error={errors.customer?.message}>
            <input
              {...register('customer')}
              placeholder="Major Retail Co."
              className={inputClass}
            />
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
            <Field label="Pickup location" required={!editing} error={errors.origin?.message}>
              {editing ? (
                <ReadOnlyValue value={origin} />
              ) : (
                <PlaceInput
                  {...registerPlace('origin', setOriginCoords)}
                  value={origin}
                  className={inputClass}
                />
              )}
            </Field>
            <Field
              label="Pickup window"
              required={!editing || Boolean(original?.start)}
              error={errors.scheduledStart?.message}
            >
              <input
                {...registerDate('scheduledStart')}
                type="datetime-local"
                min={pickupMinInput}
                max={pickupMaxInput}
                className={`${inputClass} w-full min-w-0 tabular-nums`}
              />
            </Field>
            <Field
              label="Delivery location"
              required={!editing}
              error={errors.destination?.message}
            >
              {editing ? (
                <ReadOnlyValue value={destination} />
              ) : (
                <PlaceInput
                  {...registerPlace('destination', setDestinationCoords)}
                  value={destination}
                  className={inputClass}
                />
              )}
            </Field>
            <Field label="Delivery window" error={errors.scheduledEnd?.message}>
              <input
                {...registerDate('scheduledEnd')}
                type="datetime-local"
                min={deliveryMinInput}
                max={pickupMaxInput}
                className={`${inputClass} w-full min-w-0 tabular-nums`}
              />
            </Field>
          </div>
          {editing && tripStops.some((s) => s.type !== 'PICKUP' && s.type !== 'DELIVERY') && (
            <p className="mt-2 text-caption text-text-muted">
              Intermediate stops:{' '}
              {tripStops
                .filter((s) => s.type !== 'PICKUP' && s.type !== 'DELIVERY')
                .map((s) => s.name)
                .join(' · ')}
            </p>
          )}
          {editing && (
            <p className="mt-2 text-caption text-text-muted">
              Stops cannot be changed after a trip is created.
            </p>
          )}
          {!editing &&
            intermediateStops.map((stop, index) => (
              <div key={stop.key} className="mt-2 grid grid-cols-[1fr_1fr_auto] items-end gap-3">
                <Field label={`Stop ${index + 1} location`}>
                  <PlaceInput
                    value={stop.name}
                    onTextChange={(text) =>
                      setIntermediateStops((prev) =>
                        prev.map((s) =>
                          s.key === stop.key ? { ...s, name: text, coords: null } : s,
                        ),
                      )
                    }
                    onPick={(place) =>
                      setIntermediateStops((prev) =>
                        prev.map((s) =>
                          s.key === stop.key
                            ? { ...s, name: place.name, coords: toCoords(place) }
                            : s,
                        ),
                      )
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label={`Stop ${index + 1} window`}>
                  <input
                    type="datetime-local"
                    value={stop.scheduledAt}
                    min={pickupMinInput}
                    max={pickupMaxInput}
                    onChange={(e) =>
                      setIntermediateStops((prev) =>
                        prev.map((s) =>
                          s.key === stop.key ? { ...s, scheduledAt: e.target.value } : s,
                        ),
                      )
                    }
                    className={`${inputClass} w-full min-w-0 tabular-nums`}
                  />
                </Field>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Remove stop ${index + 1}`}
                  onClick={() =>
                    setIntermediateStops((prev) => prev.filter((s) => s.key !== stop.key))
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          {!editing && (
            <button
              type="button"
              onClick={() =>
                setIntermediateStops((prev) => [
                  ...prev,
                  { key: nextStopKey.current++, name: '', coords: null, scheduledAt: '' },
                ])
              }
              className="mt-2 w-full rounded-md border border-dashed border-border py-2 text-body text-text-secondary hover:bg-bg-subtle"
            >
              + Add an intermediate stop
            </button>
          )}
        </div>

        <div>
          <h3 className="text-nav-section font-semibold uppercase tracking-wide text-text-muted">
            Assignment
          </h3>
          {trip ? (
            <div className="mt-2 grid grid-cols-3 gap-3">
              <Field label="Driver">
                <ReadOnlyValue
                  value={
                    trip.driver ? `${trip.driver.firstName} ${trip.driver.lastName}` : 'Unassigned'
                  }
                />
              </Field>
              <Field label="Unit">
                <ReadOnlyValue
                  value={
                    trip.vehicle ? `#${trip.vehicle.unitNumber.replace(/^#/, '')}` : 'Unassigned'
                  }
                />
              </Field>
              <p className="self-end pb-2 text-caption text-text-muted">
                Driver, unit and trailer change through Assign, not here.
              </p>
            </div>
          ) : (
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
              <Field
                label="Trailer"
                error={errors.trailerId?.message}
                hint={
                  trailersQuery.isError
                    ? TRAILER_LOOKUP_ERROR
                    : trailerTotal > trailerShown
                      ? `Showing ${trailerShown} of ${trailerTotal} trailers — search by number or VIN to find another.`
                      : undefined
                }
              >
                <TrailerPicker
                  value={selectedTrailerOption}
                  options={trailerOptions}
                  onSearch={setTrailerSearch}
                  onSelect={(o) => {
                    setPickedTrailer(o);
                    setValue('trailerId', o.id, { shouldValidate: true, shouldDirty: true });
                  }}
                  placeholder="Select a trailer"
                />
              </Field>
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Field label="Distance" error={errors.distanceMi?.message}>
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
          <Field label="Estimated drive time" hint="Drives the HOS check below.">
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
            {!editing && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setValue('driverId', '', { shouldDirty: true })}
              >
                Pick another driver
              </Button>
            )}
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
