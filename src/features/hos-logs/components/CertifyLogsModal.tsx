// owner: web-hos-logs — 11.12 Certify logs. **`hosCertifyOnBehalf` FULL = ADMIN only.**
//
// Certification is the driver's signature under §395.8(a)(2). An administrator signing on their
// behalf is an exceptional act, so the modal says so in a danger banner, an already-certified day
// can only be re-selected when it changed after signing (§395.8 re-certification, WB-062), and the
// write is audited server-side. There is no realtime event for
// certification (§7.4), so the mutation invalidates the log keys by hand.
import { useMemo, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { useToast } from '@/shared/ui/Toast';
import { TOAST_COPY } from '@/shared/ui/copy';
import { cn } from '@/shared/ui/cn';
import { ApiError } from '@/shared/api/errors';
import { formatDailyTotals, timezoneAbbreviation } from '@/shared/format';
import { useCertifyLogs, type RodsDaySummary } from '@/shared/api/hosLogs';

export interface CertifyLogsModalProps {
  driverId: string;
  driverName: string;
  /** The administrator's own name — printed as the signature. */
  signerName: string;
  timezone: string;
  days: RodsDaySummary[];
  /**
   * Days whose `certification.recertificationRequired` is known to be true (only the viewed day's
   * payload carries the flag — `RodsDaySummary` has just `hasEdits`). Pre-selected.
   */
  recertificationDates?: string[];
  onClose: () => void;
}

/**
 * WB-062 — a certified day stays selectable when it needs re-certification. The range summary has
 * no `recertificationRequired`, so `hasEdits` on a certified day is the best web-side signal: it is
 * enabled (never pre-selected), and the server decides.
 */
function isSelectable(day: RodsDaySummary, recertify: ReadonlySet<string>): boolean {
  return !day.certified || day.hasEdits || recertify.has(day.date);
}

function isDefaultSelected(day: RodsDaySummary, recertify: ReadonlySet<string>): boolean {
  return !day.certified || recertify.has(day.date);
}

export function CertifyLogsModal({
  driverId,
  driverName,
  signerName,
  timezone,
  days,
  recertificationDates,
  onClose,
}: CertifyLogsModalProps) {
  const { toast } = useToast();
  const mutation = useCertifyLogs(driverId);
  const [banner, setBanner] = useState<string | null>(null);
  // WB-146 — same-tick guard: one click, one certification batch.
  const inFlight = useRef(false);

  const ordered = useMemo(() => [...days].sort((a, b) => (a.date < b.date ? 1 : -1)), [days]);
  const recertify = useMemo(() => new Set(recertificationDates ?? []), [recertificationDates]);
  // WB-062 — only the user's explicit toggles are state; the selection itself is re-derived from
  // the LATEST `days` every render. A day that arrives while the modal is open gets its default, and
  // a day certified elsewhere meanwhile drops out instead of being re-posted.
  const [choices, setChoices] = useState<Record<string, boolean>>({});
  const selected = useMemo(
    () =>
      ordered
        .filter((day) => isSelectable(day, recertify) && (choices[day.date] ?? isDefaultSelected(day, recertify)))
        .map((day) => day.date),
    [ordered, recertify, choices],
  );

  function toggle(date: string) {
    setChoices((prev) => ({ ...prev, [date]: !selected.includes(date) }));
  }

  function submit() {
    if (inFlight.current || mutation.isPending) return;
    setBanner(null);
    inFlight.current = true;
    mutation.mutate(selected, {
      onSuccess: () => {
        toast({ kind: 'success', ...TOAST_COPY.certified(selected.length, driverName) });
        onClose();
      },
      onError: (error) =>
        setBanner(error instanceof ApiError ? error.userMessage : 'Something went wrong.'),
      onSettled: () => {
        inFlight.current = false;
      },
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      // WB-198 — the day selection is the whole form here: Esc/overlay/X used to drop every
      // toggled day without asking. Only a real deviation from the defaults counts as dirty.
      isDirty={Object.keys(choices).length > 0}
      title="Certify logs"
      subtitle={`${driverName} · select the days to certify on the driver behalf`}
      footer={
        <>
          <ModalCancelButton disabled={mutation.isPending} />
          <Button
            variant="primary"
            size="lg"
            disabled={selected.length === 0}
            loading={mutation.isPending}
            onClick={submit}
          >
            {`Certify ${selected.length} selected day${selected.length === 1 ? '' : 's'}`}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-2 rounded-md bg-danger-soft p-3 text-body text-text-secondary">
        <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-danger" />
        <p>
          Certification is the driver signature. Only an administrator may certify on behalf of a
          driver, and the action is written to the audit log.
        </p>
      </div>

      {banner && (
        <p role="alert" className="mt-4 rounded-md bg-danger-soft p-3 text-body text-danger">
          {banner}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {ordered.map((day) => {
          const isSelected = selected.includes(day.date);
          const selectable = isSelectable(day, recertify);
          const needsRecertification = day.certified && recertify.has(day.date);
          return (
            <label
              key={day.date}
              className={cn(
                'flex items-center gap-3 rounded-md border p-3',
                isSelected ? 'border-primary' : 'border-border',
                !selectable && 'opacity-70',
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={!selectable}
                onChange={() => toggle(day.date)}
                aria-label={`Certify ${day.date}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-body-strong text-text">
                  {formatInTimeZone(new Date(`${day.date}T12:00:00Z`), timezone, 'EEE, MMM dd')}
                </span>
                <span className="tabular block text-caption text-text-muted">
                  OFF · SB · D · ON{'  '}
                  {formatDailyTotals([day.offDutySec, day.sleeperSec, day.drivingSec, day.onDutySec])}
                </span>
              </span>
              <Badge tone={day.certified && !needsRecertification ? 'success' : 'warning'} dot>
                {needsRecertification ? 'Re-certification required' : day.certified ? 'Certified' : 'Uncertified'}
              </Badge>
            </label>
          );
        })}
      </div>

      <p className="mt-4 text-label text-text">Administrator signature</p>
      <div className="mt-1 flex h-signature flex-col items-center justify-center rounded-md border border-border">
        <span className="font-serif text-kpi text-text">{signerName}</span>
        <span className="mt-1 text-caption text-text-muted">
          {`Signed on ${formatInTimeZone(new Date(), timezone, 'MMM dd, yyyy')} at ${formatInTimeZone(
            new Date(),
            timezone,
            'HH:mm',
          )} ${timezoneAbbreviation(timezone)}`}
        </span>
      </div>
    </Modal>
  );
}
