# OneBook ELD — web panel task board

Derived from `web/tz.md` §19 (10 phases). Each agent ticks **only** its own verified
deliverables, with line-targeted edits. Ownership comes from `.claude/agents/README.md`.

**API for dev:** `http://localhost:3002/api` (port 3001 is occupied by an unrelated project on
this box — see `web/decisions.md` WD-001). WS: `http://localhost:3002`, namespace `/realtime`.

## Status snapshot — 2026-09-13 (verified by the coordinator, not self-reported)

| Gate | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` (`--max-warnings=0`, house rules on) | exit 0 |
| `npm run test:unit` | **98 files / 1039 tests passed**, exit 0 |
| Coverage (all files) | 90.17 stmts · 88.32 branch · **81.43 funcs** · 90.17 lines — every metric ≥ 80 |
| `npm run test:contract` | 8/8 |
| `npm run build` bundle budget | initial 208.7/220 · maplibre 286.2/290 (WD-023) · recharts 97.0/120 · total 874.7/1228.8 KB — met |
| Playwright E2E (full suite, 1 worker, 2026-09-13, coordinator) | **82 passed · 9 skipped · 0 failed** — skips: 02, 04 (Firebase + B-26), B-1 ×3 (06 roster, 15 & 17 W-07), B-30 (06 duplicate email), 09 (no seeded Driving events in 8 days), 11, 13 (runtime-skipped) |
| Log ids | no duplicate `WB-`/`WD-` ids |

**Phases 1–8 done. Phase 9 done except 11.24 (blocked on B-11). Phase 10 done except E2E 2/4 (Firebase + B-26) and the visual pass (Driver profile blocked on B-1, W-05 not captured). All global gates done.**

---

## Phase 1 — Foundation  ⟶ login → empty Dashboard, correct sidebar for 4 roles

### 1a · Skeleton (`web-architect`, runs first, blocks the rest)
- [x] `web/` Vite 6 + React 19 + TS 5 strict scaffold, `package.json` scripts (dev, typecheck, lint, test:unit, test:contract, build)
- [x] `tailwind.config.ts` + `@theme` wiring, `.env.example`, `.env.development`
- [x] ESLint 9 flat config + Prettier, with the 4 house rules (no URL literals, no hand-built query keys, no hex colours, no cross-feature imports) + `react/no-danger`
- [x] Folder tree from §2.2 (`app/`, `shared/{api,auth,realtime,ui,format,hooks}`, `features/*`)
- [x] `providers.tsx` (QueryClient, Auth, Realtime, Toast, Theme) and the 4 layouts
- [x] `router.tsx` — every §9 route with guard order `isAuthenticated → can(perm)` (2FA step removed, WD-067), all features `React.lazy`
- [x] AppShell: brand block, nav tree (§4.2), organisation card, topbar (context filter, search, bell, refresh, avatar), 204px secondary nav
- [x] Bundle-budget check + `web` job in CI

### 1b · Parallel after 1a
- [x] **`web-design-system`** — tokens (§3), `shared/ui` primitives (§5), 4 state components, toast/empty copy (§13)
- [x] **`web-api-client`** — `client.ts` (9 rules), `endpoints.ts`, `queryKeys.ts`, `types.ts` from `openapi.json`, `errors.ts` (§14.3), `shared/format` @ 100% coverage, zod schemas
- [x] **`web-auth-rbac`** — AuthProvider, token lifecycle, `usePermission`/`Can`/`permissions.ts` @ 100%, W-00 (dev + production modes), `/403`, role chip (W-00b removed with 2FA, WD-067)
- [x] **`web-qa-a11y`** — Vitest + MSW + Playwright wiring, coverage gates, RBAC fixture (4 roles × 26 screens)

**Gate:** `npm run typecheck` 0 errors · `npm run lint` 0 warnings · 4 demo accounts sign in · each role sees the §4.2 sidebar.

---

## Phase 2 — Dashboard + Live Fleet (`web-dashboard-fleet`, `web-realtime`)
- [x] `web-realtime`: RealtimeProvider, `useRoom`, `events.ts`, reconnect resync, OfflineBanner, polling constants
- [x] W-01 Fleet Dashboard — KPI row, donut, violations panel, map preview
- [x] W-02 Live Fleet — MapLibre GeoJSON+symbol layer, unit cards, keyboard-equivalent left column
- [x] 11.1 Create a geofence
- [x] Gaps recorded: B-3 `GET /live/fleet`, B-15 geofence fields

## Phase 3 — Fleet roster (`web-vehicles-drivers`)
- [x] W-03 Vehicles · W-04 Unit profile · W-05 Unit histories · W-06 Drivers · W-07 Driver profile
- [x] 11.2–11.9 (add/delete unit, assign driver, calibrate odometer, imports, **11.8 Add driver = Q-3**)
- [x] Gaps recorded: B-1 roster, B-2 driver HOS, B-4 histories, B-5 activities, B-13 assign-driver perm

## Phase 4 — ⭐ HOS (`web-hos-logs`)
- [x] W-08: 24-hour SVG grid (24 columns, 15-min ticks, connectors, violation dashes, PC/YM dashed, unassigned hatch, TOTAL column, hover tooltip, `role="img"` + sr-only table, DST-safe)
- [x] Available hours · Violations today · Certification last 8 days · Log events (superseded/proposed toggle)
- [x] 11.11 Request a log edit · 11.12 Certify logs (ADMIN only) · 11.13 Unassigned driving
- [x] Gaps recorded: B-6 violations endpoints; B-2 also blocks `Available hours`; B-35 blocks the grid caption; new B-38 (engine hours on log events), B-39 (PC/YM + notify on the edit-request DTO)

## Phase 5 — Compliance (`web-dvir-safety`)
- [x] W-09 DVIR & Maintenance (4 tabs) + 11.15 drawer · 11.16 work order · 11.17 resolve defect

## Phase 6 — Operations (`web-dispatch-messaging`, `web-dvir-safety`)
- [x] W-11 Dispatch & Trips + 11.10 Create trip · W-16 Messages (`web-dispatch-messaging`)
- [x] W-10 Safety (`web-dvir-safety`)

## Phase 7 — Reports (`web-reports-transfer`)
- [x] W-12 IFTA · W-13 Activity · W-14 DVIR · W-15 FMCSA pack + 11.14 Send to inspector (8-day range, test-mode banner)

## Phase 8 — Settings (`web-settings-admin`)
- [x] W-17…W-25 + 11.18–11.22 (SMS channel permanently disabled = Q-2)

## Phase 9 — Account and overlays (`web-auth-rbac`, `web-architect`, `web-design-system`)
- [x] W-26 My profile, active sessions — `/account` with `#profile` `#security` `#notifications` `#language` `#sessions` anchors; sessions list + revoke (B-50); 4 states; gaps B-50/B-51, WD-048/049/052/061, WB-034/036 (2FA setup removed 2026-09-13, WD-067)
- [x] 2FA/TOTP removed from the web panel entirely (user request, 2026-09-13, WD-067) — W-00b, `/sign-in/2fa`, the `/account#security` lock, W-26 2FA row + modals, QR encoder, W-18 `Reset two-factor` + 2FA filter, 11.18 checkbox, `TWO_FACTOR_*` copy, `/auth/2fa/*` endpoints/MSW/types deleted; typecheck, lint, contract and every touched unit test green; final grep of `src`/`tests` finds no 2FA reference
- [x] 11.23 `FilterDrawer` · 11.24 `TableSettings` · 11.25 `DateRangePicker` — built and tested as `shared/ui` primitives (Phase 1b)
- [x] 11.23 Filters wired with real filter content on every list screen tz.md §11.23 names — **W-03 Vehicles and W-06 Drivers** (`web-vehicles-drivers`): status/ELD device/make/year/terminal/defects/firmware and status/terminal/violations/exemptions, active-filter chips, Clear all, URL-synced (`fStatus`/`fDevice`/`fMake`/`fYearFrom`/`fYearTo`/`fTerminal`/`fDefects`/`fFirmware` and `fStatus`/`fTerminal`/`fViolations`/`fExempt`), client-side against the already-loaded full list (backend has no server filter params beyond `status`, gaps B-54/B-55). **W-11 Trips** (`web-dispatch-messaging`): STATUS (displayStatus On time/Late/Loading/Delivered/Cancelled/Planned)/Driver/Unit/Home terminal/Depart date range/no-trailer toggle, active-filter chips, Clear all, URL-synced (`fStatus`/`fDriver`/`fUnit`/`fTerminal`/`fDepartFrom`/`fDepartTo`/`fNoTrailer`), client-side against the already-loaded `useTripsList({ limit: 500 })` set (gap B-59). **W-09 DVIR and W-10 Safety done** (`web-dvir-safety`): DVIR groups Type/Severity/Repair status applied to the `DVIRs` tab only (`fType`/`fSeverity`/`fRepair`, WD-062), client-side against `useDvirsList({ limit: 500 })` (gap B-60); Safety groups Event type/Severity (bucketed 1-5 → Critical/Major/Minor, WD-063)/Coaching status (`fType`/`fSeverity`/`fCoaching`), client-side against `useSafetyEventsList({ limit: 500 })` (gap B-61). Filters now on W-03, W-06, W-09, W-10, W-11 — the screens tz.md §11.23 calls for plus Trips. W-12–W-15, W-18–W-21, W-23 have no filter set in the spec.
- [ ] 11.24 saved views persisted — `localStorage` only until B-11 `GET/PUT /me/preferences`
- [x] 11.26 Account menu · 11.27 Notifications panel · 11.28 Command palette (⌘K) — built as lazy chunks (WD-054…056, WD-059); 11.28 entity search MSW-backed behind B-10 `GET /search` with `/drivers?q=` + `/vehicles?q=` fallback on 404; gaps B-56…B-58
- [x] `Toast` action slot (`Download` / `Retry`, WD-041) — shared, keyboard- and focus-pause-tested

## Phase 10 — Hardening (`web-qa-a11y`, `web-architect`)
- [x] Bundle budgets met (initial 201.7/220 KB; MapLibre line raised to 290 KB with measurement, WD-023)
- [x] Coverage gate ≥ 80% on every metric repo-wide (was failing at 74.89% functions; now 80.89%)
- [x] E2E scenarios 1, 3, 5 green — dev sign-in for all 4 roles (password only, no 2FA step), no password form in the production bundle, sidebar by role
- [ ] E2E scenarios 2, 4 (need real Firebase credentials and backend B-26)
- [x] E2E scenarios 6–16 written as real Playwright specs against actual source selectors (`tests/e2e/06-…16-*.spec.ts`) — 6/7/8/10/16 CRUD/RBAC/no-SMS flows, 9/11 HOS §395.30/§395.8 flows, 12 FMCSA TEST-mode, 13 real WS `trip.status_changed` via a genuine backend PATCH, 14 offline banner, 15 the 15 non-account Viewer screens. Run green twice consecutively (`--project=e2e`, single worker) after fixing 7 spec-selector bugs and 2 real app bugs found along the way (WB-038 `useVehiclesList` compound `isError`, WB-039 `DataTable` row-action clicks bubbling into `onRowClick` through the Radix portal) — see `web/bugs.md` WB-038/WB-039. `test.fixme` where a backend gap blocks it: B-30 (duplicate-email uniqueness), B-1 (`GET /drivers/roster` 404s on the real dev API — blocks the "new driver appears in the table" half of scenario 6 and all of scenario 6's W-07 companion in 15). Scenario 9 skips at runtime (not fixme, matches the spec's own pre-existing `test.skip` fallback) when the dev DB currently has zero seeded `Driving`-status HOS events within an 8-day window of "today" — a seed-data gap, not a code defect; re-run once the dev DB has recent driving history seeded again
- [x] axe 0 critical/serious on every screen — `tests/e2e/17-axe-sweep.spec.ts` now covers all 26 screens (Live Fleet keyboard column + HOS 24-hour grid `role="img"`/`sr-only` table asserted explicitly), including W-26 `/account` and the `:id` detail routes W-04 Unit profile and W-05 Unit histories, which resolve a real id at runtime from the Vehicles table's first row rather than a hard-coded one. Two clean consecutive runs: 32/32 passed + 1 `test.fixme`. W-07 Driver profile stays `test.fixme('B-1 — …')` — `GET /drivers/roster` 404s on the real dev API, so the Drivers table it needs a row from is always empty; un-fixme once B-1 ships. No new violations found on the 4 newly-covered screens (WB-037's earlier token/attribute fixes already cover their shared components)
- [ ] Visual pass vs `web/roles and screens/` (26 screens × 4 roles) — `web/tests/VISUAL-PASS.md`: 24/26 admin-panel screens captured and reviewed (match or minor-deltas-with-owner, 0 mismatch); `vehicles/:id/histories` was out of scope this pass and Driver profile could not be captured for any role (`GET /drivers/roster` 404s on the live dev API, B-1) — box stays unticked until those two are covered
- [x] Sentry `beforeSend` masking — lazy DSN-gated chunk (28.3 KB), `shared/observability` 100% coverage (WD-057)
- [x] CSP + security headers — `deploy/nginx-security-headers.conf`, 0 violations via `deploy/verify-csp.sh` (WD-058)
- [x] 30-min idle logout E2E — `tests/e2e/idle-logout.spec.ts` 4/4 (fake clock, stubbed `/api`, WD-052); fixed WB-036 (no idle timer after `Stay signed in`)

---

## Global gates (every phase)
- [x] No URL literal outside `endpoints.ts`; no hand-built query key; no hex colour in a feature — enforced by ESLint house rules, repo-wide lint exit 0
- [x] Permission-less control absent from the DOM (not disabled) — `tests/e2e/18-permission-controls-global-gate.spec.ts`, table-driven across 4 roles × every READ-level (screen, role) pair from `RBAC_SCREENS` (24 combinations) plus one NONE-level canary per role confirming `buildRoutes` swaps in `<ForbiddenPage>` rather than a disabled screen; shares `assertNoWriteControls` (extracted to `tests/e2e/support/rbacControls.ts`) with scenario 15. Documented exception: W-24/W-25 `New ticket`/`Send feedback` for READ-level Viewer (§21.4, B-12). Green twice in a row (24/24, then 24/24) after fixing a wrong assumption in the canary test (the guard swaps the element in place at the same URL, it does not redirect to `/403`) and adding a live re-authentication fallback for the shared-demo-account refresh-token race (WB-035)
- [x] All four screen states implemented on every screen — `web/tests/STATES-AUDIT.md`, all 26 screens × 4 states. Loading and Forbidden are backed by the shared `<LoadingState>`/`<ForbiddenState>` primitives (now unit-tested in `src/shared/ui/states.test.tsx`) and the generic `buildRoutes` NONE-swap mechanism (`src/app/router.test.ts`), inherited by every screen that routes through them; screens with their own defensive/explicit branch (W-04, W-05, W-07, W-17, W-26 loading; W-04, W-07, W-17(generic)/W-26/reports/support/feedback forbidden) carry a specific test too. Added error-state tests to 7 screens that had the code path but no assertion (Live Fleet, Trips, Vehicles, Drivers, DVIR, Safety, Messages) and full 4-state coverage for the previously-untested W-04/W-05/W-07 detail pages (new `UnitProfilePage.test.tsx`, `UnitHistoriesPage.test.tsx`, `DriverProfilePage.test.tsx`)
- [x] Exact English copy from the design images and §13.2 / §13.3 — copy tables typed in `shared/ui/copy.ts`; diffed verbatim against §13.2/§13.3 and against the Phase 10 visual-pass screenshots (`web/tests/VISUAL-PASS.md`) — no mismatches

---

## Carry-over — open when work resumes

**Waiting on a user decision**
- Backend gaps (`web/backend-gaps.md`): which group to start — blocking B-1…B-6, B-35; auth B-25, B-26, B-34, B-29/B-30; then B-7…B-15, B-36…B-49. Plus permission to restart the live API on :3002 after each backend fix.
- WD-036: alert-rule channels are `IN_APP | EMAIL | WEBHOOK` (SMS impossible). Confirm, or narrow to EMAIL-only per a strict reading of Q-2.

**Done outside `web/` this session**
- Backend B-043 / WB-011: WebSocket handshake rejected every token (`TokenVerifier` DI). Fixed with a regression test; verified live (`subscribe fleet` → `{"ok":true}`).
- Deployed a preview: https://eldadmin.stackyard.uz (this panel, built from Phase 6 state, `VITE_AUTH_MODE=dev`), https://eldapi.stackyard.uz → dev API :3002 incl. `/socket.io/`, https://eld.stackyard.uz → 301 to eldadmin. **Redeployed 2026-09-13** (`preview-20260913`, no sourcemaps) with the verified Phase 1–10 state; previous build kept as `/var/www/eldadmin.stackyard.uz.bak-20260913-174125`.
- The dev API and worker run from session scratchpad scripts — not durable across a reboot.

**Known simplifications left in shipped screens**
- W-05 route replay: `Play` toggles state only, no animated marker.
- W-12: IFTA KPIs and `Miles by jurisdiction` wired to `GET /reports/ifta/summary` (B-46, backend landing in parallel; MSW-backed until then). W-15 aggregates and PDF downloads still wait on B-45/B-47/B-48.
- Screens built on MSW-only endpoints show in-card errors on the live site until their gaps land: W-02 (B-3), W-06 hours (B-1), W-05 (B-4), W-08 violations (B-6).
