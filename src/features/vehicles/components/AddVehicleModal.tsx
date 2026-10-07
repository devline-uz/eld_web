// owner: web-vehicles-drivers — 11.2 Add vehicle / Edit unit (web/tz.md §11.2). `vehicles` FULL.
import { useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { TOAST_COPY } from '@/shared/ui/copy';
import { vehicleSchema, type VehicleFormValues } from '@/shared/forms/schemas';
import { VALIDATION_MESSAGES } from '@/shared/forms/messages';
import { nonNegativeIntInputProps } from '@/shared/forms/nonNegativeIntInput';
import { useCreateVehicle, useUpdateVehicle, type VehicleRow } from '@/shared/api/vehicles';
import { useDevicesLookup } from '@/shared/api/lookups';
import { ApiError } from '@/shared/api/errors';
import { conflictField } from '@/shared/api/conflicts';
import {
  VEHICLE_CONFLICT_RULES,
  findCachedVehicleConflicts,
  normalizeVehicleUniques,
  type VehicleConflictField,
} from '../lib/vehicleConflicts';
import { fuelLabel } from '../lib/activity';

const FUEL_TYPES = ['DIESEL', 'GASOLINE', 'CNG', 'LNG', 'ELECTRIC'] as const;

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
        {label} {required && <span className="text-danger" aria-hidden="true">*</span>}
      </span>
      {children}
      {error && <span className="text-caption text-danger">{error}</span>}
    </label>
  );
}

/** Where each conflict is shown in the form (the plate + state pair is flagged on the plate). */
const CONFLICT_FORM_FIELD: Record<VehicleConflictField, keyof VehicleFormValues> = {
  unitNumber: 'unitNumber',
  vin: 'vin',
  eldSerial: 'deviceId',
  licensePlate: 'licensePlate',
};
const CONFLICT_MESSAGE: Record<VehicleConflictField, string> = {
  unitNumber: VALIDATION_MESSAGES.unitNumberTaken,
  vin: VALIDATION_MESSAGES.vinTaken,
  eldSerial: VALIDATION_MESSAGES.eldSerialTaken,
  licensePlate: VALIDATION_MESSAGES.licensePlateTaken,
};
/** Server field-error keys that name a form field differently. */
const SERVER_FIELD_ALIAS: Record<string, keyof VehicleFormValues> = {
  eldSerial: 'deviceId',
  plateState: 'licenseState',
  issuingState: 'licenseState',
};

const inputClass = 'h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text';

