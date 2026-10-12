import { Badge, DUTY_LABEL, type DutyStatus } from './Badge';
import { formatDurationShort } from '../format/duration';

// owner: web-design-system — BUG-002. The backend flags a duty status that has run past its
// plausible maximum (`isStale`, `staleSince` on `GET /drivers/:id/hos` and the roster): the ELD
// stopped reporting, the clocks are frozen at `staleSince`, and 00:00 "limit exceeded" would be
// a misleading number. These two pieces replace the clocks wherever that flag is set.

export const ELD_STALE_LABEL = 'ELD connection lost';

export function EldStaleBadge({ className }: { className?: string }) {
  return (
    <Badge tone="warning" dot className={className}>
      {ELD_STALE_LABEL}
    </Badge>
  );
}

export interface EldStaleNoticeProps {
  dutyStatus: DutyStatus;
  statusSince: string;
  /** The response's `computedAt` — "now" as the server saw it. */
  computedAt: string;
}

/** The Available hours card body for a stale status: what is stuck and for how long, no clocks. */
export function EldStaleNotice({ dutyStatus, statusSince, computedAt }: EldStaleNoticeProps) {
  const openSec = (new Date(computedAt).getTime() - new Date(statusSince).getTime()) / 1000;
  return (
    <div role="status" className="flex flex-col gap-2">
      <EldStaleBadge className="self-start" />
      <p className="text-body text-text">
        {DUTY_LABEL[dutyStatus]} for {formatDurationShort(openSec)} with no duty-status change — longer than any real
        shift. The ELD has most likely stopped reporting.
      </p>
      <p className="text-caption text-text-muted">
        Hours-of-service clocks are paused until the ELD reconnects or the log is corrected.
      </p>
    </div>
  );
}
