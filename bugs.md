# OneBook ELD web — bugs

`WB-0NN` · Found / Severity / Resolution.

## WB-001 · Dispatcher could reach `Settings · ELD devices` (nav + direct URL), design says no
**Found:** writing `tests/rbac/navigation.rbac.test.ts` against the RBAC fixture built from the
actual file counts in `web/roles and screens/` (26/21/14/16 — web/tz.md §12.1's own
cross-check). `web/roles and screens/dispatcher/` has no "Settings — ELD devices,
firmware, heartbeats.jpg", but the backend permission matrix
(`backend/src/modules/roles/permission-matrix.ts`) grants DISPATCHER `devices: READ`, and
`src/app/navigation.ts` / `src/app/router.tsx` had no design-override for that one item (unlike
the already-handled `dvir`/`safety` pair).
**Severity:** medium — a Dispatcher who typed `/settings/devices` directly got a real page
instead of `/403`, and the nav briefly showed an item no screenshot supports for that role.
**Resolution:** added `hiddenForRoles: ['DISPATCHER']` to the `SETTINGS_NAV` "ELD devices"
entry and `blockedRoles: ['DISPATCHER']` to its route in `router.tsx`, matching the existing
DVIR/Safety pattern. `firstPermittedSettingsRoute()` took a `role` parameter so `/settings`'s
redirect (which used to land Dispatcher on `/settings/devices`) now correctly falls through to
`/settings/support`. Covered by `tests/rbac/navigation.rbac.test.ts`.

## WB-002 · Dispatcher's `Reports · IFTA` tab has no design support either — ✅ resolved (Phase 7)
**Found:** same cross-check as WB-001. `web/roles and screens/dispatcher/` has no "IFTA by
jurisdiction and the report library.jpg" even though `reports` = READ for DISPATCHER and
`/reports/ifta` and `/reports/activity` share that one permission key in `router.tsx`. Only the
Activity report screenshot exists for Dispatcher.
**Severity:** low — not yet fixed; `router.tsx`'s Reports routes are all gated on the single
`reports` key today, so there is no route-level place to encode "IFTA specifically, not
Activity" without a new field. Recorded here instead of guessed at, for `web-reports-transfer`
(Phase 7) to resolve when building W-12: either split the two behind the tab UI (backend
matrix stays READ for both) or add a `reports:ifta` sub-permission. The RBAC fixture
(`tests/fixtures/rbacScreens.ts`) encodes the screenshot truth (Dispatcher: no IFTA) so the
Phase 7 RBAC test will fail loudly if this isn't addressed before that screen ships.
**Resolution (Phase 7, `web-reports-transfer`):** the screenshot wins. `app/router.tsx` gives
`reports/ifta` `blockedRoles: ['DISPATCHER']` (the same mechanism as DVIR/Safety — no new
permission key, the backend matrix stays READ), `/reports` now redirects DISPATCHER to
`/reports/activity` instead of a 403 (`ReportsIndexRedirect`), and the in-page report selector and
Report library hide IFTA/DVIR for DISPATCHER (`features/reports/reportMeta.ts` `REPORT_ROUTES`).
Verified by `src/features/reports/reportsRouting.test.tsx`, which walks every `/reports/*` entry of
`tests/fixtures/rbacScreens.ts` for all four roles through `buildRoutes()`.

## WB-003 · `house/no-design-literal` flagged every unit number (`#101`) as a hex colour
**Found:** `npm run lint` on the MSW fixtures generated from `backend/docs/openapi.json` —
9 errors, among them `Literal colour "#101"`, `"Loading at shipper #4821"` and
`"Unit #110 has not reported since Sep 09."`. The rule used `/#[0-9a-fA-F]{3,8}\b/`, which
matches any `#` followed by 3–8 hex-ish characters — and the design labels units `#101`, `#110`
and shippers `#4821` on nearly every screen.
**Severity:** high — not a mock-only problem: every feature agent writing the exact English copy
from `web/roles and screens/` (`Unit #101`, empty-state text, toast strings) would have hit an
unfixable lint error and been tempted to reword the design copy or disable the rule.
**Resolution:** narrowed the matcher in `eslint-rules/index.js` to a real colour — the whole
literal (`'#2563EB'`, 3/4/6/8 digits exactly) or a CSS position (`color: #fff`, i.e. preceded by
`:`/`(`/`,`). Verified both ways: `'#2563EB'` and `'color: #fff'` still error inside
`src/features/`, `'Unit #101 is idle'` no longer does. `src/mocks/**` was additionally exempted
from the house literal rules in `eslint.config.js`, like `tests/**`, because its fixtures are
generated from the backend document and must not be hand-edited.

## WB-004 · §14.3 spells the eRODS test-mode code `ERODS_TEST_MODE`, the backend emits `ERODS_TEST_MODE_ONLY`
**Found:** building `shared/api/errors.ts` one-to-one against
`backend/src/common/errors/codes.ts`. The registry has `ERODS_TEST_MODE_ONLY`; `web/tz.md`
§14.3 lists `ERODS_TEST_MODE`. A user hitting the real backend code would have fallen through to
`Something went wrong. Reference: <traceId>` on the FMCSA transfer screen (W-15), which is the
one screen where an inspector-facing explanation matters.
**Severity:** medium — silent copy loss on a compliance screen, invisible until an eRODS
transfer is attempted in TEST mode (which is the seeded default: `carrier.erodsMode: "TEST"`).
**Resolution:** both spellings map to the §14.3 string
`eRODS is in test mode — the file will not reach FMCSA.` The backend is not edited (the registry
is append-only and its code is the contract); the web table carries the alias and a comment.
Covered by `src/shared/api/errors.test.ts`.

## WB-005 · `POST /auth/login` does not return `user`; `GET /auth/me` carries no name or email
**Found:** verifying the four demo accounts against the running dev API (`http://localhost:3002/api`,
2026-09-12). `POST /auth/login` answers `{ accessToken, refreshToken, tokenType }` only — no
`user` object, contrary to the Phase 1b brief — and `GET /auth/me` answers
`{ id, type, role, permissions, twoFactorEnabled }`, with no `fullName`, `email`, `avatarUrl` or
carrier. The topbar avatar, the account menu and W-26 all need those.
**Severity:** low for auth itself (permissions are complete and correct), medium for display.
**Resolution:** `AuthProvider` never assumed a `user` on the login response — it always completes
sign-in with `GET /auth/me`. The display fields fall back (`fullName` → `OneBook user`,
`carrierName` → the sidebar's own default). `GET /me/profile` does return
`firstName`/`lastName`/`email` and is `@TwoFactorExempt`, so Phase 9 (W-26) will hydrate the
display fields from it; recorded as gap B-34 so `/auth/me` can carry them in one round trip.

## WB-006 · Login throttle (5/min/IP) makes a four-account E2E run flaky
**Found:** `npx playwright test tests/e2e/01-dev-sign-in.spec.ts` — the four demo sign-ins plus
the `Demo accounts` filler test exceed `@Throttle({ limit: 5, ttl: 60_000 })` on
`POST /auth/login`, and the fifth attempt renders the correct W-00 banner
`Too many attempts. Try again in a minute.` instead of signing in.
**Severity:** low in the app (the banner is the specified behaviour), medium for CI: scenario 1
fails for a reason that has nothing to do with the code under test.
**Resolution:** not a web defect and not fixed in `backend/`. Recorded for `web-qa-a11y`, who owns
`tests/e2e/support/auth.ts`: the sign-in helper needs either a shared storage-state fixture (sign
in once per role, reuse the `obk.rt` refresh token) or a retry that waits out the 60 s window.
The web side is correct, and the banner copy is verified by this very failure.
Second half of the same helper issue: `05-sidebar-by-role.spec.ts` reads
`getByRole('navigation').getByRole('link').allInnerTexts()` immediately after `waitForURL('/')`.
`allInnerTexts()` has no auto-wait, so it returns `[]` while the shell is still mounting — the
page snapshot in the failure artefact shows the correct 11-item sidebar. Driving the same four
roles with an explicit `locator.first().waitFor()` returns exactly the §4.2 lists (verified by
hand for all four roles, plus `● Fleet manager` / `● Dispatcher` / `● Read-only · Viewer` and no
chip at all for ADMIN).
**Fixed:** `05-sidebar-by-role.spec.ts` now calls `nav.getByRole('link').first().waitFor()`
before `allInnerTexts()`. For the throttle, `signInAndPersist()` in `tests/e2e/support/auth.ts`
signs in once per role in `01-dev-sign-in.spec.ts` only and writes `page.context().storageState()`
to `tests/e2e/.auth/<role>.json`; `05-sidebar-by-role.spec.ts` loads that file via
`test.use({ storageState })` instead of logging in again, and a `dependencies: ['e2e-sign-in']`
project in `playwright.config.ts` guarantees the write happens before the read. A full
`npx playwright test` run now makes exactly 4 `POST /auth/login` calls (plus one
`POST /auth/2fa/verify` for ADMIN at the time — gone since WD-067) — see `web/decisions.md` WD-016.

## WB-007 · The 2FA code cells never auto-submitted (`String.includes('')` is always true)
> **Obsolete (2026-09-13):** W-00b and `TwoFactorPage.tsx` were deleted when 2FA was removed (WD-067).
**Found:** driving W-00b in a real browser — typing all six digits left the form idle, and a wrong
code produced no `Invalid or expired code.` banner. The auto-advance guard read
`filled.length === CODE_LENGTH && !filled.includes('')`, and `'123456'.includes('')` is `true`
for every string, so the second half of the condition was always false.
**Severity:** medium — the screen still worked through the `Verify` button, but the specified
auto-submit on the sixth digit (and its paste path) silently did nothing.
**Resolution:** `src/features/auth/TwoFactorPage.tsx` now checks the cells individually
(`next.every((cell) => cell !== '')`). Re-verified end to end against the running API: six digits
auto-submit, a wrong code renders `Invalid or expired code.`, the cells clear and focus returns
to the first one.

## WB-008 · The canonical demo ADMIN now has 2FA enabled, against web/tz.md §6.7
> **Obsolete (2026-09-13):** 2FA no longer exists; `tests/e2e/support/totp.ts` and the ADMIN TOTP step in `signInAsDev()` were deleted (WD-067).
**Found:** verifying the four demo logins. At 10:13 today `POST /auth/login` for
`sarah.chen@universal-logistics.example` returned an access/refresh pair; by 13:00 the same call
returned `{ twoFactorRequired: true, pendingTwoFactorToken }`. `User.twoFactorEnabled` is `t` for
that row in `onebook_eld_dev` (the row itself was not recreated — `createdAt` is unchanged), and
`AuthService.completeUserLogin()` gates purely on that column, with no env flag.
**Severity:** medium — §6.7 says the canonical dev admin keeps 2FA **off** (the second admin,
`jason.kim@…`, is the one that keeps it on for testing the flow). E2E scenarios 1 and 5 cannot
sign in as ADMIN while it is on, because no test can produce a TOTP code.
**Resolution:** none from the web side — `backend/` is never edited and the DB is not this
agent's to rewrite. The web behaviour is correct and was verified with it: the challenge routes
to `/sign-in/2fa`, the screen renders, and a wrong code surfaces `Invalid or expired code.`
For whoever owns the dev DB: turn `twoFactorEnabled` off for `sarah.chen@…` (or re-run
`prisma/seed.ts`) to restore §6.7 and unblock E2E scenarios 1/5 for the ADMIN row.
**Resolved (reclassified):** confirmed deliberate, not a seed accident — `TWO_FACTOR_ENFORCED`
(B-26) does not exist yet, so 2FA was enrolled on `sarah.chen@…` directly through the API to
exercise the enforced-admin-2FA path on this box. `tests/e2e/support/totp.ts` computes RFC 6238
codes for the dev secret `CNHVAGLJHIOUWG2R` with `node:crypto` only (no new dependency), and
`signInAsDev()` drives the ADMIN row through `/sign-in/2fa` with a freshly computed code. See
`web/decisions.md` WD-016.

## WB-009 · The whole app crashed at first render: `useToast must be used inside <ToastProvider>`
**Found:** debugging E2E scenario 1 stalling on `getByRole('button', { name: 'Developer
sign-in' })` for the full 30s timeout with no page snapshot. A throwaway script hitting
`http://localhost:5173/sign-in` directly showed `PAGEERROR useToast must be used inside
<ToastProvider>` and a blank `<body>` — the React tree was unmounting on the very first render,
before `SignInPage` ever painted.
**Root cause:** `src/app/providers.tsx` still had web-architect's Phase-1a placeholder
`function ToastProvider({ children }) { return <>{children}</>; }`, shadowing the real
`ToastProvider`/`useToast` that `web-design-system` had since added to `shared/ui/Toast.tsx`.
`RealtimeProvider` (added since by `web-realtime`) calls `useToast()` internally for the
offline/reconnect banners, and the provider tree nested it as `<RealtimeProvider><ToastProvider>`
— i.e. `RealtimeProvider` was an *ancestor* of Toast's context, not a descendant, so
`useToast()` inside it always threw, and nothing behind it in the tree ever rendered.
**Severity:** critical — every screen, not just Sign in, was unreachable in a real browser; only
missed by `test:unit` because component tests render screens in isolation, not through
`<AppProviders>`.
**Resolution:** `providers.tsx` now imports the real `ToastProvider` from `@/shared/ui` and
nests `RealtimeProvider` inside it: `Auth → Toast → Realtime`. Verified live: `/sign-in` renders
the full W-00 card again.

## WB-010 · `GET /carrier`'s documented example is missing `timezone`, though the controller returns it
**Found:** building W-01's subtitle (`Universal Logistics Inc. · Today, Sep 10 2025 · ET`), which
needs `carrier.timezone`. `backend/docs/openapi.json`'s `/api/carrier` GET example (and the
generated `src/mocks/fixtures.generated.ts` mirror of it) is
`{ id, name, dotNumber, eldIdentifier, erodsMode }` — no `timezone` field. Reading
`backend/src/modules/carrier/carrier.controller.ts` directly shows the real
`@ApiOkResponse` example does include `timezone: 'America/New_York'`; the openapi.json on disk is
stale relative to the controller.
**Severity:** low — the real endpoint almost certainly returns the field; only the committed
doc/fixture is behind.
**Resolution:** `features/dashboard/DashboardPage.tsx`'s `useCarrier()` defensively falls back to
`'America/New_York'` when `timezone` is absent, so the subtitle still renders correctly against
either the stale fixture or a live backend. `backend/` is not edited from the web side; whoever
owns `docs/openapi.json` should regenerate it.

## WB-011 · Every real WS handshake to `/realtime` is rejected — `RealtimeModule` never imports `AuthModule`
**Found:** proving `RealtimeProvider`/`useRoom` against the live gateway (`http://localhost:3002`)
per the Phase 2 brief — logged in as `mike.torres@…` (`POST /auth/login` returns a real
`accessToken`, and that same token works fine against `GET /auth/me`), then connected
`socket.io-client` to `/realtime` with `auth: { token }`. The client gets a `connect` event
immediately followed by `disconnect` with reason `"io server disconnect"` — the exact "rejected
token" path from `web/tz.md` §7.2. Reading `backend/src/modules/realtime/realtime.module.ts`
shows why: it declares only `providers: [RealtimeGateway, RealtimeRoomAuthorizer]` and imports
nothing. `RealtimeGateway` injects the abstract `TokenVerifier` port; the real implementation
(`TokenService`) is bound inside `AuthModule`'s own `providers` array as
`{ provide: TokenVerifier, useExisting: TokenService }`, which only overrides the token for
consumers *inside* `AuthModule` (or a module that imports it). `RealtimeModule` never imports
`AuthModule`, so `RealtimeGateway` resolves `TokenVerifier` from the `@Global()` `CommonModule`
default instead — `NotImplementedTokenVerifier`, whose `verifyAccessToken` always rejects. Every
`handleConnection` therefore hits the `catch` block and calls `socket.disconnect(true)`,
regardless of how valid the token is. REST auth is unaffected because `JwtAuthGuard` sits in a
request pipeline that goes through the same global `CommonModule` binding but every controller
module *does* import `AuthModule` transitively (or `AuthModule` itself owns the guarded route).
**Severity:** critical for realtime — no browser session can ever receive a single live event;
falls back entirely to the §7.4 polling constants (`DASHBOARD_POLL_MS`/`LIVE_FLEET_POLL_MS`/
`HOS_LOGS_POLL_MS` in `shared/realtime/polling.ts`) until fixed.
**Resolution:** not fixed here — `backend/` is read-only from the web side. The one-line backend
fix is `imports: [AuthModule]` in `src/modules/realtime/realtime.module.ts` (mirroring how other
feature modules pull in the real `TokenVerifier`). Reported instead of patched. The web-side
`RealtimeProvider` code is unaffected and behaves exactly as specified even under this bug: it
sees `disconnect` reason `"io server disconnect"` and calls `signOut()` rather than retrying —
which is precisely how this defect surfaced during manual verification.

## WB-016 · `maplibre-gl` crashes on import under jsdom (`window.URL.createObjectURL` missing) — ✅ resolved (2026-09-18)
**Found:** the first Live Fleet test that renders a non-empty unit list (so `<FleetMap>` actually
lazy-loads). `maplibre-gl/dist/maplibre-gl.js` calls
`maplibregl.setWorkerUrl(window.URL.createObjectURL(...))` as a **module-load** side effect — it
runs the moment the module is imported, before `shared/map/FleetMap.tsx`'s own `HAS_STYLE` check
ever executes. jsdom does not implement `URL.createObjectURL`, so the import throws, React logs
an uncaught error, and the whole test tree unmounts (`<body><div /></body>`).
**Severity:** low — real browsers (and Playwright) implement `createObjectURL`; this only affects
Vitest/jsdom component tests that render a screen with a non-empty unit list.
**Resolution:** `features/live-fleet/LiveFleetPage.test.tsx` polyfills
`window.URL.createObjectURL` before rendering (a one-line no-op stub), the same way
`tests/setup/vitest.setup.ts` already stubs `ResizeObserver` and `matchMedia` for other libraries
jsdom does not implement. Any future test that renders a non-empty Live Fleet or Dashboard map
card needs the same one-liner — flagged here rather than added globally, since `vitest.setup.ts`
is `web-qa-a11y`'s file.

**Resolution (2026-09-18):** the `window.URL.createObjectURL ??= () => 'blob:mock'` polyfill moved
out of the per-test file and into the shared `tests/setup/vitest.setup.ts` (line 51), so every test
that lazy-loads `<FleetMap>` gets it automatically; the local copy in `LiveFleetPage.test.tsx` was
removed.

## WB-012 · An empty optional number field silently blocked the whole form, with no visible error
**Found:** writing the 11.1 Create-a-geofence test — leaving "Radius / size" blank and submitting
never called the mutation, and nothing in the UI explained why.
`register('radiusMeters', { valueAsNumber: true })` turns an empty input into `NaN`, not
`undefined`; zod's `z.number().positive().optional()` rejects `NaN` (it is a `number` by
`typeof`, so `.optional()`'s "skip if `undefined`" never applies), so `handleSubmit` never invokes
`mutationFn` — and because the modal never rendered `errors.radiusMeters`, the failure was
completely silent.
**Severity:** medium — a field documented as optional (§11.1: "Radius / size") in effect made the
whole form unsubmittable whenever it was left blank, with a false appearance of a dead `Save`
button.
**Resolution:** `features/live-fleet/components/CreateGeofenceModal.tsx` now registers
`radiusMeters` with `setValueAs: (v) => (v === '' ? undefined : Number(v))` instead of
`valueAsNumber`, so a blank field validates as `undefined` and submits. Any other optional
numeric field built the same way (`valueAsNumber: true` with no default) should use the same
`setValueAs` pattern rather than relying on zod to treat `NaN` as absent.

## WB-013 · Nobody ever called `setAuthBridge()`, so `client.ts` ran tokenless on its defaults
**Found:** writing the AuthProvider tests. `shared/api/client.ts` documents that "`shared/auth`
calls `setAuthBridge` once", and falls back to a default bridge that keeps its *own* in-memory
token, returns `null` for the refresh token and hard-redirects on sign-out. Nothing in
`src/` called it (`grep -rn "setAuthBridge" src | grep -v client` was empty), so every
authenticated request a feature screen made would have gone out **without** an `Authorization`
header once the feature agents started using the client — the sign-in flow itself works because
`authApi.ts` carries its own token (WD-012).
**Severity:** high — invisible in Phase 1b (no screen fetches yet), and it would have surfaced as
"every screen 401s" the moment Phase 2 landed.
**Resolution:** `AuthProvider` now installs the bridge in the same effect that registers the
`authEvents` listeners: `getAccessToken`/`getRefreshToken` from `tokenStore`, `onTokens` writing a
rotated pair back into both stores, `onSignOut` → `resetSession()`, `onTwoFactorSetupRequired` →
the app-wide lock. `setClientAccessToken()` is also called at every point the session changes, so
the client's copy and the store never diverge. Covered by `AuthProvider.test.tsx`.