export function AddVehicleModal({ vehicle, onClose }: { vehicle?: VehicleRow; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = Boolean(vehicle);
  const currentYear = new Date().getFullYear();
  // The three fields that live outside react-hook-form. Their initial values are captured once so
  // "has the user changed anything?" can be answered honestly (see `isDirty` below).
  const initialFuelType = vehicle?.fuelType ?? 'DIESEL';
  const initialSleeperBerth = vehicle?.sleeperBerth ?? false;
  const initialNotes = vehicle?.notes ?? '';
  const [fuelType, setFuelType] = useState<string>(initialFuelType);
  const [sleeperBerth, setSleeperBerth] = useState(initialSleeperBerth);
  const [notes, setNotes] = useState(initialNotes);

  const {
    register,
    handleSubmit,
    formState: { errors, dirtyFields },
    setError,
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    mode: 'onBlur',
    defaultValues: {
      unitNumber: vehicle?.unitNumber.replace(/^#/, '') ?? '',
      vin: vehicle?.vin ?? '',
      make: vehicle?.make ?? '',
      model: vehicle?.model ?? '',
      year: vehicle?.year ?? currentYear,
      licensePlate: vehicle?.licensePlate ?? '',
      licenseState: vehicle?.plateState ?? '',
      odometer: vehicle?.odometerMi,
    },
  });

  // WB — a freshly opened, untouched form asked "Discard changes?" on every close: react-hook-form's
  // `isDirty` deep-compares the live values against `defaultValues`, and fields the form registers
  // without a default (`deviceId`) plus the `setValueAs` coercions on `licenseState` / `odometer`
  // make them differ before the user has typed anything. `dirtyFields` only ever fills from a real
  // change event (and empties again when a field is reverted), so it answers the question honestly.
  // The three non-RHF fields are compared against the values they were opened with.
  const isDirty =
    Object.keys(dirtyFields).length > 0 ||
    fuelType !== initialFuelType ||
    sleeperBerth !== initialSleeperBerth ||
    notes !== initialNotes;

  // Fills the `/devices` cache so the ELD-serial pre-check below has something to compare against.
  useDevicesLookup();
  const createMutation = useCreateVehicle();
  const updateMutation = useUpdateVehicle(vehicle?.id ?? '');
  const mutation = isEdit ? updateMutation : createMutation;
  // WB — `mutate()` returns on the same tick, so RHF's `isSubmitting` was already false again
  // while the request was still open: two fast clicks created two units. The pending flag of the
  // mutation plus a same-tick ref is the guard every other 11.x modal now uses.
  const inFlight = useRef(false);
  const submitting = mutation.isPending;

  function onSubmit(values: VehicleFormValues) {
    if (inFlight.current || submitting) return;
    // Cheap early warning from the cached `/vehicles` pages (the unit being edited excluded). The
    // server's 409 below stays the authority for anything the cache doesn't hold.
    const uniques = normalizeVehicleUniques(values);
    const cached = findCachedVehicleConflicts(
      queryClient,
      { ...values, licensePlate: uniques.licensePlate, licenseState: uniques.plateState, deviceId: uniques.deviceId },
      vehicle,
    );
    if (cached.length > 0) {
      for (const field of cached) setError(CONFLICT_FORM_FIELD[field], { message: CONFLICT_MESSAGE[field] });
      return;
    }
    const payload = {
      unitNumber: values.unitNumber,
      vin: values.vin,
      make: values.make,
      model: values.model,
      year: values.year,
      licensePlate: uniques.licensePlate,
      plateState: uniques.plateState,
      fuelType,
      sleeperBerth,
      odometerMi: values.odometer,
      notes: notes || undefined,
      deviceId: uniques.deviceId,
    };
    inFlight.current = true;
    mutation.mutate(payload, {
      onSettled: () => {
        inFlight.current = false;
      },
      onSuccess: () => {
        if (isEdit) {
          toast({ kind: 'success', title: `Unit ${values.unitNumber} updated` });
        } else {
          // QA-B — without an ELD serial nothing is paired and no driver is notified, so the
          // §13.3 pairing sentence is only shown when a serial was actually sent.
          const created = TOAST_COPY.unitCreated(values.unitNumber, uniques.deviceId ?? '');
          toast(
            uniques.deviceId
              ? { kind: 'success', ...created }
              : { kind: 'success', title: created.title },
          );
        }
        onClose();
      },
      onError: (error) => {
        // 404 DEVICE_NOT_FOUND names the ELD serial; any other 404 keeps the generic toast below.
        if (
          error instanceof ApiError &&
          error.status === 404 &&
          (error.code === 'DEVICE_NOT_FOUND' || typeof (error.details as { eldSerial?: unknown }).eldSerial === 'string')
        ) {
          setError('deviceId', { message: VALIDATION_MESSAGES.eldSerialUnknown });
          return;
        }
        if (error instanceof ApiError && error.status === 409) {
          const field = conflictField(error, VEHICLE_CONFLICT_RULES);
          if (field) {
            setError(CONFLICT_FORM_FIELD[field], { message: CONFLICT_MESSAGE[field] });
            return;
          }
          // Unattributed conflict — don't guess a field; say the value is in use.
          toast({ kind: 'error', title: error.userMessage });
          return;
        }
        if (error instanceof ApiError) {
          const fieldErrors = error.fieldErrors;
          for (const [field, message] of Object.entries(fieldErrors)) {
            setError((SERVER_FIELD_ALIAS[field] ?? field) as keyof VehicleFormValues, { message });
          }
          if (Object.keys(fieldErrors).length > 0) return;
        }
        toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' });
      },
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Edit unit ${vehicle?.unitNumber}` : 'Add vehicle'}
      subtitle={isEdit ? 'Update the unit details' : 'Register a unit and pair it with an ELD device'}
      size="lg"
      isDirty={isDirty}
      footer={
        <>
          <ModalCancelButton disabled={submitting} />
          <Button variant="primary" size="lg" loading={submitting} onClick={() => void handleSubmit(onSubmit)()}>
            {isEdit ? 'Save changes' : 'Save unit'}
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Unit number" required error={errors.unitNumber?.message}>
            <input {...register('unitNumber')} placeholder="e.g. 126" disabled={submitting} className={inputClass} />
          </Field>
          <Field label="ELD serial" error={errors.deviceId?.message}>
            <input {...register('deviceId')} placeholder="PT30_1C4F" disabled={submitting} className={inputClass} />
          </Field>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <Field label="Make" required error={errors.make?.message}>
            <input {...register('make')} disabled={submitting} className={inputClass} />
          </Field>
          <Field label="Model" required error={errors.model?.message}>
            <input {...register('model')} disabled={submitting} className={inputClass} />
          </Field>
          <Field label="Year" required error={errors.year?.message}>
            <input
              type="number"
              min={1970}
              max={currentYear}
              {...register('year', { valueAsNumber: true })}
              disabled={submitting}
              className={inputClass}
            />
          </Field>
          <Field label="Fuel type">
            <select value={fuelType} onChange={(e) => setFuelType(e.target.value)} disabled={submitting} className={inputClass}>
              {FUEL_TYPES.map((f) => (
                <option key={f} value={f}>
                  {fuelLabel(f)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="VIN" required error={errors.vin?.message}>
          <input {...register('vin')} placeholder="17-character VIN" disabled={submitting} className={inputClass} />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="License plate" error={errors.licensePlate?.message}>
            <input {...register('licensePlate')} disabled={submitting} className={inputClass} />
          </Field>
          <Field label="Issuing state" error={errors.licenseState?.message}>
            <input
              {...register('licenseState', {
                // An untouched optional input defaults to '' — zod's `.optional()` only skips
                // validation on `undefined`, not on an empty string, so `.length(2)` would
                // reject a field the user never typed into (web/bugs.md WB-012 pattern).
                setValueAs: (v: string) => (v === '' ? undefined : v),
              })}
              maxLength={2}
              placeholder="OH"
              disabled={submitting}
              className={inputClass}
            />
          </Field>
          <Field label="Odometer at activation" error={errors.odometer?.message}>
            <input
              {...nonNegativeIntInputProps}
              {...register('odometer', {
                // `valueAsNumber` turns a blank field into `NaN`, which fails `z.number()` even
                // though the field is optional (WB-012) — coerce blank to `undefined`.
                setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
              })}
              placeholder="221,449"
              disabled={submitting}
              className={inputClass}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-body text-text">
          <input type="checkbox" checked={sleeperBerth} onChange={(e) => setSleeperBerth(e.target.checked)} disabled={submitting} />
          Sleeper berth available
        </label>
        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={submitting}
            placeholder="Optional — visible to fleet managers only"
            rows={3}
            className="rounded-md border border-border bg-bg-surface px-3 py-2 text-body text-text"
          />
        </Field>
      </form>
    </Modal>
  );
}
