// owner: web-dvir-safety — W-09 DVIR & Maintenance, 11.23 Filters (web/tz.md §11.23).
//
// tz.md §11.23 names three groups for this screen: "type, severity, repair status". `type` and
// `repairStatus` live on `DvirRow`; `severity` lives on the *defects* a DVIR raised, not on the
// DVIR itself — there is no DVIR-level severity field. All three therefore apply to the `DVIRs`
// tab's "Recent DVIRs" list (`DvirTableRow`, which already embeds `defects: DefectRow[]` for the
// DEFECTS column), not to the separate `Open defects` tab — see web/decisions.md WD-062.
//
// `GET /dvir` (`DvirListQueryDto`, backend/src/modules/service/dto/service.dto.ts) accepts
// `repairStatus` server-side, but only a single enum value, while the drawer is a multi-select
// checkbox group like every other 11.23 drawer; it has no `type` param at all, and DVIRs have no
// severity field to filter server-side in the first place. The DVIRs tab renders from the
// newest-200 window (`useRecentDvirs`, WD-073), so all three groups run client-side against
// that bounded window — never against a fetch-everything set. Recorded as web/backend-gaps.md B-60.
import type { DefectSeverity, DvirTableRow, DvirType, RepairStatus } from '@/shared/api/dvir';

export const DVIR_TYPE_OPTIONS: DvirType[] = ['PRE_TRIP', 'POST_TRIP', 'INTERMEDIATE'];
export const DVIR_SEVERITY_OPTIONS: DefectSeverity[] = ['CRITICAL', 'MAJOR', 'MINOR'];
export const DVIR_REPAIR_STATUS_OPTIONS: RepairStatus[] = ['NOT_REQUIRED', 'PENDING', 'REPAIRED', 'DEFERRED'];

export interface DvirFilters {
  type: DvirType[];
  severity: DefectSeverity[];
  repairStatus: RepairStatus[];
}

export const EMPTY_DVIR_FILTERS: DvirFilters = {
  type: [],
  severity: [],
  repairStatus: [],
};

const PARAM = {
  type: 'fType',
  severity: 'fSeverity',
  repairStatus: 'fRepair',
} as const;

export function parseDvirFilters(params: URLSearchParams): DvirFilters {
  return {
    type: (params.get(PARAM.type)?.split(',').filter(Boolean) ?? []) as DvirType[],
    severity: (params.get(PARAM.severity)?.split(',').filter(Boolean) ?? []) as DefectSeverity[],
    repairStatus: (params.get(PARAM.repairStatus)?.split(',').filter(Boolean) ?? []) as RepairStatus[],
  };
}

/** Writes the filter set onto an existing `URLSearchParams`, removing keys that are unset. */
export function writeDvirFilters(params: URLSearchParams, filters: DvirFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  const setOrDelete = (key: string, value: string | null) => {
    if (value) next.set(key, value);
    else next.delete(key);
  };
  setOrDelete(PARAM.type, filters.type.join(',') || null);
  setOrDelete(PARAM.severity, filters.severity.join(',') || null);
  setOrDelete(PARAM.repairStatus, filters.repairStatus.join(',') || null);
  next.delete('page');
  return next;
}

export function countActiveDvirFilters(filters: DvirFilters): number {
  let n = 0;
  if (filters.type.length) n += 1;
  if (filters.severity.length) n += 1;
  if (filters.repairStatus.length) n += 1;
  return n;
}

export function matchesDvirFilters(row: DvirTableRow, filters: DvirFilters): boolean {
  if (filters.type.length && !filters.type.includes(row.type)) return false;
  if (filters.severity.length && !row.defects.some((d) => filters.severity.includes(d.severity))) return false;
  if (filters.repairStatus.length && !filters.repairStatus.includes(row.repairStatus)) return false;
  return true;
}
