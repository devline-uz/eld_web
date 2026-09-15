# Four-state audit — web/tz.md §22, "every screen implements all four states"

Every screen must implement **loading** (skeleton, never a spinner), **empty** (the screen's own
§13.2 copy), **error** (`<ErrorState>` inside the failing card, never replacing the whole page)
and **forbidden** (`<ForbiddenState>` full page, §12.4). This matrix is the evidence trail.

## Two states are covered generically, not per screen

- **Loading.** Every screen below renders its `isLoading` branch through the shared
  `<LoadingState>` (`src/shared/ui/states.tsx`) — grep-verified (`isLoading ? <LoadingState …/>`)
  in every feature file listed here. `<LoadingState>` itself is unit-tested in
  `src/shared/ui/states.test.tsx` (`aria-busy`, `sr-only` "Loading" text, `.animate-pulse` rows,
  never a spinner). A screen that reaches for the shared primitive inherits that coverage; it is
  marked **generic** below rather than duplicated per screen. Four screens additionally carry
  their own explicit loading assertion (marked **explicit**) because their guard order
  (forbidden → loading → error) is itself part of what's being tested.
- **Forbidden.** `NONE`-level routes never render the feature element at all — `buildRoutes`
  (`src/app/router.tsx` `toRouteObject`) swaps in `<ForbiddenPage>` (→ `<ForbiddenState>`) in
  place, for every perm-gated route, including the `blockedRoles` design omissions (Dispatcher ×
  DVIR/Safety). This single mechanism is unit-tested generically in `src/app/router.test.ts`
  (NONE vs FULL renders a different element; every NONE-gated path shares the same
  `ForbiddenPage` reference; READ satisfies a READ-gated route; the Dispatcher DVIR omission is
  asserted by name) and exercised live end-to-end for three roles/paths in
  `tests/e2e/18-permission-controls-global-gate.spec.ts`. Two detail pages additionally render
  their own defensive `<ForbiddenState>` inline (marked **explicit**) because `vehicles`/`drivers`
  are never `NONE` for any role today and the route guard alone would never exercise that branch.

Both are marked **generic** in the matrix below where no per-screen test exists; "missing" is
reserved for a cell with neither a specific test nor a working generic mechanism behind it.

## Matrix