## WB-014 · `client.ts`'s refresh body omits `subjectType`, which the backend DTO requires
**Found:** comparing `client.ts`'s `refreshAccessToken()` (`body: { refreshToken }`) against
`backend/src/modules/auth/dto/auth.dto.ts`, where `RefreshTokenDto` is
`z.object({ refreshToken: z.string().min(1), subjectType: z.enum(['user', 'driver']) })`.
A refresh driven by the client's 401 path would be rejected with a validation error against the
real API; `shared/auth/authApi.ts` sends `subjectType: 'user'` and is unaffected.
**Severity:** medium — it only bites when an access token expires mid-session *and* the proactive
refresh has not already renewed it, which is why E2E has not hit it.
**Resolution:** fixed by `web-api-client`. `refreshAccessToken()` now sends
`{ refreshToken, subjectType: REFRESH_SUBJECT_TYPE }`, with `REFRESH_SUBJECT_TYPE = 'user'`
exported from `shared/api/client.ts` and documented against the DTO (the web panel is always a
`user`; drivers refresh from the mobile app). `shared/auth/authApi.ts` may import that constant
instead of its own literal when convenient — the value is now written down in one place.
Pinned on both sides: `src/shared/api/client.test.ts` →
`expect(bodies).toEqual([{ refreshToken: 'refresh-1', subjectType: 'user' }])`, matching
`src/shared/auth/authApi.test.ts`.

A second defect surfaced while fixing it: with **no** refresh token the old code posted `{}`,
which `RefreshTokenDto` rejects (`refreshToken` is `min(1)`) — a guaranteed-422 round trip to
learn that the session is already over. `refreshAccessToken()` now calls `onSignOut('expired')`
and throws `401 TOKEN_EXPIRED` locally without touching the network, covered by
`signs out without a request when there is no refresh token to send`.

## WB-015 · Two concurrent `vitest --coverage` runs clobber each other's `coverage/.tmp`
**Found:** the same file reported 96.93% in one full run and 44.78% in the next, and one run died
with `ENOENT: coverage/.tmp/coverage-8.json`. Several agents run `npm run test:unit` at the same
time on this box and v8 coverage uses a fixed `coverage/.tmp` directory.
**Severity:** low for CI (one run at a time), medium for local reporting — a per-file number read
during parallel work can be badly wrong.
**Resolution:** none needed in the app. When a number matters, pin the output directory:
`npx vitest run <paths> --coverage --coverage.reportsDirectory=/tmp/<name>`. Noted for
`web-qa-a11y` in case CI ever runs two projects concurrently.

## WB-017 · Full production build exceeds two bundle budgets — not attributable to Phase 2 alone
**Found:** running `npm run build` after wiring W-01/W-02. `check-bundle-budget.mjs` failed two of
its checks:
- `maplibre (lazy)`: 286.2 KB gzip > 250 KB. `maplibre-gl@^5.24.0`'s own `dist/maplibre-gl.js`
  gzips to ~284 KB by itself (no ESM/tree-shakeable export exists — `package.json` only publishes
  the one UMD-style bundle as `main`), and the checker's `/^maplibre-/` filename match also folds
  in `maplibre-*.css` (10 KB gzip) alongside it. `shared/map/FleetMap.tsx`, the only file this
  phase adds to that chunk, is itself a separate 1.8 KB gzip chunk (`FleetMap-*.js`) — it is not
  the source of the overage.
- `entry + vendor + shell (initial)`: 301.6 KB gzip > 220 KB. `vendor-react` (100.8 KB) and
  `vendor` (183.7 KB) are Phase 1's `manualChunks` buckets for every `node_modules` dependency the
  *whole app* currently imports eagerly — this build reflects the full repo state across every
  agent's concurrent work at build time, not this phase's contribution in isolation. Every route
  chunk this phase owns is comfortably inside its own 90 KB budget (`LiveFleetPage` 7.0 KB,
  `DashboardPage` 4.1 KB, `DutyDonut` 1.0 KB, `DashboardMapPreview` 0.5 KB).
**Severity:** high for the release gate, but not a Phase 2 regression to fix unilaterally —
`vite.config.ts`'s `manualChunks` and `package.json`'s `maplibre-gl` pin belong to `web-architect`,
and changing either affects every other agent's build.
**Resolution (`web-architect`, phase 3):** the initial-shell half was a real chunking defect and is
fixed; the MapLibre half is a library-versus-budget conflict and was decided in `web/decisions.md`
WD-023.

The initial overage was caused by `vite.config.ts`'s `manualChunks` catch-all `return 'vendor'`.
A named `manualChunks` bucket is only lazy if *nothing* in the eager graph imports it, so one
bucket holding every `node_modules` module made dynamic-import-only dependencies eager anyway:
`@firebase/auth` + `@firebase/app` + `@firebase/util` (~585 KB raw, loaded only by the dynamic
`import('firebase/auth')` inside `shared/auth/firebase.ts`), recharts' own transitive deps
(`lodash` 151 KB, `decimal.js-light` 48 KB, `react-smooth` 40 KB, `fast-equals` 26 KB — recharts
itself was correctly bucketed, its dependencies were not), plus `zod`, `react-hook-form` and
`@tanstack/table-core`, none of which the shell imports. Each now has its own named bucket
(`firebase`, `recharts`, `vendor-forms`, `vendor-table`), which makes them lazy chunks reached
only from the route chunks that import them. `vendor` fell from 183.7 KB to 70.8 KB gzip and the
initial payload from 301.6 KB to 191.7 KB — below the 220 KB budget and below the 198.5 KB
Phase 1 baseline. No budget number was relaxed for this half.

## WB-018 · MSW `GET /drivers/:id` swallows `GET /drivers/roster` — static path registered after the dynamic one
**Found:** building W-06 Drivers (gap B-1), `useDriverRoster()` always resolved the single-driver
`GET /api/drivers/{id}` fixture (an object, not `{ items, total, ... }`) instead of the intended
`/drivers/roster` handler.
**Severity:** medium — test-only (MSW is first-match-wins and `fleetHandlers`' `/drivers/:id`
pattern happily captures the literal segment `"roster"`), but it silently broke every roster test
with no error, just wrong data.
**Resolution:** `src/mocks/handlers/index.ts` now registers `vehiclesDriversGapHandlers` (which
owns the static `/drivers/roster` path) **before** `fleetHandlers` (which owns the dynamic
`/drivers/:id`). General rule for anyone adding a static sibling of an existing `:id` route: order
matters in the combined `handlers` array, static first.

## WB-019 · 11.2 Add vehicle silently blocked submit on untouched optional fields
**Found:** writing the 11.2 Add vehicle modal test — `Save unit` did nothing (no toast, no error
text, no network call) whenever `Issuing state` / `Odometer at activation` were left blank.
**Severity:** high — a real user filling only the required fields could never create a unit; the
form gave no visible feedback at all (`errors` render only under fields the code checks, and
nothing marked `licenseState`/`odometer` as invalid in the UI).
**Root cause:** the same class of bug as WB-012 (`CreateGeofenceModal`) — an untouched optional
text input defaults to `''`, and zod's `.optional()` only skips validation on `undefined`, not on
`''`; `licenseState` then failed `.length(2)` and `odometer`'s `valueAsNumber` turned a blank
field into `NaN`, which fails `z.number()`.
**Resolution:** both fields now use `setValueAs` to coerce `''`/blank to `undefined` before zod
sees it, matching the WB-012 fix already in `CreateGeofenceModal`. The identical trap hit
`Phone number` in 11.8 Add driver (`f.phone().optional()`) — fixed the same way.

## WB-020 · `logEditRequestSchema.reason` allowed 500 characters; the backend caps it at 60
**Found:** building 11.11 Request a log edit — `shared/forms/schemas.ts` composed the reason from
`f.editReason()` (4–500 chars), but `CreateEditRequestDto.reason` is
`annotationSchema = z.string().trim().min(4).max(60)`
(`backend/src/modules/logs/dto/logs.dto.ts`) because §395 Appendix A caps every annotation at 60.
**Severity:** medium — a carrier typing a 200-character explanation passed client validation and
got an opaque `422 VALIDATION_FAILED` from the server, on a compliance write where the user has no
way to guess which field was wrong.
**Resolution:** `logEditRequestSchema.reason` now uses `f.annotation()` (4–60, with the exact
§14.2 string `An annotation must be at least 4 characters (FMCSA requirement).`). The 11.11 modal
also hard-caps the textarea at `LIMITS.annotationMax`.

## WB-021 · `logEditRequestSchema.proposedStatus` offered `PC`/`YM`, which the endpoint cannot accept
**Found:** same modal. The shared schema's enum was `['OFF','SB','D','ON','PC','YM']`, but
`CreateEditRequestDto.proposedStatus` is `DutyStatusEnum = ['OFF','SB','D','ON']` — a §395.1(e)
special driving category has no representation in a carrier edit proposal at all.
**Severity:** medium — selecting `Yard move` produced a guaranteed 422, and the "obvious" fix
(mapping YM → ON, PC → OFF before sending) would have written a record that misstates the duty
category to an inspector.
**Resolution:** the shared enum is narrowed to the four statuses the DTO accepts; the two chips
are still drawn, in the design's order, but **disabled**, and the missing field is recorded as gap
B-39 rather than papered over client-side.

## WB-022 · `certifySchema` had the certify payload inside out
**Found:** building 11.12 Certify logs. The shared schema was `{ date: isoDay, driverIds: [...] }`
— one day for many drivers. `POST /logs/:driverId/certify` is the opposite: the driver is a path
parameter and `CertifyDto` is `{ dates: string[] (1…31) }`, i.e. many days for one driver, which
is also what the design's day-checkbox list draws.
**Severity:** medium — the schema was unused until now, but anyone wiring 11.12 from it would have
built the wrong request shape and the wrong modal.
**Resolution:** `certifySchema` is now `{ driverId, dates: isoDay[] (1…31) }`, matching
`CertifyDto`. A page-level test asserts the request body is exactly `{ dates: ['2026-09-10'] }`.

## WB-023 · The 24-hour grid missed its 50 ms render budget by 4× — ~320 `<line>` nodes for the lattice
**Found:** writing the W-08 render-budget test. A full RODS day took 213 ms to mount: the hour
rules, row rules and 15-minute ticks were 318 individual `<line>` elements, and every timestamp
went through `date-fns-tz`'s `formatInTimeZone`, which constructs a fresh `Intl.DateTimeFormat` on
**every call** (~400 constructions per render on a busy day).
**Severity:** medium — the grid is the one component in the panel with a stated performance
budget, and this is the screen an inspector waits on at the roadside.
**Resolution:** two real fixes, not a relaxed budget. (1) The lattice collapsed into three
`<path>` elements (`hourRulesPath()`, `rowRulesPath()`, `quarterHourTicksPath()` in
`features/hos-logs/grid.ts`); the SVG moved to a 96-unit quarter-hour viewBox with
`preserveAspectRatio="none"` and `vector-effect="non-scaling-stroke"`, so a 1 px rule is still
1 px at any width. (2) `Intl.DateTimeFormat` instances are cached per timezone (`rodsClock`), and
`rodsDayStart` now resolves the RODS midnight with two offset probes instead of up to 26
`formatInTimeZone` calls, memoised per `date|timezone`. The model computation for 96 segments is
asserted under 50 ms in `grid.test.ts`; the component test fences the node count instead of the
wall clock, because a jsdom mount time on a shared CI box swings 130–680 ms and is not the browser
number the budget refers to.

## WB-024 · `deviceSchema` required an `eldIdentifier` field that 11.20's modal and `CreateDeviceDto` do not have
**Found:** building 11.20 Register an ELD device. `shared/forms/schemas.ts`'s `deviceSchema`
requires `eldIdentifier` (the exactly-4-character FMCSA field), but that field lives once on the
*carrier* (`W-17`, `PATCH /carrier`) — a single ELD device has no `eldIdentifier` of its own.
`backend/src/modules/devices/dto/devices.dto.ts`'s `CreateDeviceDto` is `serial`, `model`,
`firmware`, plus BLE timing fields; the design (§11.20) shows `Device model`, `Serial number`,
`Assign to unit`, `Firmware` (disabled) and two toggles — no ELD identifier field anywhere.
**Severity:** medium — using `deviceSchema` as written would have always failed client-side
validation for a modal that never collects the value it demands.
**Resolution:** ✅ **resolved at the source by `web-api-client`.** `shared/forms/schemas.ts`
`deviceSchema` is now `CreateDeviceDto` field for field — `model: z.enum(DEVICE_MODELS)`
(`PT30 | PT40`), `serial` 1–60 (`Enter a serial number.`), `firmware` ≤ 20 — plus the
`Assign to unit` `vehicleId` that drives the follow-up `POST /devices/:id/pair`. `eldIdentifier` is
gone (it stays on `carrierSchema`, W-17). `RegisterDeviceModal.tsx`'s local schema was removed and
replaced by the shared import. Tests: `src/shared/forms/schemas.test.ts` asserts the DTO fields,
the length limits, and `'eldIdentifier' in deviceSchema.shape === false`.

## WB-025 · `alertRuleSchema.recipients` was `email[]`; `CreateAlertRuleDto.recipients` is a role/user object
**Found:** building 11.21 New alert rule. `shared/forms/schemas.ts`'s `alertRuleSchema` types
`recipients` as `z.array(f.email())`, but `backend/src/modules/notifications/dto/notifications.dto.ts`'s
`CreateAlertRuleDto.recipients` is `{ roles?: string[], userIds?: string[], driverIds?: string[],
subjectDriver?: boolean }` — an object, not an email list. The design's `Recipients ▾` control
(`Assigned fleet manager` / `Fleet managers` / `Dispatchers` / `Safety team` / `Specific users…`)
is role-based anyway, matching the DTO's `roles` array, not raw emails.
**Severity:** low — `alertRuleSchema` was unused until now; wiring the modal from it as written
would have sent a shape the endpoint has no field for.
**Resolution:** ✅ **resolved at the source by `web-api-client`.** Two shared schemas now:
`alertRuleFormSchema` (the `name` + `severity` the modal registers, `Enter a rule name.`) and
`alertRuleSchema`, the full `CreateAlertRuleDto` body — `key`, `conditions[] ≥ 1`,
`recipients: { roles?, userIds?, driverIds?, subjectDriver? }` (uuid-checked), `throttle?`,
`quietHours?` (`HH:mm`), `enabled`. The original shared schema was also wrong on `channels`: it
allowed **only** `EMAIL`, while §11.21's design draws `In-app` and `Webhook` as live options and the
DTO accepts both. `channels` is now `z.enum(['IN_APP', 'EMAIL', 'WEBHOOK'])` — `SMS` is not a member
at all, so Q-2 holds structurally rather than by convention (web/decisions.md, alert channels).
`NewAlertRuleModal.tsx`'s local schema was removed and replaced by the shared import. Tests cover
all three channels, `SMS` alone and mixed in being rejected, an email-array `recipients` being
rejected, and the empty-`conditions` and bad-`quietHours` cases.

