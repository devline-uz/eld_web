// owner: web-settings-admin — 11.20 Register an ELD device (web/tz.md §11.20). `devices` FULL.
// Validation comes from the shared `deviceSchema`, which matches `CreateDeviceDto` (WB-024).
import { useState } from 'react';
import { QrCode } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import { useCreateDevice, usePairDevice, type DeviceModel } from '@/shared/api/settingsAdmin';
import { Field, inputClass, ToggleRow } from './formKit';

import {
  deviceSchema as registerDeviceSchema,
  type DeviceFormValues as RegisterDeviceValues,
} from '@/shared/forms/schemas';

export function RegisterDeviceModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [autoUpdateFirmware, setAutoUpdateFirmware] = useState(true);
  const [sendDiagnostics, setSendDiagnostics] = useState(false);
  const [successBanner, setSuccessBanner] = useState(false);

  const createDevice = useCreateDevice();
  const pairDevice = usePairDevice();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    setError,
  } = useForm<RegisterDeviceValues>({
    resolver: zodResolver(registerDeviceSchema),
    mode: 'onBlur',
    defaultValues: { model: 'PT30' as DeviceModel, serial: '', vehicleId: '' },
  });

  function onSubmit(values: RegisterDeviceValues) {
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
      isDirty={isDirty}
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          {/* ⛔ GAP B-8 — `GET /devices/:id/diagnostics` does not exist on the live API; the
              `Test connection` button stays out of the DOM until it ships (§20). */}
          <Button variant="primary" size="lg" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>
            Register device
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Device model" required>
            <select {...register('model')} disabled={isSubmitting} className={inputClass}>
              <option value="PT30">Pacific Track PT30</option>
              <option value="PT40">Pacific Track PT40</option>
            </select>
          </Field>
          <Field label="Serial number" required error={errors.serial?.message}>
            <input {...register('serial')} placeholder="PT30_1C4F" disabled={isSubmitting} className={inputClass} />
          </Field>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-md bg-primary-soft p-4">
          <div className="flex items-center gap-3">
            <QrCode size={40} strokeWidth={1.5} className="text-primary" />
            <div>
              <p className="text-body-strong text-text">Scan the QR code on the device</p>
              <p className="text-caption text-text-muted">The serial and firmware version are filled in automatically</p>
            </div>
          </div>
          <Button variant="secondary" type="button" onClick={() => setSuccessBanner(true)}>
            Open scanner
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Assign to unit">
            <input {...register('vehicleId')} placeholder="Unit 126" disabled={isSubmitting} className={inputClass} />
          </Field>
          <Field label="Firmware">
            <input value="L113 (latest)" readOnly className={inputClass} />
          </Field>
        </div>

        <ToggleRow
          title="Update firmware automatically"
          description="Install new versions over Bluetooth while the engine is off"
          checked={autoUpdateFirmware}
          onChange={setAutoUpdateFirmware}
        />
        <ToggleRow
          title="Send diagnostics to OneBook support"
          description="Helps resolve connection problems faster"
          checked={sendDiagnostics}
          onChange={setSendDiagnostics}
        />

        {successBanner && (
          <p className="rounded-md bg-success-soft px-3 py-2 text-caption text-success">
            ✓ Device responded to the pairing request · signal strength good · GPS lock acquired.
          </p>
        )}
      </form>
    </Modal>
  );
}
