// W-02 top-bar subtitle text: `refreshed N seconds ago` for the cached `GET /live/fleet` snapshot.

/** LV-02 — cached fleet data older than this, shown while a fetch is in flight, is the snapshot
 * left by an earlier visit (or a hidden tab that stopped polling), not the screen's own refresh. */
export const REFRESHING_AFTER_MS = 60_000;

export function refreshedLabel(dataUpdatedAt: number, isFetching = false, now = Date.now()): string | null {
  if (!dataUpdatedAt) return null;
  const age = now - dataUpdatedAt;
  // LV-02: opening Live Fleet on a fleet cached minutes ago (Dashboard visit, background tab) read
  // "refreshed 2 minutes ago" for the whole slow `/live/fleet` refetch. Say it is refreshing.
  if (isFetching && age >= REFRESHING_AFTER_MS) return null;
  const seconds = Math.max(0, Math.floor(age / 1000));
  if (seconds < 60) return `refreshed ${seconds} second${seconds === 1 ? '' : 's'} ago`;
  const minutes = Math.floor(seconds / 60);
  return `refreshed ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
}
