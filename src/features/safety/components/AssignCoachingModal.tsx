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

const NOTE_MAX = 1000;
const NOTE_TOO_LONG = 'Notes are limited to 1,000 characters.';

export function AssignCoachingModal({ driver, onClose }: { driver: ScorecardTableRow; onClose: () => void }) {
  const { toast } = useToast();
  const mutation = useAssignCoaching();
  const [note, setNote] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);

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
              // `CreateCoachingDto.note` is `max(1000)`: a longer note used to reach the server and
              // come back as a bare "Check the highlighted fields" with nothing highlighted.
              if (note.length > NOTE_MAX) {
                setNoteError(NOTE_TOO_LONG);
                return;
              }
              setNoteError(null);
              mutation.mutate(
                { driverId: driver.driverId, note: note || undefined },
                {
                  onSuccess: () => {
                    toast({ kind: 'success', title: 'Coaching assigned', description: `${driverName} was scheduled for coaching.` });
                    onClose();
                  },
                  onError: (error) => {
                    const fieldMessage = error instanceof ApiError ? error.fieldErrors.note : undefined;
                    if (fieldMessage) {
                      setNoteError(NOTE_TOO_LONG);
                      return;
                    }
                    setServerError(error instanceof ApiError ? error.userMessage : 'Something went wrong.');
                  },
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
            onChange={(e) => {
              setNote(e.target.value);
              if (noteError && e.target.value.length <= NOTE_MAX) setNoteError(null);
            }}
            rows={3}
            placeholder="Coaching focus, follow-up date, etc."
            aria-invalid={noteError ? true : undefined}
            aria-describedby={noteError ? 'coaching-note-error' : undefined}
            className="rounded-md border border-border bg-bg-surface px-3 py-2 text-body text-text"
          />
        </label>
        {noteError && (
          <span id="coaching-note-error" className="-mt-3 text-caption text-danger">
            {noteError}
          </span>
        )}
        {serverError && (
          <p role="alert" className="rounded-md bg-danger-soft p-3 text-body text-danger">
            {serverError}
          </p>
        )}
      </div>
    </Modal>
  );
}
