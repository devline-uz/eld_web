import type { IftaKpis } from '@/shared/api/reports';
import { formatJurisdiction } from '@/shared/format/jurisdiction';

/** LIVE-031 — rows are shown by full name ("Illinois"), so they sort by that name, not by the
 * two-letter code (which put Iowa before Illinois and Missouri before Mississippi). */
export function sortByJurisdictionName<T extends { jurisdiction: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => formatJurisdiction(a.jurisdiction).localeCompare(formatJurisdiction(b.jurisdiction)));
}

/** LIVE-031 — a quarter is "IFTA-ready" only with fuel receipts on file; miles alone are not a
 * filing (fuel tax is computed per gallon purchased vs consumed). */
export function iftaReadinessLabel(kpis: Pick<IftaKpis, 'fuelGal'> | undefined): string {
  if (!kpis) return '';
  return kpis.fuelGal !== null && kpis.fuelGal > 0 ? 'IFTA-ready' : 'Fuel receipts missing — not IFTA-ready';
}
