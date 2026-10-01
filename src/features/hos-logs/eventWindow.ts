import { VIRTUALIZE_ABOVE } from '@/shared/ui/virtualRows';

/**
 * WB-256 — a 2,000-event day rendered every row (~22.8k DOM nodes). Above the §16.2 threshold the
 * card shows the first `EVENT_WINDOW` rows and grows by the same step on `Show more events`; the
 * rows are still a real `<table>` (shared `DataTable`), so no a11y pattern changes.
 */
export const EVENT_WINDOW = 250;

/** How many of `total` rows to render: all at or below the threshold, else a growing window that
 * always reaches `mustInclude` (the grid-highlighted row) when it is set. */
export function eventWindowSize(total: number, requested: number, mustInclude: number): number {
  if (total <= VIRTUALIZE_ABOVE) return total;
  const needed = mustInclude >= 0 ? Math.ceil((mustInclude + 1) / EVENT_WINDOW) * EVENT_WINDOW : 0;
  return Math.min(total, Math.max(requested, needed));
}
