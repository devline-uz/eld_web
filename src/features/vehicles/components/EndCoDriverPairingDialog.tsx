// owner: web-vehicles-drivers — "End co-driver pairing?" confirm (B-7 `POST /co-driver-pairings/:id/end`),
// shared by the W-04 Co-driver row and the W-03 row menu so both say and do exactly the same thing.
import { ConfirmDelete } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import { useEndCoDriverPairing, type CoDriverPairingRow } from '@/shared/api/vehicles';
import { coDriverPairingErrorMessage } from '@/shared/api/errors';

export function EndCoDriverPairingDialog({
  open,
  pairing,
  coDriverName,
  unitNumber,
  onClose,
}: {
  open: boolean;
  pairing: CoDriverPairingRow | null;
  coDriverName: string | null;
  unitNumber: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const endPairing = useEndCoDriverPairing();
  return (
    <ConfirmDelete
      open={open && Boolean(pairing)}
      onClose={onClose}
      loading={endPairing.isPending}
      onConfirm={() => {
        if (!pairing) return;
        endPairing.mutate(pairing.id, {
          onSuccess: () => {
            toast({ kind: 'success', title: 'Co-driver pairing ended' });
            onClose();
          },
          onError: (error) => {
            toast({ kind: 'error', title: coDriverPairingErrorMessage(error) });
            onClose();
          },
        });
      }}
      title="End co-driver pairing?"
      description={`${coDriverName ?? 'The co-driver'} stops team driving on unit ${unitNumber} from now. Logs recorded during the pairing stay in place.`}
      confirmLabel="End pairing"
    />
  );
}
