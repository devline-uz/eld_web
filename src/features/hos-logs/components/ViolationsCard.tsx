// owner: web-hos-logs — W-08 card 2 of 3, `Violations · today`, and the small `Resolve` modal.
//
// The list itself is real: it comes from the `violations[]` the log-day payload already carries.
// `Resolve` opens the shared `ResolveViolationModal` (B-6 `POST /violations/:id/resolve`).
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Can } from '@/shared/auth/Can';
import { cn } from '@/shared/ui/cn';
import { formatHosHours } from '@/shared/format';
import type { HosViolation } from '@/shared/api/hosLogs';
import { ResolveViolationModal } from '@/shared/violations/ResolveViolationModal';
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
      {/* WB-060 — `Resolve` lives on each OPEN row, so the violation resolved (and the note written
          against it) is always the one the user clicked, never `open[0]`. */}
      <SectionHeader title="Violations · today" subtitle={`${open.length} open`} />
      <div className="mt-4 flex flex-col gap-2">
        {violations.length === 0 ? (
          <p className="py-8 text-center text-body text-success">● No violations today</p>
        ) : (
          violations.map((violation) => {
            // WB-061 — a RESOLVED / AUTO_CLEARED violation stays listed (audit trail) but muted, with
            // a status badge, so it can never be mistaken for an open one next to "0 open".
            const isOpen = violation.status === 'OPEN';
            return (
            <div
              key={violation.id}
              data-status={isOpen ? 'open' : 'resolved'}
              className={cn(
                'flex items-start gap-3 rounded-md p-3',
                !isOpen ? 'bg-bg-subtle' : isWarning(violation) ? 'bg-warning-soft' : 'bg-danger-soft',
              )}
            >
              <AlertTriangle
                size={16}
                strokeWidth={1.75}
                className={cn(
                  'mt-0.5 shrink-0',
                  !isOpen ? 'text-text-muted' : isWarning(violation) ? 'text-warning' : 'text-danger',
                )}
              />
              <div className="min-w-0 flex-1">
                <p className={cn('flex items-center gap-2 text-body-strong', isOpen ? 'text-text' : 'text-text-muted')}>
                  {VIOLATION_TITLE[violation.type]}
                  {!isOpen && (
                    <Badge tone="neutral">
                      {violation.status === 'AUTO_CLEARED' ? 'Auto-cleared' : 'Resolved'}
                    </Badge>
                  )}
                </p>
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
              {isOpen && (
                <Can perm="hosEdit" level="FULL">
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Resolve ${VIOLATION_TITLE[violation.type]}`}
                    onClick={() => setResolving(violation)}
                  >
                    Resolve
                  </Button>
                </Can>
              )}
            </div>
            );
          })
        )}
      </div>

      {resolving && (
        <ResolveViolationModal
          violationId={resolving.id}
          subtitle={VIOLATION_TITLE[resolving.type]}
          driverId={driverId}
          date={date}
          onClose={() => setResolving(null)}
        />
      )}
    </Card>
  );
}
