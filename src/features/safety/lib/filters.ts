// owner: web-dvir-safety — W-10 Safety, 11.23 Filters (web/tz.md §11.23).
//
// `GET /safety/events` (`SafetyEventListQueryDto`, backend/src/modules/safety/dto/safety.dto.ts)
// accepts `type` and `status` (coaching status) server-side, but only one value each, while the
// drawer is a multi-select checkbox group like every other 11.23 drawer. `severity` on
// `SafetyEvent` is a raw `Int` 1-5 proxy ("how far past the threshold the delta went",
// `backend/src/modules/safety/lib/harsh-detect.ts`), not the Critical/Major/Minor enum the design
// system's severity palette uses (web/tz.md §3, `SeverityBadge`) — there is no bucketed severity
// param to send at all. `useSafetyEventsList` already loads the full set (`limit: 500`) once for
// the driver/vehicle joins (same W-03/W-06/W-09/W-11 precedent, web/decisions.md WD-024), so all
// three groups run client-side against that already-loaded set, bucketing severity the same way
// `SeverityBadge` colours it (4-5 Critical/danger, 3 Major/warning, 1-2 Minor/neutral). Recorded
// as web/backend-gaps.md B-61.
import type { CoachingStatus, SafetyEventTableRow, SafetyEventType } from '@/shared/api/safety';

export const SAFETY_EVENT_TYPE_OPTIONS: SafetyEventType[] = ['HARSH_BRAKING', 'HARSH_ACCEL', 'HARSH_TURN', 'SPEEDING', 'SEATBELT'];
export type SafetySeverityBucket = 'CRITICAL' | 'MAJOR' | 'MINOR';
export const SAFETY_SEVERITY_OPTIONS: SafetySeverityBucket[] = ['CRITICAL', 'MAJOR', 'MINOR'];
export const SAFETY_COACHING_STATUS_OPTIONS: CoachingStatus[] = ['NEW', 'REVIEWED', 'COACHED', 'DISMISSED'];

/** Same bucketing `SafetyPage` severity cells and the design's severity palette use — 4-5 →
 * Critical (danger), 3 → Major (warning), 1-2 → Minor (neutral). */
export function severityBucket(severity: number): SafetySeverityBucket {
  if (severity >= 4) return 'CRITICAL';
  if (severity === 3) return 'MAJOR';
  return 'MINOR';
}

export interface SafetyFilters {
  type: SafetyEventType[];
  severity: SafetySeverityBucket[];
  coachingStatus: CoachingStatus[];
}

export const EMPTY_SAFETY_FILTERS: SafetyFilters = {
  type: [],
  severity: [],
  coachingStatus: [],
};

const PARAM = {
  type: 'fType',
  severity: 'fSeverity',
  coachingStatus: 'fCoaching',
} as const;

export function parseSafetyFilters(params: URLSearchParams): SafetyFilters {
  return {
    type: (params.get(PARAM.type)?.split(',').filter(Boolean) ?? []) as SafetyEventType[],
    severity: (params.get(PARAM.severity)?.split(',').filter(Boolean) ?? []) as SafetySeverityBucket[],
    coachingStatus: (params.get(PARAM.coachingStatus)?.split(',').filter(Boolean) ?? []) as CoachingStatus[],
  };
}

/** Writes the filter set onto an existing `URLSearchParams`, removing keys that are unset. */
export function writeSafetyFilters(params: URLSearchParams, filters: SafetyFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  const setOrDelete = (key: string, value: string | null) => {
    if (value) next.set(key, value);
    else next.delete(key);
  };
  setOrDelete(PARAM.type, filters.type.join(',') || null);
  setOrDelete(PARAM.severity, filters.severity.join(',') || null);
  setOrDelete(PARAM.coachingStatus, filters.coachingStatus.join(',') || null);
  next.delete('page');
  return next;
}

export function countActiveSafetyFilters(filters: SafetyFilters): number {
  let n = 0;
  if (filters.type.length) n += 1;
  if (filters.severity.length) n += 1;
  if (filters.coachingStatus.length) n += 1;
  return n;
}

export function matchesSafetyFilters(row: SafetyEventTableRow, filters: SafetyFilters): boolean {
  if (filters.type.length && !filters.type.includes(row.type)) return false;
  if (filters.severity.length && !filters.severity.includes(severityBucket(row.severity))) return false;
  if (filters.coachingStatus.length && !filters.coachingStatus.includes(row.status)) return false;
  return true;
}
