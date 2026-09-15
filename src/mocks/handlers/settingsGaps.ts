// owner: web-settings-admin — ⛔ GAP B-8 (`GET /devices/:id/diagnostics`, 11.20 `Test connection`)
// and ⛔ GAP B-9 (`POST /alert-rules/:id/test`, 11.21 `Test rule`). Neither endpoint exists on the
// backend (web/backend-gaps.md). Served here with the §11.20/§11.21 documented response shapes so
// deleting this file is the whole migration the day either one ships.
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
