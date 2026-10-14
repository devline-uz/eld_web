// owner: web-dashboard-fleet — perf plan item 3 (WD-074). `GET /dashboard/summary` (permission
// `dashboard` READ, §6.4 READ for every role) answers in one round trip what W-01 Fleet Dashboard
// used to fire as 6 separate requests: `/live/fleet`, `/violations?status=OPEN`,
// `/unidentified?status=PENDING`, `/notifications?unreadOnly=true&limit=1`, `/carrier` and two
// `/vehicles?...&limit=1` counts. Response shape verified against the running dev API and mirrors
// `backend/src/modules/dashboard/dashboard.controller.ts`'s doc comment exactly.
import { useQuery } from '@tanstack/react-query';
import { client } from './client';
import { endpoints } from './endpoints';
import { qk } from './queryKeys';
import { typedCachePolicy } from './queryPolicy';
import type { LiveFleetUnit } from './liveFleet';
import type { Severity } from '@/shared/ui/Badge';

export interface DashboardViolation {
  id: string;
  severity: Severity;
  driverId: string | null;
  driverName: string | null;
  vehicleId: string | null;
  unitNumber: string | null;
  event: string;
  locationLabel: string | null;
  occurredAt: string;
  date?: string;
}

export interface DashboardSummaryResponse {
  liveFleet: {
    items: LiveFleetUnit[];
    generatedAt: string;
    /**
     * UI-003 — `moving` excludes stale units. QA LIVE-002 — `onDuty` / `driverDuty`: assigned
     * drivers by their HOS status (Drivers list definition). QA LIVE-011 — `offline`: units whose
     * paired ELD has been silent > 30 min (`connectivity: 'ELD_OFFLINE'`).
     */
    counts: {
      total: number;
      onDuty: number;
      moving: number;
      idle: number;
      offline: number;
      driverDuty?: { assigned: number; DRIVING: number; ON_DUTY: number; SLEEPER: number; OFF_DUTY: number; UNKNOWN: number };
    };
  };
  violations: { items: DashboardViolation[]; total: number };
  /** `total` / `totalDurationSec` = PENDING (unassigned). CODE-029 — `awaitingDriver*` = assigned by
   * the carrier, waiting for the driver's confirmation (PENDING_CONFIRMATION); optional for older APIs. */
  unidentified: { total: number; totalDurationSec: number; awaitingDriver?: number; awaitingDriverDurationSec?: number };
  notifications: { unreadCount: number };
  carrier: { id: string; name: string; timezone: string | null };
  /** UI-004 — `inactive` / `outOfService` are fleet-wide record-status counts (additive). */
  vehicles: { active: number; total: number; inactive?: number; outOfService?: number };
  generatedAt: string;
}

/** One query, `cachePolicy('live')` (10s stale / 30s poll while the tab is visible, §6.4). */
export function useDashboardSummary() {
  return useQuery({
    queryKey: qk.dashboardSummary,
    queryFn: ({ signal }) => client.get<DashboardSummaryResponse>(endpoints.dashboard.summary, { signal }),
    ...typedCachePolicy<DashboardSummaryResponse>('live'),
  });
}
