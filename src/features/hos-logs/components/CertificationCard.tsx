// owner: web-hos-logs — W-08 card 3 of 3, `Certification · last 8 days`.
//
// CODE-029 — certification is the driver's own signature (§395.8(e)) and only the driver can give
// it, in the app. The web shows the state of the last eight days and says who signs; there is no
// `Certify all` / on-behalf action any more (the API answers 403 CERTIFY_DRIVER_ONLY).
import { Check, AlertTriangle, Smartphone } from 'lucide-react';
import { Card, SectionHeader } from '@/shared/ui/Card';
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
  /** `A reminder was sent to the mobile app at 16:05.` — null when nothing is pending. */
  reminderNote: string | null;
}

export function CertificationCard({
  days,
  isLoading,
  isError,
  onRetry,
  onSelectDate,
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
          <span
            className="flex items-center gap-1.5 text-caption text-text-muted"
            title="Certification is the driver's signature (§395.8(e)). Only the driver can certify, in the driver app."
          >
            <Smartphone size={14} strokeWidth={1.75} aria-hidden />
            Drivers certify in the app
          </span>
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
