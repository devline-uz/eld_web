// owner: web-dashboard-fleet — perf plan item 3 (WD-074). `GET /dashboard/summary` (permission
// `dashboard` READ, §6.4 READ for every role) answers in one round trip what W-01 Fleet Dashboard
// used to fire as 6 separate requests: `/live/fleet`, `/violations?window=24h`,
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
    counts: { total: number; onDuty: number; moving: number; idle: number; offline: number };
  };
  violations: { items: DashboardViolation[]; total: number };
  unidentified: { total: number; totalDurationSec: number };
  notifications: { unreadCount: number };
  carrier: { id: string; name: string; timezone: string | null };
  vehicles: { active: number; total: number };
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
