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
import { fleetWriteHandlers, tripDetailHandlers } from './fleetWrites';
import { settingsAdminHandlers } from './settingsAdminGaps';
import { hosWriteHandlers } from './hosWrites';
import { safetyDataHandlers } from './safetyData';
import { phase13Handlers } from './phase13';

// `vehiclesDriversGapHandlers` registers static paths (`/drivers/roster`) that must be matched
// BEFORE `fleetHandlers`' `/drivers/:id` — MSW is first-match-wins and `:id` happily captures the
// literal segment "roster" (web/bugs.md WB-016). `tripsMessagingGapHandlers` overrides
// `fleetHandlers`' bare `GET /api/trips` fixture with richer W-11/W-16 data for the same reason.
// `dvirSafetyGapHandlers` adds the defects/work-orders/maintenance-schedules/dvir-detail/coaching
// endpoints W-09/W-10 need beyond the base `GET /dvir` and `GET /safety/*` in `fleetHandlers`.
//
// The four `mockState`-backed sets go FIRST (MSW is first-match-wins): they replace the thin
// generated openapi examples for `/vehicles`, `/drivers`, `/carrier`, `/roles`, `/users`,
// `/safety/*` and `/logs/*` with a consistent fleet, and they add every write path the app calls
// (`POST /vehicles`, `/vehicles/:id/assign-driver`, `/vehicles/:id/calibrate-odometer`,
// `POST /drivers`, `PATCH /carrier`, alert rules, integrations, API keys, audit log, support,
// HOS certify / log edit requests). Without them those requests fell through to the real API and
// failed with `net::ERR_FAILED` in `dev:mock` (mock-layer audit, 2026-09-23).
export const handlers = [
  // Backend Phase 13 (2026-09-24) — static `/vehicles/bulk-status`, `/dvir/compliance`,
  // `/integrations/catalog` must beat the `:id` / `:provider` handlers below (WB-016).
  ...phase13Handlers,
  // `/drivers/roster` is a STATIC path and must beat `fleetWriteHandlers`' `/drivers/:id`, which
  // otherwise captures the literal segment "roster" (WB-016).
  ...vehiclesDriversGapHandlers,
  ...fleetWriteHandlers,
  ...settingsAdminHandlers,
  ...hosWriteHandlers,
  ...safetyDataHandlers,
  ...authHandlers,
  ...dashboardHandlers,
  ...hosGapHandlers,
  ...tripsMessagingGapHandlers,
  ...tripDetailHandlers,
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
  fleetWriteHandlers,
  tripDetailHandlers,
  settingsAdminHandlers,
  hosWriteHandlers,
  safetyDataHandlers,
  phase13Handlers,
};
