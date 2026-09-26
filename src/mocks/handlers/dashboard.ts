// Perf plan item 3 (WD-074) — `GET /dashboard/summary` mock, composed from the same fixtures the
// individual endpoints already use (`fleet.ts` LIVE_FLEET, `hosGaps.ts` VIOLATIONS_FIXTURE,
// `fixtures.generated` for `/unidentified` and `/carrier`) so the mock shape stays byte-for-byte
// the same data the six requests it replaces used to return.
import { http } from 'msw';
import { endpoints } from '@/shared/api/endpoints';
import { fixture } from '../fixtures.generated';
import { ok, url } from '../envelope';
import { LIVE_FLEET } from './fleet';
import { VIOLATIONS_FIXTURE } from './hosGaps';
import { liveVehicles } from './mockState';

const DUTY_ON_STATUSES = ['DRIVING', 'ON_DUTY', 'SLEEPER'];

function liveFleetCounts() {
  const units = LIVE_FLEET.items;
  return {
    total: units.length,
    onDuty: units.filter((u) => DUTY_ON_STATUSES.includes(u.dutyStatus)).length,
    moving: units.filter((u) => u.dutyStatus === 'DRIVING').length,
    idle: units.filter((u) => u.dutyStatus === 'IDLE').length,
    offline: units.filter((u) => u.dutyStatus === 'ELD_OFFLINE').length,
  };
}

export const dashboardHandlers = [
  http.get(url(endpoints.dashboard.summary), () => {
    const unidentified = fixture<{ items: { durationSec: number }[]; total: number }>('GET /api/unidentified');
    const carrier = fixture<{ id: string; name: string; timezone?: string }>('GET /api/carrier');
    const now = new Date().toISOString();
    return ok({
      liveFleet: { items: LIVE_FLEET.items, generatedAt: LIVE_FLEET.generatedAt, counts: liveFleetCounts() },
      violations: { items: VIOLATIONS_FIXTURE, total: VIOLATIONS_FIXTURE.length },
      unidentified: {
        total: unidentified.total,
        totalDurationSec: unidentified.items.reduce((sum, s) => sum + (s.durationSec ?? 0), 0),
      },
      notifications: { unreadCount: 4 },
      carrier: { id: carrier.id, name: carrier.name, timezone: carrier.timezone ?? 'America/New_York' },
      // Derived from the same table `GET /vehicles` pages, so the KPI tile, the Vehicles header's
      // `All` count and the sidebar never disagree (mock-layer audit, 2026-09-23).
      vehicles: {
        active: liveVehicles().filter((v) => v.status === 'ACTIVE').length,
        total: liveVehicles().length,
      },
      generatedAt: now,
    });
  }),
];
