# OneBook ELD web — backend gaps

Endpoints the web panel needs that `backend/src/` does not have yet. Ids match `web/tz.md` §20.
Web agents append here; nobody edits `backend/` from the web side.

| Id | Endpoint | Blocks | Status |
|---|---|---|---|
| B-1 | `GET /drivers/roster` | W-06 Drivers (HOS hours, duty status, unit, open violations) | **shipped (backend, 2026-09-14)** — `drivers:READ`; params `page`,`limit`,`sort`,`q`,`status` plus B-55 `terminal`,`hasOpenViolation`,`exempt`; returns the exact `DriverRosterResponse` shape (driver sub-object = the 12 fields in `shared/api/drivers.ts`), clocks from the HOS engine, `emailVerified: null` (B-31). See backend/decisions.md D-051. Live once the API on :3002 is restarted |
| B-2 | `GET /drivers/:id/hos` | W-07, W-16 context panel | **shipped (backend, 2026-09-14)** — `hos:READ` (same key as `GET /logs`); exact `DriverHosResponse` shape computed now by `computeHos`, plus additive `dutyStatus`, `statusSince`, `computedAt`. `breakInSec` = driving seconds until the 30-min break is due; `breakLimitSec` = 28800. 404 `DRIVER_NOT_FOUND` for an unknown id. See backend/decisions.md D-051 |
| B-3 | `GET /live/fleet` | W-02 Live Fleet, W-01 map | **shipped (2026-09-14, backend D-053)** — `@Perm('liveFleet','READ')`, envelope `{ data: { items: LiveFleetUnit[], generatedAt } }`, exactly the 17 fields of `shared/api/liveFleet.ts#LiveFleetUnit`, 10 s server cache. `bleState` is only `CONNECTED`/`DISCONNECTED`/`null` (OUT_OF_RANGE and any heartbeat older than 30 min read `DISCONNECTED`). `ELD_OFFLINE` is only emitted for a unit with no assigned driver; a driven unit keeps its HOS status and shows the link in `bleState`. `IDLE` = ON duty + fresh telemetry with engine on at 0 mph |
| B-4 | `GET /vehicles/:id/histories?date=` | W-05 Unit histories | **confirmed missing** |
| B-5 | `GET /vehicles/:id/activities` | W-04 Unit activity | **confirmed missing** |
| B-6 | `GET /violations`, `POST /violations/:id/resolve` | W-08 Resolve, W-01 View all | **shipped in backend (2026-09-14, D-052)** — `GET /violations` (`hos READ`; `window=24h\|7d\|30d`, `from`/`to`, `driverId`, `type`, `status` default `OPEN`/`ALL`, `page`, `limit≤200`) returns `{ items, total, page, limit, totalPages }` with each `HosViolation` plus `severity`, `driverName`, `vehicleId`, `unitNumber`, `event`, `locationLabel`, `date`; `POST /violations/:id/resolve` (`hosEdit FULL`, `resolutionNote` 4-60) returns `{ id, status: 'RESOLVED', resolvedAt, resolutionNote }`, audited `VIOLATION_RESOLVED`, 404 unknown / 409 not OPEN. Live on :3002 after the next API restart. |
| B-7 | `GET/POST /co-driver-pairings` | W-04 Co-driver row, 11.2/11.4 | **confirmed missing** |
| B-35 | `GET /devices?vehicleId=` or a `device` join on `GET /vehicles/:id` | W-03 `ELD SERIAL` column, W-04 identity panel `ELD device` row | **confirmed missing** — `Device.vehicleId` is the only link (reverse-only from Vehicle); the panel shows `Not assigned` until this lands |
| B-29 | `POST /drivers/:id/send-verification` + `emailVerifiedAt` on `Driver` | 11.8 Add driver, W-07 profile — `Send verification` action | **confirmed missing** — `Driver.email` has no verification state at all |
| B-30 | `Driver.email` required + `@unique` | 11.8 Add driver — Q-3 identity field | **confirmed missing** — `email String?`, not unique; the web enforces uniqueness client-side only (cannot see other drivers' emails to check) until this ships |
| B-31 | `● Email not verified` badge data | W-06 roster, W-07 profile | blocked by B-29 — rendered nowhere in v1, planned prod affordance only |
| B-8 | `GET /devices/:id/diagnostics` | 11.20 Test connection | **confirmed missing** |
| B-9 | `POST /alert-rules/:id/test` | 11.21 Test rule | **confirmed missing** |
| B-10 | `GET /search?q=` | 11.28 Command palette | **confirmed missing** — fan out to `/vehicles` + `/drivers` meanwhile |
| B-11 | `GET/PUT /me/preferences` | 11.24 saved views, column choice | **confirmed missing** — `localStorage` fallback |
| B-12 | `POST /support/tickets` should accept `support:READ`, not just `FULL` | W-24 Viewer `New ticket`, 11.22 | **confirmed missing** — `@Perm('support', 'FULL')` on `SupportController#create`; VIEWER carries `support: READ`. The design shows `+ New ticket` for every role (§21.4 documents this as a deliberate READ exception). The button stays in the DOM for VIEWER; submitting surfaces the server's `403 FORBIDDEN` inline in the modal (`You do not have permission to do that.`) rather than pretending the ticket opened. `POST /feedback` has the same `support:FULL` gate and the same gap for Viewer's `Send feedback` (W-25). |
| B-15 | `Geofence.dwellMinutes`, `Geofence.afterHoursOnly` | 11.1 Create a geofence — the "Dwell longer than" and "After-hours entry" checkboxes | **confirmed missing** — `backend/src/modules/geofences` only has `alertOnEnter`/`alertOnExit`; the web renders both checkboxes disabled with the value collected client-side and dropped from the `POST /geofences` payload until this ships |
| B-34 *(new)* | `GET /auth/me` should also return `fullName`/`email`/`avatarUrl`/`carrierName`/`homeTerminalTimezone` | topbar avatar + role chip, account menu (11.26), W-26 header | **confirmed missing** — live response is `{ id, type, role, permissions }`; web falls back to `GET /me/profile` (a second round trip) |
| B-25 | `AUTH_MODE=dev\|production` — `403 PASSWORD_LOGIN_DISABLED` in production | server-side half of Q-1 | **confirmed missing** — `POST /auth/login` is open in every mode today; the web side already renders the `Password sign-in is disabled. Use Continue with Google.` banner for that code |
| B-26 | `TWO_FACTOR_ENFORCED` flag | — | **obsolete (2026-09-13)** — 2FA removed entirely (WD-067); E2E scenario 4 retired |
| — | `GET /vehicles/:id/telemetry` | W-04 Live status card | **confirmed missing** — only `/api/ingest/telemetry` (write path) exists |
| B-36 | `GET /trips` should join `driver`/`vehicle` names; `GET /trips/unassigned-loads` should `include: { stops: true }` | W-11 Dispatch & Trips | **confirmed missing** — `trips.repository.ts` `list()` includes `stops` but not `driver`/`vehicle`; `unassignedLoads()` includes neither. `shared/api/trips.ts` joins driver/vehicle client-side against `GET /drivers`/`GET /vehicles` (like B-35); the unassigned-loads table's PICKUP/DELIVERY/PICKUP WINDOW columns render `—` until the second half ships |
| B-37 | `GET /conversations` should embed `lastMessage: { body, sentAt }` and a real `unreadCount` per participant | W-16 Messages left panel | **confirmed missing** — `Conversation` carries only `lastMessageAt`; `ConversationParticipant` carries `lastReadAt` but no message count. `shared/api/messaging.ts` derives a truthful (but count-less) `unread: boolean` from `lastMessageAt > myParticipant.lastReadAt` and renders the list-item preview line as "Tap to open the conversation" rather than fabricate a body or a number |

**Present and usable today** (131 paths): auth (incl. `/auth/google`), carrier, vehicles +
import/export + calibrate-odometer + assign-driver + dtc, drivers + import/export, trailers,
devices (+pair/unpair/firmware/ble-status), logs (`/logs/:driverId`, `/range`, `/events`,
`/certify`, edit-requests), unidentified (+assign/annotate/reject/confirm), dvir, defects,
work-orders, maintenance-schedules, trips (+assign, auto-assign, unassigned-loads), safety
(events, scorecard, coaching), geofences, reports (ifta, activity, dvir, fmcsa-pack, generate,
schedules, download), transfers, conversations/messages/broadcast, notifications, users, roles,
alert-rules, integrations, api-keys, audit-log, support tickets, feedback, me (profile, sessions).
<!-- Phase 1a (web-architect) called no endpoint and recorded no new gap. B-1…B-6 stay with the
     feature agents that hit them. -->

---

## Contract deviations found while building the API layer (Phase 1b, `web-api-client`)

Not missing endpoints — endpoints that exist but do not answer in the shape `web/tz.md` §6.1
promises. Recorded so no feature agent types `OffsetPage<T>` where the backend sends an array.
Verified against `backend/docs/openapi.json` (131 paths, 174 operations, 2026-09-12).

| Endpoint | §6.1 expects | Backend actually documents | Impact |
|---|---|---|---|
| `GET /users` | `OffsetPage<User>` | bare `User[]` | W-18 Users — no server pagination; paginate client-side or ask for the envelope |
| `GET /roles` | `OffsetPage<Role>` | bare `Role[]` | W-19 — fine, the list is short and fixed |
| `GET /me/sessions` | `OffsetPage<Session>` | bare `Session[]` | W-26 active sessions |
| `GET /trailers` | `OffsetPage<Trailer>` | `{ items }` only — no `page`/`limit`/`total`/`totalPages` | trailer pickers cannot show a total |
| `GET /audit-log` | `OffsetPage<AuditEntry>` | `{ items, nextCursor }` — **cursor** pagination | W-23 Audit log needs a cursor `<Pagination>`, not page numbers (§5.6 assumes offset) |
| `POST /auth/login` | — | returns `{ accessToken, refreshToken, tokenType }` with **no `expiresIn`** | §17 proactive refresh (60 s before expiry) has no expiry field; `shared/auth` must read `exp` from the JWT payload and pass it to `setAccessToken(token, expiresAt)` |
| every operation | request DTOs | **no `requestBody` schema on any of the 174 operations** | request shapes cannot be generated; they come from the zod schemas in `shared/forms`, checked by hand against `backend/src/modules/**` |

| `GET /vehicles`, `GET /vehicles/:id` | `VehiclesListItem`/`VehiclesGetResponse` in `shared/api/types.ts` (`odometerMiles`, `assignedDriverId`) | the controller returns the **raw Prisma `Vehicle` row** unmapped — field is `odometerMi` (not `odometerMiles`), there is **no `assignedDriverId`** (the FK lives on `Driver.assignedVehicleId`, reverse-only) and **no `device`/`eldSerial`** join | W-03 `DRIVER`/`ELD SERIAL` columns and W-04's identity panel cannot be filled from this endpoint alone — `shared/api/vehicles.ts` cross-references `GET /drivers?...` (client-side join, one extra list call, not 69) for the assigned-driver name and leaves ELD serial as `Not assigned` until a device join exists (new gap **B-35**, `GET /devices?vehicleId=`) |
| `GET /drivers`, `GET /drivers/:id` | `DriversListItem`/`DriversGetResponse` (id, username, cdlNumber only) | actually the **full raw `Driver` row minus `passwordHash`** (email, phone, homeTerminalName/Timezone, assignedVehicleId, allow*/exempt flags, appVersion, registeredAt, …) | good news for W-06/W-07 — richer than documented; `shared/api/drivers.ts` types against the real shape |

Also observed live on `http://localhost:3002/api` (2026-09-12): *(2FA observations from this date are obsolete —
2FA was removed entirely on 2026-09-13, WD-067.)* `POST /auth/login` is rate limited to **5 requests per 60 s per
IP** (`RATE_LIMITED`, `Retry-After: 60`) — test suites that sign in repeatedly will hit it.

---

## Phase 4 (`web-hos-logs`, W-08 + 11.11–11.13)

| Id | Endpoint / field | Blocks | Status |
|---|---|---|---|
| B-6 | `GET /violations`, `POST /violations/:id/resolve` | W-08 `Violations · today` → `Resolve` | **shipped in backend (2026-09-14, D-052) — see row B-6 above; `hosGaps.ts` MSW handlers can be deleted once the API is restarted.** Previously: confirmed missing again on the live API (2026-09-12) — `HosViolation` rows only ride inside `GET /logs/:driverId` and nothing can move `status` off `OPEN`/`AUTO_CLEARED`. The W-08 violation **list is real** (read from the log payload); only the write is mocked, in `src/mocks/handlers/hosGaps.ts`, against the §20 shape `{ id, status: 'RESOLVED', resolvedAt, resolutionNote }`. Against the live API the modal shows the server's refusal verbatim and does not retry. |
| B-2 | `GET /drivers/:id/hos` | **also blocks W-08 `Available hours`** (previously recorded for W-07/W-16 only) | the four clocks (`driveRemainingSec`, `shiftRemainingSec`, `cycleRemainingSec`, `breakInSec` + their limits) are owned by the ELD HOS engine. A shift and a 30-minute break both straddle midnight, so they cannot be recomputed from `GET /logs/:driverId/range`'s daily totals without putting a wrong number on an inspector's screen — the card renders `<ErrorState>` in place until B-2 ships (web/decisions.md WD-030). |
| B-35 | device ↔ vehicle join | **also blocks the W-08 grid caption** `Recorded by ELD PT30_A86E` | no way to resolve the ELD serial that recorded the day; the caption renders `Recorded by ELD Not assigned · all times Eastern` (§8.4 `Not assigned`). |
| B-38 *(new)* | `totalEngineHours` on `GET /logs/:driverId/events` | W-08 `Log events` → `ENGINE HRS` column | **confirmed missing** — the column exists on `EldEvent` (`Decimal(10,2)`) and is written by the ingest path, but `LogsService.toEventView()` (`backend/src/modules/logs/logs.service.ts:852`) does not return it. The design shows `1070.2 h`; the panel renders `—`. One added field in `toEventView` is the whole fix. |
| B-39 *(new)* | `CreateEditRequestDto`: `proposedSpecial: 'NONE' \| 'PC' \| 'YM'`, a `notifyDriver` flag, and a name-only `location` | 11.11 Request a log edit — the `Yard move` / `Personal` chips and the `Notify the driver immediately` checkbox | **confirmed missing** — `proposedStatus` is `OFF \| SB \| D \| ON` only, so a §395.1(e) special category cannot be proposed at all; both chips render **disabled** rather than silently sending a plain `ON`/`OFF` and misstating the record. `LocationDto` needs `lat`/`lon`, which the free-text `Location` box cannot supply, so no location is sent. The notify checkbox states the backend's actual behaviour (the proposal always reaches the driver's app) and is not put on the wire. |
| B-40 *(new)* | `Defect` has no assignee/shop field (`assignedTo`, `vendor`, or a shop relation) | W-09 `Open defects` → `ASSIGNED TO` column | **confirmed missing** — `Defect` (prisma/schema.prisma) carries `workOrderId` but no assignee of its own; only `WorkOrder.vendor` exists, and a defect need not have a work order yet. The column renders `Unassigned` for every open defect until a defect-level assignee (or a `workOrder.vendor` lookup once one is attached) ships. |
| B-41 *(new)* | No `GET /attachments/:id/presign` (or equivalent) for `Attachment.key` | 11.15 DVIR detail → `Photos` grid lightbox | **confirmed missing** — no storage/attachments module exists at all in `backend/src/modules/**`; `Attachment` only stores a MinIO `key`. The drawer renders a lazy, never-cached placeholder tile (Eye icon, no `src`) instead of guessing a URL — never logs or caches a photo it cannot fetch. |
| B-42 *(new)* | `CreateWorkOrderDto`/`Defect` have no `keepOutOfService` / `notifyDriver` / `blockDispatchAssignment` flags | 11.16 Create work order — the three trailing checkboxes | **confirmed missing** — the three checkboxes render and are collected client-side (all default checked, matching the design) but nothing is sent on `POST /work-orders`; out-of-service state still only follows the existing "open CRITICAL defect" rule, independent of this modal. |
| B-43 *(new)* | `GET /safety/scorecard` has no driver-level coaching endpoint (`POST /safety/coaching` needs an `eventId`, not a `driverId`) | W-10 `Driver scorecard` → `Assign coaching` | **confirmed missing** — the design's button sits on the scorecard (per-driver), but coaching is modelled per-`SafetyEvent` on the backend. `AssignCoachingModal` first resolves the driver's open (`NEW`/`REVIEWED`) events and lets the user pick one (web/decisions.md WD-029). |
| B-44 *(new)* | `GET /safety/scorecard` has no prior-period baseline (only the current `DriverScore` row per driver/period) | W-10 `Driver scorecard` → `TREND` column | **confirmed missing** — `DriverScore` is keyed `@@unique([driverId, periodStart])` with no link to the previous period; the column renders `—` rather than a fabricated `↑`/`↓` delta. |

