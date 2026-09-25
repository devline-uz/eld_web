// owner: web-reports-transfer — W-12 `All jurisdictions ▾` (B-46: no jurisdiction list endpoint).
//
// The backend has no jurisdiction catalogue, and `GET /reports/ifta/summary` takes only
// `quarter`/`vehicleId`. The options are therefore the jurisdictions the loaded quarter actually
// has rows for, and the filter is applied client-side to those same rows. The KPI row follows the
// selection from that one row; fleet-only figures (receipt count, previous-quarter MPG) have no
// per-jurisdiction value in the summary and are dropped rather than shown for the whole fleet.
import type { IftaJurisdictionRow, IftaKpis } from '@/shared/api/reports';
import { formatJurisdiction } from '@/shared/format/jurisdiction';

export const ALL_JURISDICTIONS = 'all';

/** `?jurisdiction=` — a two-letter IFTA code, upper-cased; anything else is `All jurisdictions`. */
export function parseJurisdiction(raw: string | null): string | null {
  const code = raw?.trim().toUpperCase() ?? '';
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/** `All jurisdictions` + every code in the quarter's rows, A→Z by display name. A deep-linked code
 * the quarter has no row for stays listed so the trigger still names the selection. */
export function jurisdictionOptions(rows: IftaJurisdictionRow[], selected: string | null): { value: string; label: string }[] {
  const codes = new Set(rows.map((r) => r.jurisdiction.trim().toUpperCase()));
  if (selected) codes.add(selected);
  const options = [...codes]
    .map((code) => ({ value: code, label: formatJurisdiction(code) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return [{ value: ALL_JURISDICTIONS, label: 'All jurisdictions' }, ...options];
}

export function rowsForJurisdiction(rows: IftaJurisdictionRow[], selected: string): IftaJurisdictionRow[] {
  return rows.filter((r) => r.jurisdiction.trim().toUpperCase() === selected);
}

/** The KPI row for one jurisdiction, read from its summary row. */
export function kpisForJurisdiction(row: IftaJurisdictionRow): IftaKpis {
  return {
    totalMiles: row.totalMiles,
    taxableMiles: row.taxableMiles,
    taxablePct: row.totalMiles > 0 ? Math.round((row.taxableMiles / row.totalMiles) * 1000) / 10 : null,
    fuelGal: row.fuelGal,
    receiptCount: null,
    fleetMpg: row.mpg,
    fleetMpgPrev: null,
  };
}
