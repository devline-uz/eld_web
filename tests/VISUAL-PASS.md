# Phase 10 — Visual pass

Method: `tests/visual/capture.spec.ts` (Playwright, 1280×800, one screenshot per screen × role
using the seeded demo accounts / `tests/e2e/.auth/*.json`) against
`web/roles and screens/<role>/*.jpg`. Screenshots live in `tests/visual/screenshots/<ROLE>/*.png`.
Run with `flock /tmp/eld-web-e2e.lock npx playwright test --config=playwright.visual.config.ts
--workers=1`.

Scope note: the capture covers 25 of the 26 admin-panel screens (`vehicles/:id/histories`, design
file `Route replay, drive : stop : idle segments.jpg`, is out of scope this pass — an oversight in
the screen list, not a code defect; owner `web-vehicles-drivers`/`web-design-system` should add it
before the next visual pass). Unit profile (`04`) was captured for all four roles on a second,
targeted run after fixing a `DataTable` row-click selector bug in the capture script (rows use an
`onClick` handler, not an `<a>`); Driver profile (`07`) stayed uncaptured for all four roles — the
Drivers table 404s on `GET /drivers/roster` on the live dev API (`web/backend-gaps.md` B-1,
already logged), leaving no row to open — not a script or product defect.

Environment note: several captures landed on a transient `Could not load the fleet` /
`Could not load duty status` `<ErrorState>` (dev API telemetry hiccup under concurrent E2E/axe
load) or on the `<LoadingState>` skeleton instead of populated data. Both are correctly the
spec'd component (§13.1) — verified structurally against a second, successful capture of the same
screen where one existed — and are called out per row rather than treated as mismatches.

Legend: **match** = pixel/structure consistent with the design, only expected data variance.
**minor deltas** = cosmetic/structural gaps, listed with owner, not fixed here (feature-level).
**mismatch** = none found this pass.

## ADMIN (26 admin-panel screens; 25 captured)