---

## Phase 7 (`web-reports-transfer`, W-12…W-15 + 11.14)

Verified on the live API (`http://localhost:3002/api`, 2026-09-12) as FLEET_MANAGER.

| Id | Endpoint / field | Blocks | Needed response shape | Status |
|---|---|---|---|---|
| B-14 | `ReportType` has no `RODS` / `IDLE_FUEL` | W-12 Report library → `Driver logs (RODS)`, `Idle & fuel report` | enum values + generators; `POST /reports/generate { type: 'RODS' \| 'IDLE_FUEL', format: 'PDF', params: { from, to, driverId? } }` → `202 { reportId, status }` | **confirmed missing** — both rows stay in the list (WD-042) |
| B-45 *(new)* | carrier transfer config readable with `reports` / `reportsTransfer` — `GET /carrier` is `carrierSettings` READ (403 for FLEET_MANAGER) | 11.14 + W-15 TEST banner accuracy, 11.14 `Certificate` row, carrier-zone report ranges for FM | `GET /carrier/transfer-config` → `{ timezone, eldIdentifier, eldRegistrationId, erodsMode: 'TEST' \| 'PRODUCTION' }` | **confirmed missing** — banner fails safe to TEST (WD-038); zone falls back to the seeded carrier's |
| B-46 *(new)* | JSON report summaries + requester names | W-12 KPI row and `Miles by jurisdiction`; W-13/W-15 aggregates (today one range call per driver, WD-039) and the `vs prev.` chips; `GENERATED BY` / `SENT BY` for other users | `GET /reports/ifta/summary?quarter=` → `{ quarter, unitCount, kpis: { totalMiles, taxableMiles, taxablePct, fuelGal, receiptCount, fleetMpg, fleetMpgPrev }, rows: [{ jurisdiction, totalMiles, taxableMiles, fuelGal, mpg, taxDueUsd }], totals }` · `GET /reports/activity/summary?from&to&page&limit` → `{ kpis: { drivingSec, drivingDeltaPct, onDutySec, distanceMi, violations, violationsDelta }, items: [{ driverId, name, days, offSec, sbSec, drivingSec, onSec, distanceMi, violations, certifiedDays }], page, limit, total, totalPages }` · `requestedBy: { id, name }` on `Report` and `DataTransfer` rows | **IFTA half shipped (2026-09-14, backend/decisions.md D-054)** — `GET /reports/ifta/summary?quarter=YYYY-Qn&vehicleId?` is live, `reports` READ, declared before `GET /reports/:id`. ~~Response body is the summary object directly (no `{ data: ... }` envelope)~~ **corrected 2026-09-14 (web-api-client): false — the controller returns a plain object, and the global `TransformInterceptor` (`APP_INTERCEPTOR` in `backend/src/app.module.ts`) wraps every non-Buffer/non-string return, so the body is `{ data: IftaSummary, traceId, timestamp }` like every other endpoint. `client.ts` reads it correctly either way (WD-069, contract-tested),** `kpis.{taxablePct,fuelGal,receiptCount,fleetMpg,fleetMpgPrev}` and every row's/`totals.{fuelGal,mpg,taxDueUsd}` are `number \| null` matching `IftaKpis`/`IftaJurisdictionTotals`/WD-068 exactly — `null` (never `0`) for a whole quarter once its `FuelPurchase.count` is 0; `taxDueUsd` is always `null` (no `TaxRate` model anywhere in the schema); `taxableMiles` = `totalMiles` (no exemption model). Dev DB currently has 0 `IftaSegment`/0 `FuelPurchase` rows (nightly job never run against this seed), so every quarter answers `unitCount: 0`, empty `rows`, every derivable KPI `null` — re-verify the KPI-card and jurisdiction-table wiring once seeded data exists. `KNOWN_GAPS` entry dropped 2026-09-14 — `openapi.json` lists the path. **Activity half shipped (2026-09-14, backend/decisions.md D-078)** — `GET /reports/activity/summary?from&to&page&limit` is live, `reports` READ, declared before `GET /reports/:id`, also accepts `driverId`/`terminal`/`status` filters and `sort` (e.g. `drivingSec:desc`, `name:asc`, whitelisted). Computed with `GROUP BY` in SQL straight off the persisted `DailyLog` header (rebuilt through the real builder, see D-076) and `HosViolation` — never a per-driver `GET /logs/:driverId/range` fan-out, never an `EldEvent` load into memory (that pattern OOM-killed the API earlier the same day, B-055). `kpis.drivingDeltaPct`/`kpis.violationsDelta` compare against the previous period of the same length and are `null` (never `0`) when that period has no `DailyLog` data at all, or (for `drivingDeltaPct` only) when its `drivingSec` is exactly 0. Measured on the dev DB (200+ mock drivers): 14-day range ≈ 210–260 ms warm, 90-day range ≈ 52–57 ms warm — both well under the 1 s target, using the existing `DailyLog_logDate_idx` (no new index). No distinct role-guide page exists for the Activity tab's JSON aggregate, so it is listed in `FIGMA_UNMAPPED_ROUTES` (same reasoning as the existing `GET /reports/activity` CSV shortcut) rather than an invented `@FigmaScreen` id. Dashboard/W-15 FMCSA-pack batch need: covered by this same endpoint (all drivers, `from=to=` a single day for "today's totals"); `/drivers/roster` and `/live/fleet` answer *current* duty status/position, not day-level totals, so they are not substitutes — no separate endpoint was added. `requestedBy` still **missing** |
| B-47 *(new)* | `from` / `to` on `GET /dvir`; expected-inspection schedule | W-14 range filter (today: newest 200, range applied client-side), `Missing pre-trip`, `Not submitted` / `Missing` rows, `98% compliance` chip | `GET /dvir?from=YYYY-MM-DD&to=YYYY-MM-DD` · `GET /dvir/compliance?from&to` → `{ expected, submitted, compliancePct, missing: [{ driverId, vehicleId, date, type }] }` | **confirmed missing** — KPI shows `—`, missing rows not drawn |
| B-48 *(new)* | report formats and pack options | W-12 `Download IFTA PDF`, W-14 `Download PDF` (both 422 `VALIDATION_FAILED` — CSV only, shown verbatim); W-15 six "contains" checkboxes and `All units ▾` (`FmcsaPackParamsDto` has `driverId` only); scheduled reports with a relative window | `format: 'PDF'` for `IFTA`/`DVIR`/`ACTIVITY`; `FmcsaPackParamsDto.include?: ('RODS' \| 'UNIDENTIFIED' \| 'EDITS' \| 'ELD_ID' \| 'DVIR' \| 'MALFUNCTIONS')[]`, `vehicleId?`; schedule `params.window: 'PREVIOUS_WEEK' \| 'PREVIOUS_MONTH' \| 'PREVIOUS_QUARTER'` | **confirmed missing** |
| B-49 *(new)* | `report.ready` is never delivered to the browser — `ReportProcessor` runs in the worker process (`worker.ts`, `createApplicationContext`) and publishes `realtime.push` on the in-process `EventBusService`, which the API process's `RealtimeGateway` never sees | W-12…W-15 `Report ready` toast via `user:{id}` (§7.5); any report queued outside the open screen (schedules) | a cross-process relay: worker publishes to Redis (e.g. `@socket.io/redis-emitter` on the `/realtime` namespace, or a Redis pub/sub channel the gateway subscribes to) emitting `report.ready { reportId, type, status }` to `user:{requestedById}` | **confirmed live 2026-09-12:** socket connected to `/realtime`, `subscribe user:{id}` → `{ ok: true }`, report reached READY in 3 s, no event in 40 s (`onAny` saw nothing). The screens fall back to the named 3 s `reportStatus` poll for jobs they queued |

