// owner: web-settings-admin — B-8 (`GET /devices/:id/diagnostics`, 11.20 `Test connection`) and B-9
// (`POST /alert-rules/:id/test`, 11.21 `Test rule`), both shipped 2026-09-24. Answers the documented
// openapi.json examples (asserted by tests/contract/phase13.contract.test.ts).
import { http } from 'msw';
import { endpoints } from '@/shared/api/endpoints';
import { ok } from '../envelope';
import { url } from '../envelope';

export const settingsGapHandlers = [
  http.get(url(endpoints.devices.diagnostics(':id')), () =>
    ok({ signalStrength: 'good', gpsLock: true, responded: true }),
  ),
  http.post(url(endpoints.alertRules.test(':id')), () => ok({ triggered: true })),
];
