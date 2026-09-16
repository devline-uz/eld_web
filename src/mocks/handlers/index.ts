// The default handler set: everything phase 1–2 touches. A feature agent appends its own file
// here rather than redefining a base server.
import { authHandlers } from './auth';
import { dashboardHandlers } from './dashboard';
import { fleetHandlers } from './fleet';
import { vehiclesDriversGapHandlers } from './vehiclesDriversGaps';
import { hosGapHandlers } from './hosGaps';
import { tripsMessagingGapHandlers } from './tripsMessagingGaps';
import { dvirSafetyGapHandlers } from './dvirSafetyGaps';
import { reportsHandlers } from './reports';
import { settingsGapHandlers } from './settingsGaps';
import { shellGapHandlers } from './shellGaps';

// `vehiclesDriversGapHandlers` registers static paths (`/drivers/roster`) that must be matched
// BEFORE `fleetHandlers`' `/drivers/:id` — MSW is first-match-wins and `:id` happily captures the
// literal segment "roster" (web/bugs.md WB-016). `tripsMessagingGapHandlers` overrides
// `fleetHandlers`' bare `GET /api/trips` fixture with richer W-11/W-16 data for the same reason.
// `dvirSafetyGapHandlers` adds the defects/work-orders/maintenance-schedules/dvir-detail/coaching
// endpoints W-09/W-10 need beyond the base `GET /dvir` and `GET /safety/*` in `fleetHandlers`.
export const handlers = [
  ...authHandlers,
  ...dashboardHandlers,
  ...vehiclesDriversGapHandlers,
  ...hosGapHandlers,
  ...tripsMessagingGapHandlers,
  ...dvirSafetyGapHandlers,
  ...settingsGapHandlers,
  ...reportsHandlers,
  // 11.27/11.28 — overrides fleetHandlers' bare GET /notifications fixture (first match wins).
  ...shellGapHandlers,
  ...fleetHandlers,
];
export {
  authHandlers,
  dashboardHandlers,
  fleetHandlers,
  vehiclesDriversGapHandlers,
  hosGapHandlers,
  tripsMessagingGapHandlers,
  dvirSafetyGapHandlers,
  settingsGapHandlers,
  reportsHandlers,
  shellGapHandlers,
};
