// owner: web-vehicles-drivers — 11.3 Delete unit (web/tz.md §11.3). Destructive confirm that
// states what survives: historical logs, DVIRs and IFTA records stay in place for audits.
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { TOAST_COPY } from '@/shared/ui/copy';
import { useDeleteVehicle, type VehicleRow } from '@/shared/api/vehicles';
import { formatEnumLabel } from '@/shared/format/enumLabel';
import { formErrorMessage, openTripsOf, type OpenTripRef } from '@/shared/api/errors';

export function DeleteUnitModal({
  vehicle,
  eldSerial,
  onClose,
  onDeleted,
}: {
  vehicle: VehicleRow;
  eldSerial: string | null;
  onClose: () => void;
  /** Fired only after the server confirms the delete — the Unit profile navigates away on it.
   * `onClose` alone cannot carry that meaning: Cancel, Esc and X call it too (WB — cancelling the
   * modal used to leave the unit profile anyway). */
  onDeleted?: () => void;
}) {
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState('');
  // BE-013 — a unit with open trips cannot be deleted; the server names them (409 details.openTrips).
  const [openTrips, setOpenTrips] = useState<OpenTripRef[] | null>(null);
  const expected = `UNIT-${vehicle.unitNumber.replace(/^#/, '')}`;
  const mutation = useDeleteVehicle();
  const hasOpenIssue = vehicle.status === 'OUT_OF_SERVICE';

  return (
    <Modal
      open
      onClose={onClose}
      title={`Delete Unit ${vehicle.unitNumber}?`}
      subtitle="This cannot be undone"
      size="sm"
      // A half-typed confirmation phrase is a real edit — Cancel / Esc / X all confirm first.
      isDirty={confirmText !== ''}
      footer={
        <>
          <ModalCancelButton disabled={mutation.isPending} />
          <Button
            variant="danger"
            size="lg"
            loading={mutation.isPending}
            disabled={confirmText !== expected}
            onClick={() =>
              mutation.mutate(vehicle.id, {
                onSuccess: () => {
                  toast({ kind: 'success', ...TOAST_COPY.unitDeleted(vehicle.unitNumber.replace(/^#/, '')) });
                  onClose();
                  onDeleted?.();
                },
                onError: (error) => {
                  const trips = openTripsOf(error);
                  if (trips) {
                    setOpenTrips(trips);
                    return;
                  }
                  toast({ kind: 'error', title: formErrorMessage(error) });
                },
              })
            }
          >
            Delete unit
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex justify-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
            <Trash2 size={22} strokeWidth={1.75} />
          </span>
        </div>
        <p className="text-body text-text-secondary">
          Deleting Unit {vehicle.unitNumber} removes it from the fleet list
          {eldSerial ? ` and unassigns ELD device ${eldSerial}` : ''}. Historical logs, DVIRs and
          IFTA records stay in place and remain available for audits.
        </p>
        {openTrips && (
          <div role="alert" className="rounded-md bg-danger-soft p-3 text-body text-danger">
            <p className="font-semibold">Unit {vehicle.unitNumber} still has open trips</p>
            <p className="mt-1">Reassign or cancel them first, then delete the unit:</p>
            <ul className="mt-1 list-disc pl-5 tabular-nums">
              {openTrips.map((trip) => (
                <li key={trip.id}>
                  {trip.number} · {formatEnumLabel(trip.status)}
                </li>
              ))}
            </ul>
          </div>
        )}
        {hasOpenIssue && (
          <p className="rounded-md bg-warning-soft p-3 text-body text-warning">
            This unit is out of service with an open defect. Close it first to keep the
            maintenance history complete.
          </p>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-label text-text">
            Type <span className="font-mono">{expected}</span> to confirm
          </span>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={expected}
            className="h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text"
          />
        </label>
      </div>
    </Modal>
  );
}
