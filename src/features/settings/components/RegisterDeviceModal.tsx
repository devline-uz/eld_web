// owner: web-settings-admin — 11.20 Register an ELD device (web/tz.md §11.20). `devices` FULL.
// Validation comes from the shared `deviceSchema`, which matches `CreateDeviceDto` (WB-024).
import { QrCode } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import { useCreateDevice, usePairDevice, type DeviceModel } from '@/shared/api/settingsAdmin';
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
  const vehiclesQuery = useVehiclesPicker();

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
  const submitting = createDevice.isPending || pairDevice.isPending;
  // Every editable control is inside react-hook-form now (the B-88 toggles are read-only).
  const dirty = isDirty;

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
              {
                onSettled: () => {
                  toast({ kind: 'success', title: `Device ${device.serial} registered`, description: 'ELD paired and the driver was notified.' });
                  onClose();
                },
              },
            );
            return;
          }
          toast({ kind: 'success', title: `Device ${device.serial} registered` });
          onClose();
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
          {/* ⛔ GAP B-8 — `GET /devices/:id/diagnostics` does not exist on the live API; the
              `Test connection` button stays out of the DOM until it ships (§20). */}
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

        {/* ⛔ GAP B-88 — `POST /devices` takes `serial`, `model` and `firmware` only. Both toggles
            were collected and dropped (WB-214); they are disabled with the reason on screen
            rather than claiming a setting that never left the browser. */}
        <ToggleRow
          title="Update firmware automatically"
          description={SETTINGS_REASON.autoFirmware}
          checked={false}
          disabled
          tooltip={SETTINGS_REASON.autoFirmwareTooltip}
        />
        <ToggleRow
          title="Send diagnostics to OneBook support"
          description={SETTINGS_REASON.diagnosticsOptIn}
          checked={false}
          disabled
          tooltip={SETTINGS_REASON.diagnosticsOptInTooltip}
        />
      </form>
    </Modal>
  );
}
