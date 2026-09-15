// owner: web-vehicles-drivers — 11.2 Add vehicle / Edit unit (web/tz.md §11.2). `vehicles` FULL.
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { TOAST_COPY } from '@/shared/ui/copy';
import { vehicleSchema, type VehicleFormValues } from '@/shared/forms/schemas';
import { useCreateVehicle, useUpdateVehicle, type VehicleRow } from '@/shared/api/vehicles';
import { ApiError } from '@/shared/api/errors';

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

const inputClass = 'h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text';

export function AddVehicleModal({ vehicle, onClose }: { vehicle?: VehicleRow; onClose: () => void }) {
  const { toast } = useToast();
  const isEdit = Boolean(vehicle);
  const [fuelType, setFuelType] = useState<string>(vehicle?.fuelType ?? 'DIESEL');
  const [sleeperBerth, setSleeperBerth] = useState(vehicle?.sleeperBerth ?? false);
  const [notes, setNotes] = useState(vehicle?.notes ?? '');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    setError,
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    mode: 'onBlur',
    defaultValues: {
      unitNumber: vehicle?.unitNumber.replace(/^#/, '') ?? '',
      vin: vehicle?.vin ?? '',
      make: vehicle?.make ?? '',
      model: vehicle?.model ?? '',
      year: vehicle?.year ?? new Date().getFullYear(),
      licensePlate: vehicle?.licensePlate ?? '',
      licenseState: vehicle?.plateState ?? '',
      odometer: vehicle?.odometerMi,
    },
  });

  const createMutation = useCreateVehicle();
  const updateMutation = useUpdateVehicle(vehicle?.id ?? '');
  const mutation = isEdit ? updateMutation : createMutation;

  function onSubmit(values: VehicleFormValues) {
    const payload = {
      unitNumber: values.unitNumber,
      vin: values.vin,
      make: values.make,
      model: values.model,
      year: values.year,
      licensePlate: values.licensePlate || undefined,
      plateState: values.licenseState || undefined,
      fuelType,
      sleeperBerth,
      odometerMi: values.odometer,
      notes: notes || undefined,
      deviceId: values.deviceId || undefined,
    };
    mutation.mutate(payload, {
      onSuccess: () => {
        if (isEdit) {
          toast({ kind: 'success', title: `Unit ${values.unitNumber} updated` });
        } else {
          toast({ kind: 'success', ...TOAST_COPY.unitCreated(values.unitNumber, values.deviceId || 'device') });
        }
        onClose();
      },
      onError: (error) => {
        if (error instanceof ApiError && error.status === 409) {
          setError('unitNumber', { message: 'A unit with this number already exists.' });
          return;
        }
        if (error instanceof ApiError) {
          const fieldErrors = error.fieldErrors;
          for (const [field, message] of Object.entries(fieldErrors)) {
            setError(field as keyof VehicleFormValues, { message });
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
      subtitle="Register a unit and pair it with an ELD device"
      size="lg"
      isDirty={isDirty}
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" size="lg" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>
            {isEdit ? 'Save changes' : 'Save unit'}
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Unit number" required error={errors.unitNumber?.message}>
            <input {...register('unitNumber')} placeholder="e.g. 126" disabled={isSubmitting} className={inputClass} />
          </Field>
          <Field label="ELD serial">
            <input {...register('deviceId')} placeholder="PT30_1C4F" disabled={isSubmitting} className={inputClass} />
          </Field>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <Field label="Make" required error={errors.make?.message}>
            <input {...register('make')} disabled={isSubmitting} className={inputClass} />
          </Field>
          <Field label="Model" required error={errors.model?.message}>
            <input {...register('model')} disabled={isSubmitting} className={inputClass} />
          </Field>
          <Field label="Year" required error={errors.year?.message}>
            <input
              type="number"
              {...register('year', { valueAsNumber: true })}
              disabled={isSubmitting}
              className={inputClass}
            />
          </Field>
          <Field label="Fuel type">
            <select value={fuelType} onChange={(e) => setFuelType(e.target.value)} disabled={isSubmitting} className={inputClass}>
              {FUEL_TYPES.map((f) => (
                <option key={f} value={f}>
                  {f.charAt(0) + f.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="VIN" required error={errors.vin?.message}>
          <input {...register('vin')} placeholder="17-character VIN" disabled={isSubmitting} className={inputClass} />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="License plate">
            <input {...register('licensePlate')} disabled={isSubmitting} className={inputClass} />
          </Field>
          <Field label="Issuing state">
            <input
              {...register('licenseState', {
                // An untouched optional input defaults to '' — zod's `.optional()` only skips
                // validation on `undefined`, not on an empty string, so `.length(2)` would
                // reject a field the user never typed into (web/bugs.md WB-012 pattern).
                setValueAs: (v: string) => (v === '' ? undefined : v),
              })}
              maxLength={2}
              placeholder="OH"
              disabled={isSubmitting}
              className={inputClass}
            />
          </Field>
          <Field label="Odometer at activation">
            <input
              type="number"
              {...register('odometer', {
                // `valueAsNumber` turns a blank field into `NaN`, which fails `z.number()` even
                // though the field is optional (WB-012) — coerce blank to `undefined`.
                setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
              })}
              placeholder="221,449"
              disabled={isSubmitting}
              className={inputClass}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-body text-text">
          <input type="checkbox" checked={sleeperBerth} onChange={(e) => setSleeperBerth(e.target.checked)} disabled={isSubmitting} />
          Sleeper berth available
        </label>
        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSubmitting}
            placeholder="Optional — visible to fleet managers only"
            rows={3}
            className="rounded-md border border-border bg-bg-surface px-3 py-2 text-body text-text"
          />
        </Field>
      </form>
    </Modal>
  );
}