---

## Phase 9 (`web-auth-rbac`, W-26 My profile)

Verified on the live API (`http://localhost:3002/api`, 2026-09-13) as FLEET_MANAGER.

| Id | Endpoint / field | Blocks | Needed response shape | Status |
|---|---|---|---|---|
| B-50 *(new)* | `GET /me/sessions` returns raw `Session` rows **including `refreshHash`**, with no `current` flag and no location; no revoke-all | W-26 `Active sessions` — `● Current` badge, `Now · this device`, `LOCATION` column, `Sign out everywhere` | `[{ id, deviceLabel, userAgent, ip, location: string \| null, lastSeenAt, current: boolean }]` (never `refreshHash`/`userId`) · `DELETE /me/sessions` (all but, or including, the caller's) → `{ revoked: number }` | **confirmed missing** — **security:** the refresh-token hash is sent to the browser today; the web drops it before render. No row is marked current (WD-048); `Sign out everywhere` loops `DELETE /me/sessions/:id` |
| B-51 *(new)* | profile completeness: `jobTitle` on `UpdateMyProfileDto`; avatar upload/remove *(the 2FA-metadata half is obsolete — WD-067)* | W-26 `Job title` (read-only), `Upload`/`Remove` (omitted) | `PATCH /me/profile { firstName, lastName, jobTitle, phone }` · `POST /me/avatar` (multipart, PNG/JPG ≥ 256×256) → `{ avatarUrl }` · `DELETE /me/avatar` · `GET /me/profile` adds `avatarUrl` | **confirmed missing** — UI already renders the fields when present (WD-049) |
| ~~B-52~~ | `POST /auth/2fa/disable` | — | — | **obsolete (2026-09-13)** — 2FA removed entirely at user request (WD-067); MSW handler, endpoint key and UI deleted |
| ~~B-53~~ | `POST /auth/2fa/enroll` overwrote an enabled secret | — | — | **obsolete (2026-09-13)** — the endpoint no longer exists (WD-067) |

---

## Phase 9 continued (`web-vehicles-drivers`, W-03/W-06 11.23 Filters)

Verified against `backend/src/modules/vehicles/vehicles.controller.ts` and
`backend/src/modules/drivers/drivers.controller.ts` (2026-09-13).

| Id | Endpoint / field | Blocks | Needed response shape | Status |
|---|---|---|---|---|
| B-54 *(new)* | `GET /vehicles` only accepts `page`/`limit`/`sort`/`q`/`status` — no server params for ELD device, make, year range, home terminal, open-defects or firmware-outdated | W-03 11.23 Filters drawer (7 groups drawn: STATUS, ELD DEVICE, MAKE, Year from/to, Home terminal, two condition toggles) | additional `@ApiQuery` params on `GET /vehicles`, e.g. `deviceModel`, `make`, `yearFrom`, `yearTo`, `homeTerminal`, `hasOpenDefect`, `firmwareOutdated` | **confirmed missing** — every group filters client-side against the already-loaded `useVehiclesList({ limit: 500 })` set (69 rows today); fine at fleet size, will not scale past one server page |
| B-55 *(new)* | `GET /drivers` (and the mocked `GET /drivers/roster`, gap B-1) accept no `terminal`/`violations`/`exemptions` params | W-06 11.23 Filters drawer ("Drivers: status, terminal, violations, exemptions" per tz.md §11.23) | `GET /drivers/roster?terminal=&hasOpenViolation=&exempt=` or equivalent server filters once B-1 ships | **server filters shipped with B-1 (2026-09-14)**: `GET /drivers/roster?terminal=&hasOpenViolation=true|false&exempt=true|false` (exempt = `eldExempt`); the driver projection is confirmed as-is. Previously: **confirmed missing** — filters run client-side against the roster page already loaded (58 drivers = one page); `DriverRosterEntry.driver` was extended (client-side, `shared/api/drivers.ts`) with `eldExempt`/`allowPersonalConveyance`/`allowYardMove`/`shortHaulException`/`splitSleeperEnabled` since B-1's documented shape does not pin the driver sub-object further — confirm this projection with the backend once B-1 ships |

---

## Phase 9 (`web-architect`, 11.26–11.28 topbar overlays)

Verified on the live API (`http://localhost:3002/api`, 2026-09-13) as FLEET_MANAGER: `GET /notifications` → `200` (empty page), `GET /search?q=smith` → `404 NOT_FOUND`, `GET /drivers?q=smith` → `200`.

| Id | Endpoint / field | Blocks | Needed response shape | Status |
|---|---|---|---|---|
| B-10 | `GET /search?q=&limit=` | 11.28 `DRIVERS` / `VEHICLES` results with unit, duty status and violations; footer `Searching 69 units · 58 drivers · 1,284 logs` | `{ q, drivers: [{ id, name, unitNumber, dutyStatus, openViolations, openWarnings, homeTerminalName }], vehicles: [{ id, unitNumber, make, model, vin, driverName }], scope: { units, drivers, logs } }` | **confirmed missing again** — MSW serves this shape (`src/mocks/handlers/shellGaps.ts`). On a `404` the palette falls back to `GET /drivers?q=` + `GET /vehicles?q=` (§11.28 v1), so on live the driver line shows the home terminal only, vehicles carry no driver name and the scope footer is omitted (web/decisions.md WD-054) |
| B-56 *(new)* | `POST /notifications/:id/read` (or `PATCH /notifications/:id { readAt }`) | 11.27 "clicking an item sets `readAt`" | `{ id, readAt }` | **confirmed missing** — only `GET /notifications` and `POST /notifications/read-all` exist. MSW-only; on live the call fails and the item stays unread (no client-side `readAt` is faked). `Mark all read` is the working path |
| B-57 *(new)* | `Notification.category`, `?category=` on `GET /notifications`, and `counts` in its page | 11.27 segments `All 12 · Violations 6 · Maintenance 3` | page + `counts: { all, violations, maintenance }`; each item carries `category: 'VIOLATIONS' \| 'MAINTENANCE' \| null` | **confirmed missing** — `AlertProcessor.send` writes `type: rule.id` (a UUID), so no category can be derived client-side. Without `counts` the panel renders no segments (WD-055) |
| B-58 *(new)* | Alert-created notifications: rendered `body`, `objectType`/`objectId`, and `severity` on `notification.new` | 11.27 item sentence and click-through; §7.3 toast when `severity=CRITICAL` | `body`: a sentence ≤ 500 chars (`John Smith exceeded the 11-hour driving limit by 00:26`); `objectType`/`objectId` of the triggering record; `severity: 'INFO' \| 'WARNING' \| 'CRITICAL'` on the row and the socket payload | **confirmed missing** — `notifications/workers/alert.processor.ts` stores `body: JSON.stringify(payload).slice(0, 500)`, never sets `objectType`/`objectId`, and `Notification` has no `severity`. The panel shows the body verbatim (2-line clamp), live items have no destination, and the CRITICAL toast cannot fire on live |

## Phase 9 (`web-dispatch-messaging`, W-11 Trips 11.23 Filters)

Verified against `backend/src/modules/trips/trips.controller.ts` and `dto/trips.dto.ts` (2026-09-13).

| Id | Endpoint / field | Blocks | Needed response shape | Status |
|---|---|---|---|---|
| B-59 *(new)* | `GET /trips` (`TripListQueryDto`) only accepts `page`/`limit`/`sort`/`q`/`status`/`driverId`; `status` there is the raw `Trip.status` lifecycle enum, not the drawn STATUS column (the computed `displayStatus`: On time/Late/Loading/Delivered/Cancelled/Planned, `shared/api/trips.ts` `computeDisplayStatus`) — and there is no `vehicleId`, no depart-date-range param at all | W-11 11.23 Filters drawer (6 groups: Status, Driver, Unit, Home terminal, Depart date range, "no trailer assigned" toggle) | either compute `displayStatus` server-side and accept it in `status`, or leave the mapping to the client; add `vehicleId`, `departFrom`, `departTo` query params on `GET /trips` | **confirmed missing** — every group filters client-side against the already-loaded `useTripsList({ limit: 500 })` set (same set already used for the KPI cards and segment counts), matching the W-03/W-06 precedent (B-54/B-55); fine at fleet size, will not scale past one server page |

## Phase 9 (`web-dvir-safety`, W-09 DVIR and W-10 Safety 11.23 Filters)

Verified against `backend/src/modules/service/dto/service.dto.ts`, `backend/src/modules/service/dvir-admin.controller.ts`,
`backend/src/modules/service/defects.controller.ts`, `backend/src/modules/safety/dto/safety.dto.ts` and
`backend/src/modules/safety/safety.controller.ts` (2026-09-13).

| Id | Endpoint / field | Blocks | Needed response shape | Status |
|---|---|---|---|---|
| B-60 *(new)* | `GET /dvir` (`DvirListQueryDto`) accepts `repairStatus` but only a single enum value, not a multi-select list, and has no `type` param at all; `DvirRow` has no severity field (severity lives on the defects a DVIR raised) | W-09 11.23 Filters drawer (3 groups: Type, Severity, Repair status) | `type` as a repeatable/CSV query param on `GET /dvir`, `repairStatus` accepting a CSV list, and either a `severity` param that matches on any linked defect or a documented client-side join | **confirmed missing** — all three groups filter client-side against the already-loaded `useDvirsList({ limit: 500 })` set (same B-54/B-55/B-59 precedent); fine at fleet size, will not scale past one server page |
| B-61 *(new)* | `GET /safety/events` (`SafetyEventListQueryDto`) accepts `type` and `status` but only a single enum value each, not a multi-select list; `SafetyEvent.severity` is a raw `Int` 1-5 proxy (`harsh-detect.ts` "how far past the threshold the delta went"), not the Critical/Major/Minor bucket the design's severity palette uses, and there is no severity query param at all | W-10 11.23 Filters drawer (3 groups: Event type, Severity, Coaching status) | `type`/`status` accepting a CSV list on `GET /safety/events`, plus either a bucketed `severity` enum column or a documented threshold to bucket by | **confirmed missing** — all three groups filter client-side against the already-loaded `useSafetyEventsList({ limit: 500 })` set, bucketing severity client-side (4-5 Critical, 3 Major, 1-2 Minor, matching `SeverityBadge`'s palette) |

