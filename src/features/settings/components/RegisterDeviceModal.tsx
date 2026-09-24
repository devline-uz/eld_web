// owner: web-settings-admin — 11.20 Register an ELD device (web/tz.md §11.20). `devices` FULL.
// Validation comes from the shared `deviceSchema`, which matches `CreateDeviceDto` (WB-024).
import { useState } from 'react';
import { QrCode, Wifi, Loader2 } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import {
  useCreateDevice,
  usePairDevice,
  useUpdateDevice,
  useDeviceDiagnostics,
  type DeviceModel,
  type DeviceRow,
} from '@/shared/api/settingsAdmin';
import { useVehiclesPicker } from '@/shared/api/vehicles';
import { Field, inputClass, ToggleRow } from './formKit';
import { SETTINGS_REASON } from '../lib/copy';

import {
  deviceSchema as registerDeviceSchema,
  type DeviceFormValues as RegisterDeviceValues,
} from '@/shared/forms/schemas';

export function RegisterDeviceModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();

  const createDevice = useCreateDevice();
  const pairDevice = usePairDevice();
  const updateDevice = useUpdateDevice();
  const diagnostics = useDeviceDiagnostics();
  const vehiclesQuery = useVehiclesPicker();

  const [autoFirmware, setAutoFirmware] = useState(false);
  const [shareDiagnostics, setShareDiagnostics] = useState(false);
  // Present once `POST /devices` (and the optional pair/policy follow-up) succeeds — the modal
  // switches to a "test the connection" step instead of closing immediately (B-8).
  const [registered, setRegistered] = useState<DeviceRow | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setError,
  } = useForm<RegisterDeviceValues>({
    resolver: zodResolver(registerDeviceSchema),
    mode: 'onBlur',
    defaultValues: { model: 'PT30' as DeviceModel, serial: '', vehicleId: '' },
  });

  // Both requests count: the pair call runs inside `onSuccess`, so the modal is still busy.
  const submitting = createDevice.isPending || pairDevice.isPending || updateDevice.isPending;
  const dirty = isDirty || autoFirmware || shareDiagnostics;

  function finishPolicy(device: DeviceRow, paired: boolean) {
    // `POST /devices` still has no firmware-policy fields (B-88 "still open") — set them with the
    // documented follow-up `PATCH /devices/:id` instead of dropping the toggle state.
    if (autoFirmware || shareDiagnostics) {
      updateDevice.mutate(
        { id: device.id, dto: { autoFirmware, shareDiagnostics } },
        {
          onSettled: () => {
            toast({
              kind: 'success',
              title: `Device ${device.serial} registered`,
              description: paired ? 'ELD paired and the driver was notified.' : undefined,
            });
            setRegistered({ ...device, autoFirmware, shareDiagnostics });
          },
        },
      );
      return;
    }
    toast({
      kind: 'success',
      title: `Device ${device.serial} registered`,
      description: paired ? 'ELD paired and the driver was notified.' : undefined,
    });
    setRegistered(device);
  }

  function onSubmit(values: RegisterDeviceValues) {
    // `mutate()` resolves RHF's `submitting` before the request lands — guard on the mutation
    // so a double click cannot register the device twice.
    if (submitting) return;
    createDevice.mutate(
      { serial: values.serial, model: values.model },
      {
        onSuccess: (device) => {
          if (values.vehicleId) {
            pairDevice.mutate(
              { id: device.id, vehicleId: values.vehicleId },
              { onSettled: () => finishPolicy(device, true) },
            );
            return;
          }
          finishPolicy(device, false);
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) {
            setError('serial', { message: 'A device with this serial is already registered.' });
            return;
          }
          toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' });
        },
      },
    );
  }

  if (registered) {
    const result = diagnostics.data;
    return (
      <Modal
        open
        onClose={onClose}
        title="Register an ELD device"
        subtitle={`${registered.serial} registered`}
        size="md"
        footer={
          <Button variant="primary" size="lg" onClick={onClose}>
            Done
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 rounded-md bg-bg-subtle p-4">
            <div className="flex items-center gap-3">
              <Wifi size={32} strokeWidth={1.5} className="text-text-muted" />
              <div>
                <p className="text-body-strong text-text">Test connection</p>
                <p className="text-caption text-text-muted">
                  Reads the device&apos;s last recorded status — not a live round-trip.
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              type="button"
              disabled={diagnostics.isPending}
              iconLeft={diagnostics.isPending ? <Loader2 size={16} className="animate-spin" /> : undefined}
              onClick={() =>
                diagnostics.mutate(registered.id, {
                  onError: (error) =>
                    toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' }),
                })
              }
            >
              Test connection
            </Button>
          </div>
          {result && (
            <div className="flex flex-col gap-1 rounded-md border border-border p-3 text-body text-text">
              <p>Signal strength: <span className="text-body-strong capitalize">{result.signalStrength}</span></p>
              <p>GPS lock: <span className="text-body-strong">{result.gpsLock ? 'Acquired' : 'Not acquired'}</span></p>
              <p>Device responded: <span className="text-body-strong">{result.responded ? 'Yes' : 'No'}</span></p>
            </div>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Register an ELD device"
      subtitle="Pair a new Pacific Track PT30 with the fleet"
      size="md"
      isDirty={dirty}
      footer={
        <>
          <ModalCancelButton disabled={submitting} />
          <Button variant="primary" size="lg" loading={submitting} disabled={submitting} onClick={handleSubmit(onSubmit)}>
            Register device
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Device model" required>
            <select {...register('model')} disabled={submitting} className={inputClass}>
              <option value="PT30">Pacific Track PT30</option>
              <option value="PT40">Pacific Track PT40</option>
            </select>
          </Field>
          <Field label="Serial number" required error={errors.serial?.message}>
            <input {...register('serial')} placeholder="PT30_1C4F" disabled={submitting} className={inputClass} />
          </Field>
        </div>

        {/* Not a backend gap — there is no QR scanner in the web panel: `Open scanner` used to paint a
            "Device responded · GPS lock acquired" banner without opening a camera or contacting
            the device (WB-213). Disabled with the reason visible; the serial is typed from the
            label instead. */}
        <div className="flex items-center justify-between gap-4 rounded-md bg-bg-subtle p-4">
          <div className="flex items-center gap-3">
            <QrCode size={40} strokeWidth={1.5} className="text-text-muted" />
            <div>
              <p className="text-body-strong text-text">Scan the QR code on the device</p>
              <p className="text-caption text-text-muted">
                {SETTINGS_REASON.scanner}
              </p>
            </div>
          </div>
          <Button variant="secondary" type="button" disabled title={SETTINGS_REASON.scannerTooltip}>
            Open scanner
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Assign to unit">
            <select {...register('vehicleId')} disabled={submitting} className={inputClass}>
              <option value="">None</option>
              {(vehiclesQuery.data?.items ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.unitNumber}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Firmware" hint="Reported by the device after it first connects.">
            <input value="—" readOnly aria-label="Firmware" className={inputClass} />
          </Field>
        </div>

        {/* B-88 (shipped) — `POST /devices` still has no firmware-policy fields; the toggle state
            is applied with a follow-up `PATCH /devices/:id` right after registration. */}
        <ToggleRow
          title="Update firmware automatically"
          description="Installs new firmware over Bluetooth automatically."
          checked={autoFirmware}
          disabled={submitting}
          onChange={setAutoFirmware}
        />
        <ToggleRow
          title="Send diagnostics to OneBook support"
          description="Lets OneBook support read this device's connection diagnostics."
          checked={shareDiagnostics}
          disabled={submitting}
          onChange={setShareDiagnostics}
        />
      </form>
    </Modal>
  );
}
