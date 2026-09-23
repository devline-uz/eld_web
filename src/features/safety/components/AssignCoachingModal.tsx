// owner: web-dvir-safety — "Assign coaching" (web/tz.md §10 W-10). `safety` FULL.
//
// ⛔ Backend gap — coaching is modelled per-`SafetyEvent` (`POST /safety/coaching { eventId,
// note }`), the design's button sits next to the driver scorecard with no driver-level
// endpoint (web/decisions.md WD-034). This picks a driver, then one of that driver's open
// events, before submitting.
import { useMemo, useState } from 'react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { useSafetyEventsList, useAssignCoaching, type ScorecardTableRow } from '@/shared/api/safety';
import { ApiError } from '@/shared/api/errors';
import { formatLocal } from '@/shared/format/datetime';
import { safetyEventLabel } from '../lib/filters';

const inputClass = 'h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text';

export function AssignCoachingModal({ driver, onClose }: { driver: ScorecardTableRow; onClose: () => void }) {
  const { toast } = useToast();
  const events = useSafetyEventsList({ driverId: driver.driverId, limit: 100 });
  const mutation = useAssignCoaching();
  const [eventId, setEventId] = useState('');
  const [note, setNote] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);

  const openEvents = useMemo(
    () => events.rows.filter((e) => e.status === 'NEW' || e.status === 'REVIEWED'),
    [events.rows],
  );
  const driverName = driver.driver ? `${driver.driver.firstName} ${driver.driver.lastName}` : 'this driver';

  return (
    <Modal
      open
      onClose={onClose}
      title="Assign coaching"
      subtitle={`${driverName} · score ${driver.score}`}
      size="md"
      isDirty={Boolean(eventId) || note !== ''}
      footer={
        <>
          <ModalCancelButton disabled={mutation.isPending} />
          <Button
            variant="primary"
            size="lg"
            disabled={!eventId || mutation.isPending}
            loading={mutation.isPending}
            onClick={() => {
              // `mutate()` returns immediately — without this a double click coaches twice.
              if (!eventId || mutation.isPending) return;
              setServerError(null);
              mutation.mutate(
                { eventId, note: note || undefined },
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
        <label className="flex flex-col gap-1">
          <span className="text-label text-text">
            Event to coach on <span className="text-danger">*</span>
          </span>
          {events.isLoading ? (
            <p className="text-body text-text-muted">Loading events…</p>
          ) : openEvents.length === 0 ? (
            <p className="text-body text-text-muted">No open safety events for this driver.</p>
          ) : (
            <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={inputClass}>
              <option value="">Select an event…</option>
              {openEvents.map((e) => (
                <option key={e.id} value={e.id}>
                  {/* WB-167 — the raw enum (`HARSH_BRAKING · —`) used to reach the user. */}
                  {safetyEventLabel(e.type)} · {formatLocal(e.occurredAt, 'dateTime')}
                </option>
              ))}
            </select>
          )}
        </label>
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