## Phase 10 (`web-design-system`, visual pass — W-23 Audit log)

Verified against `backend/src/modules/audit/audit.repository.ts` (2026-09-13).

| Id | Endpoint / field | Blocks | Needed response shape | Status |
|---|---|---|---|---|
| B-62 *(new)* | `GET /audit-log` rows carry `actorId`/`actorType` only, no `actorName` | W-23 Audit log USER column — every row on the live dev API renders the generic actor type ("USER") instead of the actor's name (the design shows "Sarah Chen", "Mike Rowan", …) | join `actorId` to the user table and add `actorName` (and ideally `actorEmail`) to each row | **confirmed missing** — `AuditLogPage.tsx` already falls back to `entry.actorType` when `actorName` is absent (`entry.actorName ?? entry.actorType`); nothing to fix client-side |

## Phase 10 (`web-settings-admin`, visual-pass fixes — WB-041/042/043)

Verified against `backend/src/modules/users/users.controller.ts` and `backend/src/modules/audit/audit.repository.ts` (2026-09-13).

| Id | Endpoint / field | Blocks | Needed response shape | Status |
|---|---|---|---|---|
| B-63 *(new)* | `GET /users` (`UsersController.list()`) takes no query parameters at all — no `role`/`status` filter exists server-side | W-18 Users, 11.23-pattern `Filters` drawer (Role / Status) | `role`, `status` query params on `GET /users`, or keep it a bare array and accept client-side filtering permanently (fine at back-office user counts, will not scale past a few hundred rows) | **confirmed missing** — `UsersPage.tsx`'s `Filters` drawer (`features/settings/lib/filters.ts`) filters client-side against the already-loaded `useUsersList()` set, same B-54-family precedent |
| B-64 *(new)* | `GET /audit-log` (`AuditController.list()` / `AuditRepository.list()`) accepts `objectType`, `objectId`, `actorId` only — no `action` filter and no `createdAt` date-range params | W-23 Audit log filter row's `All actions ▾` and `Last 30 days ▾` (`DateRangePicker`, 11.25) | `action` (CSV or repeatable) and `createdAtFrom`/`createdAtTo` query params on `GET /audit-log` | **confirmed missing** — `actorId` (`All users ▾`) and `objectType` (`Filters` drawer) ARE real server params and are sent as such; `action` and the date range only narrow the window of cursor-pages already loaded, exactly like the existing free-text `search` already did — will miss matches outside the loaded window until this is added |

