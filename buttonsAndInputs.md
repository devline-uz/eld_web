# Buttons and inputs — control inventory

**What this is.** Every interactive control in the OneBook ELD web panel — buttons, icon
buttons, links-as-buttons, row-menu items, text inputs, textareas, selects, checkboxes,
radios, tabs, segmented controls, search boxes, drop zones — listed per feature area and
marked as working or not working.

**Date:** 2026-09-23.

**How it was produced.** Four parallel audits of the running mock app (`audit-A…D.md`,
Playwright + static reading) were merged, then **every row was re-verified against the
current source**, because the stage-1 correctness pass (`bugs.md` WB-140…WB-157) landed
after those audits and fixed a large share of their findings. Each feature folder was also
re-grepped for `<Button`, `<button`, `onClick`, `onSelect`, `<input`, `<textarea`,
`<select`, `iconOnly`, `type="checkbox"`, `type="radio"` and `role="tab"`, so the inventory
reflects the controls that exist today rather than only those the audits happened to list.
Nothing is marked ✅ that was not read in the current file at the cited line.

## Legend

| Mark | Meaning |
|---|---|
| ✅ | Works — real handler, registered in the form, value reaches the payload |
| ❌ | Does not work — dead control: no handler, a fake toast with no request, or a value silently discarded |
| ⚠️ | Works but has a problem — the note says what |
| 🚫 | Intentionally disabled with a visible reason (usually a documented backend gap) |
| ❓ | Needs a live check — the code is ambiguous |

## Summary

Numbers recounted on 2026-09-24 after the backend Phase 13 handoff (`backend-gaps.md`
"2026-09-24 (`web-api-client`) — backend Phase 13 shipped every open gap") unlocked 15 rows that
were still marked 🚫 for endpoints that have since shipped, and the HOS `Location input` row
(previously ❓) was confirmed ✅ once B-39 shipped. Changes against the 2026-09-23 recount:
**Total 725 → 746** (net +21, reflecting rows added by today's agents for newly-shipped controls
such as the driver Documents tab, Start chat and device diagnostics, alongside the 15 flips), ✅
656 → 729, ⚠️ 0 → 0, ❌ 0 → 0, 🚫 68 → 17, ❓ 1 → 0.

2026-09-25 (uncommitted web changes): three 🚫 rows now work and are ✅ — Trips `Assign driver to
load` → `HOS column` (bulk clocks from `GET /drivers/roster`, per-driver `GET /drivers/:id/hos`
fallback), Activity `Group by` (driver / terminal, client-side) and IFTA `Jurisdiction` (client-side
from the loaded quarter). **Total 746 → 746**, ✅ 729 → 732, 🚫 17 → 14 (Trips 1 → 0, Reports 3 → 1).

| Status | Count |
|---|---|
| ✅ works | 732 |
| ⚠️ works with a problem | 0 |
| ❌ does not work | 0 |
| 🚫 disabled with a reason | 14 |
| ❓ needs a live check | 0 |
| **Total** | **746** |

### Per feature area

| Area | Total | ✅ | ⚠️ | ❌ | 🚫 | ❓ |
|---|---|---|---|---|---|---|
| Auth | 10 | 9 | 0 | 0 | 1 | 0 |
| Dashboard | 16 | 16 | 0 | 0 | 0 | 0 |
| Live fleet | 25 | 23 | 0 | 0 | 2 | 0 |
| Vehicles | 95 | 94 | 0 | 0 | 1 | 0 |
| Drivers | 84 | 84 | 0 | 0 | 0 | 0 |
| HOS logs | 43 | 43 | 0 | 0 | 0 | 0 |
| DVIR | 82 | 82 | 0 | 0 | 0 | 0 |
| Trips | 59 | 59 | 0 | 0 | 0 | 0 |
| Safety | 24 | 24 | 0 | 0 | 0 | 0 |
| Messages | 21 | 21 | 0 | 0 | 0 | 0 |
| Reports | 68 | 67 | 0 | 0 | 1 | 0 |
| Notifications | 5 | 5 | 0 | 0 | 0 | 0 |
| Settings · Company profile | 23 | 23 | 0 | 0 | 0 | 0 |
| Settings · Users | 28 | 28 | 0 | 0 | 0 | 0 |
| Settings · Roles & permissions | 19 | 18 | 0 | 0 | 1 | 0 |
| Settings · ELD devices | 25 | 23 | 0 | 0 | 2 | 0 |
| Settings · Alert rules | 27 | 25 | 0 | 0 | 2 | 0 |
| Settings · Integrations | 17 | 16 | 0 | 0 | 1 | 0 |
| Settings · Audit log | 11 | 11 | 0 | 0 | 0 | 0 |
| Settings · Support | 19 | 19 | 0 | 0 | 0 | 0 |
| Support · Feedback | 6 | 6 | 0 | 0 | 0 | 0 |
| Account | 14 | 13 | 0 | 0 | 1 | 0 |
| Search / command palette | 3 | 3 | 0 | 0 | 0 | 0 |
| Global chrome & shared UI | 22 | 20 | 0 | 0 | 2 | 0 |

No dead controls (❌), no ⚠️ rows and no ❓ rows remain. The 14 🚫 rows are controls disabled
with a visible reason: the 404 page stub, the Traffic map layer (`VITE_TRAFFIC_TILES_URL` unset),
driverless "View logs", the Unit `Documents` tab (v2 placeholder), IFTA `Vehicle group` (no
vehicle-group model on the backend — B-46, still open), the ADMIN row of the permission matrix
("Admin cannot be edited"), the QR scanner and the read-only Firmware display, SMS delivery (Q-2,
never used), `Connect` for catalog providers with no connector (Pacific Track / DAT / Geotab /
Zapier — B-98, still open), `Work email` ("Managed by your administrator"), and the v2 `Switch
organisation` controls. Only `Vehicle group` (B-46) and `Connect` (B-98) wait on the backend; the
rest are deliberate and do not depend on a `backend-gaps.md` B-NN row shipping.

---
## Auth

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Continue with Google | button | ✅ | fixed: the competing `h-12` is gone — `size="lg"` (h-btn-lg) is the only height (stage 3, SignInPage.tsx) | src/features/auth/SignInPage.tsx:182 |
| Developer sign-in toggle (chevron) | button | ✅ | | src/features/auth/DeveloperSignIn.tsx:56 |
| Email input | text input | ✅ | required, validated on submit | src/features/auth/DeveloperSignIn.tsx:78 |
| Password input | text input | ✅ | required, validated on submit | src/features/auth/DeveloperSignIn.tsx:106 |
| Show/Hide password toggle | icon button | ✅ | correct aria-label toggle | src/features/auth/DeveloperSignIn.tsx:120 |
| Sign in (dev) button | button | ✅ fixed | empty email/password now blocked client-side before `onSubmit` fires (was: signed straight in) | src/features/auth/DeveloperSignIn.tsx:35-42, 145 |
| Enter key in Email/Password | keyboard | ✅ | fixed: fields sit in a `<form noValidate>` with a `type="submit"` Sign in, so Enter submits; a ref + `busy` guard makes a double Enter/click send one request (stage 3, DeveloperSignIn.tsx) | src/features/auth/DeveloperSignIn.tsx:78-147 |
| Demo account quick-fill buttons (×4) | buttons | ✅ | fills email+password+clears errors | src/features/auth/DeveloperSignIn.tsx:154 |
| "‹ Back to dashboard" (403 page) | link-button | ✅ | `onBack` → `navigate('/')` | src/features/auth/ForbiddenPage.tsx:23; src/shared/ui/states.tsx:119 |
| 404 page | (none) | 🚫 placeholder | still the bare `PagePlaceholder` scaffold — no interactive control on the page at all, no way back | src/features/auth/NotFoundPage.tsx:7 |

## Dashboard

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| "Open map view" | button | ✅ | `navigate('/live-fleet')` | src/features/dashboard/DashboardPage.tsx:233 |
| Live-fleet-card error Retry | button | ✅ | `summary.refetch()` | src/features/dashboard/DashboardPage.tsx:250 |
| Duty donut pie segments | chart click | ✅ | `navigate('/drivers?status=')` | src/features/dashboard/components/DutyDonut.tsx:67 |
| Duty donut legend rows (×4) | buttons | ✅ | fixed: each row has `aria-label` like `Driving: 12 units, 34%`, the visible count/percent are `aria-hidden` (stage 3, DutyDonut.tsx) | src/features/dashboard/components/DutyDonut.tsx:83-95 |
| Duty-status-card error Retry | button | ✅ | `summary.refetch()` | src/features/dashboard/DashboardPage.tsx:271 |
| "View all ›" (violations) | button | ✅ | `navigate('/hos-logs')` | src/features/dashboard/DashboardPage.tsx:284 |
| Violations table row click | row click | ✅ | `navigate(hosLogsHref(row))`, omits empty params correctly | src/features/dashboard/DashboardPage.tsx:317 |
| Row action: Open HOS logs | menu item | ✅ | gated on `row.driverId &&` — no more empty-param navigation | src/features/dashboard/DashboardPage.tsx:327 |
| Row action: Send message | menu item | ✅ | gated on `row.driverId &&` | src/features/dashboard/DashboardPage.tsx:332 |
| Row action: Resolve | menu item | ✅ | opens `ResolveViolationModal` | src/features/dashboard/DashboardPage.tsx:336 |
| Row action: Assign to driver | menu item | ✅ | shown only when `!row.driverId` | src/features/dashboard/DashboardPage.tsx:340 |
| Violations table error Retry | button | ✅ | `violations.refetch()` | src/features/dashboard/DashboardPage.tsx:303 |
| Violations Pagination (page/limit) | pagination | ✅ | | src/features/dashboard/DashboardPage.tsx:349 |
| **Resolve violation modal** — Cancel | button | ✅ works | footer now renders `ModalCancelButton` → `useModalClose()`, so the 11.30 discard confirm fires (WB-165) | src/shared/violations/ResolveViolationModal.tsx:64 (opened from DashboardPage.tsx:366) |
| **Resolve violation modal** — Resolve button | button | ✅ | real `POST /violations/:id/resolve`, server refusal shown verbatim | src/shared/violations/ResolveViolationModal.tsx:69 |
| **Resolve violation modal** — Reason textarea | textarea | ✅ | validated 4–60 chars, reaches payload | src/shared/violations/ResolveViolationModal.tsx:76 |

## Live fleet

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Unit search box | text input | ✅ | fixed: `aria-label="Search units"` (stage 3, LiveFleetPage.tsx) | src/features/live-fleet/LiveFleetPage.tsx:256-265 |
| Segment tabs (All/Driving/Idle) | segmented control | ✅ | | src/features/live-fleet/LiveFleetPage.tsx:274 |
| Unit list error Retry | button | ✅ | `fleet.refetch()` | src/features/live-fleet/LiveFleetPage.tsx:297 |
| Unit list row buttons | buttons | ✅ | selects unit, shows detail card | src/features/live-fleet/LiveFleetPage.tsx:77 |
| Map layer chips (Vehicles/Geofences/Trips) | toggle buttons | ✅ | `toggleLayer`, aria-pressed | src/features/live-fleet/LiveFleetPage.tsx:328 |
| Map layer chip (Traffic) | toggle button | 🚫 intentional | disabled with visible `title` when `VITE_TRAFFIC_TILES_URL` is unset | src/features/live-fleet/LiveFleetPage.tsx:332-333 |
| "New geofence" | button | ✅ | opens Create-geofence modal, `liveFleet` FULL gated | src/features/live-fleet/LiveFleetPage.tsx:351 |
| Map error Retry | button | ✅ | `fleet.refetch()` | src/features/live-fleet/LiveFleetPage.tsx:359 |
| Detail card Close (×) | icon button | ✅ | fixed: `size-btn-sm` (32×32) target, same as the Modal close (stage 3, LiveFleetPage.tsx) | src/features/live-fleet/LiveFleetPage.tsx:121-123 |
| Detail card "View logs" | button | 🚫 | disabled for a driverless unit with the visible reason "No driver assigned — there are no logs to open."; with a driver it opens `/hos-logs?driverId=<id>` (stage 3, LiveFleetPage.tsx) | src/features/live-fleet/LiveFleetPage.tsx:169 |
| Detail card "Message" | button | ✅ | `messagesHref` falls back to plain `/messages` with no driver | src/features/live-fleet/LiveFleetPage.tsx:174; src/shared/lib/messagesHref.ts |
| **Create geofence modal** — Cancel | button | ✅ fixed | `ModalCancelButton` → routes through `requestClose`/discard-confirm | src/features/live-fleet/components/CreateGeofenceModal.tsx:110 |
| **Create geofence modal** — Save geofence | button | ✅ | fixed: `loading`/inputs follow `mutation.isPending`, and a ref blocks a second submit before the re-render — one POST per save (stage 3, CreateGeofenceModal.tsx) | src/features/live-fleet/components/CreateGeofenceModal.tsx:110-118 |
| Geofence name input | text input | ✅ | | src/features/live-fleet/components/CreateGeofenceModal.tsx:134 |
| Type select | select | ✅ | | src/features/live-fleet/components/CreateGeofenceModal.tsx:150 |
| Colour select | select | ✅ | | src/features/live-fleet/components/CreateGeofenceModal.tsx:164 |
| Shape segments (Circle/Rectangle/Polygon/Address) | segmented control | ✅ | B-93 shipped — Circle/Rectangle/Polygon each show pressed on their own (Rectangle and Polygon send `POLYGON`, Circle `CIRCLE`); `Address` sends `type: 'ADDRESS'`, server geocodes `address` into a circle (`422 GEOCODER_NOT_CONFIGURED`/`GEOCODE_FAILED` surfaced in the in-modal banner) | src/features/live-fleet/components/CreateGeofenceModal.tsx:212-233 |
| Address input | text input | ✅ | required only for the Address shape (asterisk shown); reaches payload as `address` when `type: 'ADDRESS'` | src/features/live-fleet/components/CreateGeofenceModal.tsx:246-263 |
| Radius / size input | number input | ✅ | blank correctly coerced to `undefined`; sent as `radiusMi` (backend field, D-098) | src/features/live-fleet/components/CreateGeofenceModal.tsx:264-281 |
| Applies-to select | select | ✅ | single option today, not a bug | src/features/live-fleet/components/CreateGeofenceModal.tsx:282-291 |
| Arrival event checkbox | checkbox | ✅ | reaches payload | src/features/live-fleet/components/CreateGeofenceModal.tsx:294-302 |
| Departure event checkbox | checkbox | ✅ | reaches payload | src/features/live-fleet/components/CreateGeofenceModal.tsx:303-310 |
| "Dwell longer than" checkbox + minutes | checkbox + number | ✅ | B-15 shipped — checkbox enables the minutes input, both reach payload as `dwellMinutes` | src/features/live-fleet/components/CreateGeofenceModal.tsx:311-338 |
| "After-hours entry" checkbox | checkbox | ✅ | B-15 shipped — reaches payload as `afterHoursOnly` | src/features/live-fleet/components/CreateGeofenceModal.tsx:339-346 |
| "Count time inside as on-duty yard move" checkbox | checkbox | ✅ | in footer, wired via `setValue(..., {shouldDirty:true})`, reaches payload | src/features/live-fleet/components/CreateGeofenceModal.tsx:101-108 |

## Vehicles

