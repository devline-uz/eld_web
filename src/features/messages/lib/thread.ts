import { formatInTz } from '@/shared/format/datetime';

/** LIVE-026 — the day label above a run of messages: Today / Yesterday / `Mon, Oct 12`
 * (with the year when it is not this year), in the carrier zone like the message times. */
export function messageDayLabel(sentAt: string, timeZone: string, now: Date = new Date()): string {
  const day = formatInTz(sentAt, timeZone, 'yyyy-MM-dd');
  if (day === formatInTz(now, timeZone, 'yyyy-MM-dd')) return 'Today';
  if (day === formatInTz(new Date(now.getTime() - 86_400_000), timeZone, 'yyyy-MM-dd'))
    return 'Yesterday';
  const sameYear = formatInTz(sentAt, timeZone, 'yyyy') === formatInTz(now, timeZone, 'yyyy');
  return formatInTz(sentAt, timeZone, sameYear ? 'EEE, MMM d' : 'EEE, MMM d, yyyy');
}

/** Calendar-day key of a message in `timeZone` — a separator goes where it changes. */
export function messageDayKey(sentAt: string, timeZone: string): string {
  return formatInTz(sentAt, timeZone, 'yyyy-MM-dd');
}

interface TripLike {
  driverId: string | null;
  status: string;
  plannedStartAt: string | null;
}

export interface PanelTrip<T extends TripLike = TripLike> {
  trip: T;
  /** `current` = on the road (IN_PROGRESS, or ASSIGNED whose start has come); `next` = upcoming. */
  kind: 'current' | 'next';
}

/** LIVE-026 — the side panel's "Current trip" was any ASSIGNED trip, so a trip planned for next
 * week read as current. In progress first, then an assigned trip already due, else the next one. */
export function pickPanelTrip<T extends TripLike>(trips: T[], driverId: string, now: Date = new Date()): PanelTrip<T> | null {
  const mine = trips.filter((t) => t.driverId === driverId);
  const inProgress = mine.find((t) => t.status === 'IN_PROGRESS');
  if (inProgress) return { trip: inProgress, kind: 'current' };
  const assigned = mine
    .filter((t) => t.status === 'ASSIGNED')
    .sort((a, b) => startMs(a) - startMs(b));
  const first = assigned[0];
  if (!first) return null;
  const due = !first.plannedStartAt || startMs(first) <= now.getTime();
  return { trip: first, kind: due ? 'current' : 'next' };
}

function startMs(t: TripLike): number {
  return t.plannedStartAt ? new Date(t.plannedStartAt).getTime() : Number.POSITIVE_INFINITY;
}
