// owner: web-vehicles-drivers — Delete trailer. Destructive confirm; a server refusal is shown verbatim.
import { Trash2 } from 'lucide-react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { TOAST_COPY } from '@/shared/ui/copy';
import { useDeleteTrailer, type TrailerRow } from '@/shared/api/trailers';
import { ApiError } from '@/shared/api/errors';

export function DeleteTrailerModal({ trailer, onClose }: { trailer: TrailerRow; onClose: () => void }) {
  const { toast } = useToast();
  const mutation = useDeleteTrailer();
  return (
    <Modal
      open
      onClose={onClose}
      title={`Delete trailer ${trailer.number}?`}
      subtitle="This cannot be undone"
      size="sm"
      footer={
        <>
          <ModalCancelButton disabled={mutation.isPending} />
          <Button
            variant="danger"
            size="lg"
            loading={mutation.isPending}
            onClick={() =>
              mutation.mutate(trailer.id, {
                onSuccess: () => {
                  toast({ kind: 'success', ...TOAST_COPY.trailerDeleted(trailer.number) });
                  onClose();
                },
                onError: (error) => {
                  // The server's own sentence (e.g. why a referenced trailer cannot go) rides under the generic title.
                  if (error instanceof ApiError) {
                    toast({ kind: 'error', title: error.userMessage, description: error.message !== error.userMessage ? error.message : undefined });
                  } else {
                    toast({ kind: 'error', title: 'Something went wrong.' });
                  }
                },
              })
            }
          >
            Delete trailer
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
          Trailer {trailer.number} is removed from use: it leaves the trailer list and the Create trip trailer
          picker and cannot be assigned to new trips. Past trips and inspections stay in place for audits, and
          the number can be reused for another trailer.
        </p>
      </div>
    </Modal>
  );
}