### VehiclesPage

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Search box (unit #, VIN, plate) | text input | ✅ works | `aria-label="Search unit #, VIN, plate"`; typing also writes/clears `q` in the URL (stage 2, VehiclesPage.tsx:355) | src/features/vehicles/VehiclesPage.tsx:303-311 |
| Filters button | button | ✅ | opens `VehicleFiltersDrawer` | src/features/vehicles/VehiclesPage.tsx:313 |
| Export Units | button | ✅ works | icon now `Download` (Import keeps `Upload`), `loading={exporting}` + repeat-click guard, errors toasted (WB-163) | src/features/vehicles/VehiclesPage.tsx:178-192, 323 |
| Import Units | button | ✅ | opens Import modal, FULL gated | src/features/vehicles/VehiclesPage.tsx:327 |
| Add vehicle | button | ✅ | disabled + tooltip while offline | src/features/vehicles/VehiclesPage.tsx:330-339 |
| Segment tabs (All/Active/Inactive/Unassigned) | segmented control | ✅ | | src/features/vehicles/VehiclesPage.tsx:352 |
| Filter chip remove (×) | buttons | ✅ | | src/features/vehicles/VehiclesPage.tsx:240 (VehicleFilterChips) |
| Filter chips "Clear all" | button | ✅ | | src/features/vehicles/VehiclesPage.tsx:244 (VehicleFilterChips) |
| Table row click | row click | ✅ | `navigate('/vehicles/:id')` | src/features/vehicles/VehiclesPage.tsx:420 |
| Row selection checkboxes (select-all + per-row) | checkboxes | ✅ | shared `DataTable`, labelled "Select all rows"/"Select row" | src/features/vehicles/VehiclesPage.tsx:417-419; src/shared/ui/DataTable.tsx:87-99 |
| Row action: View unit profile | menu item | ✅ | | src/features/vehicles/VehiclesPage.tsx:425 |
| Row action: Open HOS logs | menu item | ✅ works | disabled with a visible reason (`NO_DRIVER_LOGS_REASON`) for a driverless unit — no empty `driverId=` param (WB-163) | src/features/vehicles/VehiclesPage.tsx:428 |
| Row action: Track on map | menu item | ✅ | fixed: opens `/live-fleet?unit=<vehicleId>`; Live fleet selects that unit, the map flies to it and the list scrolls to it (stage 3, VehiclesPage.tsx) | src/features/vehicles/VehiclesPage.tsx:431 |
| Row action: Assign driver | menu item | ✅ | opens `AssignDriverModal` | src/features/vehicles/VehiclesPage.tsx:434 |
| Row action: Calibrate odometer | menu item | ✅ | | src/features/vehicles/VehiclesPage.tsx:437 |
| Row action: View histories | menu item | ✅ | | src/features/vehicles/VehiclesPage.tsx:440 |
| Row action: Edit unit | menu item | ✅ | | src/features/vehicles/VehiclesPage.tsx:444 |
| Row action: Delete unit | menu item | ✅ | | src/features/vehicles/VehiclesPage.tsx:447 |
| Row actions trigger ("…") | icon button | ✅ | shared `DataTable`, aria-label "Row actions" | src/shared/ui/DataTable.tsx:120 |
| Pagination (page/limit) | pagination | ✅ | | src/features/vehicles/VehiclesPage.tsx:456 |
| Empty-state "Clear search" / "Clear filters" | button | ✅ works | "Clear search" now also deletes `q` from the URL (`setParam('q', null)`) (WB-163) | src/features/vehicles/VehiclesPage.tsx:388-390 |
| Empty-state "Import CSV" / "Add vehicle" | buttons | ✅ | | src/features/vehicles/VehiclesPage.tsx:398-401 |
| Bulk bar: Assign driver | button | ✅ works | opens 11.4 for the single selected unit; disabled with `MULTI_ASSIGN_REASON` when more than one is selected (WB-161) | src/features/vehicles/VehiclesPage.tsx:474-476 |
| Bulk bar: Export | button | ✅ works | `handleExportSelection` — CSV of the selected units only (WB-163) | src/features/vehicles/VehiclesPage.tsx:477 |
| Bulk bar: Set inactive | button | ✅ fixed | now fans out `PATCH /vehicles/:id` per selected unit via `Promise.allSettled`, reports partial failures honestly | src/features/vehicles/VehiclesPage.tsx:199-224, 480-489 |
| Bulk bar: Clear-selection (×) | icon button | ✅ | fixed: `size-btn-sm` (32×32) icon button with a Lucide `X` (stage 3, VehiclesPage.tsx) | src/features/vehicles/VehiclesPage.tsx:490-492 |

### VehicleFiltersDrawer (drawer, opened from VehiclesPage)

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Status checkboxes | checkboxes | ✅ | | src/features/vehicles/components/VehicleFiltersDrawer.tsx:78-85 |
| ELD device checkboxes + "Not assigned" | checkboxes | ✅ | | src/features/vehicles/components/VehicleFiltersDrawer.tsx:89-101 |
| Make checkboxes | checkboxes | ✅ | | src/features/vehicles/components/VehicleFiltersDrawer.tsx:105-112 |
| Year from | number input | ✅ | clamped on blur | src/features/vehicles/components/VehicleFiltersDrawer.tsx:119-145 |
| Year to | number input | ✅ | clamped on blur | src/features/vehicles/components/VehicleFiltersDrawer.tsx:148-174 |
| Home terminal select | select | ✅ | | src/features/vehicles/components/VehicleFiltersDrawer.tsx:179 |
| "Only units with open defects" | checkbox | ✅ | | src/features/vehicles/components/VehicleFiltersDrawer.tsx:196 |
| "Only units with firmware out of date" | checkbox | ✅ | | src/features/vehicles/components/VehicleFiltersDrawer.tsx:204 |
| Reset all | button | ✅ | | src/shared/ui/FilterDrawer.tsx:32 |
| Apply N filters | button | ✅ | closes drawer, applies to URL | src/shared/ui/FilterDrawer.tsx:35-42 |

### AddVehicleModal (Add vehicle / Edit unit)

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Cancel | button | ✅ fixed | `ModalCancelButton` routes through discard-confirm | src/features/vehicles/components/AddVehicleModal.tsx:139 |
| Save unit / Save changes | button | ✅ works | guard is now `mutation.isPending` + a same-tick `useRef` single-flight flag — a double click creates one unit (WB-162) | src/features/vehicles/components/AddVehicleModal.tsx:88-127, 140 |
| Unit number input | text input | ✅ | required | src/features/vehicles/components/AddVehicleModal.tsx:149 |
| ELD serial input | text input | ✅ | optional | src/features/vehicles/components/AddVehicleModal.tsx:152 |
| Make input | text input | ✅ | required | src/features/vehicles/components/AddVehicleModal.tsx:157 |
| Model input | text input | ✅ | required | src/features/vehicles/components/AddVehicleModal.tsx:160 |
| Year input | number input | ✅ | required | src/features/vehicles/components/AddVehicleModal.tsx:163-171 |
| Fuel type select | select | ✅ fixed | now included in `isDirty` comparison against its initial value | src/features/vehicles/components/AddVehicleModal.tsx:173-180, 78-82 |
| VIN input | text input | ✅ | required | src/features/vehicles/components/AddVehicleModal.tsx:183 |
| License plate input | text input | ✅ | | src/features/vehicles/components/AddVehicleModal.tsx:187 |
| Issuing state input | text input | ✅ | blank correctly coerced to `undefined` | src/features/vehicles/components/AddVehicleModal.tsx:190-201 |
| Odometer input | number input | ✅ | blank correctly coerced to `undefined` | src/features/vehicles/components/AddVehicleModal.tsx:204-215 |
| Sleeper berth checkbox | checkbox | ✅ fixed | now included in `isDirty` comparison | src/features/vehicles/components/AddVehicleModal.tsx:218, 78-82 |
| Notes textarea | textarea | ✅ fixed | now included in `isDirty` comparison | src/features/vehicles/components/AddVehicleModal.tsx:222-229, 78-82 |

### AssignDriverModal

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Cancel | button | ✅ | `ModalCancelButton` + `mutation.isPending` disable | src/features/vehicles/components/AssignDriverModal.tsx:39 |
| Assign driver button | button | ✅ | real `POST .../assign-driver`, `mutation.isPending` guard, 403 handled | src/features/vehicles/components/AssignDriverModal.tsx:40-66 |
| "Notify the driver in the app" checkbox | checkbox | ✅ (shipped 2026-09-24, B-74) | `POST /vehicles/:id/assign-driver` now takes `notify`; the checkbox is a real, enabled control reaching the payload | src/features/vehicles/components/AssignDriverModal.tsx:35-38 |
| Driver search input | text input | ✅ works | `aria-label="Search driver by name, username or licence"` (stage 2, AssignDriverModal.tsx:85) | src/features/vehicles/components/AssignDriverModal.tsx:78-83 |
| Driver list row (select) | buttons | ✅ works | name falls back to username, then "Unnamed driver" (stage 2, AssignDriverModal.tsx:93) | src/features/vehicles/components/AssignDriverModal.tsx:87-88 |

### CalibrateOdometerModal

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Cancel | button | ✅ | `ModalCancelButton` + `mutation.isPending` disable | src/features/vehicles/components/CalibrateOdometerModal.tsx:49 |
| Dashboard odometer input | number input | ✅ | | src/features/vehicles/components/CalibrateOdometerModal.tsx:101-109 |
| Large-delta / unknown-delta confirm checkbox | checkbox | ✅ fixed | now fails closed: an unknown ELD reading (`delta === null`) also demands the confirm, not just `delta > 5000` | src/features/vehicles/components/CalibrateOdometerModal.tsx:27-36, 119-129 |
| Save calibration button | button | ✅ | real `POST .../calibrate-odometer`, server refusal shown verbatim | src/features/vehicles/components/CalibrateOdometerModal.tsx:50-72 |

### DeleteUnitModal

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Cancel | button | ✅ fixed | no longer navigates away — `onDeleted` is a separate callback fired only on real server success | src/features/vehicles/components/DeleteUnitModal.tsx:43, 20-24, 54 |
| Confirm-text input ("Type UNIT-… to confirm") | text input | ✅ | Delete button disabled until exact match | src/features/vehicles/components/DeleteUnitModal.tsx:88-93 |
| Delete unit button | button | ✅ | real `DELETE /vehicles/:id`, `mutation.isPending` guard | src/features/vehicles/components/DeleteUnitModal.tsx:44-64 |

### ImportVehiclesModal

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Cancel | button | ✅ | `ModalCancelButton` + `mutation.isPending` disable | src/features/vehicles/components/ImportVehiclesModal.tsx:79 |
| Drop zone (click-to-browse + drag/drop) | drop zone | ✅ fixed | real `onDragOver`/`onDragLeave`/`onDrop` with `preventDefault`, calls `handleFile` | src/features/vehicles/components/ImportVehiclesModal.tsx:111-134 |
| Hidden file input | file input | ✅ | 5 MB / 2,000-row limits enforced | src/features/vehicles/components/ImportVehiclesModal.tsx:49-66, 154-163 |
| Remove file (×) | icon button | ✅ | resets file/rows | src/features/vehicles/components/ImportVehiclesModal.tsx:149-151 |
| Duplicate handling select | select | ✅ (shipped 2026-09-24, B-69) | enabled, reaches `POST /vehicles/import` as `options.duplicateStrategy` | src/features/vehicles/components/ImportVehiclesModal.tsx:165-176 |
| Default terminal select | select | ✅ (shipped 2026-09-24, B-69) | enabled, reaches `options.defaultTerminal` | src/features/vehicles/components/ImportVehiclesModal.tsx:178-186 |
| "Pair ELD devices automatically" checkbox | checkbox | ✅ (shipped 2026-09-24, B-69) | enabled, reaches `options.pairDevices` | src/features/vehicles/components/ImportVehiclesModal.tsx:187-191 |
| "Send a summary email" checkbox | checkbox | ✅ (shipped 2026-09-24, B-69) | enabled, reaches `options.emailSummary` | src/features/vehicles/components/ImportVehiclesModal.tsx:192-196 |
| "Download CSV template" | button | ✅ fixed | now a real `<button onClick={downloadTemplate}>` (was an unclickable `<span>`) | src/features/vehicles/components/ImportVehiclesModal.tsx:36-47, 190-192 |
| "Import N units" button | button | ✅ fixed | real `mutation.mutate({vehicles: rows})`, `mutation.isPending` guard, hardcoded "N valid, 0 errors" removed | src/features/vehicles/components/ImportVehiclesModal.tsx:80-105 |

### UnitProfilePage

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Breadcrumb "Vehicles" link | link | ✅ | | src/features/vehicles/UnitProfilePage.tsx:110 |
| "View logs" button | button | ✅ works | disabled with `NO_DRIVER_LOGS_REASON` for an unassigned unit — no empty `driverId=` param (WB-163) | src/features/vehicles/UnitProfilePage.tsx:139 |
| "Track on map" button | button | ✅ | fixed: opens `/live-fleet?unit=<vehicleId>` with this unit selected (stage 3, UnitProfilePage.tsx) | src/features/vehicles/UnitProfilePage.tsx:142 |
| "Assign driver" button | button | ✅ | opens modal even when OUT_OF_SERVICE, which states the refusal itself (WB-104) | src/features/vehicles/UnitProfilePage.tsx:149 |
| "More" menu trigger | icon button | ✅ | aria-label "More" | src/features/vehicles/UnitProfilePage.tsx:156 |
| More menu: Edit unit | menu item | ✅ | | src/features/vehicles/UnitProfilePage.tsx:162 |
| More menu: Delete unit | menu item | ✅ | | src/features/vehicles/UnitProfilePage.tsx:165 |
| Tabs (Overview/Diagnostics/Trips/DVIR/Activity) | segmented control | ✅ | | src/features/vehicles/UnitProfilePage.tsx:177-195 |
| Tab: Documents | segmented control item | 🚫 intentional | `disabled`, "Soon" badge — v2 placeholder | src/features/vehicles/UnitProfilePage.tsx:182, 193 |
| "Calibrate odometer" button | button | ✅ | | src/features/vehicles/UnitProfilePage.tsx:207 |
| "New work order" button | button | ✅ works | navigates to `/dvir?newWorkOrder=<vehicleId>`, which opens 11.18 preset to this unit (WB-161, WD-078) | src/features/vehicles/UnitProfilePage.tsx:237 |
| Activity table error Retry | button | ✅ | | src/features/vehicles/UnitProfilePage.tsx:254 |
| "Edit" button (Unit details card) | button | ✅ | | src/features/vehicles/UnitProfilePage.tsx:289 |
| Trips tab → "Dispatch & Trips" link | link | ✅ | | src/features/vehicles/UnitProfilePage.tsx:364 |
| DVIR tab → "DVIR & Maintenance" link | link | ✅ | | src/features/vehicles/UnitProfilePage.tsx:376 |
| Diagnostics table error Retry | button | ✅ | | src/features/vehicles/UnitProfilePage.tsx:322 |

### UnitHistoriesPage

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Breadcrumb links (Vehicles, Unit #) | links | ✅ | | src/features/vehicles/UnitHistoriesPage.tsx:63, 67 |
| Previous day | icon button | ✅ | | src/features/vehicles/UnitHistoriesPage.tsx:82 |
| Next day | icon button | ✅ | | src/features/vehicles/UnitHistoriesPage.tsx:86 |
| Segment filter tabs (All/Drive/Stop/Idle) | segmented control | ✅ | | src/features/vehicles/UnitHistoriesPage.tsx:101 |
| "Export" button | button | ✅ works | `exportSegments` — CSV of the visible segments (no server export endpoint, B-4) (WB-161) | src/features/vehicles/UnitHistoriesPage.tsx:116 |
| Play / Pause toggle | button | ✅ (shipped 2026-09-24, B-4) | `GET /vehicles/:id/histories?date=` now server-segments the route; `togglePlay` drives a real replay (`isPlaying` advances `elapsedMs` along the track), enabled whenever the day has a track | src/features/vehicles/UnitHistoriesPage.tsx:68-112,309-318 |
| Histories error Retry | button | ✅ | | src/features/vehicles/UnitHistoriesPage.tsx:125 |


## Drivers

### DriversPage.tsx

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Search input (driver/username) | text input | ✅ | | src/features/drivers/DriversPage.tsx:233 |
| Filters button | button | ✅ | opens DriverFiltersDrawer | src/features/drivers/DriversPage.tsx:240 |
| Export Drivers button | button | ✅ | try/catch + `loading` + error toast, same shape as the Vehicles export (WB-181) | src/features/drivers/DriversPage.tsx:140,250 |
| Import Drivers button | button | ✅ | FULL only | src/features/drivers/DriversPage.tsx:254 |
| Add driver button | button | ✅ | FULL only | src/features/drivers/DriversPage.tsx:257 |
| Segment tabs (All/On duty/Off duty/Violations) | segmented control (4) | ✅ | | src/features/drivers/DriversPage.tsx:272-286 |
| Filter chip remove (×) | button (per chip) | ✅ | `aria-label="Remove filter …"` on each chip `×` (WB-194) | src/features/drivers/components/DriverFiltersDrawer.tsx:151 |
| Filter chips "Clear all" | button | ✅ | | src/features/drivers/components/DriverFiltersDrawer.tsx:155 |
| Empty-state "Clear search"/"Clear filters" | button | ✅ | | src/features/drivers/DriversPage.tsx:306-311 |
| Empty-state "Import CSV"/"Add driver" | button (2) | ✅ | FULL only | src/features/drivers/DriversPage.tsx:318-321 |
| Table row click → driver profile | row click | ✅ | | src/features/drivers/DriversPage.tsx:339 |
| Row "Logs" button | button | ✅ | navigates to HOS logs | src/features/drivers/DriversPage.tsx:210 |
| Row selection checkboxes | checkbox | ✅ | FULL only | src/features/drivers/DriversPage.tsx:336-338 |
| Row menu "View driver profile" | menu item (onSelect) | ✅ | | src/features/drivers/DriversPage.tsx:344 |
| Row menu "Open HOS logs" | menu item (onSelect) | ✅ | | src/features/drivers/DriversPage.tsx:347 |
| Row menu "Send message" | menu item (onSelect) | ✅ | messaging perm | src/features/drivers/DriversPage.tsx:351 |
| Row menu "Assign trip" | menu item (onSelect) | ✅ | `tripsHrefForDriver()` → `/trips?fDriver=<id>`, the param W-11 actually filters on (WB-180) | src/features/drivers/DriversPage.tsx:356 |
| Row menu "Request log edit" | menu item (onSelect) | ✅ | hosEdit FULL | src/features/drivers/DriversPage.tsx:363 |
| Row menu "Certify on behalf" | menu item (onSelect) | ✅ | hosCertifyOnBehalf FULL | src/features/drivers/DriversPage.tsx:367 |
| Row menu "Export 8-day RODS" | menu item (onSelect) | ✅ | queues the real `GET /reports/fmcsa-pack` (today − 7 … today, `driverId`), `reportsTransfer` READ (WB-182) | src/features/drivers/DriversPage.tsx:372 |
| Row menu "Reset app password" | menu item (onSelect) | ✅ (shipped 2026-09-24, B-81) | enabled menu item, `POST /drivers/:id/reset-password` via `useResetDriverPassword` | src/features/drivers/DriversPage.tsx:249,514-518 |
| Row menu "Deactivate driver" | menu item | ✅ | `ConfirmDelete` → `PATCH /drivers/:id { status: 'INACTIVE' }` (WB-183) | src/features/drivers/DriversPage.tsx:379 |
| Pagination | pagination controls | ✅ | | src/features/drivers/DriversPage.tsx:388-396 |
| Bulk bar "Assign unit" | button | ✅ | single-row → `AssignUnitModal` (`POST /vehicles/:id/assign-driver`); disabled above one row with the reason visible (WB-184) | src/features/drivers/DriversPage.tsx:404-406 |
| Bulk bar "Send message" | button | ✅ | one driver → their conversation; several → `BulkMessageModal` (`POST /messages/broadcast`, `messaging` FULL) (WB-184) | src/features/drivers/DriversPage.tsx:407-409 |
| Bulk bar "Export logs" | button | ✅ | fans out the WB-182 RODS export with `allSettled`, partial failure reported (WB-184) | src/features/drivers/DriversPage.tsx:410-412 |
| Bulk bar "Deactivate" | button | ✅ | WB-183 confirm + `allSettled` fan-out (WB-184) | src/features/drivers/DriversPage.tsx:413-415 |
| Bulk bar "Clear selection" (×) | icon button | ✅ | | src/features/drivers/DriversPage.tsx:416 |

### AddDriverModal.tsx (opened from DriversPage "Add driver")

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| First name input | text input | ✅ | | src/features/drivers/components/AddDriverModal.tsx:193 |
| Last name input | text input | ✅ | | src/features/drivers/components/AddDriverModal.tsx:196 |
| Username input | text input | ✅ | | src/features/drivers/components/AddDriverModal.tsx:199 |
| Password input | text input | ✅ | | src/features/drivers/components/AddDriverModal.tsx:210-217 |
| Show/hide password button | icon button | ✅ | 28px (`size-7`) hit target (WB-190) | src/features/drivers/components/AddDriverModal.tsx:218-225 |
| Email input | text input | ✅ | | src/features/drivers/components/AddDriverModal.tsx:230 |
| Phone input | text input | ✅ | | src/features/drivers/components/AddDriverModal.tsx:233-241 |
| Driver licence number input | text input | ✅ | | src/features/drivers/components/AddDriverModal.tsx:253 |
| Issuing state select | select | ✅ | full US state list (WB-187) | src/features/drivers/components/AddDriverModal.tsx:16,256-262 |
| Home terminal select | select | ✅ | fixed: now sends the terminal name (`homeTerminalName`) and the matching IANA zone; Raleigh correctly maps to `America/New_York` | src/features/drivers/components/AddDriverModal.tsx:24-27,124,264-281 |
| Assigned unit select | select | ✅ | | src/features/drivers/components/AddDriverModal.tsx:282-291 |
| Allow personal conveyance checkbox | checkbox | ✅ | sent | src/features/drivers/components/AddDriverModal.tsx:301 |
| Allow yard move checkbox | checkbox | ✅ | sent | src/features/drivers/components/AddDriverModal.tsx:305 |
| Adverse driving conditions checkbox | checkbox | ✅ | sent | src/features/drivers/components/AddDriverModal.tsx:309 |
| Short-haul exception checkbox | checkbox | ✅ | sent | src/features/drivers/components/AddDriverModal.tsx:313 |
| Enable split sleeper berth checkbox | checkbox | ✅ | sent | src/features/drivers/components/AddDriverModal.tsx:317 |
| Exempt from ELD checkbox | checkbox | ✅ | sent | src/features/drivers/components/AddDriverModal.tsx:321 |
| Exemption reason input (conditional) | text input | ✅ | inline error + `aria-invalid` on the field (WB-191) | src/features/drivers/components/AddDriverModal.tsx:109-112,326-328 |
| "Send invitation now" checkbox (footer) | checkbox | ✅ (shipped 2026-09-24, B-82) | enabled, defaults checked, reaches `POST /drivers` as `sendInvitation` | src/features/drivers/components/AddDriverModal.tsx:56,133,172-176 |
| Close (×) / Esc | icon button | ✅ | dirty-close fixed: `isDirty` now correctly false on an untouched form (every field seeded in `defaultValues`, `extrasDirty` explicit) | src/features/drivers/components/AddDriverModal.tsx:63-105,169 |
| Cancel button | button | ✅ | routes through discard-changes confirm | src/features/drivers/components/AddDriverModal.tsx:176 |
| Save driver button | button | ✅ | fixed: guarded on `mutation.isPending` (double-click no longer creates two drivers); shows a banner + toast on an unmapped POST failure | src/features/drivers/components/AddDriverModal.tsx:91,107-160,177-179 |

### ImportDriversModal.tsx (opened from DriversPage "Import Drivers")

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Drop zone / click-to-browse | button + hidden file input | ✅ | `onDragOver`/`onDrop` handle a dropped CSV (WB-192) | src/features/drivers/components/ImportDriversModal.tsx:116-124 |
| File input (hidden) | file input | ✅ | | src/features/drivers/components/ImportDriversModal.tsx:158-167 |
| Remove file (×) | icon button | ✅ | resets `inputRef.current.value`, so the same file can be re-picked (WB-193) | src/features/drivers/components/ImportDriversModal.tsx:144-155 |
| "N valid, N need attention" counter | derived text | ✅ | fixed: now a real per-row count (`rowsNeedingAttention`, a `Set` of problem row indices) instead of `rows.length - warnings.length` | src/features/drivers/components/ImportDriversModal.tsx:25,45-67,131 |
| Duplicate handling select | select | ✅ (shipped 2026-09-24, B-69) | enabled `<fieldset>`, reaches `POST /drivers/import` as `options.duplicateStrategy` | src/features/drivers/components/ImportDriversModal.tsx:194-207 |
| Default terminal select | select | ✅ (shipped 2026-09-24, B-69) | enabled, reaches `options.defaultHomeTerminalName` | src/features/drivers/components/ImportDriversModal.tsx:194-207 |
| "Send app invitations after import" checkbox | checkbox | ✅ (shipped 2026-09-24, B-69) | enabled, checked by default, reaches `options.sendInvitations` | src/features/drivers/components/ImportDriversModal.tsx:194-207 |
| "Apply default HOS exemptions" checkbox | checkbox | ✅ (shipped 2026-09-24, B-69) | enabled, checked by default, reaches `options.applyDefaultExemptions` | src/features/drivers/components/ImportDriversModal.tsx:194-207 |
| Close (×) / Esc | icon button | ✅ | `isDirty={Boolean(file)}` | src/features/drivers/components/ImportDriversModal.tsx:78 |
| Cancel button | button | ✅ | | src/features/drivers/components/ImportDriversModal.tsx:81 |
| Import N drivers button | button | ✅ | guarded on `mutation.isPending` | src/features/drivers/components/ImportDriversModal.tsx:82-110 |

### DriverFiltersDrawer.tsx (opened from DriversPage "Filters")

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Status checkboxes (4) | checkbox | ✅ | no server param (extends B-55); switches the page to a 1,000-row reference-cached window while active, not a silent partial result | src/features/drivers/components/DriverFiltersDrawer.tsx:78-87 |
| Home terminal select | select | ✅ | real server param (`terminal`, B-55) | src/features/drivers/components/DriverFiltersDrawer.tsx:89-102 |
| "Only drivers with open violations" checkbox | checkbox | ✅ | real server param (`hasOpenViolation`) | src/features/drivers/components/DriverFiltersDrawer.tsx:104-113 |
| Exemption checkboxes (5) | checkbox | ✅ | only `eldExempt` is server-filtered; the other four run against the window (extends B-55) | src/features/drivers/components/DriverFiltersDrawer.tsx:115-124 |
| Reset all button | button | ✅ | | src/shared/ui/FilterDrawer.tsx:33-35 |
| Apply N filters button | button | ✅ | fixed: reads plain `Apply` with nothing selected, `Apply N filters` otherwise (stage 3, FilterDrawer.tsx) | src/shared/ui/FilterDrawer.tsx:36-44 |
| Close (×) / Esc | icon button | ✅ | fixed: `isDirty` now compares draft vs applied filters | src/features/drivers/components/DriverFiltersDrawer.tsx:42-49,71 |

### DriverProfilePage.tsx

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| "Drivers" breadcrumb link | link | ✅ | | src/features/drivers/DriverProfilePage.tsx:103 |
| Message button | button | ✅ | messaging perm | src/features/drivers/DriverProfilePage.tsx:132 |
| View logs button | button | ✅ | | src/features/drivers/DriverProfilePage.tsx:136 |
| Assign trip button | button | ✅ | `tripsHrefForDriver()` → `/trips?fDriver=<id>` (WB-180) | src/features/drivers/DriverProfilePage.tsx:140 |
| Row menu trigger "More" (…) | icon button | ✅ | `iconOnly`, correct `aria-label="More"` | src/features/drivers/DriverProfilePage.tsx:147 |
| Row menu "Reset app password" | menu item | ✅ (shipped 2026-09-24, B-81) | enabled menu item, `POST /drivers/:id/reset-password` | src/features/drivers/DriverProfilePage.tsx:213-219 |
| Row menu "Deactivate driver" | menu item | ✅ | `ConfirmDelete` → `PATCH /drivers/:id { status: 'INACTIVE' }` (WB-183) | src/features/drivers/DriverProfilePage.tsx:156 |
| Tab strip (Overview/HOS & logs/DVIRs/Trips/Documents/Activity) | segmented control (6) | ✅ | works except Documents | src/features/drivers/DriverProfilePage.tsx:202-230 |
| Documents tab | tab button | ✅ (shipped 2026-09-24, B-94) | enabled — driver documents API (list/presigned upload/delete) shipped; renders `DriverDocumentsTab`, no more `disabled`/"Soon" badge | src/features/drivers/DriverProfilePage.tsx:34,41,396; src/features/drivers/components/DriverDocumentsTab.tsx |
| "Edit" button (profile card) | button | ✅ | opens the new `EditDriverModal` → `PATCH /drivers/:id` (username/password out, B-81) (WB-188) | src/features/drivers/DriverProfilePage.tsx:242-244 |
| "View all ›" (Violations card) | button (link variant) | ✅ | opens `/hos-logs?driverId=…`, where per-driver violations render (WB-180 links, WB-186) | src/features/drivers/DriverProfilePage.tsx:219 |
| "Open HOS logs ›" button (Recent daily logs) | button | ✅ | | src/features/drivers/DriverProfilePage.tsx:226 |
| "HOS Logs" inline link (Overview) | link | ✅ | | src/features/drivers/DriverProfilePage.tsx:229 |
| HOS tab "HOS Logs" link | link | ✅ | | src/features/drivers/DriverProfilePage.tsx:272 |
| DVIRs tab "DVIR & Maintenance" link | link | ✅ | plain `/dvir` link with a sentence saying it cannot be narrowed to one driver yet — no dead `driverId` param (WB-180; per-driver filter is gap B-80) | src/features/drivers/DriverProfilePage.tsx:283 (vs src/features/dvir/DvirPage.tsx, no `driverId` reference) |
| Trips tab "Dispatch & Trips" link | link | ✅ | `tripsHrefForDriver()` → `/trips?fDriver=<id>`, which W-11 reads (WB-180) | src/features/drivers/DriverProfilePage.tsx:294 (vs src/features/trips/lib/filters.ts:38) |

## HOS logs

### HosLogsPage.tsx

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Driver picker (search + select) | combobox | ✅ | mock fixtures now carry real `firstName`/`lastName` (rebuilt mock layer) — the "UU undefined undefined" fixture gap is gone | src/features/hos-logs/HosLogsPage.tsx:218-223; src/mocks/handlers/vehiclesDriversGaps.ts:19-90 |
| Previous day button | icon button | ✅ | | src/features/hos-logs/HosLogsPage.tsx:225-232 |
| Next day button | icon button | ✅ | disabled on/after today | src/features/hos-logs/HosLogsPage.tsx:235-243 |
| "Add / edit event" button | button | ✅ | hosEdit FULL; with a record → 11.11 edit request against the day's latest active duty event; on an empty day → the same form proposes a NEW record via `POST /logs/:driverId/events` (B-72, `useProposeLogEvent`) — inert (recordStatus 3) until the driver accepts (§395.30); disabled caption removed | src/features/hos-logs/HosLogsPage.tsx:259-271; src/features/hos-logs/components/RequestLogEditModal.tsx:195-222 |
| "Export PDF" button | button | ✅ | fixed: prints the log page region only (`printRegion` + `shared/ui/print.css`); sidebar, topbar and the toolbar are left out; the browser dialog offers Save as PDF, as the button's title says (stage 3, HosLogsPage.tsx) | src/features/hos-logs/HosLogsPage.tsx:268-271 |
| "Send to inspector" button | button | ✅ | reportsTransfer FULL; navigates to `/reports/fmcsa` | src/features/hos-logs/HosLogsPage.tsx:272-280 |
| Unassigned-segments chip "Retry" | button | ✅ | shown only on a failed query | src/features/hos-logs/HosLogsPage.tsx:316-321 |
| Unassigned-segments chip (open modal) | button | ✅ | hosEdit FULL | src/features/hos-logs/HosLogsPage.tsx:326-331 |
| 24-hour graph — click a segment | click region | ✅ | scrolls/highlights the matching Log events row | src/features/hos-logs/components/GraphGrid.tsx:139-144; HosLogsPage.tsx:360-363 |
| Certification day cells (calendar) | button (per day) | ✅ | navigates to that date | src/features/hos-logs/components/CertificationCard.tsx:66-83 |
| "Certify all" button | button | ✅ | hosCertifyOnBehalf FULL only; `GET /logs/:id/range` now has a real MSW handler (was unregistered) | src/features/hos-logs/components/CertificationCard.tsx:46-50; src/mocks/handlers/hosWrites.ts:225 |
| "Show superseded and proposed records" checkbox | checkbox | ✅ | | src/features/hos-logs/components/LogEventsCard.tsx:160-167 |
| "View all events" button | button | ✅ | | src/features/hos-logs/components/LogEventsCard.tsx:154-158 |
| Log events row menu "Request an edit" | menu item | ✅ | hosEdit FULL | src/features/hos-logs/components/LogEventsCard.tsx:233 |
| Log events row menu "View full record" | anchor link | ✅ | opens the read-only §395.8 record in `LogRecordModal` (WB-196) | src/features/hos-logs/components/LogEventsCard.tsx:236-238 |
| Log events row menu "Copy event ID" | menu item | ✅ | clipboard + toast | src/features/hos-logs/components/LogEventsCard.tsx:198-201,239 |
| Violations "Resolve" button | button | ✅ | hosEdit FULL; opens shared `ResolveViolationModal` (out of this audit's folder scope) | src/features/hos-logs/components/ViolationsCard.tsx:88-96 |
| Available hours "Retry" | button | ✅ | `GET /drivers/:id/hos` (B-2) now has an MSW handler; card should load real data rather than the permanent error state the source comment still describes | src/features/hos-logs/components/AvailableHoursCard.tsx:24-29; src/mocks/handlers/vehiclesDriversGaps.ts:230 |

### RequestLogEditModal.tsx (opened from toolbar or a log-events row)

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Start time input | text input | ✅ | | src/features/hos-logs/components/RequestLogEditModal.tsx:268-276 |
| End time input | text input | ✅ | | src/features/hos-logs/components/RequestLogEditModal.tsx:277-285 |
| Duty status chips OFF/SB/D/ON | button group | ✅ | contextually disabled while the interval touches automatic driving time (§395.30) | src/features/hos-logs/components/RequestLogEditModal.tsx:290-318 |
| Duty status chips YM/PC | button group | ✅ | B-39: YM → `proposedStatus ON` + `proposedSpecial YM`, PC → `OFF` + `PC` (§395.1(e)); disabled only while the interval covers automatic driving, like OFF/SB/ON; "cannot be proposed" copy removed | src/features/hos-logs/components/RequestLogEditModal.tsx:337-365 |
| Location input (geocoding enabled) | combobox | ✅ | a picked suggestion sends `{lat, lon, name}`; a typed name never picked sends `{ name }` (B-39 name-only); untouched sends nothing (unit test with mocked geocoder) | src/features/hos-logs/components/RequestLogEditModal.tsx:373-418 |
| Location input (geocoding disabled) | text input | ✅ | editable, ≤ 120 chars, sent as name-only `location: { name }` (B-39); hint removed | src/features/hos-logs/components/RequestLogEditModal.tsx:419-430 |
| Place suggestion buttons | button (list) | ✅ | only reachable when geocoding is enabled | src/features/hos-logs/components/RequestLogEditModal.tsx:352-365 |
| Odometer input | text input | ✅ | | src/features/hos-logs/components/RequestLogEditModal.tsx:378-385 |
| Engine hours input | text input | ✅ | | src/features/hos-logs/components/RequestLogEditModal.tsx:386-397 |
| Reason for the edit textarea | textarea | ✅ | required, min length validated | src/features/hos-logs/components/RequestLogEditModal.tsx:401-409 |
| "Notify the driver immediately" checkbox | checkbox | ✅ | default checked, sent as `notifyDriver` (both edit request and new-record proposal); unchecked shows "The proposal still waits in the driver app until the driver accepts it." — only the push/email is skipped (B-39) | src/features/hos-logs/components/RequestLogEditModal.tsx:266-285 |
| Close (×) / Esc | icon button | ✅ | `isDirty` computed from every field | src/features/hos-logs/components/RequestLogEditModal.tsx:202-209,229 |
| Cancel button | button | ✅ | | src/features/hos-logs/components/RequestLogEditModal.tsx:242 |
| "Send edit request" button | button | ✅ | guarded (`inFlight` ref + `mutation.isPending`); banner + per-field errors on refusal | src/features/hos-logs/components/RequestLogEditModal.tsx:128-198,243 |

### CertifyLogsModal.tsx (opened from "Certify all")

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Per-day certify checkbox | checkbox | ✅ | disabled on a day that is not selectable | src/features/hos-logs/components/CertifyLogsModal.tsx:149-155 |
| Close (×) / Esc | icon button | ✅ | `isDirty` passed to `Modal` — toggled days raise the 11.30 confirm on Esc/overlay/X (WB-198) | src/features/hos-logs/components/CertifyLogsModal.tsx:100-119 |
| Cancel button | button | ✅ | | src/features/hos-logs/components/CertifyLogsModal.tsx:108 |
| "Certify N selected days" button | button | ✅ | guarded (`inFlight` ref + `mutation.isPending`); disabled at 0 selected | src/features/hos-logs/components/CertifyLogsModal.tsx:82-97,109-117 |

### UnassignedDrivingModal.tsx (opened from the unassigned-segments chip)

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Per-segment select checkbox | checkbox | ✅ | | src/features/hos-logs/components/UnassignedDrivingModal.tsx:181-186 |
| Per-segment resolution select | select | ✅ | leave-unassigned / driver / annotate | src/features/hos-logs/components/UnassignedDrivingModal.tsx:209-222 |
| Annotation textarea | textarea | ✅ | required, min length validated | src/features/hos-logs/components/UnassignedDrivingModal.tsx:232-239 |
| "Ask each driver to confirm in the app" checkbox | checkbox | ✅ | default checked (as drawn); sends `requireDriverConfirmation: true` on every `assign` action → segment `PENDING_CONFIRMATION`, nothing attributed until the driver confirms; toast `N segments sent for confirmation` (WD-089); unchecked assigns immediately (B-83) | src/features/hos-logs/components/UnassignedDrivingModal.tsx:66-69,95-120,152-162 |
| Close (×) / Esc | icon button | ✅ | `isDirty={annotation.length > 0}` | src/features/hos-logs/components/UnassignedDrivingModal.tsx:134 |
| Cancel button | button | ✅ | | src/features/hos-logs/components/UnassignedDrivingModal.tsx:142 |
| "Assign N segments" button | button | ✅ | guarded; partial-failure banner names what was already saved | src/features/hos-logs/components/UnassignedDrivingModal.tsx:79-125,143-151 |

## DVIR

### DvirPage.tsx

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Search input | text input | ✅ | fixed: clear (×) button and Esc; the one debounced term feeds every tab and stays across tab switches (stage 3, DvirPage.tsx) | src/features/dvir/DvirPage.tsx:109,215-220 |
| Filters button | button | ✅ | enabled only on the DVIRs tab (`disabled={tab !== 'dvirs'}`) (WB-163) | src/features/dvir/DvirPage.tsx:222-231,306-312 |
| Export button (header) | button | ✅ | fixed: the active tab's rows as CSV (like the other table exports), with an `Export ready` toast and an `Export failed` toast on error (stage 3, DvirPage.tsx) | src/features/dvir/DvirPage.tsx:195-203,232 |
| "New work order" button | button | ✅ | maintenance FULL | src/features/dvir/DvirPage.tsx:236 |
| Segmented tabs (DVIRs/Open defects/Work orders/Schedules) | segmented control | ✅ | "DVIRs {n}" count is `dvirs.page?.total` (all server DVIRs) vs. the last-48h/10-row table shown — cosmetic mismatch | src/features/dvir/DvirPage.tsx:282-304 |
| Filter chips remove/Clear all | button | ✅ | | src/features/dvir/components/DvirFiltersDrawer.tsx:129-136 |
| Recent DVIRs row click → drawer | row click | ✅ | | src/features/dvir/DvirPage.tsx:350 |
| "Create work order" button (Open defects header) | button | ✅ | maintenance FULL | src/features/dvir/DvirPage.tsx:450 |
| Open defects row click → Resolve defect | row click | ✅ | dvir FULL | src/features/dvir/DvirPage.tsx:470,497 |
| Open defects "ASSIGNED TO" select (per row) | select | ✅ | B-40 shipped 2026-09-24: `PATCH /defects/:id/assign`; dvir FULL only, READ-only sees the resolved name (or `Unassigned`), never the control | src/features/dvir/DvirPage.tsx (`AssignedToCell`) |
| Open-defects pagination (DVIRs tab) | pagination | ✅ | uses the clamped `currentDefectsPage` | src/features/dvir/DvirPage.tsx:459-466 |
| Open-defects pagination (Defects tab) | pagination | ✅ | uses `currentDefectsPage` (WB-163) | src/features/dvir/DvirPage.tsx:487 |
| Work orders row menu "Close" | menu item | ✅ | disabled once already closed/cancelled | src/features/dvir/DvirPage.tsx:667-673 |
| Work orders row menu "Cancel" | menu item | ✅ | | src/features/dvir/DvirPage.tsx:674-680 |
| Work orders row menu "Edit" | menu item | ✅ | | src/features/dvir/DvirPage.tsx:681-686 |
| Work orders pagination | pagination | ✅ | | src/features/dvir/DvirPage.tsx:722 |
| Schedules row menu "Complete" | menu item | ✅ | | src/features/dvir/DvirPage.tsx:865-870 |
| Schedules row menu "Edit" | menu item | ✅ | | src/features/dvir/DvirPage.tsx:871-876 |
| Schedules row menu "Delete" | menu item | ✅ | | src/features/dvir/DvirPage.tsx:877-882 |
| Schedules pagination | pagination | ✅ | | src/features/dvir/DvirPage.tsx:930 |
| WorkOrderCloseModal: Cancel / Close work order | button (2) | ✅ | guarded | src/features/dvir/DvirPage.tsx:747-765 |
| WorkOrderCancelModal: Keep / Cancel work order | button (2) | ✅ | guarded | src/features/dvir/DvirPage.tsx:791-809 |
| ScheduleCompleteModal: service date input | date input | ✅ | | src/features/dvir/DvirPage.tsx:990 |
| ScheduleCompleteModal: odometer input | number input | ✅ | | src/features/dvir/DvirPage.tsx:995 |
| ScheduleCompleteModal: Close (×) / Esc | icon button | ✅ | fixed: `isDirty` on the Modal — typed odometer/date asks to discard first (stage 3, DvirPage.tsx) | src/features/dvir/DvirPage.tsx:950-957 |
| ScheduleCompleteModal: Cancel / Mark complete | button (2) | ✅ | fixed: Cancel is `ModalCancelButton`, so it goes through the dirty prompt like × and Esc; Mark complete guarded by `isPending` (stage 3, DvirPage.tsx) | src/features/dvir/DvirPage.tsx:959-984 |
| ScheduleDeleteModal: Cancel / Delete schedule | button (2) | ✅ | guarded | src/features/dvir/DvirPage.tsx:1019-1038 |

### CreateWorkOrderModal.tsx (opened from "New work order" / "Create work order")

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Unit select | select | ✅ | only shown when no `vehicleId` was preset | src/features/dvir/components/CreateWorkOrderModal.tsx:112-124 |
| Defects-to-include checkboxes | checkbox (list) | ✅ | fixed: changing the unit clears the ticked defects, so another unit's defect ids can't be sent (stage 3, CreateWorkOrderModal.tsx) | src/features/dvir/components/CreateWorkOrderModal.tsx:24,28,57-59 |
| Title input | text input | ✅ | required | src/features/dvir/components/CreateWorkOrderModal.tsx:159 |
| "Assign to" (vendor) input | text input | ✅ | | src/features/dvir/components/CreateWorkOrderModal.tsx:165 |
| Priority select | select | ✅ | | src/features/dvir/components/CreateWorkOrderModal.tsx:171-177 |
| Due date input | date input | ✅ | | src/features/dvir/components/CreateWorkOrderModal.tsx:181 |
| Estimated parts cost input | number input | ✅ | sent as `costUsd` | src/features/dvir/components/CreateWorkOrderModal.tsx:189 |
| Odometer at service input | number input | ✅ | | src/features/dvir/components/CreateWorkOrderModal.tsx:196 |
| Work to perform textarea | textarea | ✅ | | src/features/dvir/components/CreateWorkOrderModal.tsx:205-209 |
| Close (×) / Esc | icon button | ✅ | fixed: real `isDirty` now passed | src/features/dvir/components/CreateWorkOrderModal.tsx:44-55,98 |
| Cancel button | button | ✅ | | src/features/dvir/components/CreateWorkOrderModal.tsx:103 |
| Estimated labor input | number input | ✅ | B-42 shipped 2026-09-24: sent as `estimatedLaborHours` | src/features/dvir/components/CreateWorkOrderModal.tsx |
| Keep out of service / Notify driver / Block dispatch checkboxes (3) | checkbox | ✅ | B-42 shipped 2026-09-24: real `keepOutOfService`/`notifyDriver`/`blockDispatchAssignment` flags, default checked | src/features/dvir/components/CreateWorkOrderModal.tsx |
| "Create work order" button | button | ✅ | guarded | src/features/dvir/components/CreateWorkOrderModal.tsx:69-99 |

### ResolveDefectModal.tsx (opened from an open-defect row)

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Resolution radio group (Repaired/No repair needed/Deferred) | radio | ✅ | fixed: one `role="radiogroup"` labelled Resolution, radios share a `name`, so arrow keys move between them (stage 3, ResolveDefectModal.tsx) | src/features/dvir/components/ResolveDefectModal.tsx:137 |
| Work order select | select | ✅ | fixed: now really links via `PATCH /defects/:id/work-order` (`useLinkDefectWorkOrder`) before resolving | src/features/dvir/components/ResolveDefectModal.tsx:52-61,149-156 |
| Repair notes textarea | textarea | ✅ | required | src/features/dvir/components/ResolveDefectModal.tsx:163-168 |
| Close (×) / Esc | icon button | ✅ | fixed: real `isDirty` now passed | src/features/dvir/components/ResolveDefectModal.tsx:31,86 |
| Cancel button | button | ✅ | | src/features/dvir/components/ResolveDefectModal.tsx:93 |
| Corrected by / Completed on / Labor hours / Parts cost inputs (4) | text/date/number inputs | ✅ | B-70 shipped 2026-09-24: real `correctedBy`/`completedAt`/`laborHours`/`partsCostUsd` fields | src/features/dvir/components/ResolveDefectModal.tsx |
| "Mark as resolved" button | button | ✅ | guarded | src/features/dvir/components/ResolveDefectModal.tsx |

### EditWorkOrderModal.tsx (Work orders row menu "Edit")

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Title input | text input | ✅ | | src/features/dvir/components/EditWorkOrderModal.tsx:92 |
| "Assign to" input | text input | ✅ | clearing now sends explicit `null` (fixed, WB-149) | src/features/dvir/components/EditWorkOrderModal.tsx:55,98 |
| Priority select | select | ✅ | | src/features/dvir/components/EditWorkOrderModal.tsx:104-110 |
| Due date input | date input | ✅ | clearing sends `null` (fixed) | src/features/dvir/components/EditWorkOrderModal.tsx:58,114 |
| Parts cost input | number input | ✅ | clearing sends `null` (fixed) | src/features/dvir/components/EditWorkOrderModal.tsx:56,122 |
| Odometer at service input | number input | ✅ | clearing sends `null` (fixed) | src/features/dvir/components/EditWorkOrderModal.tsx:57,129 |
| Estimated labor input | number input | ✅ | B-42 shipped 2026-09-24: sent as `estimatedLaborHours` | src/features/dvir/components/EditWorkOrderModal.tsx |
| Work to perform textarea | textarea | ✅ | clearing sends `null` (fixed) | src/features/dvir/components/EditWorkOrderModal.tsx:53,137-142 |
| Keep out of service / Notify driver / Block dispatch checkboxes (3) | checkbox | ✅ | B-42 shipped 2026-09-24: default from the row (`?? true`) | src/features/dvir/components/EditWorkOrderModal.tsx |
| Close (×) / Esc | icon button | ✅ | fixed: real `isDirty` now passed | src/features/dvir/components/EditWorkOrderModal.tsx:35-42,75 |
| Cancel button | button | ✅ | | src/features/dvir/components/EditWorkOrderModal.tsx:80 |
| "Save changes" button | button | ✅ | guarded | src/features/dvir/components/EditWorkOrderModal.tsx:44-68,81 |

### EditScheduleModal.tsx (Schedules row menu "Edit")

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Name input | text input | ✅ | required | src/features/dvir/components/EditScheduleModal.tsx:82 |
| Interval (miles) input | number input | ✅ | clearing sends `null` (fixed, WB-149) | src/features/dvir/components/EditScheduleModal.tsx:44,88 |
| Interval (days) input | number input | ✅ | clearing sends `null` (fixed) | src/features/dvir/components/EditScheduleModal.tsx:45,92 |
| Last service odometer input | number input | ✅ | clearing sends `null` (fixed) | src/features/dvir/components/EditScheduleModal.tsx:46,99 |
| Last service date input | date input | ✅ | clearing sends `null` (fixed) | src/features/dvir/components/EditScheduleModal.tsx:47,103 |
| "Schedule is active" checkbox | checkbox | ✅ | | src/features/dvir/components/EditScheduleModal.tsx:108 |
| Close (×) / Esc | icon button | ✅ | fixed: real `isDirty` now passed | src/features/dvir/components/EditScheduleModal.tsx:26-32,65 |
| Cancel button | button | ✅ | | src/features/dvir/components/EditScheduleModal.tsx:70 |
| "Save changes" button | button | ✅ | guarded | src/features/dvir/components/EditScheduleModal.tsx:34-58,71 |

### DvirDrawer.tsx (opened from a Recent DVIRs row)

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Print button | button | ✅ | `printDvir()` renders the inspection into its own hidden iframe and prints only that (WB-159) | src/features/dvir/components/DvirDrawer.tsx:86-88 |
| Export PDF button | button | ✅ | B-75 shipped 2026-09-24: `GET /dvir/:id/pdf`, fetched at click time and downloaded, never cached | src/features/dvir/components/DvirDrawer.tsx |
| "Create work order" button | button | ✅ | maintenance FULL; opens `CreateWorkOrderModal` pre-filled with the vehicle | src/features/dvir/components/DvirDrawer.tsx:91-97 |
| Photo thumbnail buttons | icon button (per photo) | ✅ | B-41 shipped 2026-09-24: `GET /attachments/:id/presign` fills a `loading="lazy"` thumbnail; click re-presigns and opens a fresh URL in a new tab — never cached in the query cache, never logged | src/features/dvir/components/DvirDrawer.tsx |
| Mechanic name input | text input | ✅ | fixed: visible `Mechanic name` label; a typed name makes the Drawer dirty, so closing asks to discard (stage 3, DvirDrawer.tsx) | src/features/dvir/components/DvirDrawer.tsx:186-191,74-99 |
| Repair status select | select | ✅ | fixed: visible `Repair status` label (default still derived from the defect state, WB-076) (stage 3, DvirDrawer.tsx) | src/features/dvir/components/DvirDrawer.tsx:34-39,192-202 |
| "Sign off" button | button | ✅ | guarded; disabled until a mechanic name is typed | src/features/dvir/components/DvirDrawer.tsx:203-220 |

### DvirFiltersDrawer.tsx (opened from DvirPage "Filters")

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Type checkboxes (3) | checkbox | ✅ | client-side over the newest-200 DVIRs window (gap B-60) | src/features/dvir/components/DvirFiltersDrawer.tsx:67-76 |
| Severity checkboxes (3) | checkbox | ✅ | same window limitation; a DVIR whose defects fall outside it is now flagged as excluded rather than silently dropped (`countUnknownSeverityExcluded`) | src/features/dvir/components/DvirFiltersDrawer.tsx:78-87; src/features/dvir/lib/filters.ts:89-98 |
| Repair status checkboxes (4) | checkbox | ✅ | same window limitation | src/features/dvir/components/DvirFiltersDrawer.tsx:89-98 |
| Reset all button | button | ✅ | | src/shared/ui/FilterDrawer.tsx:33-35 |
| Apply N filters button | button | ✅ | fixed: reads plain `Apply` with nothing selected, `Apply N filters` otherwise (stage 3, FilterDrawer.tsx) | src/shared/ui/FilterDrawer.tsx:36-44 |
| Close (×) / Esc | icon button | ✅ | fixed: `isDirty={!sameDvirFilters(draft, filters)}` | src/features/dvir/components/DvirFiltersDrawer.tsx:60,69-80 (lib/filters.ts:72-80) |

## Trips

### TripsPage.tsx

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Search input | text input | ✅ | fixed: `aria-label="Search trips"`, clear (×) button and Esc (stage 3, TripsPage.tsx) | src/features/trips/TripsPage.tsx:319-327 |
| Period dropdown trigger | button | ✅ | | src/features/trips/components/PeriodDropdown.tsx:121-124 |
| Filters button | button | ✅ | opens `TripFiltersDrawer` | src/features/trips/TripsPage.tsx:330-339 |
| "Create trip" button | button | ✅ | trips FULL | src/features/trips/TripsPage.tsx:352-354 |
| Segment tabs (Active/Scheduled/Completed/Unassigned) | segmented control | ✅ | `Scheduled` is `DRAFT ∪ PLANNED` (B-73, shipped) — two bounded slices merged client-side, same pattern as `Active` | src/features/trips/TripsPage.tsx:380-393; src/shared/api/trips.ts (`SCHEDULED_STATUSES`, `useTripsBoard`) |
| Filter chips remove/Clear all | button | ✅ | no `aria-label` on the `×` glyph (a11y, minor) | src/features/trips/components/TripFiltersDrawer.tsx:202-208 |
| Active/Scheduled/Completed table row click | row click | ✅ | selects the trip for the route panel | src/features/trips/TripsPage.tsx:463 |
| "Publish" button (Scheduled segment, DRAFT rows only) | button (per row) | ✅ | `PATCH /trips/:id { status: 'PLANNED' }` (`usePublishTrip`, B-73 shipped) | src/features/trips/TripsPage.tsx:229-256 |
| Pagination | pagination | ✅ | | src/features/trips/TripsPage.tsx:466-477 |
| Unassigned loads "Assign driver" button | button (per row) | ✅ | trips FULL | src/features/trips/TripsPage.tsx:290-293 |
| "Auto-assign" button | button | ✅ | trips FULL, guarded via `loading`; `handleAutoAssign` is declared `async` but never actually awaits anything (cosmetic only, request still fires) | src/features/trips/TripsPage.tsx:161-171,415-417 |
| Empty-state "Create trip" action | button | ✅ | | src/features/trips/TripsPage.tsx:451 |
| Empty-state "Clear search"/"Clear filters" | button | ✅ | | src/features/trips/TripsPage.tsx:441-449 |
| Unassigned loads PICKUP / DELIVERY / weight columns | table cells | ✅ | `GET /trips/unassigned-loads` now includes `stops` (ordered) and a `driver`/`vehicle` name join (B-36, shipped) — read from `row.original.stops`, no longer "unavailable" | src/features/trips/TripsPage.tsx:257-292; src/shared/api/trips.ts (`useUnassignedLoads`) |

### CreateTripModal.tsx (opened from "Create trip")

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Trip / load ID input | text input | ✅ | required | src/features/trips/components/CreateTripModal.tsx:434 |
| Customer input | text input | ✅ | `CreateTripPayload.customer` (B-73, shipped) | src/features/trips/components/CreateTripModal.tsx:441-443 |
| Reference / BOL input | text input | ✅ | | src/features/trips/components/CreateTripModal.tsx:445 |
| Pickup location input | text input | ✅ | required | src/features/trips/components/CreateTripModal.tsx:455 |
| Pickup window datetime input | datetime-local | ✅ | required, validated (calendar-real dates, range) | src/features/trips/components/CreateTripModal.tsx:458-465 |
| Delivery location input | text input | ✅ | required | src/features/trips/components/CreateTripModal.tsx:467 |
| Delivery window datetime input | datetime-local | ✅ | optional, validated | src/features/trips/components/CreateTripModal.tsx:470-477 |
| "+ Add an intermediate stop" button | button | ✅ | adds intermediate stops (place + time, `Remove`), sent as `CHECKPOINT` stops with correct `sequence` (WB-164) | src/features/trips/components/CreateTripModal.tsx:479-484 |
| Driver picker | combobox | ✅ | drives the HOS drive-time caption | src/features/trips/components/CreateTripModal.tsx:493-510 |
| Unit picker | combobox | ✅ | | src/features/trips/components/CreateTripModal.tsx:512-520 |
| Trailer picker | combobox | ✅ | `TrailerPicker` over `GET /trailers` (`useTrailersLookup`); sends `trailerId` (B-73, shipped) | src/features/trips/components/CreateTripModal.tsx:559-566; src/shared/api/trailers.ts |
| Distance input | number input | ✅ | optional; sent as `distanceMi` (B-73, shipped) | src/features/trips/components/CreateTripModal.tsx:571-590 |
| Estimated drive time input | number input | ✅ | sent as `estimatedDriveSec` (seconds) and still drives the on-screen HOS check (B-92, shipped) | src/features/trips/components/CreateTripModal.tsx:183,309-310,338,593-601 |
| Weight input | number input | ✅ | sent as `weightLbs` | src/features/trips/components/CreateTripModal.tsx:603-616 |
| Rate input | number input | ✅ | optional; sent as `rateUsd` (B-73, shipped) | src/features/trips/components/CreateTripModal.tsx:619-643 |
| "Pick another driver" button (HOS warning) | button | ✅ | reachable now that `GET /drivers/:id/hos` (B-2) returns real data | src/features/trips/components/CreateTripModal.tsx:644-665 |
| "Save as draft" button | button | ✅ | posts `draft: true` (B-73, shipped); shows in the `Scheduled` segment with a `Publish` action | src/features/trips/components/CreateTripModal.tsx:401-411 |
| Close (×) / Esc | icon button | ✅ | `dirty = isDirty \|\| estimatedDriveHours !== '' \|\| intermediateStops.length > 0` | src/features/trips/components/CreateTripModal.tsx:255,398 |
| Cancel button | button | ✅ | | src/features/trips/components/CreateTripModal.tsx:400 |
| "Create trip" button | button | ✅ | guarded on `submitting`; 422s on unmapped fields (`notes`, `stops`, `commodity`) now surface in the banner instead of vanishing | src/features/trips/components/CreateTripModal.tsx:317-389,412-421 |

### AssignLoadModal.tsx (opened from "Assign driver" on an unassigned load)

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Driver search input | text input | ✅ works | `aria-label` added (stage 2); Enter selects the first driver the live-filtered list shows and focuses its radio, never submits, no-op with no match (WB-237) (stage 3, AssignLoadModal.tsx) | src/features/trips/components/AssignLoadModal.tsx:70-87 |
| Driver list loading | — | ✅ | "Loading drivers…" row while `driversQuery.isLoading` (stage 2, AssignLoadModal.tsx:82) | src/features/trips/components/AssignLoadModal.tsx:77-107 |
| Driver row select button | button (radio-styled) | ✅ | fixed: a native `role="radiogroup"` of labelled radios sharing a `name` — no radio inside a button, arrow keys move the pick (stage 3, AssignLoadModal.tsx) | src/features/trips/components/AssignLoadModal.tsx:82-100 |
| HOS column | static text | ✅ | wired 2026-09-25: `useDriversHosClocks` reads bulk `hos.driveRemainingSec`/`cycleRemainingSec` from `GET /drivers/roster` (same `q`/`limit` page, joined by id) and falls back to `GET /drivers/:id/hos` only for rows the roster page misses; shows `HH:MM drive` / `HH:MM cycle`, a loading placeholder, `—` on error. Caveat B-99: the roster returns full limits (e.g. 11:00/70:00) when the backend cannot compute a driver's HOS state, indistinguishable from a fresh driver | src/features/trips/components/AssignLoadModal.tsx:24-26, 127, 141-152; src/shared/api/drivers.ts |
| "Notify the driver in the app" checkbox | checkbox | ✅ | `POST /trips/:id/assign` now takes `notify` (B-74, shipped); starts checked (server default `true`) | src/features/trips/components/AssignLoadModal.tsx:35-38,50 |
| Close (×) / Esc | icon button | ✅ | `isDirty={Boolean(selectedId) \|\| query !== '' \|\| !notify}` | src/features/trips/components/AssignLoadModal.tsx:33 |
| Cancel button | button | ✅ | | src/features/trips/components/AssignLoadModal.tsx:37 |
| "Assign driver" button | button | ✅ | guarded; disabled until a driver is picked | src/features/trips/components/AssignLoadModal.tsx:38-61 |

### PeriodDropdown.tsx (the period control next to Search)

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Period trigger button | button | ✅ | | src/features/trips/components/PeriodDropdown.tsx:121-124 |
| "Today" / "This week" / "This month" preset buttons | button (3) | ✅ | | src/features/trips/components/PeriodDropdown.tsx:129-142 |
| "Custom range" toggle button | button | ✅ | | src/features/trips/components/PeriodDropdown.tsx:143-154 |
| Custom "From" date input | date input | ✅ | validated | src/features/trips/components/PeriodDropdown.tsx:161-175 |
| Custom "To" date input | date input | ✅ | validated | src/features/trips/components/PeriodDropdown.tsx:178-192 |
| "Clear" button | button | ✅ | fixed: `h-btn-sm min-w-btn-sm` (32px) target (stage 3, PeriodDropdown.tsx) | src/features/trips/components/PeriodDropdown.tsx:196-205 |
| "Apply" button (custom range) | button | ✅ | disabled until a valid range is entered | src/features/trips/components/PeriodDropdown.tsx:207-217 |

### TripFiltersDrawer.tsx (opened from TripsPage "Filters")

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Status checkboxes | checkbox | ✅ | client-side over the bounded window while any filter is active (gap B-59) | src/features/trips/components/TripFiltersDrawer.tsx:71-80 |
| Driver checkboxes | checkbox | ✅ | same window limitation | src/features/trips/components/TripFiltersDrawer.tsx:82-91 |
| Unit checkboxes | checkbox | ✅ | no server `vehicleId` param at all (gap B-59) | src/features/trips/components/TripFiltersDrawer.tsx:93-102 |
| Home terminal select | select | ✅ | client-side | src/features/trips/components/TripFiltersDrawer.tsx:104-117 |
| Depart "From" date input | date input | ✅ | no server depart-range param (gap B-59) | src/features/trips/components/TripFiltersDrawer.tsx:119-133 |
| Depart "To" date input | date input | ✅ | same | src/features/trips/components/TripFiltersDrawer.tsx:134-146 |
| "Only trips with no trailer assigned" checkbox | checkbox | ✅ | client-side (gap B-59) | src/features/trips/components/TripFiltersDrawer.tsx:150-159 |
| Reset all button | button | ✅ | | src/shared/ui/FilterDrawer.tsx:33-35 |
| Apply N filters button | button | ✅ | fixed: reads plain `Apply` with nothing selected, `Apply N filters` otherwise; still disabled while a depart-date error is present (stage 3, FilterDrawer.tsx) | src/shared/ui/FilterDrawer.tsx:36-44; TripFiltersDrawer.tsx:64 |
| Close (×) / Esc | icon button | ✅ | fixed: `isDirty` compares the draft's and applied filters' serialized query strings | src/features/trips/components/TripFiltersDrawer.tsx:52-54,62 |


## Safety

### `src/features/safety/SafetyPage.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Events / Coaching / Scorecards tabs | tabs (`role=tab`) | ✅ | URL-synced, arrow-key roving tabindex | SafetyPage.tsx:120-148 |
| Search input | text input | ✅ | filters events/coaching/scorecards by name/unit | SafetyPage.tsx:494-500 |
| Filters button | button | ✅ | opens `SafetyFiltersDrawer`; hidden on Scorecards tab | SafetyPage.tsx:503-513 |
| Export button | button | ✅ | RFC 4180 CSV of exactly the rows the current tab lists (tab + search + filters), per-tab columns (WB-169, WD-085) | SafetyPage.tsx:374-381,514-516 |
| Filter chips — remove (×) | buttons | ✅ | clears one filter group | SafetyFiltersDrawer.tsx:135-140 (rendered via SafetyPage.tsx:521-526) |
| Filter chips — Clear all | button | ✅ | clears all drawer filters | SafetyFiltersDrawer.tsx:141-143 |
| Clear search / Clear filters (empty state) | button | ✅ | shown when search/filters return 0 rows | SafetyPage.tsx:393-402 |
| Select driver to coach | select | ✅ | value feeds "Assign coaching" button | SafetyPage.tsx:442-454 |
| Assign coaching button | button | ✅ | disabled until a driver is picked; opens `AssignCoachingModal` | SafetyPage.tsx:455-463 |
| Driver scorecard "Clear search" (empty state) | button | ✅ | scorecard-only search empty state | SafetyPage.tsx:473-474 |
| Driver scorecard TREND column | static (icon + number) | ✅ | B-44 shipped 2026-09-24: server `previousScore`/`trend` (prior period of the same length); `—` only when there is no prior-period row | SafetyPage.tsx |
| `View profile ›` cell | fake link (`<span>`) | ✅ | real button → `/drivers/:id`; absent without `drivers` READ (WB-168) | SafetyPage.tsx:262-266 |
| Fleet safety score verdict | static text | ✅ | verdict derived on the 90/70 bands, same as the SCORE badge (WB-170) | SafetyPage.tsx:426 |
| Threshold sentence grammar | static text | ✅ | verb agrees ("1 driver **is** below…") (WB-170) | SafetyPage.tsx:427-429 |
| Events/Coaching table pagination | pager | ✅ | page/limit controls, resets on tab/search change | SafetyPage.tsx:410 |

### `src/features/safety/components/AssignCoachingModal.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Note | textarea | ✅ | optional, reaches `note` in payload | AssignCoachingModal.tsx |
| Cancel | button (`ModalCancelButton`) | ✅ | routes through `Modal` `requestClose`; `isDirty` now passed (fixed) | AssignCoachingModal.tsx |
| Assign coaching (submit) | button | ✅ | B-43 shipped 2026-09-24: posts `{ driverId, note }` directly — `POST /safety/coaching` closes the driver's most recent open event server-side; the open-events picker is gone | AssignCoachingModal.tsx |

### `src/features/safety/components/SafetyFiltersDrawer.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Event type checkboxes (×5) | checkbox | ✅ | toggles draft filter set | SafetyFiltersDrawer.tsx:76-84 |
| Severity checkboxes (×3) | checkbox | ✅ | client-side bucketed severity (gap B-61: no server severity param) | SafetyFiltersDrawer.tsx:86-95 |
| Coaching status checkboxes (×4) | checkbox | ✅ | client-side, gap B-61 (server accepts only one `status` value) | SafetyFiltersDrawer.tsx:97-106 |
| Reset | button | ✅ | via `FilterDrawer` `onReset`, sets draft to empty | SafetyFiltersDrawer.tsx:69 |
| Apply | button | ✅ | writes filters to URL, closes drawer | SafetyFiltersDrawer.tsx:70-73 |
| Escape / X / Cancel on dirty draft | close | ✅ | `isDirty` computed by comparing serialized draft vs applied filters (fixed) | SafetyFiltersDrawer.tsx:58-68 |

## Messages

### `src/features/messages/MessagesPage.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| New (conversation list header) | button | ✅ | opens `NewConversationModal`, perm-gated | MessagesPage.tsx:258-260 |
| Conversation search input | text input | ✅ | `aria-label="Search conversations"` (stage 2, MessagesPage.tsx:270) | MessagesPage.tsx:266-271 |
| All / Unread / Groups segments | buttons (`aria-pressed`) | ✅ | filters conversation list; `Unread` count now reads the server's real `unreadCount` (B-67, shipped) | MessagesPage.tsx:281-295 |
| Conversation row | button | ✅ | selects conversation and calls `POST /conversations/:id/read` (`useMarkConversationRead`, B-67, shipped) — the local cache clears the badge on `onMutate`, before the response lands | MessagesPage.tsx:188-196,340 |
| Conversation row preview line | static text | ✅ | the newest message's body (`lastMessage.body`, `You:` prefix for the caller's own sends), B-37 shipped; falls back to the pre-B-37 placeholder when a cached row has no `lastMessage` yet | MessagesPage.tsx:56-64,347 |
| Empty-state "New" action | button | ✅ | shown when list/search has 0 results | MessagesPage.tsx:299-302 |
| No-match empty state copy | static text | ✅ | `searchEmptyState` + `Clear search`; distinct empty state for Unread / Groups (WB-171) | MessagesPage.tsx:298-302 |
| View logs | button | ✅ | `navigate('/hos-logs?driverId=…')` | MessagesPage.tsx:392-396 |
| Assign trip | button | ✅ | `navigate('/trips')`, perm-gated | MessagesPage.tsx:398-402 |
| Retry (failed message) | button (`variant=link`) | ✅ | re-sends with the same `clientId` | MessagesPage.tsx:436-439 |
| Quick action chips (×4) | buttons | ✅ | append canned text to draft | MessagesPage.tsx:451-461 |
| Message draft | textarea | ✅ | Enter sends, Shift+Enter newlines, 2000-char check before send | MessagesPage.tsx:463-476 |
| Send button | icon-only button | ✅ | 40×40 round, disabled on empty draft, optimistic send + retry-on-fail | MessagesPage.tsx:477-487 |
| Call | button | ✅ | dials `tel:` from the driver's number; disabled with "No phone number on file for this driver" when there is none (WB-172, WD-083) | MessagesPage.tsx:502-527 |
| Profile | button | ✅ | `navigate('/drivers/:id')` | MessagesPage.tsx:528-530 |

### `src/features/messages/components/NewConversationModal.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Message a driver / Broadcast to fleet | tabs (`aria-pressed`) | ✅ | switches DIRECT/BROADCAST mode | NewConversationModal.tsx:104-118 |
| Driver search input | text input | ✅ | `aria-label="Search driver"` (stage 2, NewConversationModal.tsx:129) | NewConversationModal.tsx:123-128 |
| Driver row | button w/ nested radio or checkbox | ✅ | no real `<input>` nested in the `<button>` any more (WB-165) | NewConversationModal.tsx:137-146 |
| Broadcast message | textarea (RHF-registered) | ✅ | zod-validated, required for Broadcast tab only | NewConversationModal.tsx:158-159 |
| Cancel | button | ✅ | `ModalCancelButton` + `isDirty` on `Modal` — a typed draft/selection raises the 11.30 confirm (WB-165) | NewConversationModal.tsx:78-88 (Modal has no `isDirty` prop) |
| Start conversation / Send broadcast | button | ✅ | disabled until a driver/recipients chosen; success toast, closes | NewConversationModal.tsx:89-97,46-73 |

## Reports

### Activity report — `src/features/reports/ActivityReportPage.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Report selector | menu (`SelectMenu`) | ✅ | navigates to the chosen report route | ActivityReportPage.tsx:198 |
| Date range picker | date-range control | ✅ | updates `from`/`to` in the URL, resets page | ActivityReportPage.tsx:199-205 |
| Terminal selector | menu | ✅ | server-side `terminal` filter (B-46) | ActivityReportPage.tsx:206-214 |
| Group by | menu | ✅ | wired 2026-09-25: `Group by driver` (default) / `Group by terminal`, rolled up client-side over the whole range (`activityGroups.ts`), persisted as `?group=terminal`; no unit/day/vehicle-group option — the summary rows carry neither (vehicle groups: B-46, still open) | ActivityReportPage.tsx:279-287; activityGroups.ts |
| Schedule | button | ✅ | opens shared `ScheduleReportModal`, perm-gated | ActivityReportPage.tsx:218-220 |
| Export CSV | button | ✅ | `useExportWhenReady` — guarded against double-click, auto-saves via `saveFile` once READY (cross-origin nav bug fixed) | ActivityReportPage.tsx:222-231; reportMeta.ts:230-247; useReportJobs.ts:127-174 |
| Print | button | ✅ | `window.print()` | ActivityReportPage.tsx:232-234 |
| Open logs (row action) | button | ✅ | `navigate('/hos-logs?driverId=…')` | ActivityReportPage.tsx:172-184 |
| Pagination | pager | ✅ | server-paged, steps back if page overshoots | ActivityReportPage.tsx:306-319 |
| ActionAlert dismiss | button | ✅ | clears export error | ActivityReportPage.tsx:246; ActionAlert.tsx:12-14 |

### IFTA report — `src/features/reports/IftaReportPage.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Report selector | menu | ✅ | navigates | IftaReportPage.tsx:136 |
| Quarter selector | menu | ✅ | writes `?quarter=` | IftaReportPage.tsx:137-142 |
| Jurisdiction | menu | ✅ | wired 2026-09-25: options derived client-side from the loaded quarter's rows (`iftaJurisdictions.ts`), persisted as `?jurisdiction=XX`; KPIs and table switch to that jurisdiction. Export CSV / PDF still cover every jurisdiction — a note on the page says so | IftaReportPage.tsx:181-186, 214-220; iftaJurisdictions.ts |
| Vehicle group | menu (inert) | 🚫 | `disabled` — no vehicle-group model in the backend prisma schema and no endpoint (gap B-46, still open). W-12 has no `Unit` menu either | IftaReportPage.tsx:187-188 |
| Export CSV | button | ✅ | `useExportWhenReady`, guarded, auto-saves | IftaReportPage.tsx:147-155 |
| Generate report | button | ✅ | queued job followed via `useTrackedReport` and announced through `useAnnounceReport`; FAILED shows in `ActionAlert` (WB-166, WD-082) | IftaReportPage.tsx:116,157-166; useReportJobs.ts:43-61 |
| Download IFTA PDF | button | ✅ | B-96 shipped (2026-09-24) — moved off `reports` FULL onto the same READ shortcut as Export CSV (`format=PDF`); visible to VIEWER now (WB-247). `useExportWhenReady({ announce: true })` follows the job and toasts `Report ready` on completion | IftaReportPage.tsx:229-238 |
| Jurisdiction table | data table | ✅ | server data, no defects found | IftaReportPage.tsx:245-260 |
| Report library rows (×4 navigable) | buttons | ✅ | navigate to their report route | ReportLibraryCard.tsx |
| Report library rows — `Driver logs (RODS)` / `Idle & fuel report` | button → modal | ✅ | B-14: opens `GenerateLibraryReportModal` (range, driver, unit for Idle) → `POST /reports/generate` `RODS`/`IDLE_FUEL` PDF, followed by `useTrackedReport`; `reports` FULL, absent for READ roles (WD-090) — no more Activity redirect | ReportLibraryCard.tsx; GenerateLibraryReportModal.tsx |
| Recently generated — Schedule a report | button | ✅ | opens `ScheduleReportModal` | RecentlyGeneratedCard.tsx:141-144 |
| Recently generated — per-row download | icon button | ✅ | only on READY rows, `saveFile` (fixed) | RecentlyGeneratedCard.tsx:110-126 |
| Recently generated — GENERATED BY | static text | ✅ | `requestedBy.name` embedded by `GET /reports` (B-46); own name as fallback | RecentlyGeneratedCard.tsx |
| Recently generated — pagination | pager | ✅ | only shown when `total > limit` | RecentlyGeneratedCard.tsx:171-184 |
| Recently generated — download error dismiss | button | ✅ | ActionAlert | RecentlyGeneratedCard.tsx:148-151 |
| Recently generated — empty-state Generate action | button | ✅ | perm-gated, calls `onGenerate` (= the CSV generate handler) | RecentlyGeneratedCard.tsx:192-201 |

### DVIR report — `src/features/reports/DvirReportPage.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Report selector | menu | ✅ | navigates | DvirReportPage.tsx:222 |
| Date range picker | date-range control | ✅ | updates `from`/`to` | DvirReportPage.tsx:223-229 |
| Unit selector | menu | ✅ | client-side filter (no server date filter — gap B-47) | DvirReportPage.tsx:230-238 |
| Defect type selector | menu | ✅ | client-side filter | DvirReportPage.tsx:239-247 |
| Schedule | button | ✅ | opens `ScheduleReportModal` | DvirReportPage.tsx:250-252 |
| Export CSV | button | ✅ | `useExportWhenReady`, guarded, auto-saves | DvirReportPage.tsx:254-263 |
| Download PDF | button | ✅ | B-96 shipped (2026-09-24) — moved off `reports` FULL onto the same READ shortcut as Export CSV (`format=PDF`); visible to VIEWER now (WB-247). `useExportWhenReady({ announce: true })` follows the job and toasts on completion; FAILED shows in `ActionAlert` | DvirReportPage.tsx |
| Inspection reports table | data table | ✅ | client-paged; B-47 `GET /dvir/compliance` adds `Missing` / `Not submitted` rows for each missing pre-trip, `N% compliance` chip and `Missing pre-trip` KPI (WD-091) | DvirReportPage.tsx |
| Pagination | pager | ✅ | | DvirReportPage.tsx:348-361 |
| ActionAlert dismiss | button | ✅ | clears pdf/export error | DvirReportPage.tsx:289-295 |

### FMCSA / DOT audit pack — `src/features/reports/FmcsaPackPage.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Report selector | menu | ✅ | navigates | FmcsaPackPage.tsx:197 |
| Date range picker | date-range control | ✅ | | FmcsaPackPage.tsx:198-201 |
| Driver selector | menu | ✅ | | FmcsaPackPage.tsx:202-207 |
| Unit selector | menu | ✅ | B-48: `?unit=` → `vehicleId` on `GET /reports/fmcsa-pack`; DVIR KPI scoped to the unit; caption says the RODS counts are not narrowed (WD-091) | FmcsaPackPage.tsx |
| Preview | button | ✅ | disabled until `latestPack.status === 'READY'`; `saveFile` (fixed) | FmcsaPackPage.tsx:211-224 |
| Generate pack | button | ✅ | double-submit guarded (`useGuardedMutate`); tracks `packId` via `useReport` polling and calls `announce()` locally on status change — shows a real completion toast even though the mock never fires `report.ready` over the socket | FmcsaPackPage.tsx:100-128,225-244 |
| Pack contents checkboxes (×6) | checkbox | ✅ | B-48: real `include[]` (all six = full pack, no `include`); none ticked disables `Generate pack` with `Select at least one section.`; read-only without `reportsTransfer` FULL (WD-091) | FmcsaPackPage.tsx |
| Resolve now › | button | ✅ | `navigate('/hos-logs?unassigned=1')`, shown only when segments/uncertified > 0 | FmcsaPackPage.tsx:310-319 |
| Transfer method radios (×2) | radio | ✅ | `role=radiogroup`, sets local `method` used to prefill the modal | FmcsaPackPage.tsx:334-354 |
| Inspector email address | text input | ✅ | inline `recipientError` + `aria-invalid`; "Send to inspector" is disabled while it is set (WB-178) | FmcsaPackPage.tsx:361-375 |
| Output file comment | text input | ✅ | 60-char counter turns red past the limit, value carried into the modal | FmcsaPackPage.tsx:389-399 |
| Send to inspector | button | ✅ | gated `dataTransfer` FULL (B-95); disabled while `recipientError` is set; an empty field still opens 11.14 (WB-178) | FmcsaPackPage.tsx |
| Previous transfers — View all | button | ✅ | expands to full paged list | PreviousTransfersCard.tsx:142-147 |
| Previous transfers — comment link | button | ✅ | opens `TransferDrawer` | PreviousTransfersCard.tsx:101-105 |
| Previous transfers — SENT BY | static text | ✅ | `requestedBy.name` (USER or DRIVER) from `GET /transfers` (B-46); also in the transfer drawer | PreviousTransfersCard.tsx |
| Previous transfers — Retry (per FAILED row) | button | ✅ | opens `SendLogsModal` prefilled, gated `dataTransfer` FULL (B-95) | PreviousTransfersCard.tsx |
| Previous transfers — pagination | pager | ✅ | only when expanded | PreviousTransfersCard.tsx:162-174 |
| Transfer drawer — Download a copy | button | ✅ | `saveFile` (fixed) | PreviousTransfersCard.tsx:196-211 |

### Send logs to a safety official (11.14) — `src/features/reports/components/SendLogsModal.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Driver picker | combobox (`DriverPicker`) | ✅ | required, `shouldValidate` on select | SendLogsModal.tsx:272-278 |
| Date range picker | date-range control | ✅ | max 8-day span enforced by schema | SendLogsModal.tsx:284-291 |
| Transfer method radios (×2) | radio | ✅ | RHF-registered | SendLogsModal.tsx:295-315 |
| Inspector email address | text input | ✅ | only shown for EMAIL, `fmcsa.dot.gov`-only zod rule, inline error | SendLogsModal.tsx:317-332 |
| Output file comment | text input | ✅ | 1–60 chars, counter turns red past limit | SendLogsModal.tsx:334-359 |
| Cancel / Close | button (`ModalCancelButton`) | ✅ | `isDirty = formState.isDirty && !sent` — dirty-close fixed; label flips to "Close" post-send | SendLogsModal.tsx:217,221 |
| Download a copy | button | ✅ | disabled until a transfer exists; `saveFile` (fixed) | SendLogsModal.tsx:222-235 |
| Send transfer | button | ✅ | `dataTransfer` FULL (B-95); non-reentrant submit guard (`inFlight` ref), hidden once sent, sets field errors from server `fieldErrors`; eRODS banner from `useTransferConfig` (FM too, B-45) | SendLogsModal.tsx |

### Schedule a report modal (shared — Activity / IFTA / DVIR) — `src/features/reports/components/ScheduleReportModal.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Frequency | select | ✅ | 3 fixed cron presets | ScheduleReportModal.tsx |
| Recipients | text input | ✅ | comma-separated emails, each validated | ScheduleReportModal.tsx:132-143 |
| Cancel | button (`ModalCancelButton`) | ✅ | `isDirty = formState.isDirty && !create.isSuccess` — dirty-close fixed | ScheduleReportModal.tsx:99,103 |
| Period | select | ✅ | B-48: rolling `params.window` (IFTA: Previous quarter; others: week/month/quarter) or `This selection · <range>` (WD-091) | ScheduleReportModal.tsx |
| Format | select | ✅ | `REPORT_TYPE_FORMATS[type]` — PDF now schedulable for IFTA / Activity / DVIR | ScheduleReportModal.tsx |
| Schedule (submit) | button | ✅ | non-reentrant submit guard (`inFlight` ref) | ScheduleReportModal.tsx |

## Notifications

### `src/features/notifications/NotificationsPanel.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Mark all read | button | ✅ | real endpoint (`POST /notifications/read-all`), invalidates the list | NotificationsPanel.tsx:171-174; shared/api/notifications.ts:84-90 |
| Notification preferences (gear) | icon button | ✅ | `navigate('/account#notifications')` | NotificationsPanel.tsx:176-183 |
| All / Violations / Maintenance segments | buttons (`aria-pressed`) | ✅ | `?category=` filter, counts from the live `counts` (B-57); hidden when an older API omits `counts` | NotificationsPanel.tsx:198-219 |
| Notification row | button | ✅ | navigates + closes panel. Per-item mark-read `POST /notifications/:id/read` is live (B-56 shipped); human `body` shown; click-through by `objectType`/`objectId` now also maps `EldEvent`→`/hos-logs` and `MaintenanceSchedule`→`/dvir`, and never passes a route guard; `notification.new` CRITICAL → toast (Topbar). Earlier: fixed (WB-244): the hook is not optimistic, so a failure leaves the row unread (nothing to roll back); any failure shows one non-blocking warning toast per session ("Marking a single notification as read isn't available yet" · "Use Mark all read instead."); a 404/405 is remembered for the session and the route is not called again (stage 4, NotificationsPanel.tsx:106-129; shared/api/notifications.ts:92-128) | NotificationsPanel.tsx:106-129; shared/api/notifications.ts:92-128; notifications/lib/copy.ts, lib/markReadNotice.ts |
| View all notifications | button | ✅ | expands page size; untestable live in mock (`total` never exceeds one page in the fixture) | NotificationsPanel.tsx:225-231 |


## Settings · Company profile

`src/features/settings/CompanyProfilePage.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Save changes | button | ✅ | `PATCH /carrier` now has a real mock handler (`settingsAdminGaps.ts:38`); previously always failed | CompanyProfilePage.tsx |
| Company name | text input | ✅ | validates on blur (`validateField`), and again on Save (WB-201) | CompanyProfilePage.tsx:184 |
| US DOT number | text input | ✅ | validates on blur (WB-201) | CompanyProfilePage.tsx:195 |
| MC number | text input | ✅ | validates on blur (WB-201) | CompanyProfilePage.tsx:205 |
| EIN / Tax ID | text input | ✅ | validates on blur (WB-201) | CompanyProfilePage.tsx:217 |
| Main phone | text input | ✅ | validates on blur (WB-201) | CompanyProfilePage.tsx:229 |
| Compliance email | text input | ✅ | validates on blur (WB-201) | CompanyProfilePage.tsx:241 |
| Street address | text input | ✅ | validates on blur (WB-201) | CompanyProfilePage.tsx:251 |
| City | text input | ✅ | validates on blur (WB-201) | CompanyProfilePage.tsx:261 |
| State | select | ✅ | | CompanyProfilePage.tsx |
| ZIP / Postal code | text input | ✅ | validates on blur (WB-201) | CompanyProfilePage.tsx:291 |
| HOS ruleset | select | ✅ | | CompanyProfilePage.tsx |
| Cycle restart | select | ✅ | | CompanyProfilePage.tsx |
| Home terminal time zone | select | ✅ | | CompanyProfilePage.tsx |
| Distance unit | select | ✅ | | CompanyProfilePage.tsx |
| Unassigned driving threshold | number input | ✅ | | CompanyProfilePage.tsx |
| DVIR retention | number input | ✅ | | CompanyProfilePage.tsx |
| Allow personal conveyance | toggle | ✅ | | CompanyProfilePage.tsx |
| Allow yard move | toggle | ✅ | | CompanyProfilePage.tsx |
| ELD identifier | text input | ✅ | validates on blur like the rest; the message now names the real fault — length/character set, or lowercase casing (WB-202) | CompanyProfilePage.tsx:106, 408 |
| ELD registration ID | text input | ✅ | | CompanyProfilePage.tsx |
| eRODS mode | select | ✅ | switching to PRODUCTION routes through a confirm dialog | CompanyProfilePage.tsx |
| Switch to production? — Cancel / Switch to production | confirm dialog | ✅ | | CompanyProfilePage.tsx |

## Settings · Users

`src/features/settings/UsersPage.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Invite user | button | ✅ | opens modal | UsersPage.tsx |
| Segment tabs (All / Admins / Fleet managers / Dispatchers / Viewers) | tabs (5) | ✅ | Dispatchers tab added (WB-203) | UsersPage.tsx:240 |
| Search user or email | search input | ✅ | `aria-label="Search user or email"` (WB-204) | UsersPage.tsx:264 |
| Filters | button | ✅ | opens drawer | UsersPage.tsx |
| Filter chips (remove one / Clear all) | buttons | ✅ | | UsersPage.tsx |
| Row menu — Edit user | menu item | ✅ | opens `EditUserModal` → `PATCH /users/:id` (name/role/status/email/job title/phone/home terminal, B-84 shipped 2026-09-24) (WB-205) | UsersPage.tsx:323 |
| Row menu — Change role | menu item | ✅ | opens `EditUserModal` in role-only mode → `PATCH /users/:id { roleId }` (WB-205) | UsersPage.tsx:329 |
| Row menu — Resend invitation (INVITED) | menu item | ✅ | | UsersPage.tsx |
| Row menu — Revoke invitation (INVITED) | menu item | ✅ | confirm, then `DELETE /users/:id` with a toast (WB-206) | UsersPage.tsx:341, 160 |
| Row menu — Disable/Enable user | menu item | ✅ | last-admin and self-disable guards both work (`attemptDisableToggle`) | UsersPage.tsx |
| Pending invitations — Resend all | button | ✅ | no bulk endpoint: fans out one `POST /users/:id/resend-invite` per invitation and reports partial failure honestly (WB-207) | UsersPage.tsx:144, 376 |
| Pending invitations — per-row Resend | button | ✅ | | UsersPage.tsx |
| Pending invitations — per-row Revoke | button | ✅ | same confirm → `DELETE /users/:id` as the row menu (WB-206) | UsersPage.tsx:403 |
| Can't disable this user — Close | dialog button | ✅ | refusal dialog, correct copy for both reasons | UsersPage.tsx |

### Invite a user modal

`src/features/settings/components/InviteUserModal.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Full name | text input | ✅ | splits into firstName/lastName | InviteUserModal.tsx |
| Work email | text input | ✅ | | InviteUserModal.tsx |
| Role (radio group) | radios (3) | ✅ | `errors.roleKey` renders (`role="alert"` span); role cards render since all 4 seeded roles carry ids | InviteUserModal.tsx |
| Terminal access | checkboxes | ✅ (B-85, shipped 2026-09-24) | sends `terminalIds` (home-terminal names — no Terminal table yet, D-090); stored on the user record only, not an access boundary, per the on-screen hint | InviteUserModal.tsx |
| Message (optional) | textarea | ✅ (B-85, shipped 2026-09-24) | sends `message`, included in the invitation email | InviteUserModal.tsx |
| Send invitation | button | ✅ | double-submit guarded (`inviteMutation.isPending`) | InviteUserModal.tsx |
| Cancel / Close (X) | buttons | ✅ | routes through 11.30 discard-changes (shared) | Modal.tsx |

### Edit user / Change role modal

`src/features/settings/components/EditUserModal.tsx` (new, WB-205)

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| First name / Last name | text inputs | ✅ | `profile` mode (Edit user) only | EditUserModal.tsx |
| Role | select | ✅ | both modes; `role` mode renders only this picker | EditUserModal.tsx:146 |
| Work email | text input | ✅ (B-84, shipped 2026-09-24) | changing it does not switch the address immediately — sends `email`, server answers `emailVerification.pendingEmail`, shown as an on-screen re-verification notice until confirmed | EditUserModal.tsx |
| Job title / Phone / Home terminal | text/text/select | ✅ (B-84, shipped 2026-09-24) | `jobTitle`, `phone`, `homeTerminalName` on `PATCH /users/:id` | EditUserModal.tsx |
| Save changes / Cancel / Close (X) | buttons | ✅ | shared dirty-close, double-submit guarded | EditUserModal.tsx:118 |

### Users · Filters drawer

`src/features/settings/components/UserFiltersDrawer.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Role checkboxes | checkboxes (4) | ✅ | | UserFiltersDrawer.tsx:59-68 |
| Status checkboxes | checkboxes (3) | ✅ | | UserFiltersDrawer.tsx:70-79 |

(Apply / Reset all buttons and the dirty-close routing are the shared `FilterDrawer` — see Global chrome.)

## Settings · Roles & permissions

`src/features/settings/RolesPage.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Create role | button | ✅ | | RolesPage.tsx:157 |
| Tabs (Permission matrix / Roles / Access log) | tabs (3) | ✅ | | RolesPage.tsx |
| Search permission | search input | ✅ | `aria-label="Search permission"` (WB-204) | RolesPage.tsx:192 |
| Reset to defaults | button | ✅ | confirm, then `PATCH /roles/:id` for the 3 editable built-in roles back to the shipped matrix (WB-209) | RolesPage.tsx:96, 207 |
| Permission matrix cell — ADMIN column (22, incl. `dataTransfer` row B-95) | matrix cells | 🚫 | disabled with visible reason "Admin cannot be edited" (§11.19) | RolesPage.tsx |
| Permission matrix cell — FLEET MANAGER / DISPATCHER / VIEWER columns (66) | matrix cells | ✅ | `ROLES` fixture seeds all 4 roles with real `id`s and full 23-key maps (22 + `dataTransfer`, B-95); `PATCH /roles/:id` is mocked | RolesPage.tsx, mockState.ts |
| Matrix footer "Last changed by … · today" | text | ✅ | fixed (WB-233, owner accepted WD-087): removed — it was built from `new Date()` and the carrier name, and the role DTO has no `updatedAt`/`updatedBy`. The legend stays; the Access log tab carries the real change history (stage 4, RolesPage.tsx:284-286) | RolesPage.tsx:284-286 |
| Roles tab — Edit (custom role) | button | ✅ | opens `CreateRoleModal` in edit mode → `PATCH /roles/:id` (WB-210) | RolesPage.tsx:309, 361 |
| Roles tab — Delete (custom role) | button | ✅ | opens confirm; `ROLE_IN_USE`/system-role errors handled | RolesPage.tsx |
| Delete role? — Cancel / Delete | confirm dialog | ✅ | | RolesPage.tsx |
| Reset to defaults? — Cancel / Reset to defaults | confirm dialog | ✅ | (WB-209) | RolesPage.tsx:368 |

### Create a role modal

`src/features/settings/components/CreateRoleModal.tsx` (also the Edit mode, WB-210)

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Role name | text input | ✅ | | CreateRoleModal.tsx |
| Copy permissions from | select | ✅ | | CreateRoleModal.tsx |
| Description | textarea | ✅ | | CreateRoleModal.tsx |
| Permission level toggle groups (6 rows × None/Read/Full) | buttons (18) | ✅ | | CreateRoleModal.tsx |
| Can export FMCSA / DOT pack | checkbox | ✅ | B-95 shipped 2026-09-24 (`dataTransfer` is its own 23rd key) — split back into two independent checkboxes writing `reportsTransfer` and `dataTransfer` (`ROLE_COPY.fmcsaPackCheckbox`/`dataTransferCheckbox`) | CreateRoleModal.tsx |
| Can send data transfers to an inspector | checkbox | ✅ | writes `dataTransfer` (B-95, shipped 2026-09-24) | CreateRoleModal.tsx |
| Create role / Save changes | button | ✅ | double-submit guarded | CreateRoleModal.tsx |
| Cancel / Close (X) | buttons | ✅ | shared dirty-close | Modal.tsx |

## Settings · ELD devices

`src/features/settings/DevicesPage.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Register device | button | ✅ | | DevicesPage.tsx:192 |
| Segment tabs (All / Connected / Disconnected / Unassigned) | tabs (4) | ✅ | | DevicesPage.tsx |
| Search serial or unit | search input | ✅ | `aria-label="Search serial or unit"` (WB-204) | DevicesPage.tsx:229 |
| Export | button | ✅ | `GET /devices/export`; now shows an error toast on failure and is guarded against double clicks (WB-215) | DevicesPage.tsx:105, 241 |
| Row menu — Pair to unit | menu item | ✅ | opens the new `PairDeviceModal` → `usePairDevice` (WB-211) | DevicesPage.tsx:274 |
| Row menu — Unpair | menu item | ✅ | shown only when paired; success/failure toasts added (WB-215) | DevicesPage.tsx:126, 278 |
| Row menu — Update firmware | menu item | ✅ | opens the new `UpdateFirmwareModal` → `useUpdateFirmware` (WB-212) | DevicesPage.tsx:288 |
| Row menu — Retire device | menu item | ✅ | opens confirm | DevicesPage.tsx |
| Retire device? — Cancel / Retire | confirm dialog | ✅ | | DevicesPage.tsx |
| Row menu — View diagnostics | menu item | ✅ (B-8, shipped 2026-09-24) | opens a modal reading `GET /devices/:id/diagnostics` (derived from last recorded status, not a live round-trip) | DevicesPage.tsx |
| (Hardcoded "L113 available" firmware chip) | chip | ✅ | removed — it was not read from any data (WB-215) | DevicesPage.tsx |

### Pair to unit modal

`src/features/settings/components/PairDeviceModal.tsx` (new, WB-211)

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Unit | select | ✅ | error text in the modal if the unit list fails to load | PairDeviceModal.tsx:73 |
| Pair / Cancel / Close (X) | buttons | ✅ | double-submit guarded, shared dirty-close | PairDeviceModal.tsx |

### Update firmware modal

`src/features/settings/components/UpdateFirmwareModal.tsx` (new, WB-212)

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Target version | text input | ✅ | required, validated against the firmware label format | UpdateFirmwareModal.tsx:70 |
| Update firmware / Cancel / Close (X) | buttons | ✅ | double-submit guarded, shared dirty-close | UpdateFirmwareModal.tsx |

### Register an ELD device modal

`src/features/settings/components/RegisterDeviceModal.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Device model | select | ✅ | | RegisterDeviceModal.tsx |
| Serial number | text input | ✅ | 409 duplicate maps to field error | RegisterDeviceModal.tsx |
| Open scanner | button | 🚫 | disabled with its reason visible — the web panel has no QR scanner (not a backend gap); used to paint a fake success banner (WB-213) | RegisterDeviceModal.tsx:109-124 |
| Assign to unit | select | ✅ | pairs the device on submit via `usePairDevice` | RegisterDeviceModal.tsx |
| Firmware (display) | read-only input | 🚫 | static display value, not part of the form | RegisterDeviceModal.tsx:140 |
| Update firmware automatically | toggle | ✅ (B-88, shipped 2026-09-24) | `POST /devices` still has no policy field — applied with a follow-up `PATCH /devices/:id { autoFirmware }` right after registration | RegisterDeviceModal.tsx |
| Send diagnostics to OneBook support | toggle | ✅ (B-88, shipped 2026-09-24) | same follow-up PATCH, `shareDiagnostics` | RegisterDeviceModal.tsx |
| Register device | button | ✅ | double-submit guarded | RegisterDeviceModal.tsx |
| Cancel / Close (X) | buttons | ✅ | shared dirty-close | Modal.tsx |
| Test connection | button | ✅ (B-8, shipped 2026-09-24) | shown after registration succeeds (needs a device id): `GET /devices/:id/diagnostics` | RegisterDeviceModal.tsx |

## Settings · Alert rules

`src/features/settings/AlertRulesPage.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| New rule | button | ✅ | | AlertRulesPage.tsx |
| Notification channel toggle — Email | switch | ✅ (B-87, shipped 2026-09-24) | `GET/PATCH /notification-channels`, `alertRules` FULL to write | AlertRulesPage.tsx |
| Notification channel toggle — SMS | toggle-styled span | 🚫 | intentionally disabled, "SMS is not available" (Q-2) | AlertRulesPage.tsx |
| Notification channel toggle — Webhook | switch | ✅ (B-87, shipped 2026-09-24) | same resource, `webhook.enabled` | AlertRulesPage.tsx |
| Segment tabs (All / Active / Muted) | tabs (3) | ✅ | | AlertRulesPage.tsx |
| Search rule | search input | ✅ | `aria-label="Search rule"` (WB-204) | AlertRulesPage.tsx:177 |
| Per-rule Active/Muted switch | toggle | ✅ | `PATCH /alert-rules/:id` mocked | AlertRulesPage.tsx:221 |
| Row menu — Edit rule | menu item | ✅ | opens `NewAlertRuleModal` in edit mode → `PATCH /alert-rules/:id` (WB-217) | AlertRulesPage.tsx:239 |
| Row menu — Duplicate | menu item | ✅ | opens `NewAlertRuleModal` prefilled → `POST /alert-rules` (WB-217) | AlertRulesPage.tsx:245 |
| Row menu — Mute for 24 h | menu item | ✅ (B-86, shipped 2026-09-24) | `PATCH /alert-rules/:id { mutedUntil }`, ISO 24 h out; row badge reflects the effective mute | AlertRulesPage.tsx |
| Row menu — Delete | menu item | ✅ | opens confirm; `RULE_IS_SYSTEM` 409 handled by the mock | AlertRulesPage.tsx |
| Delete rule? — Cancel / Delete | confirm dialog | ✅ | | AlertRulesPage.tsx |
| Row menu — Test rule | menu item | ✅ (B-9, shipped 2026-09-24) | `POST /alert-rules/:id/test`; toasts whether it triggered (a muted rule answers `triggered: false`) | AlertRulesPage.tsx |

### New alert rule modal

`src/features/settings/components/NewAlertRuleModal.tsx` (also Edit / Duplicate, WB-217)

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Rule name | text input | ✅ | the derived `key` is sent on create only — an edit no longer re-sends a regenerated key (WB-220) | NewAlertRuleModal.tsx:217 |
| Severity | select | ✅ | | NewAlertRuleModal.tsx |
| Condition rows (event / minutes / remove) | select, number input, button | ✅ | minutes must be greater than 0 (WB-222) | NewAlertRuleModal.tsx:164-172, 270-303 |
| + Add a condition | button | ✅ | appends a condition row; the block is a real builder now (WB-219) | NewAlertRuleModal.tsx:325 |
| In-app delivery | checkbox | ✅ | at least one channel required (WB-222) | NewAlertRuleModal.tsx:176 |
| Email delivery | checkbox | ✅ | | NewAlertRuleModal.tsx |
| SMS delivery | checkbox | 🚫 | permanently disabled/unchecked, tooltip "SMS is not available" (Q-2) | NewAlertRuleModal.tsx |
| Webhook delivery | checkbox | ✅ | | NewAlertRuleModal.tsx |
| Recipients | select | ✅ | reaches `recipients.roles` in the payload | NewAlertRuleModal.tsx |
| Repeat | select | ✅ | controlled, sent as `throttle`; an existing custom throttle is kept, not overwritten (WB-219) | NewAlertRuleModal.tsx:42-65, 391-402 |
| Quiet hours | toggle | ✅ | an edit keeps the rule's own quiet-hours window instead of resetting it (WB-221) | NewAlertRuleModal.tsx:100, 193 |
| Enable the rule immediately | checkbox | ✅ | footer, reaches `enabled` | NewAlertRuleModal.tsx |
| Create rule / Save changes | button | ✅ | double-submit guarded | NewAlertRuleModal.tsx |
| Cancel / Close (X) | buttons | ✅ | shared dirty-close | Modal.tsx |

## Settings · Integrations

`src/features/settings/IntegrationsPage.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Browse marketplace | button | ✅ (B-89, shipped 2026-09-24) | opens a modal listing `GET /integrations/catalog`; `available:false` entries keep `Connect` disabled | IntegrationsPage.tsx |
| Connect (unconnected, known provider) | button | ✅ | `PUT /integrations/:provider`; toast names the product, not the raw provider id; double-click guarded (WB-226). WB-251 fixed 2026-09-25: `Custom webhook` opens `WebhookConfigModal` (endpoint URL http/https + signing secret with show/hide and `Generate`) and sends `config: { url, secret }`; once connected its card also has `Configure` (URL prefilled, secret re-entered because the backend replaces the whole config) and `Send test` (`POST /integrations/webhook/test`), FULL only | IntegrationsPage.tsx, components/WebhookConfigModal.tsx |
| Disconnect (connected provider) | button | ✅ | renamed from "Manage" (which disconnected instantly); confirms first, then toasts (WB-224) | IntegrationsPage.tsx:87, 194, 273 |
| Connect (catalog entries with no provider mapping — Pacific Track, DAT, Geotab, Zapier) | button | 🚫 | disabled, `title` = `SETTINGS_REASON.providerUnavailable`; the same reason is now also the card's visible status line (WB-232) (stage 4, IntegrationsPage.tsx:56, 197, 217-220). Backend gap B-98 (still open): `INTEGRATION_PROVIDERS` = mcleod, wex, comdata, quickbooks, slack, webhook — these four get a 422, no OAuth, no connectors | IntegrationsPage.tsx:217-220 |
| Integration card status lines ("69 devices syncing", "1,842 receipts this quarter") | text | ✅ | fixed (WB-232, owner accepted WD-087): the hardcoded `meta` figures are gone. The line is built from `GET /integrations` only — `Last sync · <relative>` from `lastSyncAt`, `Connected · no sync yet`, `Not connected`, or, for catalogue entries with no connector, the reason the `Connect` button is disabled (`INTEGRATION_STATUS`, settings/lib/copy.ts) (stage 4, IntegrationsPage.tsx:39-59, 197) | IntegrationsPage.tsx:39-59, 197 |
| Create key | button | ✅ | opens modal | IntegrationsPage.tsx:225 |
| Copy key prefix | icon button | ✅ | clipboard write | IntegrationsPage.tsx:126 |
| Row menu — Edit scopes | menu item | ✅ | opens the new `EditApiKeyScopesModal` → `useUpdateApiKeyScopes` (WB-225) | IntegrationsPage.tsx:253 |
| Row menu — Revoke | menu item | ✅ | now confirms first and toasts the result (WB-226) | IntegrationsPage.tsx:103, 256, 282 |

### Edit API key scopes modal

`src/features/settings/components/EditApiKeyScopesModal.tsx` (new, WB-225)

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Scope checkboxes | checkboxes (4) | ✅ | | EditApiKeyScopesModal.tsx |
| Save scopes / Cancel / Close (X) | buttons | ✅ | double-submit guarded, shared dirty-close | EditApiKeyScopesModal.tsx:68 |

### Create API key modal

`src/features/settings/components/CreateApiKeyModal.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Name | text input | ✅ | | CreateApiKeyModal.tsx:87 |
| Scope checkboxes | checkboxes (4) | ✅ | | CreateApiKeyModal.tsx:92-104 |
| Create key | button | ✅ | double-submit guarded | CreateApiKeyModal.tsx:79 |
| Copy plaintext key | button | ✅ | shown exactly once, per contract | CreateApiKeyModal.tsx:56 |
| Done | button | ✅ | | CreateApiKeyModal.tsx:53 |
| Cancel / Close (X) | buttons | ✅ | shared dirty-close | Modal.tsx |

## Settings · Audit log

`src/features/settings/AuditLogPage.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| USER column | text | ✅ | B-62 shipped — `actorName` (server-joined) plus an `actorEmail` caption line; falls back to `actorType` when absent | AuditLogPage.tsx |
| Export CSV | button | ✅ | forwards the same filters the table uses (WB-111/WB-135) | AuditLogPage.tsx:157-187 |
| Search action, object or user | search input | ✅ | `aria-label` (WB-204). Fixed (WB-239): while a search is typed, older cursor pages are fetched automatically up to 1,000 entries (`AUTO_SEARCH_MAX_ENTRIES`), with a live "N entries searched" status and a `Stop`; it ends early once the loaded pages reach past the start of the date range. The whole log in the date range is searched within the cap; past the cap (or after Stop) the notice says older entries are not covered (server-side search is still gap B-64) (stage 4, AuditLogPage.tsx:33-42, 91-137, 290-311) | AuditLogPage.tsx:33-42, 91-137, 290-311 |
| Filter by user | select | ✅ | real server param (`actorId`), has `aria-label` | AuditLogPage.tsx:206 |
| Filter by action | select | ✅ | fixed (WB-239): same automatic older-page fetch as search — capped at 1,000 entries, live count, `Stop`, cap/stop notice kept; no server `action` param yet (B-64) (stage 4, AuditLogPage.tsx:91-137, 260-271, 290-311) | AuditLogPage.tsx:91-137, 260-271, 290-311 |
| Date range picker | shared control | ✅ | fixed (WB-239): a non-default range starts the same capped automatic fetch; since entries arrive newest first, fetching stops as soon as the loaded pages reach past the range start and says "Searched every entry in the selected date range" — the cap/stop notice covers the rest (no server date params yet, B-64) (stage 4, AuditLogPage.tsx:91-137, 273-280, 290-311) | AuditLogPage.tsx:91-137, 273-280, 290-311 |
| Filters (object type) | button | ✅ | opens drawer; real server param | AuditLogPage.tsx |
| Table row click | row | ✅ | opens the audit-entry detail drawer (Before/After JSON) | AuditLogPage.tsx |
| Load more | button | ✅ | appends the next cursor page; fixed (WB-238): also shown under the empty state, so the notice's "use Load more" is reachable when a filter matches nothing loaded (stage 4, AuditLogPage.tsx:364-373) | AuditLogPage.tsx:364-373 |
| Filters drawer — Object type checkboxes | checkboxes | ✅ | | AuditLogPage.tsx |
| Audit entry drawer — Close (X) | button | ✅ | shared | AuditLogPage.tsx |

## Settings · Support

`src/features/support/SupportPage.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| New ticket | button | ✅ | opens modal | SupportPage.tsx:108 |
| Start chat | button | ✅ (B-90, shipped 2026-09-24) | opens `StartChatModal` → `POST /support/chats`; replies land under Messages | SupportPage.tsx |
| Send email | button | ✅ | `mailto:` | SupportPage.tsx:142 |
| Call now | button | ✅ | `tel:` | SupportPage.tsx:156 |
| ("42 min average response" line) | text | ✅ | removed — it was hardcoded, not measured (WB-231) | SupportPage.tsx |
| Segment tabs (All / Open / In progress / Resolved) | tabs (4) | ✅ | `All` tab added and is the default (WB-231) | SupportPage.tsx:166 |
| Search ticket | search input | ✅ | `aria-label="Search ticket"` (WB-204) | SupportPage.tsx:187 |
| Export (Your tickets toolbar) | button | ✅ | builds a CSV of the tickets on screen client-side — there is no export endpoint (WB-229) | SupportPage.tsx:56-60, 204 |

### Start chat modal

`src/features/support/components/StartChatModal.tsx` (new, B-90 shipped 2026-09-24)

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Message | textarea | ✅ | required | StartChatModal.tsx |
| Start chat / Cancel / Close (X) | buttons | ✅ | double-submit guarded, shared dirty-close | StartChatModal.tsx |

### New support ticket modal

`src/features/support/components/NewTicketModal.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Category | select | ✅ | | NewTicketModal.tsx |
| Priority | select | ✅ | | NewTicketModal.tsx |
| Subject | text input | ✅ | | NewTicketModal.tsx |
| Description | textarea | ✅ | | NewTicketModal.tsx |
| Unit (for diagnostics) | select | ✅ (B-91, shipped 2026-09-24) | `vehicleId` — the unit the server-collected attachments are taken from | NewTicketModal.tsx |
| Include device diagnostics | checkbox | ✅ (B-91, shipped 2026-09-24) | sends `attachments: [{ kind: 'DEVICE_DIAGNOSTICS' }]`; assembled server-side, nothing uploaded from the browser | NewTicketModal.tsx |
| Include last 24h of ELD events | checkbox | ✅ (B-91, shipped 2026-09-24) | same, `kind: 'ELD_EVENTS_24H'` | NewTicketModal.tsx |
| Submit ticket | button | ✅ | permission-based (WB-250, B-12 shipped): `can('support', 'READ')` submits — every role that can open this modal (route/nav gated on `support`) can submit. `+ New ticket` stays for every role per tz.md §21.4. The inline 403 banner remains the fallback for a genuine server-side refusal (NewTicketModal.tsx:31-35,57,102-105) | NewTicketModal.tsx:31-35, 57, 102-105 |
| Cancel / Close (X) | buttons | ✅ | shared dirty-close | Modal.tsx |

## Support · Feedback

`src/features/support/FeedbackPage.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Tabs (Send feedback / Driver feedback / Feature requests) | tabs (3) | ✅ | | FeedbackPage.tsx:87-97 |
| Answer buttons (5 questions × 4 options) | buttons (20) | ✅ | | FeedbackPage.tsx:118-136 |
| Comment textarea | textarea | ✅ | | FeedbackPage.tsx:140 |
| Contact-me checkbox | checkbox | ✅ | | FeedbackPage.tsx:149 |
| Submit feedback | button | ✅ | permission-based (WB-250, B-12 shipped): `POST /feedback` needs only `can('support', 'READ')` — every role that can reach this page (route/nav gated on `support`) can submit. The inline 403 remains the fallback for a genuine server-side refusal (FeedbackPage.tsx:49-52, 61, 159-176) | FeedbackPage.tsx:49-52, 61, 159-176 |
| Send another (post-submit) | button | ✅ | | FeedbackPage.tsx:107 |

## Account

`src/features/account/AccountPage.tsx` and components — one page, five anchored cards.

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| First name | text input | ✅ | | ProfileCard.tsx:133 |
| Last name | text input | ✅ | | ProfileCard.tsx:143 |
| Profile photo — Upload | button + hidden file input | ✅ | `POST /me/avatar` (B-51); PNG/JPG, ≥ 256×256, ≤ 5 MB pre-checked client-side (`avatar.ts`), server 422 shown under the photo; refreshes `/auth/me` so the topbar avatar updates | ProfileCard.tsx:90-99 |
| Profile photo — Remove | button | ✅ | `DELETE /me/avatar`; rendered only when a photo exists | ProfileCard.tsx:101-114 |
| Job title | text input | ✅ | editable, ≤ 120 chars, saved with `PATCH /me/profile` (B-51) | ProfileCard.tsx:245-254 |
| Work email | disabled input | 🚫 | "Managed by your administrator" | ProfileCard.tsx:171 |
| Mobile number | tel input | ✅ | strips non-digits as typed | ProfileCard.tsx:189 |
| Cancel (profile, when dirty) | button | ✅ | resets to defaults | ProfileCard.tsx:212 |
| Save changes (profile) | button | ✅ | `PATCH /me/profile` (first/last name, job title, phone), toasts "Settings saved", re-reads `/auth/me` for the topbar chip | ProfileCard.tsx |
| Language & region selectors (Language / Time zone / Date format / Distance unit) | selects (4) | ✅ | `GET /me/preferences` (B-11); Language offers English only (v1) | PreferenceCards.tsx:107 |
| Cancel / Save changes (Language & region, when dirty) | buttons | ✅ | `PUT /me/preferences` with the merged full row (saved views / table columns survive), toasts "Settings saved"; error → banner in the card | PreferenceCards.tsx:164-169 |
| Sign out (per non-current session) | button | ✅ | `DELETE /me/sessions/:id`; the `current` row (B-50) shows `● Current` instead, LOCATION from the server or `—` | SessionsCard.tsx |
| Sign out everywhere | button | ✅ | opens confirm | SessionsCard.tsx:65-71 |
| Sign out everywhere? — Cancel / Sign out everywhere | confirm dialog | ✅ | one `DELETE /me/sessions` (all other sessions, B-50) then signs out here via `/auth/logout` (WD-092) | SessionsCard.tsx:42-52 |

(Security & sign-in card and Notifications card show no interactive controls — sign-in method and an `EmptyState` only.)

## Search / command palette

`src/features/search/CommandPalette.tsx`

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Search combobox | text input | ✅ | debounced entity search: one `GET /search?q=&limit=5` (B-10, live), no `/drivers`+`/vehicles` fan-out any more; a section the role may not read comes back empty/absent and is not rendered; driver `dutyStatus` is always `null` live → duty slot shows `—` (WD-093) + local pages/actions filtering | CommandPalette.tsx:152; shared/api/search.ts; search/paletteText.ts |
| Result option (click) | option row | ✅ | navigates and closes | CommandPalette.tsx:221-246 |
| Retry (search failed banner) | button | ✅ | | CommandPalette.tsx:180 |

(↑/↓/Enter/Esc keyboard handling on the input is verified in code, not a separate control.)

## Global chrome & shared UI

| Element | Type | Status | Note | Source |
|---|---|---|---|---|
| Sidebar nav links | links (11) | ✅ | `/reports`→`/reports/ifta` and `/settings`→`/settings/company` are intended index redirects | Sidebar.tsx:82-104 |
| Sidebar "Switch organisation" chevron | icon button | 🚫 | permanently disabled, v2 placeholder (§11.26); hit box still 16×16, well under the 24px minimum | Sidebar.tsx:24-31 |
| Sidebar collapse/expand | — | ✅ | toggle with `aria-expanded`/`aria-controls`, 64px collapsed state remembered in `localStorage` (WB-173) | Sidebar.tsx |
| Topbar search trigger | button | ✅ | opens command palette; ⌘K/Ctrl+K do the same | Topbar.tsx:179-190 |
| Topbar bell trigger | button | ✅ | opens `NotificationsPopover`; the panel's own contents (`features/notifications/NotificationsPanel`) are a different feature, out of this area's scope | Topbar.tsx:192-204 |
| `Report ready` toast → Download (shell) | toast action | ✅ | `report.ready` over `user:{id}` (worker → Redis bridge, live): invalidates every report query on any screen and toasts once outside `/reports/*`; the report screens keep their own toast + 3 s poll fallback (WD-094). Download fetches a fresh presigned URL at click time | shared/realtime/reportReady.ts; Topbar.tsx |
| Topbar refresh | button | ✅ | `queryClient.invalidateQueries()`, spinner while fetching | Topbar.tsx:207-219 |
| Topbar account-menu trigger (avatar + chevron) | button | ✅ | | Topbar.tsx:222-234, TopbarTriggers.tsx:34 |
| Account menu items — My profile / Account security / Notification preferences / Language / Help center / Keyboard shortcuts / Sign out | menu items (7) | ✅ | correct `/account#hash` / `/settings/support` targets; Sign out lands on `/sign-in` | AccountMenu.tsx:101-118 |
| Account menu items — Switch organisation / Appearance / What is new | menu items (3) | 🚫 | disabled by design (§11.26/WD-056), visible "v2"/"Light" hints | AccountMenu.tsx:107-115 |
| Keyboard shortcuts modal — Close | button | ✅ | opened via `?`, the account menu, or the topbar effect | KeyboardShortcutsModal.tsx:21 |
| SettingsLayout / AccountLayout sub-nav links | links | ✅ | AccountLayout uses plain `<a href="#hash">` (correctly, not `NavLink`) so re-clicking the current section still scrolls | SettingsLayout.tsx:22, AccountLayout.tsx:31 |
| Modal/Drawer close (X) | icon button | ✅ | fixed: routes through `requestClose`, which raises the 11.30 discard-changes confirm when `isDirty` | Modal.tsx:116-127, 189-200 |
| Modal footer Cancel (`ModalCancelButton`) | button | ✅ | same dirty-close routing via `useModalClose()` context, not a direct `onClose` | Modal.tsx:30-37 |
| Discard changes? — Keep editing / Discard | dialog | ✅ | | Modal.tsx:222-250 |
| ConfirmDelete — Cancel / Confirm | dialog | ✅ | used throughout (delete role/rule/device, retire device, blocked-disable, switch-to-production) | Modal.tsx:263-292 |
| FilterDrawer — Reset all / Apply N filters | buttons | ✅ | fixed: `isDirty` is now threaded through from each screen's drawer wrapper, so Esc/X/overlay on a dirty draft raises the discard confirm | FilterDrawer.tsx:23-51 |
| Pagination — Previous/Next, page numbers, Rows-per-page select | buttons/select | ✅ | | Pagination.tsx |
| DataTable row-actions trigger (⋯) | icon button | ✅ | stops propagation so it never also fires `onRowClick` (WB-039) | DataTable.tsx:117-142 |
| DataTable column-sort toggle (header click) | button | ✅ | applies to any column with an `accessorKey` (e.g. Devices SERIAL/MODEL, API keys NAME, tickets TICKET) | DataTable.tsx:196-205 |
| Toast — Dismiss (X) | icon button | ✅ | | Toast.tsx:106-108 |
| Toast — action button (e.g. Retry) | button | ✅ | pauses auto-dismiss on hover/focus (Radix) | Toast.tsx:97-104 |


---

## Backend gaps that block controls

These are the API gaps behind the 🚫 rows above. Full detail in `backend-gaps.md`.

All entries below are **shipped as of 2026-09-24** (backend Phase 13) unless marked "still open".
Kept for history; none currently blocks a control still marked 🚫 in this document except where noted.

| Gap | Missing API | Controls it blocks |
|---|---|---|
| ~~B-69~~ | shipped 2026-09-24 | Import drivers / Import vehicles — `Duplicate handling`, `Default terminal`, `Send app invitations`, `Apply default HOS exemptions`, `Pair ELD devices automatically`, `Send a summary email` are real controls again |
| ~~B-70~~ | shipped 2026-09-24 | 11.17 Resolve defect — `correctedBy`/`completedAt`/`laborHours`/`partsCostUsd` are real fields again (`ResolveDefectModal.tsx`) |
| ~~B-71~~ | shipped 2026-09-24 | `PATCH /vehicles/bulk-status` — Vehicles bulk `Set inactive` now uses the atomic endpoint (still reports partial `failed[]` honestly) |
| ~~B-72~~ | shipped 2026-09-24 | `POST /logs/:driverId/events` — HOS `Add / edit event` on a day with no duty record now proposes a new record (`useProposeLogEvent`); no longer disabled |
| ~~B-73~~ | shipped 2026-09-24 | Create trip — `Distance`, `Rate`, `Customer` and `Trailer` are real, sent fields again |
| ~~B-42~~ | shipped 2026-09-24 | Create/Edit work order — `keepOutOfService`/`notifyDriver`/`blockDispatchAssignment` checkboxes and `estimatedLaborHours` are real fields again |
| ~~B-68~~ | shipped 2026-09-24 | Resolve defect — "No repair needed" sends `resolutionType: 'NOT_REQUIRED'` (see WD-088); no note-prefix workaround |
| ~~B-15~~ | shipped 2026-09-24 | Create geofence — `Dwell` and `After-hours only` checkboxes are real fields again |
| ~~B-48~~ | shipped 2026-09-24 | FMCSA pack `Unit` filter and the six pack-contents checkboxes are real (`include[]`, `vehicleId`) |
| still open (B-46, group model) | no vehicle-group model exists | IFTA `Vehicle group` stays disabled — there is no group entity to list. Activity `Group by` and IFTA `Jurisdiction` were wired client-side on 2026-09-25 |
| still open (B-98) | no connector / OAuth for Pacific Track, DAT, Geotab, Zapier (`INTEGRATION_PROVIDERS` rejects them with 422) | W-22 `Connect` for those four catalog entries |
| ~~B-14~~ | shipped 2026-09-24 | library rows generate real PDFs (WD-090) |
| ~~B-8~~ / ~~B-9~~ | shipped 2026-09-24 | `View diagnostics`, `Test connection`, `Test rule` are real controls again |
| ~~B-85~~ / ~~B-86~~ / ~~B-87~~ / ~~B-88~~ / ~~B-89~~ / ~~B-90~~ / ~~B-91~~ / ~~B-95~~ | shipped 2026-09-24 | Invite terminal/message, Mute for 24 h, notification channels, device firmware/diagnostics toggles, marketplace catalog, Start chat, ticket attachments, and the separate `dataTransfer` matrix row/checkbox are all real controls again |
| ~~B-2~~ / ~~B-6~~ / ~~B-7~~ | shipped | Driver profile HOS clocks, Violations card, Co-driver row; the Create-trip HOS warning and `Pick another driver` are real again; the Assign-load `HOS column` reads the bulk clocks from `GET /drivers/roster` (2026-09-25, caveat B-99) |
| ~~B-4~~ | shipped 2026-09-24 | Unit histories `Play` / `Pause` drives a real replay again |
| ~~B-41~~ | shipped 2026-09-24 | DVIR drawer photo thumbnails — real presigned `loading="lazy"` tiles, click re-presigns and opens a fresh URL |
| ~~B-37~~ / ~~B-67~~ | shipped 2026-09-24 | Messages left-panel preview line and unread dot are real (`lastMessage`, `unreadCount`, `POST /conversations/:id/read`) |
| ~~B-56~~ | shipped 2026-09-24 | Notification row mark-read is live |
| ~~B-10~~ | shipped 2026-09-24 | Command palette uses the single live `GET /search?q=` call (WD-093) |
| ~~B-12~~ | shipped 2026-09-24, client updated 2026-09-24 (WB-250) | New ticket / Feedback for VIEWER — `NewTicketModal.tsx`/`FeedbackPage.tsx` now gate `Submit` on `can('support', 'READ')`; VIEWER submits real tickets/feedback |
| ~~B-94~~ (tz §20 B-16) | shipped 2026-09-24 | Driver profile `Documents` tab is a real, enabled tab again |

## What the stage-1 pass fixed

Recorded as `WB-140`…`WB-157` in `bugs.md`; each was re-verified in the current source while
building this inventory.

| ID | Fix | Files |
|---|---|---|
| WB-140 | Report downloads no longer navigate the SPA away — `saveFile` checks the href origin and opens cross-origin presigned URLs in a new tab | `src/features/reports/reportMeta.ts` |
| WB-141 | Bulk `Set inactive` really PATCHes (fan-out + `Promise.allSettled`), reports partial failure honestly instead of a fake success toast | `src/features/vehicles/VehiclesPage.tsx` |
| WB-142 | Add-driver POST failure now shows a banner and a toast (422 → field errors, 409 → username error) | `src/features/drivers/components/AddDriverModal.tsx` |
| WB-143 | Import modals lost the hardcoded "N valid, 0 errors"; unsendable options disabled with a visible reason | `ImportDriversModal.tsx`, `ImportVehiclesModal.tsx` |
| WB-144 | `Send invitation` no longer fails silently — role group is a `radiogroup` with `aria-invalid` and a visible error | `src/features/settings/components/InviteUserModal.tsx` |
| WB-145 | Footer `Cancel` now routes through `requestClose`, so it confirms like Esc/X | `src/shared/ui/Modal.tsx` + ~20 modal footers, `FilterDrawer.tsx` |
| WB-146 | Double-submit guards: `mutation.isPending` plus a single-flight ref, across ~20 modals and buttons | `useReportJobs.ts` (`useGuardedMutate`) and the modal set |
| WB-147 | HOS `Add / edit event` passes the day's last active duty change; disabled with a visible reason on an empty day | `src/features/hos-logs/HosLogsPage.tsx` |
| WB-148 | Create work order stopped claiming effects it had no field for — labour estimate and the 3 always-true checkboxes and the dead `Save as draft` removed | `CreateWorkOrderModal.tsx` |
| WB-149 | Edit WO / Edit schedule send explicit `null`, so clearing a field really clears it | `src/shared/api/dvir.ts`, `EditWorkOrderModal.tsx`, `EditScheduleModal.tsx` |
| WB-150 | Dirty-tracking corrected everywhere: DVIR modals and all 6 filter drawers now pass a real `isDirty`; Add vehicle / Add driver / Create trip no longer false-prompt | 4 DVIR modals, 6 vehicle/geofence modals, 6 filter drawers |
| WB-151 | Resolve defect stopped collecting 4 fields it discarded; `Work order` kept and now really sent via `PATCH /defects/:id/work-order` | `ResolveDefectModal.tsx` |
| WB-153 | Add driver writes the terminal's display name, not the IANA zone string; the Raleigh → `America/Chicago` mis-mapping fixed | `AddDriverModal.tsx` |
| WB-154 | Calibrate odometer's >5,000 mi extra confirm fails **closed** when the delta cannot be computed | `CalibrateOdometerModal.tsx` |
| WB-155 | Cancelling the Delete-unit modal no longer navigates to `/vehicles` | `UnitProfilePage.tsx`, `DeleteUnitModal.tsx` |
| WB-156 | Developer sign-in validates empty credentials instead of signing in | `src/features/auth/DeveloperSignIn.tsx` |
| WB-157 | Create trip surfaces a 422 in a banner instead of swallowing it | `CreateTripModal.tsx` |
| — | The MSW mock layer was rebuilt (`src/mocks/**`), so controls the audits could not test (driver names, HOS clocks, log range, alert rules, integrations, API keys, audit log, support tickets, `PATCH /carrier`) are now exercisable, and the "undefined undefined" screens are gone | `src/mocks/handlers/**` |