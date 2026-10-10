// owner: web-dvir-safety — W-09 Schedules table cells (WD-112). A schedule can carry a mileage
// interval, a day interval or both, and the server marks it Overdue on whichever trips first — so
// INTERVAL and NEXT DUE show both halves, otherwise an Overdue badge next to a future date is
// unexplained.
import { formatDistance, formatNumber } from '@/shared/format/numbers';
import { formatLocal } from '@/shared/format/datetime';
import { EMPTY } from '@/shared/format/empty';
import type { MaintenanceScheduleRow } from '@/shared/api/dvir';

type IntervalFields = Pick<MaintenanceScheduleRow, 'intervalMi' | 'intervalDays'>;
type NextDueFields = Pick<MaintenanceScheduleRow, 'nextDueMi' | 'nextDueAt'>;

const SEP = ' · ';

/** `Every 10,000 mi · 30 days` / `Every 10,000 mi` / `Every 30 days` / `—` */
export function scheduleIntervalLabel({ intervalMi, intervalDays }: IntervalFields): string {
  const parts: string[] = [];
  if (intervalMi != null) parts.push(formatDistance(intervalMi));
  if (intervalDays != null) parts.push(`${formatNumber(intervalDays)} ${intervalDays === 1 ? 'day' : 'days'}`);
  return parts.length ? `Every ${parts.join(SEP)}` : EMPTY.dash;
}

/** `12,000 mi · Nov 08, 2026` / `12,000 mi` / `Nov 08, 2026` / `—` */
export function scheduleNextDueLabel({ nextDueMi, nextDueAt }: NextDueFields): string {
  const parts: string[] = [];
  if (nextDueMi != null) parts.push(formatDistance(nextDueMi));
  if (nextDueAt) parts.push(formatLocal(nextDueAt, 'shortDate'));
  return parts.length ? parts.join(SEP) : EMPTY.dash;
}