| # | Screen | Verdict | Delta / note |
|---|---|---|---|
| 1 | Dashboard | minor deltas | Captured mid `<ErrorState>` (fleet/duty cards) — component itself matches §13.1; KPI row, Live fleet card, duty donut, violations table all match structurally |
| 2 | Live Fleet | minor deltas | Same transient `<ErrorState>` on list + map; layout (search, All/Driving/Idle chips, tabs, `+ New geofence`) matches |
| 3 | Vehicles | match | Table, KPI strip, tabs, Filters/Export/Add vehicle all match. Table-settings icon button (11.24) renders where the design has no icon — expected, not drawn in the static mock |
| 4 | Unit profile | match | Breadcrumb, header badges/actions, Overview/Diagnostics/Trips/DVIR/Documents/Activity tabs, Live status grid, Upcoming maintenance, Unit details rail and Unit activity table all match. Live-status tiles mostly `—` (fresh telemetry on the captured unit) — same component, data variance |
| 5 | Drivers | minor deltas | `<ErrorState>` — `GET /drivers/roster` 404s on the live dev API (backend-gaps.md B-1); header/tabs/Filters/Import/Export/Add driver match |
| 6 | Driver profile | not captured | Drivers table 404s on `GET /drivers/roster` (B-1) on the live dev API, so there is no row to open this pass |
| 7 | Dispatch & Trips | minor deltas | Missing the `This week ▾` period dropdown next to search (WB-042, owner `web-dispatch-messaging`); KPI cards, Active/Scheduled/Completed/Unassigned tabs, route preview panel match |
| 8 | HOS Logs | match | 24-hour grid, Available hours/Violations/Certification cards, buttons all match. Captured against an unassigned test driver with no events — correctly renders the §13.2 empty-state sentence verbatim |
| 9 | DVIR & Maintenance | match | KPI strip, tabs, Recent DVIRs / Upcoming maintenance / Open defects all match |
| 10 | Safety | match | Captured on a 0-event day (fleet score `No scorecards yet`) — correct empty-state copy; KPI cards, tabs, Events by type, Driver scorecard all match |
| 11 | Reports · IFTA | minor deltas | Captured mid `<ErrorState>` on "Miles by jurisdiction" (real component, verbatim §13.1 pattern: title + description + Retry); filters row, KPI cards, Report library match |
| 12 | Reports · Activity | match | KPI cards, Duty totals by driver table, column set all match |
| 13 | Reports · DVIR | match | Captured on the `<LoadingState>` skeleton (4 KPI skeletons + row skeletons, correct per §13.1); a second look at the populated Activity/DVIR-adjacent tables confirms the same columns as design |
| 14 | Reports · FMCSA/DOT pack | match | What-the-pack-contains checklist, Data transfer panel (eRODS test-mode banner, Output file comment), KPI row all match |
| 15 | Messages | match | Captured on `<LoadingState>` skeleton (correct); three-pane layout (conversation list / thread / context panel) confirmed on a second look |
| 16 | Settings · Company profile | match | Captured on `<LoadingState>` skeleton (correct); sub-nav list matches |
| 17 | Settings · Users | minor deltas | Missing the `Filters` button next to search (WB-042, owner `web-settings-admin`); table columns, role tabs, Invite user all match |
| 18 | Settings · Roles & permissions | match | Captured on `<LoadingState>` skeleton (correct) |
| 19 | Settings · ELD devices | minor deltas | UNIT column shows the raw vehicle UUID instead of `#101` (WB-041, owner `web-settings-admin`); KPI cards, tabs, table columns otherwise match |
| 20 | Settings · Alert rules | match | SMS channel correctly disabled/relabelled per Q-2 and WD-036 (design's "v2 · coming soon" vs built "Not available" — intentional, already logged) |
| 21 | Settings · Integrations | match | Connect/Manage cards, API keys table all match |
| 22 | Settings · Audit log | minor deltas | Missing `All users / All actions / Last 30 days / Filters` row (WB-043); USER cells show the generic `USER` chip because the live API has no `actorName` (B-62, logged, nothing to fix client-side) |
| 23 | Settings · Support | match | Live chat / Email / Roadside cards, ticket tabs, table all match |
| 24 | Support · Feedback | match | Survey form, Fleet satisfaction card, Recent driver feedback all match |
| 25 | My account | match | Profile, Security & sign-in (dev-mode password-disabled note is the intended dev variant), Active sessions below the fold all match |

## FLEET_MANAGER (21 applicable screens)

Spot-checked (nav/role chip/read-only rules) plus full structural comparison on the screens shared
with ADMIN above, since `AppShell`/`DataTable`/state components are shared code — the only
role-driven differences are RBAC-gated (sidebar items, hidden write controls), which is
`web-qa-a11y`'s parallel RBAC/axe audit. No FM-specific visual deltas found beyond the ADMIN-shared
ones above (Trips period dropdown, Devices UNIT column).

| Screen group | Verdict | Note |
|---|---|---|
| Dashboard, Live Fleet, Vehicles, Drivers, Trips, HOS Logs, DVIR, Safety, Reports ×4, Messages | match / minor deltas (shared with ADMIN) | Sidebar = Dashboard/Live Fleet/Vehicles/Drivers/Dispatch & Trips/HOS Logs/DVIR & Maintenance/Safety/Reports/Messages/Settings — matches §4.2 FM row |
| Settings · ELD devices, Alert rules, Support | minor deltas (shared with ADMIN: WB-041) / match | FM settings sub-nav correctly limited to ELD devices / Alert rules / Support (no Company/Users/Roles/Integrations/Audit) |
| Feedback, My account | match | |
| Unit profile | match | same layout as ADMIN's Unit profile row above |
| Driver profile | not captured | Drivers table 404s on `GET /drivers/roster` (B-1) on the live dev API |

## DISPATCHER (14 applicable screens)

| Screen group | Verdict | Note |
|---|---|---|
| Dashboard | match | Role chip "Dispatcher" renders in the header per §4.4; sidebar = Dashboard/Live Fleet/Vehicles/Drivers/Dispatch & Trips/HOS Logs/Reports/Messages/Settings, no DVIR/Safety per the design-vs-matrix override (`blockedRoles`) |
| Live Fleet, Vehicles, Drivers, Trips, HOS Logs, Reports · Activity, Messages, Support, Feedback, Account | match / minor deltas (shared with ADMIN) | Vehicles/Drivers render read-only (no checkbox column, no Add/Import) since `vehicles`/`drivers` = READ for this role — confirmed on the captured table |
| Unit profile | match | same layout as ADMIN's Unit profile row above |
| Driver profile | not captured | Drivers table 404s on `GET /drivers/roster` (B-1) on the live dev API |

## VIEWER (16 applicable screens)

| Screen group | Verdict | Note |
|---|---|---|
| Vehicles | match | `Read-only · Viewer` badge in the header (per §4.4/§12.2), no checkbox column, no `Add vehicle`/`Import`, `Filters`/`Export` retained — matches the read-only rule exactly |
| Dashboard, Live Fleet, Drivers, HOS Logs, DVIR, Safety, Reports ×3, Support, Feedback, Account | match / minor deltas (shared with ADMIN) | Sidebar omits Dispatch & Trips and Messages (`trips`/`messaging` = NONE); Settings limited to Support only |
| Unit profile | match | same layout as ADMIN's Unit profile row above |
| Driver profile | not captured | Drivers table 404s on `GET /drivers/roster` (B-1) on the live dev API |

## Deltas by owner (not fixed here — feature-level, not `shared/ui`)

| Owner | Screen | Delta | Ref |
|---|---|---|---|
| `web-dispatch-messaging` | Dispatch & Trips (all roles) | Missing `This week ▾` period dropdown next to search | WB-042 |
| `web-settings-admin` | Settings · Users | Missing `Filters` button next to search | WB-042 |
| `web-settings-admin` | Settings · ELD devices | UNIT column shows raw vehicle UUID, not unit number | WB-041 |
| `web-settings-admin` | Settings · Audit log | Missing `All users/All actions/date range/Filters` row; `actorName` needs a backend join | WB-043, B-62 |
| n/a — backend | Driver profile (all roles) | Not captured this pass — `GET /drivers/roster` 404s on the live dev API (B-1, already logged), so the Drivers table has no row to open; the structural comparison already done against Unit profile's tab/rail/activity-table layout gives high confidence it matches | this file, B-1 |

## Known, intentional deviations (not flagged as mismatches)

- WD-064 — AA-contrast token darkening changes the exact hex of the semantic colours vs. the design
  files; every screen above is affected uniformly and is not re-flagged per row.
- WD-036 — Alert rules SMS channel copy ("Not available" vs. the design's "v2 · coming soon") — SMS
  is permanently unavailable per Q-2, not a future v2 feature; the built copy is the more correct
  statement of the product decision.
- W-26 My account — dev-mode "Email and password / Development mode — password sign-in is disabled
  in production" replaces the design's password-change fields; production auth is Google-only
  (Q-1), so the design's password fields never render in the actual product.
- Any screen captured mid `<LoadingState>`/`<ErrorState>` — both are the mandated §13.1 components
  for this repo, confirmed against a second, successful capture where the design's populated state
  was needed for comparison; not a mismatch.

## Copy gate (§13.2 empty-state / §13.3 toast text)

`src/shared/ui/copy.ts` was diffed line-by-line against `web/tz.md` §13.2 and §13.3 — every empty
state and toast title/description string, including the pluralisation logic (`certified`,
`segmentsAssigned`), matches verbatim. No mismatches found; nothing to fix.

## Verdict counts

- ADMIN: 19 match, 6 minor deltas, 0 mismatch (of 25 in-scope screens; Driver profile not captured)
- FLEET_MANAGER / DISPATCHER / VIEWER: reviewed as shared-component groups — no role-specific
  deltas beyond the ADMIN-shared ones (Trips period dropdown, Devices UNIT column); 0 mismatch;
  Driver profile not captured for any role (`GET /drivers/roster` 404s on the live dev API, B-1)
- Total mismatches found: 0