## WB-026 · `ticketSchema.priority` was `LOW | MEDIUM | HIGH`; the backend and the design use `LOW | NORMAL | HIGH | URGENT`
**Found:** building 11.22 New support ticket. `shared/forms/schemas.ts`'s `ticketSchema` enum has
no `URGENT` member and calls the middle tier `MEDIUM`, but `backend/src/modules/support/dto/support.dto.ts`'s
`TicketPriorityEnum` is `LOW | NORMAL | HIGH | URGENT`, and §11.22 itself draws the four options as
`Urgent — vehicle down / High / Normal / Low`.
**Severity:** medium — selecting the design's own `Urgent` option or the (correctly-labelled)
default `Normal` tier would have failed client validation before ever reaching the server.
**Resolution:** ✅ **resolved at the source by `web-api-client`.** `ticketSchema.priority` is
`z.enum(TICKET_PRIORITIES)` = `LOW | NORMAL | HIGH | URGENT`, identical to `TicketPriorityEnum`;
`category` ≤ 100 and `description` (the DTO's `body`) ≤ 5000 with `Enter a description.`;
`attachments` was dropped because `CreateSupportTicketDto` has no such field. `subject` keeps
§14.2's 3–140, which sits inside the DTO's 1–200, so nothing the form accepts is ever rejected by
the server. One visible difference from the removed local copy: a 1–2 character or 141–200
character subject is now caught client-side with `Enter a subject between 3 and 140 characters.`
`NewTicketModal.tsx`'s local schema was removed and replaced by the shared import. Tests accept all
four priorities, reject `MEDIUM`, and cover the description, subject and category limits.

## WB-027 · W-23 Audit log's `Load more` displayed the page it had just replaced, not the one it fetched
**Found:** writing the cursor-pagination coverage test for `AuditLogPage`. The original
implementation held one `cursor` in state and one `accumulated` array; `loadMore()` pushed
`auditQuery.data` (the *previous* page, still in scope from before the cursor changed) into
`accumulated` and only then advanced `cursor`. The next render's `items` picked `accumulated`
(the stale page) instead of the freshly fetched one — a second `Load more` click was needed
before new rows ever appeared, and the very last page (`nextCursor: null`) never rendered its own
rows at all, only the second-to-last page's.
**Severity:** medium — the audit trail is append-only and load-bearing for compliance review; a
reviewer who paginated once would see the previous screen's rows relabelled as the new page.
**Resolution:** replaced the single-cursor/accumulator pair with `useQueries` over an array of
page cursors (`pageCursors: (string | undefined)[]`), so every loaded page's `data` is read
directly off its own live query result and flattened in order — no page is ever one click behind
the fetch that answered it. Covered by `AuditLogPage.test.tsx`'s two-cursor pagination test.

## WB-028 · `TRANSFER_TERMINAL_STATUSES` in `shared/api/cache.ts` names statuses the backend does not have
**Found:** building W-15 `Previous transfers` and 11.14. `cache.ts` stops the named `transferStatus`
policy at `DELIVERED | CONFIRMED | FAILED | REJECTED`; the backend `TransferStatus` enum is
`QUEUED | TEST_ONLY | SENT | ACCEPTED | REJECTED | FAILED`, and `transfer.processor.ts` finishes a
send at `TEST_ONLY` (eRODS TEST mode — every dev transfer) or `SENT`. Verified live on 2026-09-12:
`POST /transfers` → `QUEUED`, `GET /transfers/:id` 5 s later → `TEST_ONLY`, which the policy would
have polled every 5 s forever.
**Severity:** medium — an endless 5 s poll per open transfer; "stops at terminal" (§6.4) was false.
**Resolution:** `shared/api/reports.ts` keeps the named interval (`POLL.transferStatus`) and the
visibility gate but stops at the backend's final set `TEST_ONLY | SENT | ACCEPTED | REJECTED | FAILED`
(`transferRefetchInterval`, unit-tested for every status). `cache.ts` itself is untouched — owned
by `web-api-client`, flagged here for its next edit.

✅ **Resolved at the source by `web-api-client`.** `shared/api/cache.ts` now stops the named
`transferStatus` policy at `TEST_ONLY | SENT | ACCEPTED | REJECTED | FAILED` — every
`TransferStatus` member except `QUEUED`. `SENT` is terminal on purpose: `fmcsa-transfer.service.ts`
ends every send at `TEST_ONLY`, `SENT` or `FAILED`, and nothing in `backend/src/modules/transfers`
ever writes `ACCEPTED`/`REJECTED`, so polling a `SENT` row for a verdict would be the endless poll
again. The report set was checked the same way and was already right (`ReportStatus` =
`QUEUED | RUNNING | READY | FAILED`, terminal `READY | FAILED`). `cache.test.ts` has one test per
real terminal status for both enums, a test that the invented `DELIVERED`/`CONFIRMED` keep polling,
and a guard that re-reads `backend/prisma/schema.prisma` and fails if either enum changes without
the terminal set following. `reports.ts`'s local `transferRefetchInterval` can now use
`cachePolicy('transferStatus')`; left to `web-reports-transfer`, whose file it is.
**Update (Phase 7 close):** `web-api-client` fixed the set in `cache.ts`; `shared/api/reports.ts` dropped its local interval and now uses the named `transferStatus` policy.

## WB-029 · `transferSchema` could never validate an eRODS transfer and spells the method wrong — ✅ resolved (2026-09-18)
**Found:** building 11.14. `shared/forms/schemas.ts` `transferSchema` makes `recipient:
inspectorEmail()` required for every method, so a `Web services (eRODS)` transfer (no recipient)
always fails client validation; its `method` enum is `EMAIL | WEB_SERVICE` where
`CreateTransferDto.method` is `WEB_SERVICES | EMAIL` — the singular value is a 422.
**Severity:** medium — the preferred roadside method would have been unsendable.
**Resolution:** `features/reports/sendLogs.ts` composes the SAME shared rules and strings
(`inspectorEmail`, `outputFileComment` 1–60, `daySpan` ≤ `LIMITS.transferRangeDays`, `M.transferRange`)
into a schema that requires the address only for `EMAIL` and uses `WEB_SERVICES`. No constraint was
widened (`sendLogs.test.ts`). `transferSchema` is untouched — flagged for `web-api-client`/`web-forms`.

**Resolution (2026-09-18):** `shared/forms/schemas.ts` now exports `transferFields` (`method:
'WEB_SERVICES' | 'EMAIL'`, matching `CreateTransferDto.method`) and `refineTransfer`, which
requires `recipient` only when `method === 'EMAIL'` and enforces `1 <= daySpan <=
LIMITS.transferRangeDays`. `transferSchema = transferFields.superRefine(refineTransfer)`, and
`features/reports/sendLogs.ts`'s `sendLogsSchema` is `transferFields.extend({ driverId
}).superRefine(refineTransfer)` — one source of truth for both 11.14 and the driver-scoped
send-logs form.

## WB-030 · `limit: 500` is a 422 on the live API — shared picker and DVIR joins break outside MSW
**Found:** probing the live API for W-12/W-14 on 2026-09-12: `GET /vehicles?limit=500` → 422 and
`GET /drivers?limit=500` → 422 (`limit` max is 200 on the list DTOs, e.g. `DvirListQueryDto`).
`shared/api/vehicles.ts` `useVehiclesPicker()` and the joins inside `shared/api/dvir.ts`
`useDvirsList()` (`useDriversList({ limit: 500 })`, `defects?limit=500`) send exactly that; MSW
accepts any limit, so their unit tests stay green.
**Severity:** high for the screens that use them (unit and driver names never resolve live); none
for reports.
**Resolution:** the report screens do not use those hooks — `shared/api/reports.ts` makes the same
joins with `REPORT_LIST_LIMIT = 200`. The shared hooks are untouched (owners `web-vehicles-drivers`,
`web-dvir-safety`), flagged here.

✅ **Resolved at the source by `web-api-client`, in two layers.**
1. **No request can carry `limit > 200`.** `shared/api/client.ts` exports `MAX_PAGE_LIMIT = 200`;
   `buildUrl` clamps any larger `limit` (number or string) to 200 and, in development, logs a
   `console.warn` naming WB-030 — so a new caller that reintroduces 500 gets a correct request and a
   visible warning instead of a live 422.
2. **Callers that need more rows page instead of truncating.** New `client.list<T>(path, params)`:
   `limit ≤ 200` is exactly one request with the page returned untouched; above that it walks
   200-row pages from the offset `page` implies, stops at `limit` rows / last page / an empty page,
   and returns one `OffsetPage` in the caller's own `limit`. Every list call in `vehicles.ts`,
   `dvir.ts`, `trips.ts`, `messaging.ts`, `safety.ts` and `drivers.ts` now goes through it, which
   covers `useVehiclesPicker`, the `useDvirsList` joins, `useDriversList({ limit: 500 })` everywhere
   it is used, and the `limit: 500` that `features/*` pass into `useVehiclesList`, `useDvirsList`,
   `useDefectsList`, `useWorkOrdersList`, `useSchedulesList` and `useSafetyEventsList` — with no
   edit in `features/`. Query keys are unchanged, so `setQueryData(qk.trips({ limit: 500 }))` still
   lands. 69 units today is one request; 300 units is two.
Covered by `client.test.ts`: the clamp and warning, the single-request path, a real paginating MSW
server for 300 rows at `limit: 500` (two requests at 200, all 300 rows, `row-0`…`row-299`), stopping
at the requested count, the page-2 offset, and stopping on an empty page.
**Update (Phase 7 close):** `web-api-client` added `client.list()` and a 200 clamp in `client.ts`; `shared/api/reports.ts` dropped `REPORT_LIST_LIMIT` and reads every list through `client.list()` (same 200-row joins, `useReportDrivers()`).

## WB-034 · Re-reading `/auth/me` rebuilt the whole router and remounted the current screen
**Found:** building W-26 2FA enrolment (web-auth-rbac). `AuthProvider.loadSession()` always stored a
fresh `toPermissionMap()` object, and `AppRouter` memoises `createBrowserRouter()` on
`[permissions, role]` — so any second `GET /auth/me` with identical permissions produced a new router
and remounted the open page. On W-26 that would have wiped the one-time recovery-code list the
moment the session was reloaded after `POST /auth/2fa/enable`.
**Severity:** high for W-26 (recovery codes are shown once and would vanish), medium elsewhere (any
screen losing local state on a session reload).
**Resolution:** `loadSession()` keeps the previous map when `samePermissions(prev, next)`; the
enrolment modal also reloads the session only when the user leaves the recovery-code step. Covered
by `AuthProvider.test.tsx` (`reloadSession` keeps the same `permissions` reference) and
`AccountPage.test.tsx` (`reloadSession` is not called while the codes are on screen).

## WB-033 · W-19 permission matrix silently ignored clicks on every non-ADMIN cell
**Found:** writing the cell-cycling coverage test for `RolesPage`. `cycleCell()` guarded on
`role.isSystem`, but `GET /roles` marks **all four** seeded roles `isSystem: true` (ADMIN,
FLEET_MANAGER, DISPATCHER, VIEWER are all pre-seeded system roles on the backend) — only ADMIN is
meant to be locked (§11.19's "Admin cannot be edited" chip). The JSX's own `disabled` state
(`isAdminCol || !canFull`) already got this right — the FLEET_MANAGER/DISPATCHER/VIEWER buttons
rendered enabled and clickable — but the click handler silently returned early for all four
columns, so no request was ever sent for a role other than a future custom (non-system) one.
**Severity:** high — the entire permission matrix was non-functional for its stated purpose
(editing FM/Dispatcher/Viewer permissions) while looking fully interactive.
**Resolution:** `cycleCell()` now gates on `role.key === 'ADMIN'`, matching `isAdminCol`. Covered
by `RolesPage.test.tsx`'s cell-cycling test, which asserts the PATCH body's `permissions.vehicles`
actually changes for the DISPATCHER column.

## WB-032 · jsdom missing pointer-capture APIs breaks every Radix pointer-driven primitive
**Found:** writing `Toast.test.tsx` for the new `action` slot (WD-041 follow-up) — any pointer
event on `Toast.Action`/`Toast.Root` threw `TypeError: target.hasPointerCapture is not a
function`, because jsdom implements neither `hasPointerCapture`, `setPointerCapture` nor
`releasePointerCapture`, and Radix's Toast (swipe-to-dismiss) and other drag-based primitives
call them unconditionally on pointerdown.
**Severity:** medium — silently broken component tests for any Radix primitive that touches
pointer capture (Toast today; would also hit Slider/future drag surfaces), not caught until a
real pointer interaction was exercised in a test.
**Resolution:** added the same class of no-op polyfill already used for `matchMedia` /
`ResizeObserver` / `scrollIntoView` to `tests/setup/vitest.setup.ts`.

## WB-035 · E2E harness: `keepAuthStateFresh` could overwrite a good refresh token with nothing, and the shared demo accounts race across concurrently-running agents
**Found:** writing Phase 10 E2E scenarios 6–16 and the axe sweep (`tests/e2e/06-…16-*.spec.ts`,
`tests/e2e/17-axe-sweep.spec.ts`). `POST /auth/refresh` rotates the refresh token and — because
reuse of an already-rotated one is treated as a compromise
(`backend/src/modules/auth/auth.service.ts` `refreshUser`) — revokes every session for that user.
Two compounding defects surfaced:
1. Every spec file that loads a role's `tests/e2e/.auth/<role>.json` forces exactly one rotation
   the moment the app boots (only `obk.rt` survives in `localStorage`; the access token is
   memory-only, so the first API call is always a 401 that triggers a refresh). Scenarios 1/3/5
   never hit this because each ran in isolation; chaining 11 more spec files that reuse the same
   four files (as scenarios 6–16 do) meant every file after the first got "Your session has
   expired" — `client.ts` rule 3 firing exactly as designed, just on a token nobody told it had
   already rotated.
2. The fix (`keepAuthStateFresh()` in `support/auth.ts`, persisting the rotated pair back to disk
   in `afterEach`) had its own defect: a crashed or torn-down browser context (`Target crashed` /
   `Page crashed`, both observed under the shared-machine RAM exhaustion the coordinator flagged
   mid-task) answers `context.storageState()` with `{ cookies: [], origins: [] }` instead of
   throwing. Writing that straight to disk wiped a perfectly good `obk.rt`, leaving every later
   spec permanently signed out until a human re-ran scenario 1.
3. Even after both of the above were fixed, `POST /auth/refresh` for ADMIN kept coming back a
   genuine, server-side `401` seconds after a guaranteed-fresh login with nothing of mine in
   between (confirmed via a diagnostic spec logging every `/api/*` request/response — no client
   bug, no thrown error, just a real 401 on a token that had not yet been used). The most likely
   explanation, given the coordinator's own message mid-task ("5 agents run vite build / eslint /
   tsc / playwright at once"): other web agents in this same session run Playwright against this
   same checkout and the same seeded demo accounts (Q-3 — one account per role), and can write to
   the exact same `tests/e2e/.auth/<role>.json` path. Any concurrent login or refresh for the same
   role from a sibling agent rotates the token out from under this one.
**Severity:** high for (1) and (2) — both silently broke the entire "reuse storage state instead
of re-logging in" pattern the existing scenarios 1/5 already depended on (WB-006); medium for (3)
— a real limitation of running multiple agents' E2E suites against one shared demo account and one
shared state-file path, not a defect in any one agent's code.
**Resolution:** (1) `fullyParallel: false` + `workers: 1` in `playwright.config.ts` so specs that
share a role's storage state never race each other from *this* process. (2) `keepAuthStateFresh()`
now reads `context.storageState()` un-pathed first, checks it actually still carries a non-empty
`obk.rt`, and only then writes it to the role's file — a state with no refresh token is dropped,
never persisted. (3) unresolved by design — needs a cross-agent convention (e.g. a per-agent or
per-run `tests/e2e/.auth/` subdirectory, or a lock around any write to those four files) that is
outside `web/tests/**` for one agent to impose unilaterally; flagged for `web-architect`/whoever
owns the shared Playwright conventions next.

## WB-036 · After `Stay signed in` the session had no idle timer at all
**Found:** writing the idle-logout Playwright E2E (web-auth-rbac). The §17 idle effect re-armed the
30-minute timer only from an activity event, and activity is deliberately ignored while the warning
is open — so the click on `Stay signed in` itself never re-armed it. Once dismissed, a session could
sit idle indefinitely with no second warning.
**Severity:** high — the §17 security control was silently disabled after its first use.
**Resolution:** the effect in `shared/auth/AuthProvider.tsx` now depends on `[status, idleWarning]`:
it is torn down while the warning is up and arms a fresh 30 minutes when it closes. Covered by
`AuthProvider.test.tsx` (`Stay signed in` arms a fresh 30 minutes; activity behind the open warning
does not reset it) and `tests/e2e/idle-logout.spec.ts` (the warning returns 30 minutes after
`Stay signed in`).

## WB-037 · axe sweep: `text-muted`/success/warning/danger text and four missing accessible names
**Found:** running `tests/e2e/17-axe-sweep.spec.ts` (Phase 10 axe fix task). `color-contrast`
(serious) fired on nearly every screen — `--color-text-muted` (#94a3b8, 2.56:1 on white, 2.3-2.4:1
on the sidebar/card/nav-active surfaces) fell well short of the 4.5:1 small-text floor, and the
same was true wherever `--color-success`/`--color-warning`/`--color-danger` were used as text
colour rather than a badge dot (2.1-3.8:1 depending on background). Four accessible-name gaps
were criticals/serious on top of that: Live Fleet's `role="list"` wrapper div held a `role="alert"`
`ErrorState` child during a failed fetch (`aria-required-children`); the Company profile
`ToggleRow` switch and the Roles & permissions matrix cell button had no name at all
(`button-name` ×2); the shared `ProgressBar` never set an accessible name (`aria-progressbar-name`,
hit on Support · Feedback's satisfaction bars); Support · Feedback's free-text `<textarea>` and
Safety's "Select driver to coach" `<select>` had no `<label>`/`aria-label` (`label`/`select-name`).
**Severity:** serious/critical — WCAG 2.1 AA failures on every screen in the sweep.
**Resolution:** darkened `--color-text-muted` to `#5f6d7f` (≥4.5:1 on white/`bg-subtle`/`bg-app`/
`bg-nav-active`) and `--color-success`/`warning`/`danger` to `#15803d`/`#b45309`/`#b91c1c`
(≥4.5:1 as text on both their solid and `*-soft` backgrounds, and white-on-solid stays ≥4.5:1) in
`src/shared/ui/tokens.css` — same hue family, only the lightness moved. Moved `role="list"` off
`LiveFleetPage`'s wrapper div onto the `<ul>` itself so the loading/error/empty branches no longer
render as illegal list children. Added `aria-label` to `ToggleRow` (now requires a string `title`)
and to the Roles matrix cell button (`"<permission> — <role>: <level>"`). Gave `ProgressBar` an
optional `label` prop (falls back to `"<pct>%"`) and wired it from `HosMeter`, `ProgressCard` and
DVIR's maintenance-due list. Added `aria-label` to the Feedback textarea and the Safety coach
`<select>`. Full `17-axe-sweep.spec.ts` run (29/29) green after the fix.

## WB-038 · `useVehiclesList` blanked the whole Vehicles table on a transient `/drivers` or `/devices` failure, even with good cached vehicle rows
**Found:** Phase 10 gate work, `tests/e2e/15-viewer-read-only.spec.ts` W-04 Unit profile — under
real system load the supporting `GET /drivers` or `GET /devices` join call (used only to resolve
the DRIVER / ELD SERIAL columns) intermittently failed while `GET /vehicles` itself had already
returned 69 rows; the KPI line still read "69 units · 68 active" from the cached `vehiclesQuery`
data, but the table body rendered a full `<ErrorState>` ("Could not load the fleet") because
`isError` was `vehiclesQuery.isError || driversQuery.isError || devicesQuery.isError` — any one of
three unrelated queries failing hid a table that had perfectly good primary data.
**Severity:** medium — turns a transient, unrelated network blip into a full page-level outage for
Vehicles, and made W-04 unreachable by row click during the failure window.
**Resolution:** `shared/api/vehicles.ts` `useVehiclesList` now reports `isError` only when the
primary `vehiclesQuery` itself has no error *and* no cached data (`vehiclesQuery.isError &&
!vehiclesQuery.data`); the driver/device joins already degrade safely to `Unassigned` / `Not
assigned` per §8.4 when their own query has no data. Verified by rerunning
`tests/e2e/15-viewer-read-only.spec.ts` W-04 twice in a row (green both times).

## WB-039 · Every row-action menu item also navigated to the row's detail page, because Radix portals still bubble React synthetic events up the component tree
**Found:** Phase 10 gate work, `tests/e2e/07-unit-crud.spec.ts` — clicking `Edit unit` from a
Vehicles row's `…` menu opened the Edit modal *and*, in the same tick, fired the table's
`onRowClick`, navigating to `/vehicles/:id` and unmounting `VehiclesPage` (and the modal with it)
out from under the still-open Edit dialog. Root cause: `shared/ui/DataTable.tsx`'s row-actions
trigger button calls `e.stopPropagation()`, but the `DropdownMenu.Content` it opens is portalled
to `document.body` — React attaches its synthetic-event delegation at the app root and bubbles by
component-tree position, not DOM position, so a click on any `DropdownMenu.Item` inside the portal
still bubbled to the `<tr onClick>` above the trigger, no matter where in the real DOM it painted.
**Severity:** high — every table with `rowActions` (Vehicles, Drivers, …) had this: any row-menu
selection could unintentionally navigate away and abandon whatever modal/mutation the item had
just started. Compliance-adjacent actions (`Delete unit`, `Calibrate odometer`) were exposed to
the same race, not just `Edit unit` — it happened to surface first in the Edit flow because that's
the one with a visible follow-up modal to lose.
**Resolution:** added `onClick={(e) => e.stopPropagation()}` to `DropdownMenu.Content` itself, so
no item click inside the portal reaches the row's `onClick` regardless of portal placement.
Verified by rerunning `tests/e2e/07-unit-crud.spec.ts` twice in a row (green both times) — edit and
delete both now complete without an unexpected navigation.

## WB-040 · W-21 Alert rules enable switch had no accessible name (axe `button-name`, critical)
**Found:** coordinator's full serial E2E run, `tests/e2e/17-axe-sweep.spec.ts` W-21 — the per-rule
`role="switch"` button in `src/features/settings/AlertRulesPage.tsx` rendered only a decorative knob
`<span>`, so screen readers announced an unnamed switch. It was missed by the earlier WB-037 sweep
because the switch only renders for `canFull` users with at least one rule.
**Severity:** critical (axe) — keyboard/screen-reader users could not tell which rule a switch toggles.
**Resolution:** `aria-label={`Enable ${rule.name}`}` on the switch. Verified: eslint clean,
`src/features/settings` unit tests 77/77, axe sweep + `16-no-sms` E2E 30/30.

## WB-041 · W-20 ELD devices UNIT column renders the raw vehicle UUID instead of the unit number
**Found:** Phase 10 visual pass, comparing `ADMIN`/`20-settings-devices` capture against
`roles and screens/admin panel/Settings — ELD devices, firmware, heartbeats.jpg`. `DevicesPage.tsx`
renders `row.original.vehicleId` verbatim (`#0d4c275e-ac5a-4ff9-b394-...`); the design shows the
human unit number (`#101`). `shared/api/vehicles.ts` already has a `joinVehicles` helper that maps
ids to unit numbers for the Vehicles table — `DevicesPage` never joins against the vehicles list.
**Severity:** major (cosmetic + unusable column — an operator cannot tell which truck a device is
paired to without opening the row menu).
**Owner:** `web-settings-admin` (not fixed here — feature-level join logic, not shared/ui).
**Resolution:** `DevicesPage.tsx` now joins against `useVehiclesPicker()` (the same `reference`-
cached vehicles list `shared/api/vehicles.ts` already exposes for other pickers) into an
`id -> unitNumber` map, mirroring `joinVehicles`'s intent without duplicating it. The UNIT column
renders the joined `unitNumber` (already carries its own `#`, e.g. `#101`, matching
`VehiclesPage`'s own UNIT # column convention) via `orDash`, so an unassigned device now shows
`—` instead of `Unassigned` or the raw UUID. Covered by a new `DevicesPage.test.tsx` case
asserting `#101` renders for a paired device and `—` for an unassigned one, and that the raw
vehicle UUID is never in the DOM.

## WB-042 · W-19 Users and W-11 Trips are missing filter controls the design draws
> **Update (2026-09-13):** the Users drawer's `Two-factor` group and the `fTwoFactor` URL param were removed with 2FA (WD-067); Role and Status remain.
**Found:** Phase 10 visual pass. `Settings · Users` has no `Filters` button next to the search box
(design: `Search user or email…` · `Filters`); `Dispatch & Trips` has no period dropdown next to
search (design: `This week ▾`). Both pages only expose the tabs/search already built.
**Severity:** minor (functionality present via tabs/search; the drawn control is absent).
**Owner:** `web-settings-admin` (Users), `web-dispatch-messaging` (Trips) — not fixed here.
**Resolution (Trips part):** added `features/trips/components/PeriodDropdown.tsx` — the `This
week ▾` control next to search, with `Today` / `This week` / `This month` presets plus a typed
custom range. It reuses the Filters drawer's own `fDepartFrom`/`fDepartTo` URL params (no second
filter to keep in sync — see web/decisions.md WD-065) and, per WD-065, does not write those params
on first load so the default view stays unfiltered by date (protects E2E 13's realtime-patched
row from being hidden by a seeded trip falling outside "this week"). `npx tsc --noEmit`,
`npx eslint src/features/trips` and `npx vitest run src/features/trips` (30 tests, `PeriodDropdown`
at 100% line/stmt/func coverage) all pass.
**Resolution (Users part):** added `Filters` next to `Search user or email…`, mirroring the W-03
Vehicles pattern — `features/settings/lib/filters.ts` (`f`-prefixed URL params `fRole`/`fStatus`/
`fTwoFactor`, `parseUserFilters`/`writeUserFilters`/`countActiveUserFilters`/`matchesUserFilters`)
and `features/settings/components/UserFiltersDrawer.tsx` (the shared `FilterDrawer`, three groups:
Role, Status, Two-factor — plus `UserFilterChips` and a `Clear all`). `GET /users` takes no query
parameters at all (logged as gap B-63), so every group filters client-side against the already-
loaded `useUsersList()` set, same precedent as the Vehicles/Trips/DVIR/Safety filter drawers
(B-54/B-59/B-60/B-61). The `Filters` button carries the applied count (`Filters · N`), and an
empty result shows the shared search/filter empty state with a `Clear filters` action. Covered by
two new `UsersPage.test.tsx` cases (drawer open → role filter narrows the table → chip `Clear all`
restores it; a filter matching nothing shows the empty state with `Clear filters`) plus
`features/settings/lib/filters.test.ts` (11 tests, 100% line/branch/func/stmt coverage).

## WB-043 · W-23 Audit log has no filter row and no `actorName` on the live API
**Found:** Phase 10 visual pass. `Settings · Audit log` design draws `All users ▾ · All actions ▾ ·
Last 30 days ▾ · Filters`; the built page only has a search box. Separately, every row's USER cell
shows the generic `USER` chip because the live API never returns `actorName` (see
`web/backend-gaps.md` B-62); `AuditLogPage.tsx`'s `entry.actorName ?? entry.actorType` fallback is
already correct, there is nothing to fix client-side for the name.
**Severity:** minor (filters), informational (actor name — backend gap, logged as B-62).
**Owner:** `web-settings-admin` — filter row not fixed here.
**Resolution:** added the drawn filter row — `All users ▾` (native `select` of the back-office
`useUsersList()` roster; `actorId` IS a real server-side param on `GET /audit-log`, so selecting a
user resets pagination and re-fetches server-side) · `All actions ▾` (`select` over the four
`Badge` actions already rendered) · the shared `DateRangePicker` (11.25) defaulting to `Last 30
days`, matching the design's own default label · `Filters` (opens the shared `FilterDrawer` with
an `Object type` group, folding in `objectType` — the other server-supported param — from both a
known set and whatever else is in the loaded pages). `action` and the date range have no
server-side param (logged as gap B-64), so both narrow the window of cursor-pages already loaded,
exactly like the pre-existing free-text `search`; `actorId`/`objectType` changes reset
`pageCursors` since they change the server query itself. The empty-state `Reset filters` action
now clears every control, not just search. `actorName` is unchanged — still the correct
`entry.actorName ?? entry.actorType` fallback, blocked on backend gap B-62. Verified: all 6
existing `AuditLogPage.test.tsx` cases still pass unmodified (default `Last 30 days` window keeps
today-dated fixture entries visible), `npx tsc --noEmit` and `npx eslint
src/features/settings/AuditLogPage.tsx` clean.

## WB-044 · Two unit tests flaked only in the full coverage run (1 s async-util budget too tight)
**Found:** coordinator's final serial `npm run test:unit` — `Topbar.overlays.test.tsx` (11.28 palette
search) and `UnitHistoriesPage.test.tsx` (W-05 error state) failed with `Unable to find role=…`,
while both files passed 25/25 twice when run on their own. Cause: Testing Library's default
`asyncUtilTimeout` of 1 000 ms, which the lazy palette chunk + debounced query + MSW round-trip
(and the W-05 fetch → retry-less 404 → `ErrorState`) can exceed under full-suite + coverage load.
**Severity:** low (test-only; no app defect) — but it made the coverage gate non-deterministic.
**Resolution:** `configure({ asyncUtilTimeout: 5_000 })` in `tests/setup/vitest.setup.ts`, so every
`findBy*`/`waitFor` gets the same headroom; the repo-wide `testTimeout` stays 20 s.

## WB-045 · MSW doubles for shipped B-2/B-6 drifted from openapi.json
**Found:** 2026-09-14, web-api-client, contract check after B-1/B-2/B-3/B-6/B-46 shipped. The default `GET /violations` handler returned `{ items: [], total: 0, page: 1 }`: no `limit`/`totalPages`, and no item to check. `DriverHosResponse` and its fixture lacked the backend's `dutyStatus`, `statusSince` and `computedAt`. `useResolveViolation` invalidated only the day log, so the W-01 fleet list (`qk.violations`) kept a resolved row.
**Severity:** medium (contract hole; stale dashboard row after Resolve).
**Resolution:** handler now serves the documented offset page with one documented row. The three fields were added to the type and fixture. The resolve mutation also invalidates `qk.violations()`. All six endpoints are covered in `tests/contract/shipped-gaps.contract.test.ts`.

## WB-046 · W-12 would render IFTA codes (`OH`) where the design shows names (`Ohio`)
**Found:** 2026-09-14, web-api-client. Backend `reports/lib/jurisdiction.ts` stores and returns two-letter codes (`OH`, `ON`). The MSW fixture used display names, so tests passed while the live screen would print `OH`, against the design's `Ohio` / `Ontario (CA)`.
**Severity:** medium (visible design mismatch on a compliance report).
**Resolution:** new `shared/format/jurisdiction.ts#formatJurisdiction`, 100% tested: US code → state name, CA province → `Name (CA)`, unknown → as given, empty → `—`. The W-12 cell uses it, and the fixture now carries codes.

## WB-047 · W-06 applied server-supported filters to one loaded page only
**Found:** 2026-09-14, web-api-client. `GET /drivers/roster` is server-paginated (default `limit` 10), but `terminal`, `violations` and `eldExempt` filters ran client-side on the current page. With 58 drivers, a filter silently missed matches on other pages.
**Severity:** medium.
**Resolution:** `useDriverRoster` takes `DriverRosterParams` (`terminal`, `hasOpenViolation`, `exempt`). `DriversPage` forwards them from the 11.23 Filters state, and the client-side match stays as a no-op refinement. Duty-status filter and segment counts are still per page, because the backend has no duty-status param or aggregate counts.

## WB-048 · Live browser QA (2026-09-14, ADMIN, https://eldadmin.stackyard.uz preview-20260914) — Live Fleet map renders wrong region and ~200 per-driver HOS-range calls fan out uncancelled
**Found:** manual Playwright QA pass against the deployed dev build with 6-month mock data.
1. **W-02 Live Fleet:** the main map pane renders a blue/white ocean-like projection with no
   visible unit markers or US landmass, while the Dashboard's own mini live-fleet map (same
   session, same data) correctly centres on the Midwest. Screenshot:
   `ADMIN_W-02_Live_Fleet.png`. Nav to `/live-fleet` itself took 41.85 s (`networkidle`), far
   past the §16 1.5 s budget for 69 markers — consistent with the map failing to fit bounds to
   the fleet's actual GPS extent and instead defaulting to a 0,0-ish view.
2. **Uncancelled per-driver fan-out:** during the same ADMIN session, 308 distinct
   `GET /api/logs/{driverId}/range?from=2026-09-01&to=2026-09-14` calls and 3
   `GET /api/transfers/{id}` calls were observed, each exceeding 3 s, with latency climbing
   monotonically from ~3.1 s to ~15.2 s as the run progressed (classic head-of-line queueing
   behind a single-origin connection cap). This is far more requests than any one screen needs
   (drivers ≈ 200) and they kept completing well after navigating away from the screen that
   issued them, i.e. `client.ts` rule 9 (`AbortController` cancels in-flight requests on unmount)
   is not honoured for whatever screen batches this call per driver instead of using a range/
   batch endpoint. Likely candidate: W-13 Activity report or W-01 Dashboard's unassigned-driving
   summary — the report/`FMCSA pack` and `Live Fleet` navigations landing at 17.9 s/17.3 s/41.9 s
   respectively line up with this backlog draining. No 4xx/5xx status was returned by any of
   these calls and no console errors were logged; this is a performance/architecture defect, not
   a broken endpoint.
**Severity:** high (Live Fleet map) / medium (fan-out latency, degrades every subsequent screen in
the session).
**Owner:** web feature — Live Fleet map bounds-fitting (likely `features/live-fleet`), and
whichever feature issues the per-driver `/logs/:id/range` calls instead of a bulk query (needs
code-location follow-up; not fixed here — QA pass only, no code changed per task scope).
**Resolution (fan-out half, `web-reports-transfer`, 2026-09-15):** the source was `useFleetRangeTotals` (WD-039) used by both W-13 Activity and W-15 FMCSA pack — one `GET /logs/:driverId/range` per ACTIVE driver each, uncancelled because the hooks passed no `signal`. W-01 never issued the call. Fixed per WD-070/WD-071: W-13 → one `GET /reports/activity/summary` (server paging/sort/terminal, B-46 shipped); W-15 → one summary read for all drivers or the picked driver's single range; every reports query and `useLogRange` pass TanStack's `signal`, and the jsdom/undici AbortSignal realm mismatch that made an earlier agent drop it is fixed in `tests/setup/jsdom-native-abort.ts`. Request counts per screen with a 50-driver fleet (`src/app/logsRangeFanOut.test.tsx`, guard ≤ 5): W-13 50 → 0, W-15 all drivers 50 → 0, W-15 one driver 50 → 1, W-01 0 → 0. Verified against the live `:3002` API (14-day fleet summary 0.31 s). The Live Fleet map half (item 1) belongs to `web-dashboard-fleet`.

**Root cause (map part, confirmed 2026-09-14 with the ~247-unit `/api/live/fleet` mock — 170 mock
+ 77 seed, some with `null` lat/lon):** `shared/map/FleetMap.tsx` never fit the camera to the
fleet's actual GPS extent at all — it hardcoded `center: [-83, 40], zoom: 6` (a fixed point on the
south shore of Lake Erie) on every mount, regardless of `units`. With the mock fleet spread lat
25–48/lon −124…−73, that fixed camera usually lands on open water near Ohio with no nearby
markers, matching the "ocean, no US landmass, no markers" screenshot exactly — it was never about
one bad `(0,0)`/`NaN` point moving a `fitBounds()` call, because there was no `fitBounds()` call.
Contributing hardening gap: `shared/api/liveFleet.ts#hasPosition` only checked `typeof === 'number'`,
so a unit reporting `(0, 0)` (a plausible "no fix" sentinel) or `NaN` would have been treated as a
real, valid position had bounds-fitting existed — confirmed as a live risk even though the current
mock fixture didn't happen to trip it, since a Google-style "null island" default is standard
upstream telemetry behaviour. The unrelated 41.8 s nav time is the WB-048 fan-out item above
(other agents), not the map.
**Resolution (map part, this fix):** `FleetMap.tsx` now (1) fits the camera to the fleet's real
extent on `load` and once more when the first non-empty batch of valid units arrives after mount,
then leaves the camera alone on later 30 s polls so a dispatcher's own pan/zoom survives; (2)
falls back to a continental-US default view (`[-97, 38.5]`, zoom 3.4) when there is not a single
valid fix, never `[0, 0]`; (3) calls `map.resize()` right after `load` and wires a `ResizeObserver`
on the container, covering the "0×0 at init" MapLibre failure mode; (4) filters every point fed to
the GeoJSON source and to bounds-fitting through a shared `isValidCoord` guard (rejects
non-number, `NaN`/`Infinity`, out-of-range lat/lon, and `(0, 0)`). `shared/api/liveFleet.ts#hasPosition`
carries the identical guard (now a type predicate) so both W-01's mini map and W-02's main map get
the same protection from one place. New tests: `shared/api/liveFleet.test.ts` (6 cases covering
null, NaN, null-island, out-of-range, swapped lat/lon) and three new cases in
`shared/map/FleetMap.withStyle.test.tsx` (resize-before-fit, mixed valid/invalid units fit bounds
to the valid ones only, all-invalid falls back to the US default, and fit-once-not-on-every-poll).
`npx tsc --noEmit`, `npx eslint` on the touched files, and `npx vitest run` on
`src/shared/map`, `src/shared/api/liveFleet.test.ts`, `src/features/live-fleet`,
`src/features/dashboard` all pass (28 tests). Not covered here — and already tracked above as a
separate item under the same WB-048 owner note: the `/logs/:id/range` fan-out and the 41.8 s nav
time it causes; no redeploy risk from this change beyond the normal web build/release of
`preview-20260914`'s successor.


## WB-049 · W-08 crashed on `day.certification.certified` — the MSW logs fixtures are truncated stubs
**Found:** 2026-09-17, dev (`/hos-logs`, MSW). `TypeError: Cannot read properties of undefined
(reading 'certified')` in `HosLogsPage.tsx`; React Router's error boundary replaced the whole page.
**Severity:** blocker — the compliance screen was unreachable in dev/demo.
**Cause:** `fixtures.generated.ts` `'GET /api/logs/{driverId}'` carries only `driverId/date/timezone/
summary/graph` (one 1-hour OFF block, a `summary` that is not a `RodsDaySummary`), with no
`certification`, `events` or `violations` — all required by `LogDayResponse`. `fleet.ts` served it
verbatim, and the page dereferenced the nested object behind a `day &&` guard only.
**Fix:** (1) `mocks/handlers/hosGaps.ts` now builds the RODS day, range and event list itself — a
full 24-hour graph in the driver's own `homeTerminalTimezone` (sleeper → pre-trip → drive → 30-min
break → drive → yard move → drive → post-trip → personal conveyance → off duty), derived totals, a
recorded `DRIVING_11` violation, §395.8 events including the superseded (2) and proposed (3) audit
records, and a `certification` block; segments are clamped to the real end of the day so a 23-/25-
hour DST day still sums to `dayLengthSec`. The truncated fixture handlers were removed from
`fleet.ts`. (2) `HosLogsPage.tsx` no longer dereferences query data unguarded: `certification`,
`summary`, `graph`, `violations` and `timezone` all fall back, and a partial payload renders the
grid card's existing `<ErrorState>` instead of the router boundary.

### WB-050 — `/account` showed two scrollbars: the page scrolled behind the main scroll area
**Found:** W-26 My profile at 1280×800 (`AppShell` single-scroll mode, `xl:` and up). The content
inside `<main>` scrolled *and* the whole window — sidebar and topbar included — scrolled with it.
**Severity:** medium (visual/UX; every long screen containing an `sr-only` caption or hint could
hit it — `/account` is simply the first page tall enough).
**Cause:** not `AccountLayout` (it is shape-identical to `SettingsLayout`) and not `AccountPage`.
Tailwind's `sr-only` utility is `position:absolute`. `<main>` was `static`, and nothing between it
and `<html>` is positioned, so the sr-only `<caption>` of the Active sessions table and the
sr-only sort hint in its `<th>` resolved against the *initial* containing block: at their static
position ~1400px down the un-scrolled content, they stretched `document.documentElement` to
`scrollHeight: 1402` against a `clientHeight` of 720 while `body.scrollHeight` stayed at 720 —
a document-level scrollbar produced by two invisible 1px elements that are not even in body's
scroll box. `/vehicles` has the same sr-only caption but is short enough to stay under the fold.
**Fix:** `src/app/layouts/AppShell.tsx` — `<main>` is now `relative` in both the padded and the
full-bleed variant, so it is the containing block for its absolutely positioned descendants and
their overflow belongs to the scroll container instead of `<html>`. `position:relative` with no
offsets and `z-index:auto` moves nothing and creates no stacking context, so there is no visual
change and no change to sub-`xl` page-scroll behaviour.


---

# Audit 2026-09-17 — full-project sweep (WB-053 …)

A read-only audit of the whole panel (~54 000 lines) run area by area against the code as it
stands on branch `shohruh` at `123fdeb`, plus the uncommitted working tree. Nothing below was
fixed; every entry is **open** and carries the evidence needed to reproduce it.

**Update (2026-09-18):** most entries below are now resolved or partly resolved — see the status appended to each entry's heading and its dated Resolution paragraph; a handful remain open by design (backend-blocked or deliberately deferred) or are still in progress.

**Gates as of this audit:** `tsc --noEmit` clean · `eslint --max-warnings=0` clean ·
`vitest run` 1083/1084 (the one failure is WB-056) · `npm run build` succeeds and every bundle
budget is met (initial, route chunks, maplibre 286.2/290 KB, recharts 97/120 KB, total
873.8/1228.8 KB).

**Numbering note:** `WB-049`–`WB-052` are referenced from code comments and tests
(`shared/map/FleetMap.tsx`, `shared/api/liveFleet.ts`, `mocks/handlers/vehiclesDriversGaps.ts`,
`features/account/AccountPage.tsx`), so those four ids are already spoken for. `WB-049` and
`WB-050` are written up above (they arrived from `main` after this audit was drafted); `WB-051`
and `WB-052` live only in the code. This audit therefore starts at `WB-053`.

---

## Build, dependencies and CI

## WB-053 · `maplibre-gl` ships a critical XSS sanitizer bypass — ✅ resolved (2026-09-18)
**Found:** `npm audit --omit=dev` — `maplibre-gl` `^5.24.0` is covered by GHSA-jrc7-96c5-q579
("XSS Sanitizer Bypass in `DOM.sanitize()` via Live NamedNodeMap Removal Skip"), which affects
every version `<= 6.4.0`.
**Severity:** critical — the map renders carrier-controlled strings (unit numbers, driver names,
geofence names) inside popups, which is exactly the sanitizer path the advisory bypasses.
**Fix (proposed):** bump to `maplibre-gl@6.10.0`. It is a major bump, so it has to be re-measured
against the 290 KB maplibre budget (WD-023) and `shared/map/FleetMap.tsx` re-verified against the
v6 API. Three further moderate advisories exist in dev-only deps (`vitest`/`@vitest/mocker`).

**Resolution (2026-09-18):** `package.json` pins `maplibre-gl@^6.10.0`; `npm audit --omit=dev` now
reports 0 vulnerabilities. v6 ships ESM-only with no default export, so `shared/map/FleetMap.tsx:9`
imports `* as maplibregl`, and `FleetMap.withStyle.test.tsx` was reshaped for the new mock surface.
No `Popup`/`setHTML` call exists anywhere under `shared/map/`, so the advisory's XSS path was never
reachable through carrier-controlled strings. The maplibre chunk measures 278.2/290 KB, still
inside budget.

## WB-054 · Production build publishes 74 source maps — ✅ resolved (2026-09-18)
**Found:** `vite.config.ts` sets `build.sourcemap: true` and nothing in `deploy/` removes them —
a verified `npm run build` emits 74 `*.map` files into `dist/assets/`, and the nginx snippet
serves the directory as-is.
**Severity:** medium — the panel's full readable source, including every internal endpoint path
and permission check, is downloadable from production.
**Fix (proposed):** either `sourcemap: 'hidden'` with the maps uploaded to Sentry and deleted
from `dist/` before sync, or a `find dist -name '*.map' -delete` step in the deploy script.

**Resolution (2026-09-18):** `vite.config.ts:27` builds with `sourcemap: 'hidden'` (maps are
generated but `dist/` carries no `sourceMappingURL` reference). The new
`scripts/extract-sourcemaps.mjs`, wired into `npm run build` (see `package.json`'s `build` script),
moves every `*.map` out of `dist/` into a git-ignored `sourcemaps/` directory (`.gitignore:3`) and
fails the build (`process.exit(1)`) if any map or map reference remains in `dist/`. The Sentry
upload of those maps is not wired yet — it needs secrets CI does not have.

## WB-055 · There is no CI configuration at all — ✅ resolved (2026-09-18)
**Found:** the repository has no `.github/`, and no pipeline file of any kind, although
`tz.md` §2.4/§16 and the §18 done-checklist require a green `web` job whose gates are the bundle
budget and `npm audit --production` (`tz.md:3519`, `:3564`, `:3851` — "`high`+ → build tushadi").
**Severity:** medium — every gate the spec calls mandatory is manual today. The audit gate in
particular would currently fail on WB-053, which is how that advisory went unnoticed.
**Fix (proposed):** add the `web` job running `typecheck`, `lint`, `test:unit`, `test:contract`,
`build` (which already includes the budget check) and `npm audit --omit=dev --audit-level=high`.

**Resolution (2026-09-18):** `.github/workflows/web.yml` (currently untracked/uncommitted) runs
`npm ci → typecheck → lint → vitest run → npm run build (incl. the bundle budget) → npm audit
--omit=dev --audit-level=high`, with `permissions: contents: read` and no deploy step, no secrets
and no E2E against live servers. `test:contract` is intentionally excluded because it reads
`../backend/docs/openapi.json`, which is not checked out in this job.

## WB-056 · The unit suite cannot pass without the backend repo checked out beside it — ✅ resolved (2026-09-18)
**Found:** `src/shared/api/cache.test.ts:101` throws `backend Prisma schema not found` when
`../backend/prisma/schema.prisma` is absent. The hard throw is deliberate (a silent skip would let
the enum cross-check rot), but it makes `npm run test:unit` red on any checkout of this repo alone.
**Severity:** low — it is the single failing test in an otherwise green 1084-test suite, and it
fails for an environmental reason rather than a defect in the panel.
**Fix (proposed):** keep the hard failure in CI (where both repos are present) but let it fail
loudly-and-skippably elsewhere, e.g. `it.skipIf(!existsSync(schemaPath))` combined with a CI-only
assertion that the file *was* found.

**Resolution (2026-09-18):** `src/shared/api/cache.test.ts:108` wraps the Prisma-enum cross-check
in `it.skipIf(skipEnumGuard)`, where `skipEnumGuard` (line 103) is true only when the backend
schema file is absent AND `ELD_REQUIRE_BACKEND_SCHEMA !== '1'`; the skip reason is in the test
title. Setting `ELD_REQUIRE_BACKEND_SCHEMA=1` makes a missing schema fail hard instead of silently
skipping.

---

## W-08 HOS Logs — the compliance core

## WB-057 · Unassigned-driving window is built from UTC midnights, so the end of the RODS day is never fetched — ✅ resolved (2026-09-18)
**Found:** `src/features/hos-logs/HosLogsPage.tsx:82` requests
`from: ${shiftDay(date,-1)}T00:00:00.000Z`, `to: ${shiftDay(date,1)}T00:00:00.000Z`. Verified by
reading the call site: for a `America/New_York` home terminal that window is
`[day-1 20:00 ET, day 20:00 ET]`, not the driver's RODS day.
**Severity:** critical — a PENDING unidentified segment at 21:30 ET on the viewed day falls outside
the request. The grid draws no hatched block, the header chip reads "No unassigned segments", and
modal 11.13 cannot resolve it. Unassigned driving that an auditor would see is invisible in the panel.
**Fix (proposed):** build the window from `rodsDayStart(date, timezone)` ± one day, the same helper
the grid itself already uses, instead of from UTC midnights.

**Resolution (2026-09-18):** `HosLogsPage.tsx:84` now builds the unassigned window from
`rodsDayStart(date, timezone)` (`grid.ts:125`), not UTC midnight, and fetches `[dayStart - 1 day,
dayStart + 2 days)` (lines 88-89) so the window runs +2 days from the day start, covering the end
of a 25-hour RODS day. The query is gated on `Boolean(driver) || driversQuery.isFetched` (line 93)
so it is never first built against the `UTC` fallback zone before the driver record loads.

## WB-058 · The unassigned chip and the 11.13 subtitle count neighbouring days — ✅ resolved (2026-09-18)
**Found:** `HosLogsPage.tsx:181`, `:283-289` and `components/UnassignedDrivingModal.tsx:103` use the
raw ±1-day list; only `plotUnassigned` clamps to the viewed day before drawing.
**Severity:** high — a day with zero overlapping segments still shows the "N unassigned segments"
warning chip because yesterday has one, and the modal's "N segments · total" header is inflated.
**Fix (proposed):** filter by overlap with `[dayStart, dayStart + dayLengthSec)` before counting.

**Resolution (2026-09-18):** `unassignedInDay()` (`grid.ts:311`) is the single helper now used by
the HOS page's chip (`HosLogsPage.tsx:191`), by `plotUnassigned` (`grid.ts:328`), and by the 11.13
modal's own filtering, so all three agree on which segments belong to the viewed day.

## WB-059 · The §395.30 guard is inverted — driving time can be re-stated away — ✅ resolved (2026-09-18)
**Found:** `components/RequestLogEditModal.tsx:238-239` computes
`disabled = (chip.value === 'D' && touchesAutomaticDriving) || 'YM' || 'PC'`. Verified by reading
the fieldset: when the requested interval covers automatic driving, `D` is greyed out while
`OFF`, `SB` and `ON` stay selectable and submittable — and the red note "Driving time can never be
shortened, deleted or restatused (49 CFR §395.30)" is rendered next to the one chip that is safe.
**Severity:** high — the modal permits precisely the edit §395.30 forbids and blocks the one it
allows. Only the server's `DRIVING_TIME_IMMUTABLE` refusal stops the request.
**Fix (proposed):** when `touchesAutomaticDriving`, disable `OFF`/`SB`/`ON` and leave `D` enabled,
keeping the §14.3 text.

**Resolution (2026-09-18):** `RequestLogEditModal.tsx:260-264` disables a status chip when
`touchesAutomaticDriving && chip.value` is `OFF`/`SB`/`ON` (`restatesDriving`), or unconditionally
for `YM`/`PC` (gap B-39/WB-021); `D` is in neither condition and stays enabled, so §395.30 driving
time can no longer be re-stated away through the edit modal.

## WB-060 · `Resolve` always resolves the first open violation — ✅ resolved (2026-09-18)
**Found:** `components/ViolationsCard.tsx:47` — the single card-level button targets `open[0]`, and
there is no per-row action.
**Severity:** high — on a day with `DRIVING_11` and `BREAK_30` both OPEN, the second violation is
unreachable until the first is resolved; a compliance officer resolving "the one they clicked"
actually resolves a different violation and writes the resolution note against it.
**Fix (proposed):** move `Resolve` onto each OPEN row.

**Resolution (2026-09-18):** `ViolationsCard.tsx` renders a `Resolve` button (guarded by `<Can
perm="hosEdit" level="FULL">`, lines 90-97) on each `isOpen` violation row individually, calling
`setResolving(violation)` for that specific violation; the old card-level single button is gone.

## WB-061 · Resolved violations are drawn exactly like open ones — ✅ resolved (2026-09-18)
**Found:** `ViolationsCard.tsx:58-84` maps every violation; only `open` feeds the count.
**Severity:** medium — a RESOLVED `DRIVING_11` keeps its red danger band and "Exceeded by 01:12 at
14:30" while the card subtitle says "0 open". An inspector cannot tell the two states apart.
**Fix (proposed):** render `status !== 'OPEN'` rows muted with a `Resolved` badge.

**Resolution (2026-09-18):** `ViolationsCard.tsx:57-76` gives a non-open row
`bg-bg-subtle`/`text-text-muted` styling and a neutral `Badge` reading `Resolved` or `Auto-cleared`
(`violation.status === 'AUTO_CLEARED'`), and the `Resolve` button is now wrapped in `{isOpen &&
(...)}` so it never renders for a resolved/auto-cleared row. `GraphGrid.tsx:208-286` colours a
closed violation's band/mark with `--color-neutral-soft`/`--color-text-muted` instead of the open
danger colours, so they stay visually muted on the grid too.

## WB-062 · A day edited after certification can never be re-certified, and the modal's selection is frozen — ⚠️ partly resolved (2026-09-18)
**Found:** `components/CertifyLogsModal.tsx:116` disables the checkbox for every `day.certified`,
even though `RodsDaySummary` carries `hasEdits`/`certificationCount` and `RodsCertification` has
`recertificationRequired`. Separately, `selected` (`:43-45`) is seeded from the first render only.
**Severity:** medium — §395.8 re-certification after a carrier edit is impossible from this screen;
days that arrive while the modal is open (range query still loading, or a refetch after
`eld.events_ingested`) can never be selected, and a day certified elsewhere meanwhile stays in
`selected` and is re-posted.
**Fix (proposed):** enable the checkbox when `recertificationRequired`/`hasEdits`, and reconcile
`selected` against the latest `days` instead of seeding it once.

**Resolution (2026-09-18):** `CertifyLogsModal.tsx` no longer freezes selection: `isSelectable()`
(line 40) allows a certified day to stay selectable when `day.hasEdits` or
`recertify.has(day.date)`, and `isDefaultSelected()` (line 44) pre-selects a day only when it is
uncertified or its date is in `recertificationDates`. REMAINS open exactly as the in-code comment
says (lines 36-38): `RodsDaySummary` (the range payload) has no `recertificationRequired` field —
only the single viewed day's payload carries it — so days other than the one currently open cannot
be pre-selected; this is a backend gap, not a client defect.

## WB-063 · A partial multi-segment assignment leaves the list stale and invites a double assign — ✅ resolved (2026-09-18)
**Found:** `src/shared/api/hosLogs.ts:318-348` — `useResolveUnidentified` POSTs sequentially in a
loop and invalidates only in `onSuccess`.
**Severity:** medium — select 5 segments, have the 3rd return 409: segments 1–2 are already assigned
server-side, the modal shows the refusal, the list still shows all 5 as pending, and pressing the
button again re-posts 1–2.
**Fix (proposed):** invalidate in `onSettled` and report which segments succeeded.

**Resolution (2026-09-18):** `UnassignedDrivingModal.tsx`'s mutation is called with
`onSuccess`/`onError` (lines 98-114), and the underlying mutation in `shared/api/hosLogs.ts`
invalidates `qkRoot.unidentified` and `qkRoot.logs` in `onSettled` (lines 367-369), so the list
refreshes after both a clean success and a partial failure. On a partial failure,
`UnidentifiedBatchError.succeededIds` drives `${done.length} of ${actions.length} segments were
saved before the server refused the next one: ${refusal}` (line 111), and `setPicked` drops the
already-saved ids from the selection (line 109) so they cannot be double-submitted.

## WB-064 · "Yard move" and "Personal conveyance" send byte-identical requests — ⚠️ partly resolved (2026-09-18)
**Found:** `components/UnassignedDrivingModal.tsx:77-78` — `ANNOTATE_YARD` and `ANNOTATE_PC` both
build `{ kind: 'annotate', annotation }`; the category itself is dropped.
**Severity:** medium — a segment annotated as PC is indistinguishable from YM in the record, and the
two options in the UI promise a distinction the payload does not carry.
**Fix (proposed):** send the category, or record the missing field as a `B-NN` backend gap and merge
the two options into one until it exists.

**Resolution (2026-09-18):** `UnassignedDrivingModal.tsx:216` merges the two former options into
one `Annotate as yard move or personal conveyance` `<option>`, with an inline note (line 237)
telling the admin to state the category in the annotation text. REMAINS open exactly as the in-code
comment says (lines 25-28): `POST /unidentified/:id/annotate` carries only `annotation`, with no
category field on the wire — a backend gap with no assigned B-number yet in `backend-gaps.md`.

## WB-065 · "N driver edits pending review" counts edits that were already applied — ✅ resolved (2026-09-18)
**Found:** `HosLogsPage.tsx:155-162`, `:358` → `components/LogEventsCard.tsx:152` add
`pendingEditCount` (`recordStatus = 3`, genuinely proposed) to `driverEditCount`
(`recordStatus = 1 && recordOrigin = 2`, accepted driver edits).
**Severity:** medium — a day with 1 proposal and 4 accepted driver edits reads "5 driver edits
pending review", sending a compliance officer looking for four reviews that do not exist.
**Fix (proposed):** pass only the proposed count to the card.

**Resolution (2026-09-18):** `LogEventsCard.tsx:152,188` counts and highlights only records where
`row.recordStatus === RECORD_STATUS.proposed` (`recordStatus = 3`) as pending review; an accepted
driver edit, once applied, no longer carries that status and drops out of the count.
`HosLogsPage.test.tsx:1018-1031` asserts this against a fixture mixing proposed and accepted
records.

## WB-066 · A malformed `?date=` crashes the screen — ✅ resolved (2026-09-18)
**Found:** `HosLogsPage.tsx:76`, `:170` take `date` straight from the URL with no validation;
`/hos-logs?driverId=drv_1&date=banana` reaches `fromZonedTime('bananaT12:00:00', tz)` and
`formatInTimeZone` throws `RangeError: Invalid time value` during render.
**Severity:** medium — a mistyped or truncated shared link white-screens the compliance screen
rather than falling back.
**Fix (proposed):** validate against `/^\d{4}-\d{2}-\d{2}$/` (and the ≤ 62-day range rule) and fall
back to `todayKey`.

**Resolution (2026-09-18):** `validDayKey()` (`grid.ts:442`) rejects a non-`YYYY-MM-DD` string,
rejects a string that round-trips to a different ISO date (an impossible calendar date), rejects
any date after `todayKey`, and otherwise falls back to `todayKey` — a malformed `?date=` can no
longer crash the screen. The proposed 62-day transfer-range cutoff was deliberately not folded into
this check, since that rule bounds a range's length, not how far back a single day can be opened.

## WB-067 · The Before/After preview shows the proposed value in the "Before" column — ✅ resolved (2026-09-18)
**Found:** `components/RequestLogEditModal.tsx:308-310` prints `endTime` — the value being typed
into *End time* — inside the Before block.
**Severity:** medium — typing `15:30` makes the original record read `ON 14:26 → 15:30`, identical
to After, so the reviewer approving the edit cannot see what is actually changing.
**Fix (proposed):** derive Before from the original event/graph segment.

**Resolution (2026-09-18):** `RequestLogEditModal.tsx:177-178,331-337` documents and implements the
fix directly: the `Before` column shows the original record's status and start time plus the graph
segment's original end, while the typed `End time` field only ever feeds the `After` column.

## WB-068 · `role="img"` hides the graph's own screen-reader audit table — ✅ resolved (2026-09-18)
**Found:** `components/GraphGrid.tsx:111` puts `role="img"` on the wrapper that contains the
`sr-only` table, which removes the table's children from the accessibility tree.
**Severity:** low — the accessible alternative to the 24-hour grid exists but is never exposed.
**Fix (proposed):** move `role="img"` onto the drawn SVG only, leaving the table a sibling.

**Resolution (2026-09-18):** `GraphGrid.tsx:114` gives `role="img"` only to the `<div>` wrapping
the drawn grid (its children are presentational); the sr-only audit `<table className="sr-only">`
(line 345) is that div's sibling, not its descendant, so it is no longer dropped from the
accessibility tree by the `role="img"` container.

## WB-069 · `isDirty` ignores four of the edit modal's fields — ✅ resolved (2026-09-18)
**Found:** `components/RequestLogEditModal.tsx:164` — status, location, odometer and engine hours
are not part of the dirty check.
**Severity:** low — 11.30 Discard changes is skipped and those edits are silently lost on Esc.
**Fix (proposed):** include every controlled field in the comparison.

**Resolution (2026-09-18):** `RequestLogEditModal.tsx:169-175` computes `isDirty` from the proposed
status, start/end time, and now also `odometer !== odometerDefault` and `engineHours.length > 0`,
so Escape on a changed duty status, odometer or engine-hours field triggers the dirty-close
confirmation instead of discarding silently.

## WB-070 · The typed location is collected and never sent, with no hint to the user — ✅ resolved (2026-09-18)
**Found:** `components/RequestLogEditModal.tsx:269` — `location` has no representation in
`CreateEditRequestDto` (gap B-39) but is rendered as an ordinary enabled field.
**Severity:** low — the user believes they corrected the location.
**Fix (proposed):** disable the field with the gap note, as the `YM`/`PC` chips already do.

**Resolution (2026-09-18):** `RequestLogEditModal.tsx:293-294` renders the location `<input>` as
`readOnly` on `bg-bg-subtle` with the hint "Not sent with the request — a location correction needs
coordinates.", and the code comment (lines 76-78, 146) explains why:
`CreateEditRequestDto.location` needs `lat`/`lon` (gap B-39), which the free-text box cannot
supply, so a half-filled value is never sent.

## WB-071 · The available-hours subtitle hardcodes the 70/8 cycle — ✅ resolved (2026-09-18)
**Found:** `components/AvailableHoursCard.tsx:19` always renders
`Property-carrying · 70 hr / 8 day`, even when `cycleLimitSec` describes the 60/7 cycle
(`CYCLE_60` exists in the type).
**Severity:** low — a 60/7 carrier reads the wrong rule set beside correct numbers.
**Fix (proposed):** derive the label from the cycle on the response.

**Resolution (2026-09-18):** `AvailableHoursCard.tsx:20` sets the subtitle from
`cycleRuleLabel(query.data?.cycleLimitSec)` (`grid.ts:454-459`), which returns `Property-carrying ·
70 hr / 8 day` for a 70×3600 s limit, `· 60 hr / 7 day` for 60×3600 s, and otherwise a computed
`formatHosHours(cycleLimitSec)` fallback — the 70/8 cycle is no longer hardcoded.

## WB-072 · A 25-hour DST day is documented as 89 600 seconds — ✅ resolved (2026-09-18)
**Found:** `src/shared/api/hosLogs.ts:8`, `:72` and `src/features/hos-logs/lib/grid.test.ts:147`
all say `89_600`; 25 hours is `90_000`.
**Severity:** low — the computed value comes from real timestamps, so only the comments and the test
fixture are wrong, but they will mislead the next reader of the DST math.
**Fix (proposed):** correct the constant in both comments and the test.

**Resolution (2026-09-18):** `grid.test.ts:151-152` documents and asserts a fall-back (25-hour)
RODS day as `90_000` seconds and a spring-forward (23-hour) day as `82_800` seconds
(`(rodsDayStart('2026-11-02') - rodsDayStart('2026-11-01')) / 1000 === 90_000`); additional
23-/25-hour length tests exist at lines 128-150 and 369+.

## WB-073 · `hos: NONE` renders an error, not the forbidden state — ✅ resolved (2026-09-18)
**Found:** `HosLogsPage.tsx:183` returns `<ErrorState>` where the rest of the panel returns the
full-page `<ForbiddenState>`.
**Severity:** low — a Viewer without `hos` is told something broke instead of that they lack access.
**Fix (proposed):** return `<ForbiddenState>`, matching the other screens.

**Verified correct in this area (no action):** `rodsDayStart`'s two-probe DST math (checked against
2026-03-08 and 2026-11-01 in `America/New_York`), the 24-column/25-label axis, `fractionOf` against
`dayLengthSec`, the strict `>` on `DRIVING_LIMIT_SEC`, the absence of any client-side violation
computation, invalidation after certify, and the absence of per-day/per-driver request fan-out.

**Resolution (2026-09-18):** `HosLogsPage.tsx:193-195` checks `!can('hos')` and returns
`<ForbiddenState screenName="HOS Logs" />` (from `@/shared/ui/states`) instead of the generic error
state.

---

## W-09 DVIR & maintenance · W-10 Safety

## WB-074 · Six row-action menu items on the DVIR screen do nothing at all — ✅ resolved (2026-09-18)
**Found:** `src/features/dvir/DvirPage.tsx:621-637` (Work orders — `Close`, `Cancel`, `Edit`) and
`:709-724` (Schedules — `Complete`, `Edit`, `Delete`). Verified by reading both `rowActions`
renderers: every `DropdownMenu.Item` is a bare styled element with no `onSelect`/`onClick`. The
mutations that should back them — `useCancelWorkOrder`, `useCompleteSchedule`
(`src/shared/api/dvir.ts:446-454`, `:516+`) — are exported and never imported by `DvirPage.tsx`,
and no update/delete-schedule mutation exists at all.
**Severity:** critical — a Fleet Manager or Admin can never close a work order or complete, edit or
delete a maintenance schedule from this screen; every click is a silent no-op with no error.
**Fix (proposed):** wire each item to its mutation (adding the missing edit/delete ones) with the
confirm + invalidate pattern the rest of the file already uses.

**Resolution (2026-09-18):** all six DVIR row-action menu items are wired: `shared/api/dvir.ts`
gained `useUpdateWorkOrder` (line 461) and `useUpdateSchedule` (line 578) alongside the
pre-existing `useDeleteSchedule` (line 543); `DvirPage.tsx` renders the new `EditWorkOrderModal`
(line 728) and `EditScheduleModal` (line 935), and wires `useDeleteSchedule` at line 1008 for the
schedule row menu's Complete/Edit/Delete, and work-order Close/Cancel/Edit. Correction to the
original write-up: `useDeleteSchedule` already existed before this fix; only
`useUpdateWorkOrder`/`useUpdateSchedule` and the two edit modals are new.

## WB-075 · "Return unit to service" is decoration — the flag is never sent — ⚠️ partly resolved (2026-09-18)
**Found:** `src/features/dvir/components/ResolveDefectModal.tsx:33-54`. The checkbox (checked by
default) only picks the wording of the success toast; `submit()` never puts `returnToService` in
the payload, and `useResolveDefect` (`src/shared/api/dvir.ts:345-357`) has no such field.
**Severity:** high — unchecking the box to *keep* a unit down (because a second CRITICAL defect is
still open) has no effect whatsoever, while the toast can claim the unit was returned to service.
**Fix (proposed):** send the flag, or remove the checkbox and state the actual consequence.

**Resolution (2026-09-18):** `ResolveDefectModal.tsx` has no decorative return-to-service checkbox;
it was replaced with a conditional informational note (line 98: "resolved returns the unit to
service unless another critical defect is still open") and a success toast whose `description`
(lines 47-54) states the consequence conditionally rather than asserting an outcome the client
cannot confirm. REMAINS open as the code comment says: `useResolveDefect`'s DTO (`dvir.ts:345`) has
no `returnToService` field — the backend derives OUT_OF_SERVICE state itself, so there is still no
explicit return-to-service control on the API.

## WB-076 · Mechanic sign-off always records `REPAIRED` — ✅ resolved (2026-09-18)
**Found:** `src/features/dvir/components/DvirDrawer.tsx:165-190` hardcodes
`repairStatus: 'REPAIRED'`, although `RepairStatus` (`src/shared/api/dvir.ts:23`) also has
`NOT_REQUIRED`, `PENDING` and `DEFERRED`, and the sign-off box is shown for every DVIR lacking a
mechanic signature — including `SATISFACTORY` ones with no defects.
**Severity:** medium — the maintenance record claims a repair that never happened, on exactly the
documents an auditor reads.
**Fix (proposed):** derive the status from the DVIR's defect state, or let the mechanic choose.

**Resolution (2026-09-18):** `DvirDrawer.tsx:34-38` adds `deriveRepairStatus(defects)`:
`NOT_REQUIRED` when there are no defects, `PENDING` when any defect is `OPEN`/`IN_PROGRESS`,
`DEFERRED` when every defect is `DEFERRED`, else `REPAIRED`; this feeds a `<select>` default (line
71) the mechanic can still override before submitting, replacing the old hardcoded `REPAIRED`.

## WB-077 · "No repair needed" is submitted as `REPAIRED` — ⚠️ partly resolved (2026-09-18)
**Found:** `components/ResolveDefectModal.tsx:36` —
`resolution === 'DEFERRED' ? 'DEFERRED' : 'REPAIRED'`, while the modal offers three resolutions
(`:100-105`) and the API accepts two (`src/shared/api/dvir.ts:348`).
**Severity:** medium — "inspected and found within specification" is written to the audit trail as a
completed repair, indistinguishable downstream from a real one.
**Fix (proposed):** add a `NOT_REQUIRED` resolution to the DTO as a backend gap, or carry the
distinction in a `resolutionType` field.

**Resolution (2026-09-18):** `ResolveDefectModal.tsx:39` still sends `status: 'REPAIRED'` for the
"No repair needed" option (the API only accepts `REPAIRED | DEFERRED`), but now prefixes the note:
`resolutionNote = resolution === 'NO_REPAIR' ? '[No repair needed] ' + notes.trim() :
notes.trim()`, so the audit trail can tell the two apart. REMAINS open — tracked as new backend gap
B-68 in `backend-gaps.md`, since there is still no distinct status value for "inspected, no repair
needed".

## WB-078 · DVIRs whose defects are outside the loaded window silently fail every severity filter — ✅ resolved (2026-09-18)
**Found:** `src/features/dvir/lib/filters.ts:69-74` — severity is matched against child defects, so
a DVIR with `defectsKnown: false` (B-66) matches nothing.
**Severity:** low — results are understated with no indication that the defects are merely unknown.
**Fix (proposed):** exclude unknown-defect DVIRs from the filtered count explicitly, or surface the
bound in the UI.

**Resolution (2026-09-18):** `dvir/lib/filters.ts:81` adds `countUnknownSeverityExcluded(rows,
filters)`, and `DvirPage.tsx:182` uses it to caption the Recent DVIRs list with "N DVIRs with
unknown defect severity (outside the loaded window) are excluded from this filter" whenever a
severity filter is active, so the silent-drop behaviour is now disclosed instead of hidden.

---

## Authentication, session and RBAC

## WB-079 · Sign-out loses the race with an in-flight refresh and re-persists a valid token — ✅ resolved (2026-09-18)
**Found:** `src/shared/auth/AuthProvider.tsx:171-184` (`resetSession` → `clearTokens()`) versus the
bridge's `onTokens` at `:196-206`, which writes unconditionally. Nothing cancels the single
in-flight `refreshPromise` in `src/shared/api/client.ts:206-254`.
**Severity:** high — with `POST /auth/refresh` in flight (proactive timer or a 401 replay), the user
clicks Sign out: `resetSession` wipes `obk.rt`, the refresh then resolves and `setRefreshToken(new)`
writes a *fresh, unrevoked* refresh token back. The UI shows the sign-in page, but the next reload
boots straight back into the session — and `logoutSession` already revoked only the superseded token,
so the live one was never revoked server-side. On a shared machine this is a real session-leak.
**Fix (proposed):** give `resetSession` a generation counter / `signedOut` flag that `onTokens`
checks before writing, and cancel the client's refresh promise on sign-out.

**Resolution (2026-09-18):** `shared/api/client.ts` exports `cancelRefresh()` (line 239), called
from `AuthProvider.tsx`'s `resetSession` (line 198) on every sign-out/session-end; a session
generation counter is bumped so a refresh already in flight when the session ends is discarded
rather than re-persisting a token for a session that no longer exists. A refresh token that arrives
late is explicitly revoked via `logoutSession(refreshToken, accessToken)` (lines 241, 296).

## WB-080 · A two-second network blip during refresh destroys the session and deletes the refresh token — ✅ resolved (2026-09-18)
**Found:** `AuthProvider.tsx:219-227` — `runRefresh()` ends in `.catch(() => null)`, flattening every
failure into `null`; the boot path (`:250-254`) and the proactive timer (`:275-279`) both treat
`null` as `resetSession('expired')`. `fetchOnce` throws `NetworkError` (`client.ts:198-201`) without
ever calling `bridge.onSignOut`, so this is not the server rejecting anything.
**Severity:** high — a Wi-Fi drop or a server hiccup at minute 14 of a 15-minute token logs a
dispatcher out mid-work, clears `obk.rt`, clears the query cache and shows "Your session has
expired." Work in an open modal is lost for a transient fault.
**Fix (proposed):** distinguish `NetworkError`/5xx from an auth rejection — retry with backoff and
keep the session; only 401/403/`REFRESH_TOKEN_REUSED` may reset.

**Resolution (2026-09-18):** `client.ts:250` exports `isTransientRefreshFailure()`, distinguishing
network errors, 5xx and 408/429 from a hard auth rejection. `AuthProvider.tsx:73` defines
`REFRESH_RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000]`, used both at boot and for the proactive
pre-expiry refresh (line 284) to retry a transient failure instead of ending the session; any other
4xx still ends it immediately.

## WB-081 · Every deep link opened while signed out is discarded after sign-in — ✅ resolved (2026-09-18)
**Found:** `src/app/guards.tsx:14` navigates with `state={{ from: location.pathname + location.search }}`,
but nothing in `src/` ever reads `location.state`; `src/features/auth/SignInPage.tsx:114`
unconditionally renders `<Navigate to="/" replace />`.
**Severity:** medium — an emailed `/hos-logs?driverId=…&date=…` or `/vehicles/:id` link dumps the
user on the dashboard after Google sign-in, with the context they were sent silently dropped.
**Fix (proposed):** read `useLocation().state?.from` in `SignInPage` and navigate there, accepting
only a same-origin path that starts with a single `/` (reject `//host` and absolute URLs — this is
an open-redirect surface).

**Resolution (2026-09-18):** new `shared/auth/returnTo.ts` stores the deep-linked path in
`sessionStorage['obk.returnTo']` (line 7) across a Google `signInWithRedirect` round trip, and its
path validator accepts only a same-origin, in-app path (lines 2-3) — an absolute or cross-origin
value is rejected. `guards.tsx` preserves path + hash when it records the return target.

## WB-082 · The MY ACCOUNT sub-nav is a no-op when the hash does not change — ✅ resolved (2026-09-18)
**Found:** the uncommitted `<a>` → `NavLink` change in `src/app/layouts/AccountLayout.tsx:17-22`
combined with `src/features/account/AccountPage.tsx:46-57`, where scrolling now happens only in an
effect keyed on `[location.hash, profile.isPending]`, and the native anchors were renamed to
`account-section-*` so the browser will not scroll either.
**Severity:** medium — click "Active sessions" (it scrolls), scroll back up by hand, click it again:
React Router pushes an entry with the same hash, the effect deps do not change, nothing happens. The
old plain anchor handled this natively.
**Fix (proposed):** key the effect on `location.key` as well as `location.hash`, or scroll from the
`NavLink`'s `onClick`.

**Resolution (2026-09-18):** `AccountPage.tsx:41-43` adds `location.key` to the scroll-to-hash
effect's dependency array alongside `location.hash`, so navigating to the same hash a second time
(e.g. re-clicking a sub-nav item already active) still re-triggers the scroll, since React Router
bumps `location.key` on every navigation even when the path/hash is unchanged.

## WB-083 · The server's token lifetime is parsed, passed along, and then thrown away — ✅ resolved (2026-09-18)
**Found:** independently by both the auth and the API-layer pass. `client.ts:240-247` computes
`expiresAt` from the refresh response's `expiresIn` and hands it to `bridge.onTokens`;
`AuthProvider.tsx:199-203` destructures only `{ accessToken, refreshToken }` and calls
`setAccessToken(accessToken)`, which falls back to `tokenStore.ts:30-33`'s hard-coded
`ACCESS_TOKEN_TTL_MS = 15 * 60_000`. The §17 "refresh 60 s before expiry" timer (`:274`) then
schedules off that assumption.
**Severity:** medium-high — if the backend issues a 5-minute access token, the timer fires about
11 minutes late: every request in the gap pays a 401 + refresh + replay round trip, the first one
after a long idle can bounce the user through `onSignOut`, and `writeSessionSnapshot`'s
`accessTokenExpiresAt` is fiction. The correct value is already on the wire and already parsed.
**Fix (proposed):** `onTokens: ({ accessToken, refreshToken, expiresAt }) =>
setAccessToken(accessToken, expiresAt ? expiresAt - Date.now() : undefined)`.

**Resolution (2026-09-18):** `AuthProvider.tsx:230-233`'s `onTokens` callback now receives the
server's `expiresAt` and calls `setAccessToken(accessToken, expiresAt ? expiresAt - Date.now() :
undefined)`; the sign-in path instead uses `ttlFromExpiresIn(pair.expiresIn)`
(`tokenStore.ts:42-46,139`), and `setAccessToken()` (`tokenStore.ts:35-39`) falls back to the
documented `ACCESS_TOKEN_TTL_MS = 15 * 60_000` when no usable lifetime is supplied, instead of
arming a timer that fires immediately or never.

## WB-084 · Escape on the idle warning counts as "I am here" and grants another full window — ✅ resolved (2026-09-18)
**Found:** `src/shared/auth/IdleWarningModal.tsx:29` passes `onClose={onStay}`, and
`AuthProvider.tsx:300-313` re-arms the idle effect whenever `idleWarning` goes false.
**Severity:** low — a stray Escape, a backdrop click, or any Radix dismiss on an unattended machine
extends the session by the full idle period, which is the opposite of what §17 asks of the modal.
**Fix (proposed):** point `onClose` at `onSignOut`, or make the modal non-dismissible.

**Resolution (2026-09-18):** `IdleWarningModal.tsx:30-32` treats Escape, a backdrop click and the
close `X` all the same way — none of them count as "I am here"; only the `Stay signed in` button
(line 43) extends the session. `AuthProvider.test.tsx:882-963` (`30-minute idle timeout (§17)`)
exercises this.

## WB-085 · Firebase keeps the Google session after the panel session ends — ✅ resolved (2026-09-18)
**Found:** `src/shared/auth/firebase.ts:62-88` — there is no `authModule.signOut(auth)` anywhere in
`src/`, so the Firebase user object and its IndexedDB persistence survive `signOut()`.
**Severity:** low — on a shared machine a Google credential for the panel's Firebase app outlives
what the user believes was a sign-out. `prompt: 'select_account'` limits but does not remove this.
**Fix (proposed):** `await authModule.signOut(auth)` from `resetSession`.

**Verified correct in this area (no action):** `toPermissionMap` degrades unknown keys and levels to
`NONE`; `toAuthUser` falls back to `VIEWER`, never to a permissive role; `router.tsx:217-231`
enforces `can(perm)` per route and substitutes `<ForbiddenPage/>`, so hidden nav is genuinely backed
by route enforcement; the session-revoke hooks invalidate `qk.sessions` correctly; the dev password
block sits behind an inlined `VITE_AUTH_MODE === 'dev'` literal in both call sites.

**Resolution (2026-09-18):** `firebase.ts:103` exports `signOutOfGoogle()`, called from
`AuthProvider.tsx`'s `resetSession` (line 209), so ending the panel session also ends the
Firebase/Google session instead of leaving it live.

---

## `shared/api` and `shared/format`

## WB-086 · `client.blob()` bypasses the 401 → refresh → replay rule — ✅ resolved (2026-09-18)
**Found:** `src/shared/api/client.ts:400-405` calls `fetchOnce` directly instead of `send()`, so
neither rule 2 (single-flight refresh and replay) nor rule 7 (GET retry) applies. The
`ensureAccessToken` guard on `:401` only fires when there is *no* access token — an expired token is
still a token, so it returns false and `:403` throws on the resulting `401 TOKEN_EXPIRED`.
**Severity:** high — leave W-15 open past the access-token TTL and click `Download`:
`downloadTransferFile()` (`reports.ts:315-317`) throws `ApiError(401)`, the user sees "Your session
has expired." and gets no file, while `obk.rt` is perfectly valid and the next table refetch
succeeds silently through `send()`. Every future `client.blob` caller inherits this.
**Fix (proposed):** give `blob` the same 401 branch as `send` (refresh once, re-issue with
`retriedAfterRefresh`), or route it through `send` with a response-type flag.

**Resolution (2026-09-18):** `client.ts:474-478`'s `blob()` now calls the shared `send<Response>({
...options, method: 'GET', path, raw: true })` instead of a bespoke `fetch`, so it goes through the
same 401 → refresh → replay handling, retry-on-network-error/5xx and `AbortSignal` support as every
other request.

## WB-087 · One query key with two conflicting cache policies — `qk.drivers({ limit: 500 })` — ✅ resolved (2026-09-18)
**Found:** `src/shared/api/lookups.ts:26-30` registers `['drivers', {limit:500}]` with
`pagePolicy('reference')` (10 min stale, no refetch on focus), while `src/shared/api/safety.ts:85`,
`:125` and `src/features/messages/MessagesPage.tsx:66` (via `messaging.ts:81-85`) register the
identical key through `useDriversList({ limit: 500 })` with `typedCachePolicy('list')` (60 s stale,
refetch on focus). TanStack keeps one cache entry but applies each observer's own options, so the
most aggressive policy wins for everyone.
**Severity:** medium — with Safety or Messages mounted, alt-tabbing away and back refetches the
session-wide driver lookup that WD-073 exists to fetch once, and above 200 drivers each refetch is
three parallel `GET /drivers?limit=200` calls. Vehicles, Trips and DVIR silently pay for it too.
**Fix (proposed):** have those call sites consume `useDriversLookup()`/`useDriverMap()` instead of
re-declaring the key with the list policy.

**Resolution (2026-09-18):** one shared cache policy replaces the two conflicting `qk.drivers({
limit: 500 })` sites: `safety.ts` (`useSafetyEventsList`, `useScorecard`) and `messaging.ts`
(`useConversationsList`) now call the new `useDriversLookup()` (`shared/api/lookups.ts:44`,
`reference` cache policy), and `features/messages/MessagesPage.tsx` no longer runs its own separate
`useDriversList({ limit: 500 })`. New test: `src/shared/api/lookups.test.tsx`.

## WB-088 · `formatEngineHoursLong` can render `60 m` — ✅ resolved (2026-09-18)
**Found:** `src/shared/format/numbers.ts:42-47` — `Math.round((value - whole) * 60)` returns 60 for
any fraction ≥ 0.99167 and there is no carry into the hour. Verified by execution:
`1070.995` → `1,070 h 60 m`.
**Severity:** medium — the W-04 engine-hours tile shows an impossible clock for roughly 0.8 % of
values, on a number that feeds maintenance scheduling.
**Fix (proposed):** carry (`if (minutes === 60) { minutes = 0; whole += 1; }`) plus a test.

**Resolution (2026-09-18):** `formatEngineHoursLong()` (`shared/format/numbers.ts:42-52`) rounds
minutes, and when that rounds to `60` (e.g. `1070.995`) it carries into the hour (`minutes = 0;
whole += 1`) instead of rendering the impossible `1,070 h 60 m` — `1070.995` now renders `1,071 h
00 m`.

## WB-089 · Rule 9 (abort on unmount) is wired into three hooks and missing from every other one — ⚠️ partly resolved (2026-09-18)
**Found:** only `reports.ts` and `hosLogs.useLogRange` (`:171`) forward TanStack's `signal` into
`client.get`/`client.list`. Every other `queryFn` — `drivers.ts:32,40,92,129,164`,
`vehicles.ts:118,125,229,272,291,339`, `trips.ts:117,287,295`, `dvir.ts:163,232,274,469`,
`safety.ts:82,122`, `hosLogs.ts:160,184,300`, `notifications.ts:62`, `liveFleet.ts:43`,
`dashboardSummary.ts:46` and all of `settingsAdmin.ts` — is `() => client.get(...)`, so
`fetchOnce` passes `signal: undefined` to `fetch` and unmounting cancels nothing.
**Severity:** medium — clicking quickly through Vehicles → Drivers → Trips leaves each screen's
lookup fan-out (up to three parallel 200-row requests) running to completion for a screen that no
longer exists, on top of the `live`-policy roster and dashboard queries. `search.ts:117-118`
documents the reason (jsdom `AbortSignal` vs MSW's undici `Request`) — a test-environment problem
being paid for in production behaviour.
**Fix (proposed):** thread `({ signal })` through the query functions and solve the jsdom/MSW
incompatibility in the test setup instead.

**Resolution (2026-09-18):** the query `signal` is now threaded into every `client.*` call inside
the 13 `src/shared/api/` hook modules (`paging.ts`'s `PageQueryOptions.queryFn` takes `{ signal }`,
and each hook forwards it), guarded by `src/shared/api/abortOnUnmount.test.tsx` (`it.each` over 19
hooks). REMAINS open outside `shared/api/`: `features/account/api.ts` intentionally does not
forward `signal` (documented at line 49 — jsdom's `AbortSignal` breaks Node `fetch`, WD-046), but
`AuditLogPage.tsx`, `DashboardPage.tsx`, `DriverProfilePage.tsx` and `app/routePrefetch.ts` also
call `client.get`/`client.list` without a `signal` and are not covered by the guard test — real
residue, not a documented exception, so rule 9 is not yet universal.

## WB-090 · `useGlobalSearch` leaves `scope` out of the query key — ✅ resolved (2026-09-18)
**Found:** `src/shared/api/search.ts:116` keys on `qk.search(q)` = `['search', q]`, while
`fetchGlobalSearch(q, scope)` filters drivers and vehicles by `scope` (`:92-93`, `:102-103`).
**Severity:** low (latent) — two scopes share one cache entry and, because the key never changes,
widening the scope triggers no refetch at all: the narrowed result is served indefinitely. `scope`
is currently derived from permissions and stable per session (`CommandPalette.tsx:55`), so this bites
the first person who makes it a user-facing toggle.
**Fix (proposed):** `search: (q, scope) => ['search', q, p(scope)]`.

**Resolution (2026-09-18):** `queryKeys.ts:104`'s `search: (q, scope) => ['search', q, p(scope)]`
now includes `scope` in the key, so two searches with different scopes no longer collide in the
cache.

## WB-091 · `formatJurisdiction` is missing Alaska — ✅ resolved (2026-09-18)
**Found:** `src/shared/format/jurisdiction.ts:8-18` — the `US` map runs `AL, AZ, AR, CA, …`; `AK` is
absent. Verified: DC and HI are correctly excluded (not IFTA members), but Alaska is one.
**Severity:** low — an Alaska row on W-12 falls through to the pass-through branch (`:32`) and
renders `AK` where every other row renders a full state name, which is exactly the inconsistency
WB-046 was raised to remove.
**Fix (proposed):** add `AK: 'Alaska'`.

**Resolution (2026-09-18):** `shared/format/jurisdiction.ts:8` adds `AK: 'Alaska'` to the
state-code map; `jurisdiction.test.ts:7` asserts `formatJurisdiction('AK') === 'Alaska'`.

## WB-092 · `timezoneAbbreviation` invents labels for zones that never observe DST — ✅ resolved (2026-09-18)
**Found:** `src/shared/format/datetime.ts:79-87` collapses any three-letter abbreviation whose middle
character is `S` or `D`. Verified by execution against `Intl`: `America/Phoenix` is `MST`
year-round but renders `MT`; `Pacific/Honolulu` is `HST` always but renders `HT`, which is not a
real label; `America/Anchorage` is four letters so it passes through as `AKDT`.
**Severity:** low — the dashboard subtitle reads `· ET`, `· MT` and `· AKDT` across carriers, and
two of the three are wrong for the timezone rule §5 cares about.
**Fix (proposed):** strip the middle letter only when the zone's summer and winter abbreviations
actually differ.

**Resolution (2026-09-18):** `timezoneAbbreviation()` (`shared/format/datetime.ts:78-93`) reads the
`en-US` short zone name from `Intl.DateTimeFormat` at the actual instant passed in, and only drops
the DST letter when the January and July names form a real …ST/…DT pair, keeping a non-DST zone's
real label instead (`America/Phoenix` → `MST`, `Pacific/Honolulu` → `HST`). Asserted at
`datetime.test.ts:67-70`.

## WB-093 · `upsertMessage` overwrites the thread's server-side `total` — ✅ resolved (2026-09-18)
**Found:** `src/shared/api/messaging.ts:139-145` sets `total: withoutDuplicate.length + 1`, replacing
the server's count with the number of messages currently cached (≤ 100).
**Severity:** low — a 350-message thread drops to `total: 101` the moment the dispatcher sends one,
and again on every `message.new` echo. `useMessages` hard-codes `limit: 100` so nothing paginates on
it today, but any future counter or "load older" affordance reads a fabricated number.
**Fix (proposed):** `total: prev.total + (isNew ? 1 : 0)`.

**Verified correct in this area (no action):** `client.list()`'s above-200 paging arithmetic
(`offset`/`skip`/`firstApiPage`/`lastApiPage` worked through by hand for 500@p1, 500@p2, 250@p1,
250@p2, a short last page and a page past the end); `buildUrl`'s limit clamp and empty-value
dropping; `formatHosHours`/`formatDuration` padding and the >24 h cycle case; `rodsDayFraction`/
`rodsDayOffsetSec` DST handling; `hasPosition`'s null-island guard; the `untilTerminal` poll gates;
`formatNumber(value, 0)`. Two suspected invalidation bugs (`qk.violations()`, `qk.schedules()`) were
investigated and dismissed — TanStack's `partialMatchKey` deep-partial-matches `{}`, so those calls
do reach the parameterised list keys.

**Resolution (2026-09-18):** `messaging.ts:144-153`'s `upsertMessage()` sets `total: prev.total +
(isNew ? 1 : 0)`, where `isNew` is true only when de-duplicating by `id`/`clientId` did not remove
an existing entry — replacing an optimistic placeholder or de-duplicating a server echo no longer
inflates the thread's server-side `total`. New test in `src/shared/api/messaging.test.tsx`.

---

## W-12 … W-15 Reports and the FMCSA transfer

## WB-094 · The inspector-email rule accepts any domain that merely ends with `fmcsa.dot.gov` — ✅ resolved (2026-09-18)
**Found:** `src/shared/forms/fields.ts:20-22` —
`/\.?fmcsa\.dot\.gov$/i` has no left anchor and the dot is optional. Verified by execution:
`evilfmcsa.dot.gov` and `notfmcsa.dot.gov` both pass.
**Severity:** high — typing `officer@notfmcsa.dot.gov` in 11.14 (`SendLogsModal.tsx:314`) or on the
pack card (`FmcsaPackPage.tsx:141-144`) passes client validation and POSTs a complete RODS file — a
driver's full duty history — to `/transfers` for a privately registered domain. Only the server's
`INVALID_TRANSFER_RECIPIENT` stands between that and an exfiltrated compliance record.
**Fix (proposed):** `/^(?:[^@]+\.)?fmcsa\.dot\.gov$/i`.

**Resolution (2026-09-18):** `shared/forms/fields.ts:24` defines `INSPECTOR_DOMAIN_RE =
/^(?:[a-z0-9-]+\.)*fmcsa\.dot\.gov$/i`, and `inspectorEmail()` (lines 26-30) tests the address's
domain against it, so `evilfmcsa.dot.gov` (which merely ends with the string) is correctly rejected
while a real subdomain like `eastern.fmcsa.dot.gov` still passes. `schemas.test.ts:27-33` asserts
both.

## WB-095 · "Uncertified logs" is computed two different ways and the single-driver one contradicts the backend — ✅ resolved (2026-09-18)
**Found:** `src/shared/api/reports.ts:439-456` — the single-driver branch counts persisted logs that
are uncertified (`days.filter(d => !d.certified).length`); the all-drivers branch counts
`rangeDays − certifiedDays`, which the comment on `:446` identifies as the backend's own
`uncertifiedDayCount`.
**Severity:** high — for Sep 1–30 with a driver who has 4 DailyLogs, all certified, W-15 shows
`Uncertified logs 0` with that driver selected and `26` for the same driver under "All drivers", and
`POST /transfers` then refuses with `UNCERTIFIED_LOGS` after the page said the pack was clean.
**Fix (proposed):** use `Math.max(0, rangeDays - certifiedDays)` in both branches.

**Resolution (2026-09-18):** `shared/api/reports.ts:446-447` computes the single-driver branch as
`uncertified = single.data ? Math.max(0, rangeDays - certifiedDays) : 0`, matching the fleet branch
and the backend's `uncertifiedDayCount` definition (comment lines 442-445): a day with no persisted
log now counts as uncertified too, instead of the old persisted-but-uncertified-only count that
could read `0` while `POST /transfers` still refused the send.

## WB-096 · The DVIR report filters a date range client-side over the newest 200 inspections — ⚠️ partly resolved (2026-09-18)
**Found:** `src/shared/api/reports.ts:489-495` calls `GET /dvir` with `limit: 200`,
`sort: submittedAt:desc` and no `from`/`to` (gap B-47); `DvirReportPage.tsx:89-96` then filters
those 200 by day.
**Severity:** medium — a fleet that has submitted more than 200 DVIRs since `to` (a week for a
100-truck fleet) sees an empty table and `0` inspections, `0` with defects, `—` average fix time for
any earlier range, while `Export CSV` (`:252`, server-side `from`/`to`) downloads the real rows. The
same window feeds `DVIRs included` on the audit pack (`FmcsaPackPage.tsx:104-113`).
**Fix (proposed):** page until `submittedAt < from`, or state the "newest 200 inspections" bound
instead of rendering a silent zero.

**Resolution (2026-09-18):** `useDvirReportRows` (used by `DvirReportPage.tsx:82` and
`FmcsaPackPage.tsx:95`) pages newest-first until it passes the requested `from` date, capped at
`DVIR_REPORT_MAX_PAGES` (`reportMeta.ts:9`, `= 10`, ~2,000 rows); when the cap is hit the UI shows
an `N+` count and `DVIR_WINDOW_NOTE` (`reportMeta.ts:185`): "Only the newest N inspections could be
read — earlier inspections in this range are not counted." REMAINS open — tracked as B-47: `GET
/dvir` still has no `from`/`to` param, so a sufficiently long range is still an honestly-labelled
approximation, not a complete answer.

## WB-097 · Exports ignore filters that are applied on screen — ⚠️ partly resolved (2026-09-18)
**Found:** `ActivityReportPage.tsx:230` sends only `{ from, to }`, dropping the `terminal` filter and
the `status: 'ACTIVE'` restriction the table uses (`:88`); `DvirReportPage.tsx:252`, `:264` send
`{ from, to, vehicleId }` and drop the defect-category filter.
**Severity:** medium — filter Activity to the Chicago terminal (3 drivers on screen), click
`Export CSV`, receive all 240 drivers of every status. The file does not match what was exported from.
**Fix (proposed):** forward the applied filters, or disable/annotate the export while an unsupported
filter is set.

**Resolution (2026-09-18):** the export buttons on `ActivityReportPage.tsx:227` and
`DvirReportPage.tsx:258` carry `aria-describedby` pointing at a note stating that the
terminal/defect-type filter "applies to this screen only" whenever such a filter is active, so the
export is now honestly labelled instead of silently ignoring an on-screen filter. REMAINS open: the
export endpoints themselves still take no `terminal`/`status`/`defectCategory` params — a backend
gap, not a client defect.

## WB-098 · The Activity terminal filter narrows one page while the pager keeps server totals — ✅ resolved (2026-09-18)
**Found:** `ActivityReportPage.tsx:105-119`, `:283`, `:300-312` — `rows` drops drivers outside the
chosen terminal, but `total`/`totalPages` come from the unfiltered response, and `terminalOf` only
knows the first 200 drivers (`useReportDrivers`, `limit: 200`), with `t === undefined` treated as a
match.
**Severity:** medium — "240 drivers · showing 2", pages that render entirely empty, and driver #201
onward leaking through the filter.
**Fix (proposed):** filter server-side, or derive the totals from the filtered set and bound the
lookup honestly.

**Resolution (2026-09-18):** `ActivityReportPage.tsx:80-92` passes `terminal` straight through to
`useActivitySummary({ ..., terminal })`, which hits `GET /reports/activity/summary?terminal=`
(B-46/D-078) — rows, `total` and pagination now all come from the server for the selected terminal;
the client-side re-filter of one loaded page was removed.

## WB-099 · `RODS` and `IDLE_FUEL` rows render blank, and the ready toast says "undefined" — ✅ resolved (2026-09-18)
**Found:** `src/features/reports/reportMeta.ts:22-29` keys `REPORT_LABEL` on `ReportType`, which
omits two types the backend can still store (gap B-14);
`components/RecentlyGeneratedCard.tsx:83`, `:115` and `useReportJobs.ts:45`, `:47` read it directly.
**Severity:** medium — a `RODS` row shows an empty `Report` cell and `aria-label="Download undefined"`,
and `report.ready` produces the toast `undefined · 2.4 MB`.
**Fix (proposed):** `REPORT_LABEL[type] ?? type`.

**Resolution (2026-09-18):** `reportMeta.ts:42`'s `reportLabel(type)` falls back to explicit
library names for `RODS` ("Driver logs (RODS)") and `IDLE_FUEL` ("Idle & fuel report") instead of
leaving them blank; `RecentlyGeneratedCard`/`useReportJobs.ts:45,47` and the ready toast all call
it, so neither renders blank text nor the literal string "undefined".

## WB-100 · The download object URL is revoked on the same tick as the click — ✅ resolved (2026-09-18)
**Found:** `src/features/reports/reportMeta.ts:182-192` — `saveFile` calls `URL.revokeObjectURL(href)`
immediately after `link.click()`. The blob callers are `Download a copy` in 11.14
(`SendLogsModal.tsx:221`) and the transfer drawer (`PreviousTransfersCard.tsx:204`).
**Severity:** low — in Firefox and Safari the download can abort with no error, leaving a safety
official without the file during a TEST-mode transfer.
**Fix (proposed):** revoke inside `setTimeout(…, 0)`.

**Resolution (2026-09-18):** `reportMeta.ts:224`'s `saveFile()` calls `setTimeout(() =>
URL.revokeObjectURL(href), 0)` instead of revoking on the same tick as the click, giving the
browser a chance to start the download before the object URL is torn down.

## WB-101 · The 11.14 preview counts calendar days as daily logs — ✅ resolved (2026-09-18)
**Found:** `components/SendLogsModal.tsx:192` builds `records` from `span`, the inclusive day count,
although `range.data.days` is already loaded on `:128`.
**Severity:** low — an 8-day range always reads "8 daily logs · … events" even when only 3 RODS days
exist, overstating the compliance preview shown to a safety official.
**Fix (proposed):** `range.data?.days.length ?? EMPTY.dash`.

**Resolution (2026-09-18):** `SendLogsModal.tsx:193` now reads `range.data?.days.length` for the
daily-log count in the 11.14 preview, counting actual returned log days rather than the number of
calendar days spanned by the selected range.

## WB-102 · A half-specified report deep link is silently replaced by month-to-date — ✅ resolved (2026-09-18)
**Found:** `src/features/reports/useReportRange.ts:13-15` requires both `from` and `to` to be present.
**Severity:** low — `/reports/activity?from=2026-01-01` shows a different period from the one the
sender was looking at, with no indication.
**Fix (proposed):** fill the missing half (`to = today`, `from = monthStart(to)`).

**Verified correct in this area (no action):** report and transfer polling stop at terminal statuses;
list invalidation after generate/queue; IFTA quarter arithmetic; money and distance formatting never
convert or re-round; page-overflow clamping in all three lists.

**Resolution (2026-09-18):** `useReportRange.ts:13`'s `resolveRange(rawFrom, rawTo, today)` runs
`from` alone through to `today`, starts `to` alone at the 1st of its month, and falls back to
month-to-date for an inverted pair (`from > to`) or an unparseable pair —
`useReportRange.test.ts:9-23` asserts all four cases including the inverted-range fallback.

---

## W-03 … W-07 Vehicles and drivers

## WB-103 · Driver segments and half the filter drawer narrow only the loaded page, then claim to be complete — ⚠️ partly resolved (2026-09-18)
**Found:** `src/features/drivers/DriversPage.tsx:83-90` with `lib/filters.ts:77-83`. The roster is now
server-paginated (`limit` 10), but the ON_DUTY/OFF_DUTY/VIOLATIONS segment tabs and the 11.23
`status`/`exemptions` fields run through `matchesDriverFilters` over `entries` — the current page
only. `serverFilters` (`:67-75`) forwards just `terminal`, `violationsOnly` and `eldExempt`. The
code then collapses `pageTotalPages`/`shownPage` to 1 (`:103-107`).
**Severity:** high — selecting "Personal conveyance" or a duty status, or clicking a segment tab
while on any page, filters roughly ten rows and presents the result as the complete filtered list.
Matching drivers on other pages are invisible with no hint that more exist. This is WB-047 returning
through the pagination change.
**Fix (proposed):** forward `status` and the exemption flags to the server (extend B-55), or fetch a
full roster window (as `VehiclesPage`'s `useWindow` does) whenever a client-only filter is active.

**Resolution (2026-09-18):** `DriversPage.tsx:78,84` sends the real `hasOpenViolation` server param
on the roster query for the VIOLATIONS segment and the violations-only filter, instead of narrowing
in memory. Duty-status segments and the other unsupported filters still fall back to a
reference-cached window, `useDriverRosterWindow` (`shared/api/drivers.ts:117`, capped at ~1,000
rows), and `backend-gaps.md`'s B-55 entry was extended to describe this. REMAINS open: there is
still no server-side duty-status param, so those specific filters remain a bounded-window
approximation.

## WB-104 · `Assign driver` is disabled with no reason, defeating the modal built to give one — ✅ resolved (2026-09-18)
**Found:** `src/features/vehicles/UnitProfilePage.tsx:146` sets
`disabled={vehicle.status === 'OUT_OF_SERVICE'}` with no `title`, while
`components/AssignDriverModal.tsx:1-2`, `:69-73` exists specifically to say "Unit X is out of
service. Close the critical defect before assigning a driver." — its own header comment reads "show
the reason, never a silent 409". `VehiclesPage.tsx:391` gets this right: the row action is not gated
and the modal explains the refusal.
**Severity:** high — the screen most likely to be used for this silently refuses and never states the
CRITICAL-defect rule, contradicting both §4 and the component's own contract.
**Fix (proposed):** let the button open the modal, exactly as the row action does.

**Resolution (2026-09-18):** `UnitProfilePage.tsx:146-150` no longer disables `Assign driver` for
an `OUT_OF_SERVICE` unit; the modal it opens states the refusal itself, giving a reason instead of
a silently disabled control.

## WB-105 · The active-DTC badge on the unit header is a dead literal — ✅ resolved (2026-09-18)
**Found:** `UnitProfilePage.tsx:98` — `const activeDtcCount = 0;` with a comment claiming it is
"resolved on the Diagnostics tab query below when open", but it is never wired to `dtcQuery`.
**Severity:** medium — the `{activeDtcCount} active DTCs` badge (`:130`) never renders, even when the
Diagnostics tab has loaded uncleared DTCs; a fault-code warning the header is supposed to carry is
permanently absent.
**Fix (proposed):** derive it from `dtcQuery.data?.items.filter(d => !d.clearedAt).length`.

**Resolution (2026-09-18):** `UnitProfilePage.tsx:98` computes `activeDtcCount =
dtcQuery.data?.items.filter((d) => !d.clearedAt).length ?? 0` from the live diagnostics query, and
line 130 renders it in the header badge — replacing the old dead literal.

## WB-106 · Both CSV importers break on quoted fields and on a BOM — ✅ resolved (2026-09-18)
**Found:** `src/features/drivers/components/ImportDriversModal.tsx:25-31` and
`src/features/vehicles/components/ImportVehiclesModal.tsx:25-31` both do a naive `line.split(',')`,
and `text.trim()` does not strip a leading UTF-8 BOM.
**Severity:** medium — an address like `"123 Main St, Suite 4"` shifts every later column for that
row, and an Excel-exported file makes the first header key `"﻿name"`, so that column silently
fails to map for every row. The failure is silent in both cases: bad data is imported, not rejected.
**Fix (proposed):** use a quote-aware tokenizer and strip the BOM before splitting.

**Resolution (2026-09-18):** new `shared/lib/csv.ts` (`parseCsvRows`/`parseCsv`) is an RFC 4180
parser handling quoted fields, escaped `""` quotes, CRLF/LF/CR line endings and a leading UTF-8
BOM; both `features/drivers/components/ImportDriversModal.tsx` and
`features/vehicles/components/ImportVehiclesModal.tsx` import it, replacing their previous ad hoc
`split(',')` parsing.

## WB-107 · The "Missing or duplicate email" warning never checks for duplicates — ✅ resolved (2026-09-18)
**Found:** `ImportDriversModal.tsx:42-45` tests only `!row.email`.
**Severity:** low — two rows with the same non-empty address produce no warning, although Q-3 and
B-30 make email the identity field and the web is the only place uniqueness is checked today.
**Fix (proposed):** track seen addresses while parsing and flag repeats.

**Resolution (2026-09-18):** `ImportDriversModal.tsx:45,49,52` lower-cases and trims every row's
email in a first pass to build a seen-set, then flags a second-pass match as "Row N — Missing or
duplicate email — driver cannot sign in", so a case-different duplicate (`A@x.com` vs `a@x.com`) is
now caught.

## WB-108 · The advertised import row caps are not enforced — ✅ resolved (2026-09-18)
**Found:** `ImportDriversModal.tsx:103` promises "500 rows maximum" and
`ImportVehiclesModal.tsx:96` "2,000 rows maximum"; neither `handleFile` checks `parsed.length`.
**Severity:** low — a larger file is accepted and submitted whole, and the rejection (if any) comes
from the server after the upload.
**Fix (proposed):** validate against the stated limit before enabling Import.

**Resolution (2026-09-18):** both importers define and enforce a row cap —
`ImportDriversModal.tsx:14` `MAX_ROWS = 500`, `ImportVehiclesModal.tsx:15` `MAX_ROWS = 2000` —
rejecting an oversized file with an inline error ("File has N rows — 500 rows maximum.") and
clearing the selected file, instead of silently truncating or attempting the import.

---

## W-17 … W-25 Settings

## WB-109 · Device pairing sends whatever the admin types as the vehicle id — ✅ resolved (2026-09-18)
**Found:** `src/features/settings/components/RegisterDeviceModal.tsx:44-54`, `:119` — "Assign to
unit" is a plain text `<input>` registered on `vehicleId`, placeholder `Unit 126`, and the value goes
verbatim into `pairDevice.mutate({ id, vehicleId })` → `POST /devices/:id/pair`. `DevicesPage.tsx`
one file over does this correctly through `useVehiclesPicker`.
**Severity:** high — typing exactly what the placeholder invites sends a non-UUID; the pairing either
fails opaquely or targets the wrong resource, and an ELD device silently ends up on no unit.
**Fix (proposed):** replace the input with a picker sourced from `useVehiclesPicker()`.

**Resolution (2026-09-18):** `settings/components/RegisterDeviceModal.tsx:121` replaces the
free-text vehicle id with a `<select {...register('vehicleId')}>` populated from
`useVehiclesPicker()` (lines 12, 28), so pairing can no longer send whatever string the admin
typed.

## WB-110 · Two destructive actions fire with no confirmation — ✅ resolved (2026-09-18)
**Found:** `src/features/settings/DevicesPage.tsx:249-254` (`Retire device` →
`removeDevice.mutate(row.id)`) and `src/features/settings/AlertRulesPage.tsx:197-202` (`Delete` →
`deleteRule.mutate(rule.id)`) are wired straight to `DropdownMenu.Item onSelect`.
`RolesPage.tsx:319-338` shows the house pattern (open `ConfirmDelete`, then mutate).
**Severity:** high — one stray click in a row menu permanently retires an ELD device or deletes an
alert rule, with no warning and nothing stating what survives (house rule 11.3).
**Fix (proposed):** route both through `ConfirmDelete`, as Roles does.

**Resolution (2026-09-18):** `ConfirmDelete` is now used across the settings screens
(`AlertRulesPage.tsx`, `DevicesPage.tsx`, `CompanyProfilePage.tsx`, `RolesPage.tsx`), covering both
"Retire device" and alert-rule "Delete" with a confirmation step instead of firing immediately.

## WB-111 · Audit-log CSV export ignores every active filter — ✅ resolved (2026-09-18)
**Found:** `src/features/settings/AuditLogPage.tsx:149-161` — `handleExportCsv` always requests
`{ limit: 200 }` with no `actorId`, `objectType`, date range, `action` or `search`, while the table
on screen is filtered by all of them.
**Severity:** medium — an admin who filters to "Role changes, last 7 days" and exports for a
compliance request receives the newest 200 unrelated entries instead, with nothing saying so.
**Fix (proposed):** forward the same parameters the table query uses.

**Resolution (2026-09-18):** `AuditLogPage.tsx:156-172`'s `handleExportCsv()` forwards the same
real server params the on-screen table uses (`actorId`, `objectType`) and then runs the fetched
batch through the same `applyLocalFilters()` (line 109) the table itself uses for
`action`/date-range/`search`, so the CSV export can no longer silently disagree with what is shown
on screen.

## WB-112 · `eldIdentifier` is silently auto-corrected, against the rule stated beside it — ✅ resolved (2026-09-18)
**Found:** `src/features/settings/CompanyProfilePage.tsx:314-318` — `onChange` applies
`.toUpperCase()` before storing and validating, although §14.2 says the value is never auto-corrected.
**Severity:** medium — the FMCSA registration identifier a carrier typed is rewritten under them
rather than flagged, so a genuinely wrong value can be "corrected" into a plausible one.
**Fix (proposed):** store what was typed, validate `/^[A-Z0-9]{4}$/` as-is, and let the field's
FMCSA text explain the case requirement.

**Resolution (2026-09-18):** `CompanyProfilePage.tsx:316-323` no longer calls `.toUpperCase()` on
`eldIdentifier` as the admin types; the field is validated exactly as entered
(`validateEldIdentifier`, line 75) with an inline hint: "Exactly 4 characters, uppercase letters
and digits only (A-Z, 0-9). Entered as typed — never auto-corrected."

## WB-113 · Nothing stops an admin from disabling the last admin, or themselves — ⚠️ partly resolved (2026-09-18)
**Found:** `src/features/settings/UsersPage.tsx:89-99` — `handleDisableToggle` disables any user for
any holder of `users:FULL`, with no last-active-ADMIN or self check on the client, and no such check
in the mock handlers either.
**Severity:** low — a carrier can lock itself out of its own panel in one click.
**Fix (proposed):** at minimum a confirm dialog when the target is the last active ADMIN or the
current user.

**Not re-reported (already documented gaps):** B-8 device diagnostics, B-9 alert-rule test, B-12
support ticket permission mismatch, B-64/WB-043 audit-log filters and date range being client-side.

**Resolution (2026-09-18):** `UsersPage.tsx:111-123`'s `attemptDisableToggle()` refuses, with a
clear reason, to disable the signed-in user (`reason: 'self'`) or the last active ADMIN
(`user.role.key === 'ADMIN' && user.status === 'ACTIVE' && activeAdminCount <= 1`, `reason:
'lastAdmin'`), surfacing `blockedDisable` to a refusal modal; enabling a disabled user is never
blocked. REMAINS open: this is a UI-only guard — the server must still enforce the same rule — and
demotion is not covered at all, since the row menu's `Change role` item (line 281) has no
`onSelect` handler wired.

---

## W-11 Dispatch · W-16 Messages · W-01 Dashboard · W-02 Live Fleet

## WB-114 · Trip KPIs and segment counts go stale on `trip.status_changed` — ✅ resolved (2026-09-18)
**Found:** `src/features/trips/TripsPage.tsx:108-121` — the realtime handler only
`setQueriesData`-patches rows inside `qkRoot.trips`; it never invalidates the separately-filtered KPI
queries (`tripsKpiQuery` for DELIVERED, `tripsCountQuery('PLANNED')`, the ASSIGNED/IN_PROGRESS
totals). The inline comment claims there is "nothing to refetch", which is not true of those caches.
**Severity:** high — when a trip moves IN_PROGRESS → DELIVERED the row is patched in place in the
in-progress cache, never removed from it and never added to the delivered one, and no count moves.
"Active trips", "Running late", "Completed" and on-time % all stay wrong until a reload — on the one
screen a dispatcher watches live. `DashboardPage.tsx` does this correctly for `dashboardSummary`.
**Fix (proposed):** invalidate the KPI/count keys after patching.

**Resolution (2026-09-18):** `TripsPage.tsx:111-127` subscribes to `trip.status_changed` via
`useRoom('fleet', ...)`, patches the row's `status`/`etaAt` in every cached `/trips` page with
`setQueriesData` (never invalidating the list itself, per §16.3), and additionally invalidates the
`ASSIGNED`/`IN_PROGRESS` active-slice queries, the `PLANNED` count query and the KPI query so the
segment counts and dashboard KPIs that a single row patch cannot fix stay correct.

## WB-115 · Create trip does not enforce the assignment block it displays — ✅ resolved (2026-09-18)
**Found:** `src/features/trips/components/CreateTripModal.tsx:150` computes `assignmentBlocked` from
the shared `blocksAssignment` helper and renders the warning, but the `Create trip` button carries no
`disabled` for it. `components/AssignLoadModal.tsx:42` — the other call site of the same helper —
does `disabled={!selectedId || blocked}`.
**Severity:** high — a dispatcher can create and assign a trip to a driver flagged unverified (B-31)
straight from this modal, so the "one check, one place" rule holds for the helper but not for its
enforcement.
**Fix (proposed):** `disabled={isSubmitting || assignmentBlocked}`.

**Resolution (2026-09-18):** `CreateTripModal.tsx:76,153` computes `assignmentBlocked =
blocksAssignment(selectedDriver)` (the same `shared/api/trips.ts` helper `AssignLoadModal.tsx:22`
already used) and disables the submit button (`disabled={isSubmitting || assignmentBlocked}`) while
it is true, matching the inline warning the modal already displayed but did not previously enforce.

## WB-116 · A failed message stays in the thread looking sent — ✅ resolved (2026-09-18)
**Found:** `src/features/messages/MessagesPage.tsx:104-131` — `handleSend` optimistically appends via
`upsertMessage`, then `sendMessage.mutate(..., { onError: () => toast(...) })`. On failure only the
toast fires; the `optimistic-${clientId}` row is never removed or marked failed.
**Severity:** high — the dispatcher sees their message in the conversation, indistinguishable from a
delivered one, with no retry. A missed dispatch instruction is a safety problem, not a UI nit.
**Fix (proposed):** roll the optimistic row back (or mark it failed with a retry action) in `onError`.

**Resolution (2026-09-18):** `shared/api/messaging.ts` adds a client-only `MessageRow.status?:
'sending' | 'failed'` (line 58) and `markMessageStatus()` (lines 156-167) to set it by `clientId`;
`MessagesPage.tsx`'s `sendOrRetry()` (line 116) reuses the same failed message's `clientId` on
retry. A `'failed'` bubble renders with a red border, "Not delivered." text and a `Retry` action,
so a failed send no longer looks identical to a delivered one.

## WB-117 · The unread badge can never clear — nothing marks a conversation read — ⚠️ partly resolved (2026-09-18)
**Found:** `src/shared/api/messaging.ts:64-72` derives `unread` from
`lastMessageAt > participant.lastReadAt`; `src/shared/api/endpoints.ts:164-170` has no
mark-read entry and `MessagesPage.tsx` calls none — opening a conversation only fetches messages.
**Severity:** medium — once a conversation has an unread message, its list dot and the "Unread"
segment count stay for the rest of the session, even after the dispatcher reads and replies.
Note that B-37 documents the missing `unreadCount`, but not the missing write path; if the backend
has no `POST /conversations/:id/read`, this needs a new `B-NN` entry in `backend-gaps.md` rather than
a silent UI that can never be right.
**Fix (proposed):** call the mark-read endpoint on selection and invalidate the list, or record the
gap and stop rendering an unread state the panel cannot clear.

**Resolution (2026-09-18):** `messaging.ts:178`'s `markConversationRead()` patches the caller's own
`lastReadAt` in the local TanStack Query cache the moment `MessagesPage.tsx:105` opens an unread
conversation, clearing the unread badge for the rest of the session. REMAINS open, exactly as
`backend-gaps.md`'s B-67 entry states: there is still no `POST /conversations/:id/read` (or
equivalent) endpoint, so the patch is client-memory only — a page refresh, a second tab, or another
dispatcher's panel still see the conversation as unread until that endpoint ships.

## WB-118 · Donut percentages need not add up to 100 — ✅ resolved (2026-09-18)
**Found:** `src/features/dashboard/components/DutyDonut.tsx:87-89` rounds each segment
independently (`Math.round((s.count / total) * 100)`) with no largest-remainder allocation.
**Severity:** low — the legend beside a chart that represents the whole fleet can read 33 / 33 / 33
or 34 / 33 / 34.
**Fix (proposed):** allocate the last segment as the remainder.

**Verified correct in this area (no action):** global search is race-safe (per-term key plus
`keepPreviousData`); `DashboardPage.tsx:73-75`'s clamp-during-render is the sanctioned React pattern.
**Left open, not verifiable here:** neither `AssignLoadModal` nor `CreateTripModal` filters out
drivers already on an active trip, and backend enforcement could not be checked without the backend
repo.

**Resolution (2026-09-18):** new `features/dashboard/lib/allocatePercents.ts` implements
largest-remainder (Hare-Niemeyer) allocation: it floors each share, then distributes the leftover
`100 - sum(floors)` percentage points one at a time to the entries with the largest fractional
remainder, so the donut's displayed integer percentages always sum to exactly 100.

---

## Realtime

## WB-119 · Routine token rotation fires a false "Reconnected" toast and a full refetch storm — ✅ resolved (2026-09-18)
**Found:** `src/shared/realtime/RealtimeProvider.tsx:244-256` — the token-refresh effect does
`socket.auth = { token }; socket.disconnect().connect();`, which emits the socket's own `disconnect`
and `connect`. The `connect` handler (`:209-217`) gates only on a local `everConnected` boolean,
never on the disconnect `reason`.
**Severity:** high — for a user sitting on Live Fleet or the dashboard, every access-token rotation
(roughly every 14 minutes, an entirely healthy event) runs `queryClient.invalidateQueries()` across
every mounted query and pops the green "Reconnected" toast, teaching dispatchers to ignore the one
banner that is meant to mean the connection dropped.
**Fix (proposed):** mark the self-initiated cycle (a ref set before `disconnect().connect()`, or
`reason === 'io client disconnect'` plus a token-cycle flag) and skip the invalidate and the toast
for it.

**Verified correct in this area (no action):** `useRoom` resubscribing on every `connected`
transition is required (server-side room membership does not survive a reconnect); `FleetMap`
disposes its map, layers and observers; `isValidCoord` rejects NaN, out-of-range and `0,0`;
`scrub.ts`/`sentry.ts` scrub tokens and PII recursively including `extra`; `polling.ts` gates on
`visibilitychange`; no phantom §7.4 event is wired anywhere; the MSW envelope and pagination doubles
match the documented contract.

**Resolution (2026-09-18):** `RealtimeProvider.tsx` marks a socket cycle as its own right before
the token watcher rotates the connection (line 272, reason documented at lines 47/196), so the
resulting `connect` event is not treated as a foreign reconnect — no "Reconnected" toast and no
refetch storm fire for routine token rotation. The mark is cleared on `connect_error` (line 244) or
a disconnect that was not our own cycle, so a genuine drop still reconnects and refetches normally.

---

## Shared UI and the app shell

## WB-120 · The date-range calendar cannot leave the current month — ✅ resolved (2026-09-18)
**Found:** `src/shared/ui/DateRangePicker.tsx:175-223` — `MonthCalendar` renders
`format(month, 'MMMM yyyy')` with no previous/next controls, and `month` is hard-wired to
`draft.from` with no separate view-month state.
**Severity:** high — any custom range outside the month `draft.from` already sits in is unreachable;
only the fixed presets (Today, Last 7, This month …) can get there. On the report screens, where an
auditor asks for a specific past period, that is the primary interaction.
**Fix (proposed):** add a `viewMonth` state with previous/next buttons that do not move `draft`.

**Resolution (2026-09-18):** `DateRangePicker.tsx:90` adds a `viewMonth` state, re-anchored to
`startOfMonth(range.from)` both on open (line 116) and whenever a preset is applied (line 98), with
`onPrevMonth`/`onNextMonth` handlers (lines 151-152) that step `viewMonth` — the calendar can now
navigate away from and back to the current month.

## WB-121 · Column reorder has only a "move up" button, on every row — ✅ resolved (2026-09-18)
**Found:** `src/shared/ui/TableSettings.tsx:79-86` — one button per row
(`aria-label="Move {label} up"`, `move(i, -1)`), no "move down", and the `GripVertical` icon implies
drag-and-drop that is not wired (no `draggable`/`onDragStart`/`onDrop`).
**Severity:** medium — moving a column toward the end of the table means clicking "move up" on every
column below it, and for a screen-reader user the operation is not discoverable at all.
**Fix (proposed):** add a real "move down" control (or implement the drag-and-drop the icon promises)
with correct labels.

**Resolution (2026-09-18):** `TableSettings.tsx:80-96` gives each row a separate "Move up" and
"Move down" `<button>` (each with its own `aria-label`), individually `disabled` at `i === 0` / `i
=== draft.length - 1` — replacing the earlier single "move up" control that appeared on every row
regardless of position.

## WB-122 · The account sub-nav never shows which section you are on — ✅ resolved (2026-09-18)
**Found:** `src/app/layouts/AccountLayout.tsx:17-22` passes `NavLink`'s `className` as a static
string instead of the `({ isActive }) => …` form used in `Sidebar.tsx:90-97`.
**Severity:** low — none of the five `/account#…` items is ever highlighted, even though the page
does scroll to the matching section. Not a regression from the uncommitted change (the old plain
anchors had no active state either), but the component now supports it.
**Fix (proposed):** mirror the Sidebar pattern.

**Verified correct in this area (no action):** `DataTable`, `Modal`/`Drawer`/`ConfirmDelete`/
`DiscardChangesDialog`, `Pagination`, `router.tsx`/`guards.tsx`, and the uncommitted `AppShell`/
`Sidebar` diffs (the `overscroll-contain` additions are right, and `router.tsx`'s
`useMemo(() => createBrowserRouter(...), [permissions, role])` is safe because `AuthProvider`
preserves permission-map identity through `samePermissions`, per WB-034).

**Resolution (2026-09-18):** `AccountLayout.tsx:33` sets `aria-current={isActive ? 'location' :
undefined}` on the active sub-nav item, matching the hash to a section; a bare `/account` or an
unrecognised hash defaults to highlighting "My profile".

## WB-123 · The DataTable row-action menu closed itself on any parent re-render — ✅ resolved (2026-09-18)
**Found:** `shared/ui/DataTable.tsx` built its `allColumns` array as a fresh literal on every
render. A parent re-render caused by polling or a live update (not by any column/selection input
actually changing) gave TanStack Table a new `columns` reference each time, which regenerated
every row/cell model and could close an open row-actions dropdown mid-interaction.
**Severity:** medium — any screen using `DataTable` with polling or realtime updates could drop a
menu the user had just opened, on any of the 26 screens that use it.
**Cause:** `allColumns` was recomputed unconditionally instead of memoized against its real inputs.
**Fix:** `DataTable.tsx:80-148` wraps `allColumns` in `useMemo(() => [...], [selectable, columns,
rowActions])`, so it is rebuilt only when those three inputs actually change. WB-039's
`stopPropagation` on the row-actions cell (lines 102, 121, 135) was kept.

## WB-124 · The HOS unassigned chip said "No unassigned segments" before the answer was known — ✅ resolved (2026-09-18)
**Found:** the 24-hour graph grid's unassigned-segments chip on W-08 rendered "No unassigned
segments" immediately, including while `unassignedQuery` was still loading or had failed, so an
admin could be told a day was clean before the panel had actually checked.
**Severity:** medium — a false-negative compliance signal on the HOS screen.
**Cause:** the chip branched only on `unassignedSegments.length === 0`, with no loading/error case.
**Fix:** `HosLogsPage.tsx:283-306` now branches on `unassignedQuery.isPending` first (a skeleton
pill with `aria-busy="true"` and sr-only "Checking for unassigned segments"), then on
`unassignedQuery.isError && !unassignedQuery.data` ("Unassigned segments unavailable · Retry", a
button that calls `unassignedQuery.refetch()`), and only then falls through to the real count.

## WB-125 · WB-038's join-failure pattern existed in `safety.ts` and `messaging.ts` too — ✅ resolved (2026-09-18)
**Found:** the same class of defect as WB-038 (`shared/api/paging.ts`): `useSafetyEventsList`,
`useScorecard` (`shared/api/safety.ts`) and `useConversationsList` (`shared/api/messaging.ts`) each
joined a reference list (`/drivers`, `/vehicles`) onto a primary query and blanked the whole
screen — Safety events, the scorecard, or the W-16 conversation list — on a transient join-query
error, even when the primary rows were good and only the joined DRIVER/UNIT column needed to
degrade to `—`.
**Severity:** medium — a transient reference-list failure took down three otherwise-healthy
screens.
**Fix:** both files now compute `isError` from the primary query only, and only when it has
nothing cached to fall back on: `safety.ts` — `isError: eventsQuery.isError && !eventsQuery.data`
(events list) and `isError: scorecardQuery.isError && !scorecardQuery.data` (scorecard), with a
join failure leaving `driver`/`vehicle` as `null`. `messaging.ts:102` —
`isError: conversationsQuery.isError && !conversationsQuery.data`, with a `/drivers` failure
leaving `driver: null` on each row (the row falls back to its title). New tests:
`src/shared/api/safety.test.tsx` and the `useConversationsList — join-failure isolation` cases in
`src/shared/api/messaging.test.tsx`.

---

## Summary

| Severity | Count | Ids |
|---|---|---|
| Critical | 3 | WB-053, WB-057, WB-074 |
| High | 17 | WB-058, WB-059, WB-060, WB-079, WB-080, WB-086, WB-094, WB-095, WB-103, WB-104, WB-109, WB-110, WB-114, WB-115, WB-116, WB-119, WB-120 |
| Medium | 29 | WB-054, WB-055, WB-061…WB-067, WB-075…WB-077, WB-081…WB-083, WB-087, WB-088, WB-089, WB-096…WB-099, WB-105, WB-106, WB-111, WB-112, WB-117, WB-121 |
| Low | 21 | WB-056, WB-068…WB-073, WB-078, WB-084, WB-085, WB-090…WB-093, WB-100…WB-102, WB-107, WB-108, WB-113, WB-118, WB-122 |

**Resolution status (2026-09-18)** — counted per entry from the marker on its own heading above (this table's `Count` column predates today and is left as written; two of its rows list one ID fewer/more than their stated count, which is unrelated to today's work). WB-123–WB-125, found and fixed today, are outside the original audit numbering and are not included below.

| Severity | Resolved | Partly resolved | Open | Members counted |
|---|---|---|---|---|
| Critical | 3 | 0 | 0 | 3 |
| High | 16 | 1 (WB-103) | 0 | 17 |
| Medium | 20 | 8 (WB-062, WB-064, WB-075, WB-077, WB-089, WB-096, WB-097, WB-117) | 0 | 28 |
| Low | 21 | 1 (WB-113) | 0 | 22 |
| **Total** | **60** | **10** | **0** | **70** |

Suggested order of work: the three critical entries first (WB-074 is a few hours of wiring, WB-057
is a one-line window fix with a test, WB-053 is a dependency bump with a bundle re-measure), then the
compliance and data-integrity highs — WB-059, WB-094, WB-095, WB-103 — then the session pair
WB-079/WB-080, which are the ones most likely to be reported as "it logged me out" or "it did not
log me out".
