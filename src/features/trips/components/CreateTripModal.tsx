// owner: web-dispatch-messaging — 11.10 Create trip (web/tz.md §11.10). `trips` FULL, size `lg`.
import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { DriverPicker, UnitPicker, type PickerOption } from '@/shared/ui/DriverPicker';
import { useToast } from '@/shared/ui/Toast';
import { useDriversList } from '@/shared/api/drivers';
import { useVehiclesPicker } from '@/shared/api/vehicles';
import { useDriverHos } from '@/shared/api/drivers';
import { useCreateTrip, blocksAssignment, type CreateTripStopInput } from '@/shared/api/trips';
import { tripSchema } from '@/shared/forms/schemas';
import { ApiError } from '@/shared/api/errors';
import { formatHosHours } from '@/shared/format/hos';

const createTripSchema = tripSchema.extend({
  shippingDocument: z.string().trim().max(60).optional(),
  weightLbs: z.number().int().min(0).optional(),
});
type CreateTripValues = z.infer<typeof createTripSchema>;

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
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
  const [driverId, setDriverId] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [estimatedDriveHours, setEstimatedDriveHours] = useState<string>('');
  const [sendNow, setSendNow] = useState(true);

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
  const assignmentBlocked = blocksAssignment(selectedDriver as { emailVerified?: boolean | null } | null);

  const estimatedDriveSec = Number(estimatedDriveHours) > 0 ? Math.round(Number(estimatedDriveHours) * 3600) : 0;
  const showHosWarning =
    !driverHos.isLoading && !driverHos.isError && driverHos.data && estimatedDriveSec > driverHos.data.driveRemainingSec;

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CreateTripValues>({
    resolver: zodResolver(createTripSchema),
    mode: 'onBlur',
    defaultValues: { reference: '', driverId: '', vehicleId: '', origin: '', destination: '', scheduledStart: '', shippingDocument: '' },
  });

  const createMutation = useCreateTrip();

  function onSubmit(values: CreateTripValues) {
    const stops: CreateTripStopInput[] = [
      { sequence: 1, type: 'PICKUP', name: values.origin, scheduledAt: values.scheduledStart || undefined },
      { sequence: 2, type: 'DELIVERY', name: values.destination },
    ];
    createMutation.mutate(
      {
        number: values.reference,
        driverId: values.driverId || undefined,
        vehicleId: values.vehicleId || undefined,
        shippingDocument: values.shippingDocument || undefined,
        weightLbs: values.weightLbs,
        plannedStartAt: values.scheduledStart || undefined,
        notes: values.notes,
        stops,
      },
      {
        onSuccess: (trip) => {
          toast({ kind: 'success', title: `Trip ${trip.number} created`, description: sendNow ? 'Sent to the driver app.' : undefined });
          onClose();
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 422 && error.details) {
            for (const [field, message] of Object.entries(error.details)) {
              setError(field as keyof CreateTripValues, { message: String(message) });
            }
            return;
          }
          toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' });
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
          <label className="mr-auto flex items-center gap-2 text-body text-text-secondary">
            <input type="checkbox" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} />
            Send the trip to the driver app now
          </label>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="secondary" size="lg" disabled={isSubmitting}>
            Save as draft
          </Button>
          <Button
            variant="primary"
            size="lg"
            disabled={isSubmitting || assignmentBlocked}
            loading={isSubmitting}
            onClick={handleSubmit(onSubmit)}
          >
            Create trip
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
          <h3 className="text-nav-section font-semibold uppercase tracking-wide text-text-muted">Stops</h3>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Field label="Pickup location" required error={errors.origin?.message}>
              <input {...register('origin')} className={inputClass} />
            </Field>
            <Field label="Pickup window">
              <input {...register('scheduledStart')} type="datetime-local" className={inputClass} />
            </Field>
            <Field label="Delivery location" required error={errors.destination?.message}>
              <input {...register('destination')} className={inputClass} />
            </Field>
            <Field label="Delivery window">
              <input type="datetime-local" className={inputClass} />
            </Field>
          </div>
          <button type="button" className="mt-2 w-full rounded-md border border-dashed border-border py-2 text-body text-text-secondary hover:bg-bg-subtle">
            + Add an intermediate stop
          </button>
        </div>

        <div>
          <h3 className="text-nav-section font-semibold uppercase tracking-wide text-text-muted">Assignment</h3>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <Field label="Driver" required error={errors.driverId?.message}>
              <DriverPicker
                value={selectedDriverOption}
                options={driverOptions}
                onSelect={(o) => {
                  setDriverId(o.id);
                  setValue('driverId', o.id, { shouldValidate: true });
                }}
                placeholder="Select a driver"
              />
              {driverId && (
                <span className="text-caption text-text-muted">
                  {driverHos.isLoading ? 'Loading drive time…' : driverHos.isError || !driverHos.data ? 'Drive time unavailable' : `${formatHosHours(driverHos.data.driveRemainingSec)} drive time left today`}
                </span>
              )}
            </Field>
            <Field label="Unit" required error={errors.vehicleId?.message}>
              <UnitPicker
                value={selectedUnitOption}
                options={unitOptions}
                onSelect={(o) => {
                  setVehicleId(o.id);
                  setValue('vehicleId', o.id, { shouldValidate: true });
                }}
                placeholder="Select a unit"
              />
            </Field>
            <Field label="Trailer">
              <input placeholder="Not set" className={inputClass} />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Field label="Distance">
            <input placeholder="mi" className={inputClass} />
          </Field>
          <Field label="Estimated drive time">
            <input
              value={estimatedDriveHours}
              onChange={(e) => setEstimatedDriveHours(e.target.value)}
              placeholder="h"
              className={inputClass}
            />
          </Field>
          <Field label="Weight">
            <input
              type="number"
              {...register('weightLbs', { valueAsNumber: true })}
              placeholder="lbs"
              className={inputClass}
            />
          </Field>
          <Field label="Rate">
            <input placeholder="USD" className={inputClass} />
          </Field>
        </div>

        {showHosWarning && driverHos.data && selectedDriver && (
          <div className="flex items-start justify-between gap-3 rounded-md bg-warning-soft p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warning" />
              <p className="text-body text-warning">
                {selectedDriver.firstName} {selectedDriver.lastName} has {formatHosHours(driverHos.data.driveRemainingSec)} of drive time
                left. This trip needs {estimatedDriveHours}h — a 10-hour reset will be required before delivery.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setDriverId(null)}>
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
