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

## WB-016 · `maplibre-gl` crashes on import under jsdom (`window.URL.createObjectURL` missing)
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

## WB-029 · `transferSchema` could never validate an eRODS transfer and spells the method wrong
**Found:** building 11.14. `shared/forms/schemas.ts` `transferSchema` makes `recipient:
inspectorEmail()` required for every method, so a `Web services (eRODS)` transfer (no recipient)
always fails client validation; its `method` enum is `EMAIL | WEB_SERVICE` where
`CreateTransferDto.method` is `WEB_SERVICES | EMAIL` — the singular value is a 422.
**Severity:** medium — the preferred roadside method would have been unsendable.
**Resolution:** `features/reports/sendLogs.ts` composes the SAME shared rules and strings
(`inspectorEmail`, `outputFileComment` 1–60, `daySpan` ≤ `LIMITS.transferRangeDays`, `M.transferRange`)
into a schema that requires the address only for `EMAIL` and uses `WEB_SERVICES`. No constraint was
widened (`sendLogs.test.ts`). `transferSchema` is untouched — flagged for `web-api-client`/`web-forms`.

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
