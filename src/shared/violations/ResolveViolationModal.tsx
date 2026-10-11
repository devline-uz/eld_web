// The small `Resolve violation` modal (B-6 `POST /violations/:id/resolve`, `hosEdit` FULL).
// Shared by W-08 `Violations · today` (hos-logs) and the W-01 `HOS violations & alerts` row menu
// (dashboard) — moved out of `features/hos-logs` because features never import each other.
import { useEffect, useRef, useState } from 'react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { ApiError, formErrorMessage } from '@/shared/api/errors';
import { VALIDATION_MESSAGES, LIMITS } from '@/shared/forms/messages';
import { useResolveViolation } from '@/shared/api/hosLogs';

export function ResolveViolationModal({
  violationId,
  subtitle,
  driverId,
  date,
  onClose,
}: {
  violationId: string;
  /** What is being resolved, e.g. `11-hour driving limit`. */
  subtitle: string;
  /** The driver log day to refresh afterwards; absent for an unassigned (driverless) row. */
  driverId?: string | null;
  date?: string | null;
  onClose: () => void;
}) {
  const [note, setNote] = useState('');
  const [banner, setBanner] = useState<string | null>(null);
  // A server 400/422 on `resolutionNote` sits under the textarea, not in the banner.
  const [noteError, setNoteError] = useState<string | null>(null);
  const bannerRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (banner) bannerRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [banner]);
  const { toast } = useToast();
  const mutation = useResolveViolation(driverId ?? undefined, date ?? undefined);

  const tooShort = note.trim().length < LIMITS.annotationMin;

  function submit() {
    if (tooShort) {
      setBanner(VALIDATION_MESSAGES.annotation);
      return;
    }
    setBanner(null);
    setNoteError(null);
    mutation.mutate(
      { id: violationId, resolutionNote: note.trim() },
      {
        onSuccess: () => {
          toast({ kind: 'success', title: 'Violation resolved', description: 'The note was written to the audit log.' });
          onClose();
        },
        // Compliance write: the refusal (404 unknown, 409 no longer OPEN) is shown verbatim inside
        // the modal and never retried.
        // A `resolutionNote` 400/422 issue goes under the textarea; anything else (incl. unplaced
        // issues, spelled out) goes to the banner, scrolled into view.
        onError: (error) => {
          const fieldErrors =
            error instanceof ApiError && (error.status === 422 || error.status === 400) ? error.fieldErrors : {};
          const inline = fieldErrors.resolutionNote;
          if (inline) setNoteError(inline);
          // Every issue already sits under the textarea → no banner; otherwise the §14.3 copy or
          // the unplaced issues spelled out ("Reason: …" never appears here — it is placed).
          const allPlaced = inline !== undefined && Object.keys(fieldErrors).length === 1;
          setBanner(allPlaced ? null : formErrorMessage(error, ['resolutionNote'], { resolutionNote: 'Reason' }));
        },
      },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Resolve violation"
      subtitle={subtitle}
      size="sm"
      isDirty={note.length > 0}
      footer={
        <>
          {/* WB-165 — `onClick={onClose}` walked past the 11.30 confirm even though `isDirty`
              is set, so a typed reason was dropped silently. */}
          <ModalCancelButton disabled={mutation.isPending} />
          <Button variant="primary" size="lg" onClick={submit} loading={mutation.isPending}>
            Resolve
          </Button>
        </>
      }
    >
      {banner && (
        <p ref={bannerRef} role="alert" className="mb-3 rounded-md bg-danger-soft p-3 text-body text-danger">
          {banner}
        </p>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-label text-text">
          Reason <span className="text-danger">*</span>
        </span>
        <textarea
          value={note}
          maxLength={LIMITS.annotationMax}
          onChange={(event) => {
            setNote(event.target.value);
            setNoteError(null);
          }}
          aria-invalid={(tooShort && note.length > 0) || noteError !== null}
          aria-describedby={noteError ? 'resolve-violation-note-error' : undefined}
          className="min-h-20 rounded-md border border-border bg-bg-surface p-3 text-body text-text"
        />
        {noteError && (
          <span id="resolve-violation-note-error" className="text-caption text-danger">
            {noteError}
          </span>
        )}
        <span className="text-caption text-text-muted">
          Stored with the record and shown to any safety official. 4–60 characters.
        </span>
      </label>
    </Modal>
  );
}