| Screen | Loading | Empty | Error | Forbidden |
|---|---|---|---|---|
| W-01 Fleet Dashboard | generic | `DashboardPage.test.tsx` | `DashboardPage.test.tsx` (B-6 404, in-card) | generic |
| W-02 Live Fleet | generic | `LiveFleetPage.test.tsx` | `LiveFleetPage.test.tsx` | generic |
| W-03 Vehicles | generic | `VehiclesPage.test.tsx` | `VehiclesPage.test.tsx` | generic |
| W-04 Unit profile | **explicit** `UnitProfilePage.test.tsx` | `UnitProfilePage.test.tsx` (Unit activity card) | `UnitProfilePage.test.tsx` | **explicit** `UnitProfilePage.test.tsx` |
| W-05 Unit histories | **explicit** `UnitHistoriesPage.test.tsx` | N/A — no §13.2 empty copy defined for this screen; a 0-segment day renders the same KPI/table shell (asserted) | `UnitHistoriesPage.test.tsx` | generic (unreachable — `vehicles` is never `NONE` for any role) |
| W-06 Drivers | generic | `DriversPage.test.tsx` | `DriversPage.test.tsx` (B-1 roster shape) | generic |
| W-07 Driver profile | **explicit** `DriverProfilePage.test.tsx` | `DriverProfilePage.test.tsx` (Activity tab) | `DriverProfilePage.test.tsx` | **explicit** `DriverProfilePage.test.tsx` |
| W-08 HOS Logs | generic | `HosLogsPage.test.tsx` (§13.2 banner, no ELD records) | `HosLogsPage.test.tsx` (grid + Available-hours B-2) | generic |
| W-09 DVIR & Maintenance | generic | `DvirPage.test.tsx` (×2: DVIRs, open defects) | `DvirPage.test.tsx` | generic |
| W-10 Safety | generic | `SafetyPage.test.tsx` | `SafetyPage.test.tsx` | generic |
| W-11 Dispatch & Trips | generic | `TripsPage.test.tsx` (×2: trips, Unassigned) | `TripsPage.test.tsx` | generic |
| W-12 Reports · IFTA | generic | N/A — always has the 6 library entries; "no reports generated yet" is exercised via the Recently-generated card | `IftaReportPage.test.tsx` | `reportsRouting.test.tsx` / `reportsInteractions.test.tsx` |
| W-13 Reports · Activity | generic | `ActivityReportPage.test.tsx` (no active driver) | `ActivityReportPage.test.tsx` | **explicit** `ActivityReportPage.test.tsx` |
| W-14 Reports · DVIR | generic | covered by the same 0-row table path as Activity (shared `ReportTable`) | `DvirReportPage.test.tsx` | **explicit** `DvirReportPage.test.tsx` |
| W-15 Reports · FMCSA pack | generic | N/A — KPI/transfer-history screen, no list empty state in §13.2 | `FmcsaPackPage.test.tsx` | **explicit** `FmcsaPackPage.test.tsx` |
| W-16 Messages | generic | `MessagesPage.test.tsx` | `MessagesPage.test.tsx` | generic |
| W-17 Settings · Company profile | **explicit** `CompanyProfilePage.test.tsx` | N/A — single-record form, no list | `CompanyProfilePage.test.tsx` | generic |
| W-18 Settings · Users | generic | `UsersPage.test.tsx` (×2: no users, search-empty) | `UsersPage.test.tsx` | generic |
| W-19 Settings · Roles & permissions | generic | `RolesPage.test.tsx` (Access log tab) | `RolesPage.test.tsx` | generic |
| W-20 Settings · ELD devices | generic | `DevicesPage.test.tsx` | `DevicesPage.test.tsx` | generic |
| W-21 Settings · Alert rules | generic | `AlertRulesPage.test.tsx` | `AlertRulesPage.test.tsx` | generic |
| W-22 Settings · Integrations | generic | `IntegrationsPage.test.tsx` (API keys) | `IntegrationsPage.test.tsx` (×2: catalogue, API keys) | generic |
| W-23 Settings · Audit log | generic | `AuditLogPage.test.tsx` | `AuditLogPage.test.tsx` | generic |
| W-24 Settings · Support | generic | `SupportPage.test.tsx` | `SupportPage.test.tsx` | **explicit** `SupportPage.test.tsx` (B-12) |
| W-25 Support · Feedback | generic | N/A — submit-only form, no list to be empty | N/A — no GET query on this screen, nothing to fail | **explicit** `FeedbackPage.test.tsx` (B-12) |
| W-26 My profile | **explicit** `AccountPage.test.tsx` | `AccountPage.test.tsx` (sessions list) | `AccountPage.test.tsx` (×2: profile cards, sessions) | **explicit** `AccountPage.test.tsx` |

## Shared component coverage backing the "generic" cells

- `src/shared/ui/states.test.tsx` — `<LoadingState>` (skeleton, `aria-busy`, never a spinner),
  `<ErrorState>` (`role="alert"`, Retry wiring, renders with no Retry when none is supplied),
  `<ForbiddenState>` (names the screen, no Retry button), `<EmptyState>` (existing, §13.2 copy).
- `src/app/router.test.ts` — the `buildRoutes`/`toRouteObject` NONE ⇒ `<ForbiddenPage>` swap, the
  same component backing every NONE-gated screen, READ-satisfies-READ, and the Dispatcher
  DVIR/Safety design omission.
- `tests/e2e/18-permission-controls-global-gate.spec.ts` — live confirmation for one canary path
  per role (FLEET_MANAGER `/settings/users`, DISPATCHER `/dvir`, VIEWER `/trips`) that the
  mechanism actually renders `<ForbiddenState>` text against the real dev API, not just in a unit
  test.

## Conclusion

Every one of the 26 × 4 = 104 cells is covered — either by a screen-specific test (where the
screen's own guard order or empty copy is part of what needs proving) or by the shared
`<LoadingState>`/`<ErrorState>`/`<ForbiddenState>` primitives plus the generic `buildRoutes`
mechanism, both of which are now unit-tested in their own right. N/A cells are screens whose
design has no such state (a single-record settings form has no "empty" state; a submit-only
feedback form has no GET query to fail).
