// web/tz.md §8.2 — durations. `05h 30m` for a segment, `12h 40m` for a KPI; both from seconds.
import { EMPTY } from './empty';

type Sec = number | null | undefined;

const isSec = (value: Sec): value is number => typeof value === 'number' && Number.isFinite(value);

/** `05h 30m` — two-digit hours, two-digit minutes. */
export function formatDuration(seconds: Sec): string {
  if (!isSec(seconds)) return EMPTY.dash;
  const total = Math.max(0, Math.trunc(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
}

/** `5h 30m` — the compact form used inside a sentence. */
export function formatDurationShort(seconds: Sec): string {
  if (!isSec(seconds)) return EMPTY.dash;
  const total = Math.max(0, Math.trunc(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** `45 min` — a sub-hour duration in a table cell. */
export function formatMinutes(seconds: Sec): string {
  if (!isSec(seconds)) return EMPTY.dash;
  return `${Math.max(0, Math.round(seconds / 60))} min`;
}
