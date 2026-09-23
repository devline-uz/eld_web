// owner: web-settings-admin — W-20 row menu `Pair to unit`. `devices` FULL.
// Real endpoint: `POST /devices/:id/pair { vehicleId }` (the same call `RegisterDeviceModal` makes
// after creating a device).
import { useState } from 'react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import { useVehiclesPicker } from '@/shared/api/vehicles';
import { usePairDevice, type DeviceRow } from '@/shared/api/settingsAdmin';
import { Field, inputClass } from './formKit';
import { SETTINGS_TOAST } from '../lib/copy';

export function PairDeviceModal({ device, onClose }: { device: DeviceRow; onClose: () => void }) {
  const { toast } = useToast();
  const pairDevice = usePairDevice();
  const vehiclesQuery = useVehiclesPicker();
  const [vehicleId, setVehicleId] = useState(device.vehicleId ?? '');
  const [error, setError] = useState<string | null>(null);

  const submitting = pairDevice.isPending;
  const units = vehiclesQuery.data?.items ?? [];
  // Re-pairing to the unit the device is already on would be a no-op request.
  const alreadyPaired = vehicleId !== '' && vehicleId === device.vehicleId;

  function submit() {
    if (submitting) return;
    if (!vehicleId) {
      setError('Choose a unit to pair this device with.');
      return;
    }
    setError(null);
    pairDevice.mutate(
      { id: device.id, vehicleId },
      {
        onSuccess: () => {
          const unitNumber = units.find((v) => v.id === vehicleId)?.unitNumber ?? 'the unit';
          toast({ kind: 'success', ...SETTINGS_TOAST.devicePaired(device.serial, unitNumber) });
          onClose();
        },
        onError: (err) => setError(err instanceof ApiError ? err.userMessage : 'Something went wrong.'),
      },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Pair to unit"
      subtitle={`${device.serial} · ${device.model}`}
      size="sm"
      isDirty={vehicleId !== (device.vehicleId ?? '')}
      footer={
        <>
          <ModalCancelButton disabled={submitting} />
          <Button
            variant="primary"
            size="lg"
            loading={submitting}
            disabled={submitting || alreadyPaired}
            onClick={submit}
          >
            Pair device
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Unit" required error={error ?? undefined}>
          <select
            value={vehicleId}
            aria-label="Unit"
            onChange={(e) => {
              setVehicleId(e.target.value);
              setError(null);
            }}
            disabled={submitting || vehiclesQuery.isLoading}
            className={inputClass}
          >
            <option value="">— Choose a unit —</option>
            {units.map((v) => (
              <option key={v.id} value={v.id}>
                {v.unitNumber}
              </option>
            ))}
          </select>
        </Field>
        {vehiclesQuery.isError && (
          <p className="text-caption text-danger">The unit list could not be loaded. Close and try again.</p>
        )}
        <p className="text-caption text-text-muted">
          The device starts recording hours of service for this unit as soon as a driver connects to it
          over Bluetooth.
        </p>
      </div>
    </Modal>
  );
}
