// owner: web-vehicles-drivers — W-06 bulk bar `Assign unit` (11.5's counterpart, seen from the
// driver side). `drivers` FULL only.
//
// There is no bulk assignment endpoint and there could not be a useful one: a unit carries exactly
// one driver (`POST /vehicles/:id/assign-driver` moves the link and clears whoever held it), so the
// action is deliberately single-driver — the caller only opens it with one row selected.
import { useState } from 'react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import { useAssignDriver, useVehiclesPicker } from '@/shared/api/vehicles';
import { DRIVER_TOAST } from '../lib/copy';

export interface AssignUnitModalProps {
  driverId: string;
  driverName: string;
  onClose: () => void;
  onAssigned?: () => void;
}

const selectClass = 'h-input w-full rounded-md border border-border bg-bg-surface px-3 text-body text-text';

export function AssignUnitModal({ driverId, driverName, onClose, onAssigned }: AssignUnitModalProps) {
  const { toast } = useToast();
  const vehiclesQuery = useVehiclesPicker();
  const [vehicleId, setVehicleId] = useState('');
  const [banner, setBanner] = useState<string | null>(null);
  const mutation = useAssignDriver(vehicleId);

  const units = (vehiclesQuery.data?.items ?? []).filter((unit) => unit.status === 'ACTIVE');
  const selected = units.find((unit) => unit.id === vehicleId);

  function submit() {
    if (!vehicleId || mutation.isPending) return;
    setBanner(null);
    mutation.mutate(
      { driverId },
      {
        onSuccess: () => {
          toast({ kind: 'success', ...DRIVER_TOAST.unitAssigned((selected?.unitNumber ?? '').replace(/^#+/, ''), driverName) });
          onAssigned?.();
          onClose();
        },
        onError: (error) => {
          setBanner(error instanceof ApiError ? error.userMessage : 'Something went wrong.');
        },
      },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Assign unit"
      subtitle={`${driverName} · the unit's current driver is unassigned`}
      size="sm"
      isDirty={vehicleId !== ''}
      footer={
        <>
          <ModalCancelButton disabled={mutation.isPending} />
          <Button variant="primary" size="lg" disabled={!vehicleId || mutation.isPending} loading={mutation.isPending} onClick={submit}>
            Assign unit
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {banner && (
          <p role="alert" className="rounded-md bg-danger-soft p-3 text-body text-danger">
            {banner}
          </p>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-label text-text">
            Unit <span className="text-danger" aria-hidden="true">*</span>
          </span>
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            disabled={mutation.isPending || vehiclesQuery.isLoading}
            className={selectClass}
          >
            <option value="">Select a unit</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.unitNumber}
              </option>
            ))}
          </select>
        </label>
        {vehiclesQuery.isError && (
          <p className="text-caption text-danger">The unit list could not be loaded. Close and try again.</p>
        )}
      </div>
    </Modal>
  );
}
