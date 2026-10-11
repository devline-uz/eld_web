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
import type { HosViolation, OngoingViolation } from '@/shared/api/hosLogs';
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
  ongoing = [],
}: {
  driverId: string;
  date: string;
  timezone: string;
  violations: HosViolation[];
  /**
   * Limits crossed on an earlier day that the driving carried over midnight is still breaking
   * (`GET /logs/:id` `ongoingViolations`). They are the SAME violations as the rows filed on the
   * day of the crossing — listed, never counted as new open ones and never resolved from here.
   */
  ongoing?: OngoingViolation[];
}) {
  const [resolving, setResolving] = useState<HosViolation | null>(null);
  const open = violations.filter((violation) => violation.status === 'OPEN');
  // A type already filed on this day is not repeated as "continuing".
  const filedTypes = new Set(violations.map((violation) => violation.type));
  const continuing = ongoing.filter((violation) => !filedTypes.has(violation.type));
  const subtitle = continuing.length
    ? `${open.length} open · ${continuing.length} continuing from an earlier day`
    : `${open.length} open`;

  return (
    <Card>
      {/* WB-060 — `Resolve` lives on each OPEN row, so the violation resolved (and the note written
          against it) is always the one the user clicked, never `open[0]`. */}
      <SectionHeader title="Violations · today" subtitle={subtitle} />
      <div className="mt-4 flex flex-col gap-2">
        {continuing.map((violation) => (
          <div
            key={`ongoing-${violation.type}`}
            data-status="continuing"
            className="flex items-start gap-3 rounded-md bg-danger-soft p-3"
          >
            <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-danger" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-body-strong text-text">
                {VIOLATION_TITLE[violation.type]}
                <Badge tone="danger">Continuing</Badge>
              </p>
              <p className="tabular text-caption text-text-muted">
                {violation.crossedAt
                  ? `In violation from 00:00 · limit crossed ${formatInTimeZone(new Date(violation.crossedAt), timezone, 'MMM d, HH:mm')}`
                  : 'In violation from 00:00 · limit crossed on an earlier day'}
              </p>
              <p className="text-caption text-text-muted">{violation.detail}</p>
            </div>
          </div>
        ))}
        {violations.length === 0 && continuing.length === 0 ? (
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
                    data-print-hide=""
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
