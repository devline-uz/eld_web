// QA LIVE-003 — the dispatcher's "Mark delivered" confirm: IN_PROGRESS → DELIVERED with the actual
// delivery time (default now, never in the future, never before the trip started). The backend
// stamps `onTime` from it against the planned end, which feeds the On-time delivery KPI.
import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import { formErrorMessage } from '@/shared/api/errors';
import { formatCarrierDateTime, timezoneAbbreviation } from '@/shared/format/datetime';
import { useCarrierTimezone } from '@/shared/auth/useCarrierTimezone';
import { useTripStatusAction, type TripRow } from '@/shared/api/trips';
import { tripDeliveredToast } from '../lib/copy';
import { deliveredAtError, parseLocalInput, toLocalInput } from '../lib/deliveredAt';

export function MarkDeliveredModal({ trip, onClose }: { trip: TripRow; onClose: () => void }) {
  const { toast } = useToast();
  const action = useTripStatusAction();
  const tz = useCarrierTimezone();
  const [deliveredAt, setDeliveredAt] = useState(() => toLocalInput(new Date(), tz));
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const error = deliveredAtError(deliveredAt, trip, tz);
  const late = (() => {
    const at = parseLocalInput(deliveredAt, tz);
    const end = trip.plannedEndAt ? Date.parse(trip.plannedEndAt) : NaN;
    return at && Number.isFinite(end) ? at.getTime() > end : null;
  })();

  function submit() {
    setTouched(true);
    if (error || action.isPending) return;
    const at = parseLocalInput(deliveredAt, tz) as Date;
    // A time in the skew window is "now", and the start's own minute is the start itself: never send
    // an instant the server could read as future or as before the start (the input has no seconds).
    const started = trip.startedAt ? Date.parse(trip.startedAt) : NaN;
    const clamped = Math.min(at.getTime(), Date.now());
    const completedAt = new Date(Number.isFinite(started) ? Math.max(clamped, started) : clamped).toISOString();
    action.mutate(
      { tripId: trip.id, status: 'DELIVERED', completedAt },
      {
        onSuccess: () => {
          toast({ kind: 'success', title: tripDeliveredToast(trip.number) });
          onClose();
        },
        onError: (err) => setServerError(formErrorMessage(err)),
      },
    );
  }

  const shownError = (touched || deliveredAt !== '') && error ? error : serverError;
  return (
    <Modal
      open
      onClose={() => {
        if (!action.isPending) onClose();
      }}
      title={`Mark trip ${trip.number} delivered?`}
      subtitle="The trip moves to Completed and can no longer be edited."
      size="sm"
      footer={
        <>
          <ModalCancelButton disabled={action.isPending} />
          <Button variant="primary" size="lg" onClick={submit} loading={action.isPending} disabled={Boolean(error)}>
            Mark delivered
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="delivered-at" className="text-body-strong text-text">
            Delivered at ({timezoneAbbreviation(tz)})
          </label>
          <input
            id="delivered-at"
            type="datetime-local"
            value={deliveredAt}
            max={toLocalInput(new Date(), tz)}
            aria-invalid={Boolean(shownError)}
            aria-describedby="delivered-at-hint"
            onChange={(e) => {
              setDeliveredAt(e.target.value);
              setTouched(true);
              setServerError(null);
            }}
            className="h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text"
          />
          <span id="delivered-at-hint" className={shownError ? 'text-caption text-danger' : 'text-caption text-text-muted'} role={shownError ? 'alert' : undefined}>
            {shownError ?? 'When the load was actually delivered — defaults to now.'}
          </span>
        </div>
        {trip.plannedEndAt && (
          <p className="text-caption text-text-secondary">
            Planned end {formatCarrierDateTime(trip.plannedEndAt, tz)}
            {late === null ? '' : late ? ' · will count as late' : ' · will count as on time'}
          </p>
        )}
      </div>
    </Modal>
  );
}
