/**
 * LIVE-017 — card copy for the viewed RODS day: "today" only when it IS today in the driver's home
 * terminal zone, otherwise "on Oct 8" (a past day used to read "Violations · today").
 */
export function dayPhrase(date: string, todayKey: string): string {
  if (date === todayKey) return 'today';
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return 'this day';
  const label = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `on ${label}`;
}
