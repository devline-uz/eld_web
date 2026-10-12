// QA UI-020 — a backend enum (`IN_PROGRESS`, `AIR_LINES`, `EXHAUST`) must never reach the screen
// as a raw code: sentence case, underscores to spaces. A curated label always wins over this.
import { EMPTY } from './empty';

/** `IN_PROGRESS` → `In progress` · `AIR_LINES` → `Air lines` · `EXHAUST` → `Exhaust` · empty → `—`. */
export function formatEnumLabel(value: string | null | undefined): string {
  if (!value) return EMPTY.dash;
  const words = value.trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
