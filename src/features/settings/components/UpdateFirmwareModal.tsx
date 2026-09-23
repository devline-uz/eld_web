// owner: web-settings-admin — W-20 row menu `Update firmware`. `devices` FULL.
// Real endpoint: `PATCH /devices/:id/firmware { firmware }`. The API has no "latest available
// version" field, so the target version is typed rather than invented from a hardcoded constant.
import { useState } from 'react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import { useUpdateFirmware, type DeviceRow } from '@/shared/api/settingsAdmin';
import { Field, inputClass } from './formKit';
import { SETTINGS_TOAST } from '../lib/copy';

/** Pacific Track versions are short alphanumeric labels (`L113`, `L112b`). */
const FIRMWARE_RE = /^[A-Za-z0-9.\-_]{2,16}$/;

export function UpdateFirmwareModal({ device, onClose }: { device: DeviceRow; onClose: () => void }) {
  const { toast } = useToast();
  const updateFirmware = useUpdateFirmware();
  const [firmware, setFirmware] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submitting = updateFirmware.isPending;

  function submit() {
    if (submitting) return;
    const value = firmware.trim();
    if (!FIRMWARE_RE.test(value)) {
      setError('Enter the firmware version to install, for example L113.');
      return;
    }
    setError(null);
    updateFirmware.mutate(
      { id: device.id, firmware: value },
      {
        onSuccess: () => {
          toast({ kind: 'success', ...SETTINGS_TOAST.firmwareQueued(value, device.serial) });
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
      title="Update firmware"
      subtitle={`${device.serial} · currently ${device.firmwareVersion ?? 'unknown'}`}
      size="sm"
      isDirty={firmware !== ''}
      footer={
        <>
          <ModalCancelButton disabled={submitting} />
          <Button variant="primary" size="lg" loading={submitting} disabled={submitting} onClick={submit}>
            Update firmware
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Target version"
          required
          error={error ?? undefined}
          hint="The version is sent to the device as typed — OneBook does not publish a latest-version feed."
        >
          <input
            value={firmware}
            aria-label="Target version"
            placeholder="L113"
            onChange={(e) => {
              setFirmware(e.target.value);
              setError(null);
            }}
            disabled={submitting}
            className={inputClass}
          />
        </Field>
      </div>
    </Modal>
  );
}
