// W-02 Live Fleet search box — `Search unit, driver, plate…` (QA FE-006). "Unit 104", "#104" and
// "104" all find unit 104; the licence plate (from the session-cached vehicle lookup, since
// `GET /live/fleet` has no plate) matches with or without spaces/dashes.
import type { LiveFleetListUnit } from '@/shared/api/liveFleet';

/** "Unit 104" / "unit #104" / "#104" → "104"; anything else is just trimmed and lower-cased. */
export function normalizeUnitQuery(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^unit\b\s*/, '')
    .replace(/^#\s*/, '');
}

const compact = (value: string) => value.toLowerCase().replace(/[\s-]/g, '');

export function matchesUnitSearch(unit: Pick<LiveFleetListUnit, 'unitNumber' | 'driverName'>, raw: string, plate?: string | null): boolean {
  const text = raw.trim().toLowerCase();
  if (!text) return true;
  const unitQuery = normalizeUnitQuery(raw);
  const unitNumber = unit.unitNumber.toLowerCase().replace(/^#/, '');
  if (unitQuery && unitNumber.includes(unitQuery)) return true;
  if ((unit.driverName ?? '').toLowerCase().includes(text)) return true;
  return Boolean(plate && compact(text) && compact(plate).includes(compact(text)));
}
