// MSW for the topbar overlays (11.27, 11.28). B-10 `GET /search`, B-56 `POST /notifications/:id/read`
// and B-57/B-58 (`category`, `counts`, `kind`, `severity`) all shipped 2026-09-24; the shapes below
// are held to openapi.json by tests/contract/phase13.contract.test.ts.
import { http } from 'msw';
import { endpoints } from '@/shared/api/endpoints';
import type { NotificationItem } from '@/shared/api/notifications';
import type { SearchDriverHit, SearchVehicleHit } from '@/shared/api/search';
import { ok, url } from '../envelope';
import { DRIVERS, liveVehicles } from './mockState';

const MIN = 60_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

function seedNotifications(): NotificationItem[] {
  return [
    { id: 'ntf_1', kind: 'VIOLATION', severity: 'CRITICAL', type: 'hos_violation', category: 'VIOLATIONS', title: 'HOS violation', body: 'John Smith exceeded the 11-hour driving limit by 00:26', objectType: 'Driver', objectId: 'drv_1', readAt: null, createdAt: ago(2 * MIN) },
    { id: 'ntf_2', kind: 'DEVICE', severity: 'CRITICAL', type: 'eld_disconnected', category: 'VIOLATIONS', title: 'ELD disconnected', body: 'Unit #110 · PT30_77D2 has been offline for 46 minutes', objectType: 'Vehicle', objectId: 'veh_110', readAt: null, createdAt: ago(45 * MIN) },
    { id: 'ntf_3', kind: 'WARNING', severity: 'WARNING', type: 'break_due', category: 'VIOLATIONS', title: 'Break due soon', body: 'Marvin McKinney needs a 30-minute break in 00:18', objectType: 'Driver', objectId: 'drv_7', readAt: null, createdAt: ago(60 * MIN) },
    { id: 'ntf_4', kind: 'MAINTENANCE', severity: 'WARNING', type: 'maintenance_overdue', category: 'MAINTENANCE', title: 'Maintenance overdue', body: 'Unit #104 oil & filter service was due 2 days ago', objectType: 'WorkOrder', objectId: 'wo_1', readAt: null, createdAt: ago(180 * MIN) },
    { id: 'ntf_5', kind: 'UNIDENTIFIED', severity: 'INFO', type: 'unassigned_driving', category: null, title: 'Unassigned driving', body: '1h 12m of driving with no driver logged in on unit #103', objectType: 'UnidentifiedSegment', objectId: 'uds_1', readAt: ago(200 * MIN), createdAt: ago(300 * MIN) },
    { id: 'ntf_6', kind: 'OTHER', severity: 'INFO', type: 'report_ready', category: null, title: 'Report ready', body: 'FMCSA audit pack for Jun 2025 finished generating', objectType: 'Report', objectId: 'rpt_1', readAt: ago(600 * MIN), createdAt: ago(30 * 60 * MIN) },
  ];
}

let notifications = seedNotifications();

/** Tests call this in `afterEach` — the handlers keep read state between requests. */
export function resetShellGapState(): void {
  notifications = seedNotifications();
}

export const SEARCH_DRIVERS: SearchDriverHit[] = [
  { id: 'drv_1', name: 'John Smith', unitNumber: '101', dutyStatus: 'ON_DUTY', openViolations: 1, openWarnings: 1, homeTerminalName: 'Columbus, OH' },
  { id: 'drv_33', name: 'Smith Rodriguez', unitNumber: '133', dutyStatus: 'OFF_DUTY', openViolations: 0, openWarnings: 0, homeTerminalName: 'Dayton, OH' },
];

export const SEARCH_VEHICLES: SearchVehicleHit[] = [
  { id: 'veh_101', unitNumber: '101', make: 'Freightliner', model: 'Cascadia', vin: '1FUJGLDR8LLLL1234', driverName: 'John Smith' },
];

export const shellGapHandlers = [
  http.get(url(endpoints.notifications.list), ({ request }) => {
    const search = new URL(request.url).searchParams;
    const limit = Number(search.get('limit') ?? '25');
    const unreadOnly = search.get('unreadOnly') === 'true';
    const category = search.get('category');
    const filtered = notifications.filter(
      (item) => (!unreadOnly || !item.readAt) && (!category || item.category === category),
    );
    return ok({
      items: filtered.slice(0, limit),
      page: 1,
      limit,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
      counts: {
        all: notifications.length,
        violations: notifications.filter((item) => item.category === 'VIOLATIONS').length,
        maintenance: notifications.filter((item) => item.category === 'MAINTENANCE').length,
      },
    });
  }),

  http.post(url(endpoints.notifications.readAll), () => {
    const now = new Date().toISOString();
    const updated = notifications.filter((item) => !item.readAt).length;
    notifications = notifications.map((item) => (item.readAt ? item : { ...item, readAt: now }));
    return ok({ updated });
  }),

  http.post(url(endpoints.notificationItem.markRead(':id')), ({ params }) => {
    const readAt = new Date().toISOString();
    notifications = notifications.map((item) => (item.id === params.id ? { ...item, readAt } : item));
    return ok({ id: String(params.id), readAt });
  }),

  http.get(url(endpoints.search.root), ({ request }) => {
    const q = (new URL(request.url).searchParams.get('q') ?? '').toLowerCase();
    return ok({
      q,
      drivers: SEARCH_DRIVERS.filter((hit) => hit.name.toLowerCase().includes(q)),
      vehicles: SEARCH_VEHICLES.filter((hit) =>
        [hit.unitNumber, hit.vin, hit.make, hit.model, hit.driverName].some((v) => v?.toLowerCase().includes(q)),
      ),
      // WB-176 — the palette footer used to claim 69 units while `GET /vehicles` answered the
      // real fixture; the scope counts are derived now, as the rest of `mockState` already is.
      scope: { units: liveVehicles().length, drivers: DRIVERS.length, logs: 1284 },
    });
  }),
];
