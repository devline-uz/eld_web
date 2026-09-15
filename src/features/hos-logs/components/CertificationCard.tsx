// owner: web-hos-logs — W-08 card 3 of 3, `Certification · last 8 days`.
//
// ⚠️ `Certify all` is gated on `hosCertifyOnBehalf` FULL, which only ADMIN holds. The design image
// draws the button in a Fleet-manager frame, but §10 W-08's role table and §11.12 are explicit
// that certification is the driver's signature and only an administrator may sign on their behalf
// (web/decisions.md WD-029). A fleet manager does not see the button at all — it is absent from
// the DOM, not disabled.
import { Check, AlertTriangle } from 'lucide-react';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/auth/Can';
import { cn } from '@/shared/ui/cn';
import { ErrorState, LoadingState } from '@/shared/ui/states';
import type { RodsDaySummary } from '@/shared/api/hosLogs';

export interface CertificationCardProps {
  days: RodsDaySummary[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** `03`…`10` — clicking a cell navigates to `?date=`. */
  onSelectDate: (date: string) => void;
  onCertifyAll: () => void;
  /** `A reminder was sent to the mobile app at 16:05.` — null when nothing is pending. */
  reminderNote: string | null;
}

export function CertificationCard({
  days,
  isLoading,
  isError,
  onRetry,
  onSelectDate,
  onCertifyAll,
  reminderNote,
}: CertificationCardProps) {
  const certified = days.filter((day) => day.certified).length;
  const pending = days.length - certified;

  return (
    <Card>
      <SectionHeader
        title="Certification · last 8 days"
        subtitle={`${certified} certified · ${pending} pending`}
        action={
          <Can perm="hosCertifyOnBehalf" level="FULL">
            <Button variant="primary" onClick={onCertifyAll}>
              Certify all
            </Button>
          </Can>
        }
      />
      <div className="mt-4">
        {isLoading ? (
          <LoadingState rows={2} />
        ) : isError ? (
          <ErrorState
            title="Could not load certification"
            description="The last eight RODS days did not load. Your data is safe — try again in a moment."
            onRetry={onRetry}
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {days.map((day) => (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => onSelectDate(day.date)}
                  aria-label={`${day.date} — ${day.certified ? 'certified' : 'uncertified'}`}
                  className={cn(
                    'flex size-cert-cell flex-col items-center justify-center gap-0.5 rounded-md',
                    day.certified ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning',
                  )}
                >
                  <span className="tabular text-badge font-semibold text-text">{day.date.slice(-2)}</span>
                  {day.certified ? (
                    <Check size={14} strokeWidth={1.75} />
                  ) : (
                    <AlertTriangle size={14} strokeWidth={1.75} />
                  )}
                </button>
              ))}
            </div>
            {reminderNote && <p className="mt-4 text-caption text-text-muted">{reminderNote}</p>}
          </>
        )}
      </div>
    </Card>
  );
}