## 2026-09-14 (`web-api-client`) — B-1/B-2/B-3/B-6/B-46 shipped: contract check

All six paths are in the regenerated `backend/docs/openapi.json` and are gone from `tests/contract` `KNOWN_GAPS`. `tests/contract/shipped-gaps.contract.test.ts` validates each one through the real client. Web types match backend source field for field. The web-side fixes are WB-045…WB-047. The notes below are backend-side, so they are **not** new gaps.

| Id | Endpoint | Blocks | Status |
|---|---|---|---|
| B-1/B-2/B-3/B-6/B-46 | all six | live verification | **dev API on :3002 not restarted** — at 2026-09-14 07:57Z `GET /live/fleet`, `/violations`, `/drivers/:id/hos`, `/reports/ifta/summary`, `POST /violations/:id/resolve` answered `404 NOT_FOUND "Cannot GET …"` and `GET /drivers/roster` answered `404 DRIVER_NOT_FOUND` (matched as `/drivers/:id`). The web was not restarted by this agent, so W-02/W-06/W-07/W-08/W-12 stay in their error states on the live site until someone with permission restarts it |
| B-6, B-46 | `GET /violations`, `GET /reports/ifta/summary` | openapi accuracy only | `@Query(zodBody(...))` emits no `parameters` — openapi.json documents none of `window/from/to/driverId/type/status/page/limit` or `quarter/vehicleId`. The web sends them per the DTO source. `/drivers/roster` does document its params |
| B-1, B-3 | `GET /drivers/roster`, `GET /live/fleet` | openapi accuracy only | examples cannot express `null`; source types make `unit`, `appVersion`, `email`, and 14 of 17 `LiveFleetUnit` fields nullable. The contract suite checks those against an explicit allow-list copied from source (WD-069) |

