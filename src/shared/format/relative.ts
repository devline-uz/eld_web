// web/tz.md §8.2 — relative time, the one place the browser locale is correct.
// < 60 s → `just now` · < 60 min → `N minutes ago` (`12 min` in tables) · < 24 h → `N h` ·
// yesterday → `Yesterday` · < 7 d → `N d` · older → the date. Recomputed every 30 s.
import { formatLocal, type DateInput } from './datetime';
import { EMPTY } from './empty';

export const RELATIVE_TICK_MS = 30_000;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function toTime(value: DateInput): number | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

/** Whether `then` falls on the calendar day before `now`, in the browser's zone. */
function isYesterday(then: number, now: number): boolean {
  const a = new Date(then);
  const b = new Date(now);
  const startOfToday = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  const startOfDay = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  return startOfToday - startOfDay === DAY;
}

/** `2 minutes ago` · `1 h` · `Yesterday` · `2 d` · `just now` · older → `Sep 11, 2025`. */
export function formatRelative(value: DateInput, now: number = Date.now()): string {
  const then = toTime(value);
  if (then === null) return EMPTY.dash;
  const diff = now - then;
  if (diff < 0) return 'just now';
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE);
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  if (diff < DAY) return `${Math.floor(diff / HOUR)} h`;
  if (isYesterday(then, now)) return 'Yesterday';
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} d`;
  return formatLocal(then, 'shortDate');
}

/** The table form — `12 min`, `3 h`, `2 d`, `just now` (§8.2 `LAST SYNC`). */
export function formatRelativeShort(value: DateInput, now: number = Date.now()): string {
  const then = toTime(value);
  if (then === null) return EMPTY.dash;
  const diff = now - then;
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} h`;
  if (isYesterday(then, now)) return 'Yesterday';
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} d`;
  return formatLocal(then, 'shortDate');
}

/** `14:26 · 1h ago` — the mixed form. The clock half is rendered in the given zone. */
export function formatTimeWithAge(clock: string, value: DateInput, now: number = Date.now()): string {
  const then = toTime(value);
  if (then === null) return clock;
  const diff = Math.max(0, now - then);
  if (diff < HOUR) return `${clock} · ${Math.max(1, Math.floor(diff / MINUTE))}m ago`;
  if (diff < DAY) return `${clock} · ${Math.floor(diff / HOUR)}h ago`;
  return `${clock} · ${Math.floor(diff / DAY)}d ago`;
}
