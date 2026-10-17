// owner: web-design-system — UI-003 / UI-004. How one `GET /live/fleet` unit reads wherever a
// unit is listed (W-01 Dashboard, W-02 Live Fleet): the record status wins the badge (an
// OUT_OF_SERVICE truck is "Out of service", not "Inactive"), and a one-line note says what the
// ELD link is doing — "No device" or, for a stale duty status, "Last update 4 d ago".
import type { LiveFleetListUnit } from '@/shared/api/liveFleet';
import { formatAgo } from '@/shared/format/relative';
import { useNowTick } from '@/shared/format/useRelativeTime';
import { Badge, DutyBadge } from './Badge';
import { cn } from './cn';

type BadgeUnit = Pick<LiveFleetListUnit, 'dutyStatus' | 'recordStatus'>;
type NoteUnit = Pick<LiveFleetListUnit, 'connectivity' | 'isStale' | 'staleSince' | 'lastSeenAt'>;

/** The headline badge: `Out of service` from the record, else the (server-resolved) duty status. */
export function LiveUnitBadge({ unit, className }: { unit: BadgeUnit; className?: string }) {
  if (unit.recordStatus === 'OUT_OF_SERVICE') {
    return (
      <Badge tone="danger" dot className={className}>
        Out of service
      </Badge>
    );
  }
  return <DutyBadge status={unit.dutyStatus} className={className} />;
}

/** The secondary line, or null when the unit is live and has an ELD. Pure, for tests. */
export function liveUnitNote(unit: NoteUnit, now: number = Date.now()): string | null {
  if (unit.isStale) {
    const since = unit.staleSince ?? unit.lastSeenAt;
    return since ? `Last update ${formatAgo(since, now)}` : 'No recent update';
  }
  if (unit.connectivity === 'NO_DEVICE') return 'No device';
  return null;
}

/** `liveUnitNote`, re-rendered on the shared 30 s tick. Stale reads in the warning tone. */
export function LiveUnitNote({ unit, className }: { unit: NoteUnit; className?: string }) {
  const now = useNowTick();
  const note = liveUnitNote(unit, now);
  if (!note) return null;
  return (
    <span data-testid="live-unit-note" className={cn('text-caption', unit.isStale ? 'text-warning' : 'text-text-muted', className)}>
      {note}
    </span>
  );
}
