// owner: web-dvir-safety — "Assign coaching" (web/tz.md §10 W-10). `safety` FULL.
//
// B-43 (shipped 2026-09-24) — `POST /safety/coaching` now accepts `{ driverId, note? }` directly
// (closing that driver's most recent open `NEW`/`REVIEWED` event server-side), so the modal no
// longer needs the driver's open-events picker WD-034 introduced as a workaround.
import { useState } from 'react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { useAssignCoaching, type ScorecardTableRow } from '@/shared/api/safety';
import { ApiError } from '@/shared/api/errors';

export function AssignCoachingModal({ driver, onClose }: { driver: ScorecardTableRow; onClose: () => void }) {
  const { toast } = useToast();
  const mutation = useAssignCoaching();
  const [note, setNote] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);

  const driverName = driver.driver ? `${driver.driver.firstName} ${driver.driver.lastName}` : 'this driver';

  return (
    <Modal
      open
      onClose={onClose}
      title="Assign coaching"
      subtitle={`${driverName} · score ${driver.score}`}
      size="md"
      isDirty={note !== ''}
      footer={
        <>
          <ModalCancelButton disabled={mutation.isPending} />
          <Button
            variant="primary"
            size="lg"
            loading={mutation.isPending}
            onClick={() => {
              // `mutate()` returns immediately — without this a double click coaches twice.
              if (mutation.isPending) return;
              setServerError(null);
              mutation.mutate(
                { driverId: driver.driverId, note: note || undefined },
                {
                  onSuccess: () => {
                    toast({ kind: 'success', title: 'Coaching assigned', description: `${driverName} was scheduled for coaching.` });
                    onClose();
                  },
                  onError: (error) => setServerError(error instanceof ApiError ? error.userMessage : 'Something went wrong.'),
                },
              );
            }}
          >
            Assign coaching
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-body text-text-secondary">
          This coaches {driverName} on their most recent open safety event.
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-label text-text">Note</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Coaching focus, follow-up date, etc."
            className="rounded-md border border-border bg-bg-surface px-3 py-2 text-body text-text"
          />
        </label>
        {serverError && (
          <p role="alert" className="rounded-md bg-danger-soft p-3 text-body text-danger">
            {serverError}
          </p>
        )}
      </div>
    </Modal>
  );
}
