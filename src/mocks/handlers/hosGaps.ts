// owner: web-hos-logs — B-6 `GET /violations` + `POST /violations/:id/resolve` (shipped 2026-09-14).
// Test doubles only: both bodies follow the documented example in backend/docs/openapi.json and
// are validated by tests/contract/shipped-gaps.contract.test.ts (WB-045).
import { http } from 'msw';
import { endpoints } from '@/shared/api/endpoints';
import { ok, url } from '../envelope';

/** Shared with `dashboard.ts` (§20 dashboard summary MSW handler) so the two responses agree. */
export const VIOLATIONS_FIXTURE = [
  {
    id: 'vio_1',
    driverId: 'drv_1',
    dailyLogId: 'dl_1',
    logDate: '2026-09-14',
    type: 'DRIVING_11',
    occurredAt: '2026-09-14T14:26:00.000Z',
    exceededBySec: 1560,
    detail: 'Driving 11h26m',
    status: 'OPEN',
    resolvedAt: null,
    resolvedById: null,
    resolutionNote: null,
    severity: 'VIOLATION',
    driverName: 'John Smith',
    vehicleId: 'veh_1',
    unitNumber: '101',
    event: '11-hour driving limit exceeded',
    locationLabel: '1.04 mi W of Harrisburg, OH',
    date: '2026-09-14',
  },
];

export const hosGapHandlers = [
  http.get(url(endpoints.violations.list), () =>
    ok({
      items: VIOLATIONS_FIXTURE,
      total: 1,
      page: 1,
      limit: 25,
      totalPages: 1,
    }),
  ),
  http.post(url(endpoints.violations.resolve(':id')), async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as { resolutionNote?: string };
    return ok({
      id: String(params.id),
      status: 'RESOLVED',
      resolvedAt: new Date().toISOString(),
      resolutionNote: body.resolutionNote ?? '',
    });
  }),
];
