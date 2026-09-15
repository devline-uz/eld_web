// owner: web-hos-logs — 11.12 Certify logs. **`hosCertifyOnBehalf` FULL = ADMIN only.**
//
// Certification is the driver's signature under §395.8(a)(2). An administrator signing on their
// behalf is an exceptional act, so the modal says so in a danger banner, an already-certified day
// cannot be re-selected, and the write is audited server-side. There is no realtime event for
// certification (§7.4), so the mutation invalidates the log keys by hand.
import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { Modal } from '@/shared/ui/Modal';
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
  onClose: () => void;
}

export function CertifyLogsModal({
  driverId,
  driverName,
  signerName,
  timezone,
  days,
  onClose,
}: CertifyLogsModalProps) {
  const { toast } = useToast();
  const mutation = useCertifyLogs(driverId);
  const [banner, setBanner] = useState<string | null>(null);

  const ordered = useMemo(() => [...days].sort((a, b) => (a.date < b.date ? 1 : -1)), [days]);
  const [selected, setSelected] = useState<string[]>(
    ordered.filter((day) => !day.certified).map((day) => day.date),
  );

  function toggle(date: string) {
    setSelected((prev) => (prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]));
  }

  function submit() {
    setBanner(null);
    mutation.mutate(selected, {
      onSuccess: () => {
        toast({ kind: 'success', ...TOAST_COPY.certified(selected.length, driverName) });
        onClose();
      },
      onError: (error) =>
        setBanner(error instanceof ApiError ? error.userMessage : 'Something went wrong.'),
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Certify logs"
      subtitle={`${driverName} · select the days to certify on the driver behalf`}
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose}>
            Cancel
          </Button>
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
          return (
            <label
              key={day.date}
              className={cn(
                'flex items-center gap-3 rounded-md border p-3',
                isSelected ? 'border-primary' : 'border-border',
                day.certified && 'opacity-70',
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={day.certified}
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
              <Badge tone={day.certified ? 'success' : 'warning'} dot>
                {day.certified ? 'Certified' : 'Uncertified'}
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
