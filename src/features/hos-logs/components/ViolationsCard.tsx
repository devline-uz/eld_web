// owner: web-hos-logs — W-08 card 2 of 3, `Violations · today`, and the small `Resolve` modal.
//
// The list itself is real: it comes from the `violations[]` the log-day payload already carries.
// Only the write path is a gap — ⛔ B-6 `POST /violations/:id/resolve` does not exist.
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { Can } from '@/shared/auth/Can';
import { useToast } from '@/shared/ui/Toast';
import { cn } from '@/shared/ui/cn';
import { formatHosHours } from '@/shared/format';
import { ApiError } from '@/shared/api/errors';
import { VALIDATION_MESSAGES, LIMITS } from '@/shared/forms/messages';
import { useResolveViolation, type HosViolation } from '@/shared/api/hosLogs';
import { VIOLATION_TITLE } from '../grid';

/** `Warning` severity for a limit that is only approaching, `Violation` once it is exceeded. */
function isWarning(violation: HosViolation): boolean {
  return violation.exceededBySec <= 0;
}

export function ViolationsCard({
  driverId,
  date,
  timezone,
  violations,
}: {
  driverId: string;
  date: string;
  timezone: string;
  violations: HosViolation[];
}) {
  const [resolving, setResolving] = useState<HosViolation | null>(null);
  const open = violations.filter((violation) => violation.status === 'OPEN');

  return (
    <Card>
      <SectionHeader
        title="Violations · today"
        subtitle={`${open.length} open`}
        action={
          open.length > 0 ? (
            <Can perm="hosEdit" level="FULL">
              <Button variant="secondary" onClick={() => setResolving(open[0] ?? null)}>
                Resolve
              </Button>
            </Can>
          ) : undefined
        }
      />
      <div className="mt-4 flex flex-col gap-2">
        {violations.length === 0 ? (
          <p className="py-8 text-center text-body text-success">● No violations today</p>
        ) : (
          violations.map((violation) => (
            <div
              key={violation.id}
              className={cn(
                'flex items-start gap-3 rounded-md p-3',
                isWarning(violation) ? 'bg-warning-soft' : 'bg-danger-soft',
              )}
            >
              <AlertTriangle
                size={16}
                strokeWidth={1.75}
                className={cn('mt-0.5 shrink-0', isWarning(violation) ? 'text-warning' : 'text-danger')}
              />
              <div className="min-w-0">
                <p className="text-body-strong text-text">{VIOLATION_TITLE[violation.type]}</p>
                <p className="tabular text-caption text-text-muted">
                  {isWarning(violation)
                    ? violation.detail
                    : `Exceeded by ${formatHosHours(violation.exceededBySec)} at ${formatInTimeZone(
                        new Date(violation.occurredAt),
                        timezone,
                        'HH:mm',
                      )}`}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {resolving && (
        <ResolveViolationModal
          driverId={driverId}
          date={date}
          violation={resolving}
          onClose={() => setResolving(null)}
        />
      )}
    </Card>
  );
}

function ResolveViolationModal({
  driverId,
  date,
  violation,
  onClose,
}: {
  driverId: string;
  date: string;
  violation: HosViolation;
  onClose: () => void;
}) {
  const [note, setNote] = useState('');
  const [banner, setBanner] = useState<string | null>(null);
  const { toast } = useToast();
  const mutation = useResolveViolation(driverId, date);

  const tooShort = note.trim().length < LIMITS.annotationMin;

  function submit() {
    if (tooShort) {
      setBanner(VALIDATION_MESSAGES.annotation);
      return;
    }
    mutation.mutate(
      { id: violation.id, resolutionNote: note.trim() },
      {
        onSuccess: () => {
          toast({ kind: 'success', title: 'Violation resolved', description: 'The note was written to the audit log.' });
          onClose();
        },
        // ⛔ B-6: against the live API this is a 404 until the endpoint ships. The refusal is
        // shown verbatim inside the modal and never retried.
        onError: (error) =>
          setBanner(error instanceof ApiError ? error.userMessage : 'Something went wrong.'),
      },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Resolve violation"
      subtitle={VIOLATION_TITLE[violation.type]}
      size="sm"
      isDirty={note.length > 0}
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="lg" onClick={submit} loading={mutation.isPending}>
            Resolve
          </Button>
        </>
      }
    >
      {banner && (
        <p role="alert" className="mb-3 rounded-md bg-danger-soft p-3 text-body text-danger">
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
          onChange={(event) => setNote(event.target.value)}
          aria-invalid={tooShort && note.length > 0}
          className="min-h-20 rounded-md border border-border bg-bg-surface p-3 text-body text-text"
        />
        <span className="text-caption text-text-muted">
          Stored with the record and shown to any safety official. 4–60 characters.
        </span>
      </label>
    </Modal>
  );
}
