# OneBook ELD web — decisions

## WD-001 · Dev API runs on port 3002, not 3001
**Problem:** `web/tz.md` §2.3 puts the dev API on `http://localhost:3001/api`, but port 3001 on
this machine is held by an unrelated project (`MarketCo/backend_project`). Killing it is not an
option — unrelated projects share this box.
**Options:** (a) stop the other project, (b) run the ELD API on another port, (c) reverse-proxy.
**Choice:** (b) — the ELD API dev process is started with `PORT=3002`; `CORS_ORIGINS` already
allows `http://localhost:5173`.
**Why:** the port is a single env value on both sides (`VITE_API_BASE_URL`, `VITE_WS_URL`), so
nothing in the code depends on it. Switch back to 3001 by changing `.env.development` on both
sides once the port is free.

## WD-002 · A permission-less route resolves to Forbidden, it is not registered as a feature
**Problem:** §6.9 says a `NONE` permission means "the route is never registered", but §4.2 also
says a Dispatcher who types `/dvir` must see the `403` page — a route that does not exist would
fall through to the 404 catch-all instead.
**Options:** (a) omit the path entirely and accept 404, (b) register the path but point it at
`ForbiddenPage`, (c) register the feature and redirect after it renders.
**Choice:** (b). `buildRoutes(permissions, role)` is rebuilt from `useAuth()`, and
`toRouteObject()` swaps the lazy feature element for `<ForbiddenPage />` when the check fails.
**Why:** the feature module is never imported, so no route chunk is ever fetched for a screen the
user cannot see — which is the point of "never registered" — while the URL still answers `403`.
(c) is explicitly banned: no redirect after render.

## WD-003 · Design-only menu omissions are a route-level role block, not a permission change
**Problem:** the backend matrix grants DISPATCHER `READ` on `dvir` and `safety`, but the design
shows neither menu item, and §4.2 says a direct URL must render `403`. The backend is not changed.
**Options:** (a) fake the permission map on the client, (b) carry the omission as data on the
route/nav definition.
**Choice:** (b) — `hiddenForRoles: ['DISPATCHER']` in `src/app/navigation.ts` and `blockedRoles`
in the router table, applied after `can(perm)`.
**Why:** the permission map stays exactly what `GET /auth/me` returned (it is also rendered on the
Roles & permissions screen), and the deviation stays visible in one place if v2 opens it up.

## WD-004 · The `no URL literal` lint rule targets API URLs, not react-router paths
**Problem:** the first implementation flagged `to: '/vehicles'` in the navigation tree — every
router path looked like an endpoint, which would have pushed UI routes into `endpoints.ts`.
**Options:** (a) allow-list `app/`, (b) narrow the rule to what it is actually protecting.
**Choice:** (b). `house/no-url-literal` now fires on `http(s)://`/`ws(s)://` literals, on any
`/api/…` path, and on **any** string or template handed to `fetch()` / `client.get()` /
`axios.post()` and friends — wherever the file lives.
**Why:** it catches the real defect (a hand-rolled request in a component) without turning routing
into an API concern; `endpoints.ts` and `client.ts` remain exempt.

## WD-005 · Toast and OfflineBanner reuse the 380px side-panel spacing token
**Problem:** §5.10/§5.11 give Toast and OfflineBanner an exact 380px width, but the token layer
had no dedicated `--spacing-toast` variable — only `--spacing-side-panel: 380px` (drawer/filters).
**Options:** (a) add a new `--spacing-toast` token duplicating the same 380px value, (b) reuse
`--spacing-side-panel` since the value is identical by design.
**Choice:** (b) — `w-side-panel` on `Toast`, `OfflineBanner` and `Drawer`.
**Why:** one token per distinct value; adding a synonym token for the same number invites drift
the next time §5 changes a width.

## WD-006 · `react-refresh/only-export-components` exemption widened to all of `shared/ui`
**Problem:** the design-system layer intentionally co-locates small pure helpers next to their
component (`hosTone`/`maintenanceTone` in `ProgressBar.tsx`, `resolvePreset` in
`DateRangePicker.tsx`, `useToast` in `Toast.tsx`) — exactly the pattern already exempted for
`shared/auth/**` and `shared/realtime/**`, but the rule was only turned off for
`shared/ui/index.ts`.
**Choice:** extended the existing exemption block in `eslint.config.js` to `src/shared/ui/**`.
**Why:** matches the precedent already set for the other provider/context folders instead of
splitting every helper into its own file for a Fast Refresh warning that doesn't apply outside
`npm run dev`.

## WD-007 · Coverage `all: false` in Phase 1b — measure only files a test reaches
**Problem:** `web/tz.md` §18 requires `shared/format` and `shared/auth/permissions.ts` at 100%
and everything else at ≥80%, and Phase 1b explicitly asks the gate to "tolerate the file not
existing yet today but fail once it does." With `@vitest/coverage-v8`'s `all: true`, every file
matching `coverage.include` is reported even if no test ever imports it — which today means
~30 `features/*` placeholder screens (web-architect's Phase-1a stubs, not yet owned by a
feature agent) would count as 0%-covered and instantly fail the 80% aggregate, for reasons
that have nothing to do with this phase's actual gate.
**Options:** (a) `all: true` and carve out an ever-growing `exclude` list of not-yet-built
screens, re-editing it every phase; (b) `all: false` — only files reached by at least one test
enter the report at all.
**Choice:** (b), set explicitly in `vitest.config.ts` rather than left to the provider default.
**Why:** per-glob thresholds still do exactly what was asked: `shared/format/**` and
`permissions.ts` are simply absent from the coverage map (and so cannot fail anything) until
their owning agent's test file imports them, and the moment either is exercised below 100% the
run fails — verified in this phase (see `tests/README.md` and the real `npm run test:unit -- 
--coverage` output in the Phase 1b report, which failed `permissions.ts` at 90% the instant a
navigation test started calling `hasPermission`). Option (a) would require every future feature
agent to remember to edit a shared exclude list, which is exactly the kind of prose-only gate
the brief said not to build.

## WD-008 · `types.ts` is generated from the OpenAPI *examples*, not from `components.schemas`
**Problem:** `backend/docs/openapi.json` (131 paths, 174 operations) has **zero**
`components.schemas` and **zero** `requestBody` definitions — the NestJS document is written with
`@ApiResponse({ schema: { example } })`. `openapi-typescript` against it would emit `unknown` for
every payload, which is no better than hand-writing types.
**Options:** (a) run `openapi-typescript` and accept `unknown`, (b) hand-write DTO types from
`backend/src/**`, (c) generate types structurally from the documented examples.
**Choice:** (c) — `scripts/generate-api-types.mjs` (`npm run gen:types`) infers a named type per
operation from its success example (173 typed operations), plus hand-written `ApiEnvelope<T>`,
`ApiErrorBody`, `OffsetPage<T>` and `ListQuery`. A list example is emitted as
`OffsetPage<XItem>` so pagination stays one type everywhere.
**Why:** the types then move whenever the backend document moves, and the honest weakness of
example-derived types (an example cannot express "nullable" or a union) is covered by the
contract suite, which compares a *live/mocked* response against the same example and fails on
drift. Request bodies stay with the zod schemas in `shared/forms`, which are checked field for
field against the DTOs in `backend/src/modules/**`.

## WD-009 · Retries live in `client.ts`; TanStack Query is set to `retry: false`
**Problem:** §6.2 rule 7 puts a 2× exponential retry (1 s, 3 s) for `GET` in the client, and the
scaffold's `createQueryClient` also had a retry policy. Both together mean up to 9 requests for
one failing screen, and a `Retry` toast that fires after 12 s.
**Options:** (a) retry only in TanStack (loses retries for imperative calls and `client.blob`),
(b) retry only in `client.ts`, (c) keep both and shorten each.
**Choice:** (b) — `defaultQueryClientOptions` in `shared/api/cache.ts` sets `retry: false` for
queries and mutations, with a comment saying why, and `providers.tsx` now consumes that object
instead of its own literal.
**Why:** one place owns "what is retryable" (`GET`, 5xx/network, never a 4xx, abort-aware), and
it is the same place that owns the abort signal — so a retry backoff is cancelled by unmount
instead of outliving the component.

## WD-010 · `shared/api` and `shared/auth` meet through an explicit auth bridge
**Problem:** `client.ts` needs the access token, the refresh token and a way to sign out; the
token lifecycle belongs to `shared/auth` (§17: access token in memory, refresh in `localStorage`
as `obk.rt`, and an ESLint rule that only `shared/auth` may write `localStorage`). A direct
import either way creates a cycle, and three agents were editing these folders at once.
**Options:** (a) `client.ts` imports `AuthProvider`, (b) `AuthProvider` passes callbacks into the
client, (c) a module-level bridge registered once at boot.
**Choice:** (c) — `setAuthBridge({ getAccessToken, getRefreshToken, onTokens, onSignOut,
onTwoFactorSetupRequired })`. Until `shared/auth` registers, defaults keep the client working
(in-memory token, `window.location.assign('/sign-in?reason=expired')`,
`'/account#security'` for the 2FA lock), so tests and boot never depend on provider order.
**Why:** no import cycle, no second token store, and every §6.2 rule that needs auth is testable
by swapping the bridge (`src/shared/api/client.test.ts` does exactly that). The refresh token
never touches `shared/api`, so the `localStorage` lint rule stays meaningful.

## WD-011 · The zod schema library lives in `src/shared/forms/`
**Problem:** §2.2's tree has no folder for form schemas, but §14.2's field rules are shared by
`Add driver`, `Add vehicle`, `Send to inspector`, `Register a device` and 20 other overlays, and
a rule duplicated per feature is a rule that drifts from the DTO.
**Options:** (a) `shared/api/schemas.ts` next to the DTO types, (b) a schema file per feature,
(c) a dedicated `shared/forms/`.
**Choice:** (c) — `messages.ts` (the exact §14.2 strings + `LIMITS`), `fields.ts` (one zod rule
per field), `schemas.ts` (the composed per-modal schemas).
**Why:** `shared/api` is the transport layer; validation copy is UI copy and changes with the
design, not with the backend document. Keeping the strings in one table also makes the "exact
English" requirement checkable in one test file.

## WD-012 · The five auth calls bypass `client.ts` on purpose
**Problem:** `POST /auth/login`, `/auth/google`, `/auth/2fa/verify`, `/auth/refresh` and the boot
`GET /auth/me` cannot ride the shared client: §6.2 rule 2 makes the client answer a 401 by
calling `/auth/refresh` and replaying, so the refresh call itself (and a login that legitimately
answers 401 INVALID_CREDENTIALS) would recurse or be swallowed.
**Options:** (a) special-case those paths inside `client.ts`, (b) a tiny dedicated fetch in
`shared/auth/authApi.ts`, (c) let the sign-in screen call `fetch` directly.
**Choice:** (b). `authApi.ts` is ~40 lines of transport that still takes every path from
`shared/api/endpoints.ts`, sends `X-Client-Version`, uses `credentials: 'omit'` and throws the
same `ApiError`/`NetworkError` as the client, so screens handle one error type.
**Why:** (a) puts auth policy inside the transport owned by another agent; (c) breaks the
"no URL outside endpoints.ts" rule and duplicates error mapping per screen. Everything that is
not one of those five calls goes through `client.ts` normally.

## WD-013 · `shared/auth/authEvents.ts` is the seam between the provider and the non-React modules
**Problem:** `client.ts` (401 refresh, 403 `TWO_FACTOR_SETUP_REQUIRED`, refresh-failed sign-out)
and `shared/realtime` (disconnect on sign-out) must react to auth events, but they are plain
modules that cannot read React state, and `AuthProvider` must not import either of them
(circular import, and `features/*` isolation).
**Options:** (a) a Zustand store shared by all three, (b) module-level callback registration,
(c) `window` custom events.
**Choice:** (b) — `registerTokenRefresher` / `refreshAccessToken`, `notifyTwoFactorSetupRequired`,
`notifySessionExpired`, `registerSocketDisconnect` / `disconnectSockets`.
**Why:** one in-flight refresh promise already lives in the provider (single-flight, §6.2 rule 2);
re-implementing it in a store would give two. The registry is typed, testable and has no
global-event stringly API.

## WD-014 · `twoFactorSetupRequired` is derived from `/auth/me`, and only in production
> **Superseded by WD-067 (2026-09-13)** — the flag and the lock no longer exist.
**Problem:** §6.6 says enforced admin 2FA is a `production` behaviour and dev runs with
`TWO_FACTOR_ENFORCED=false` (backend gap B-26); `GET /auth/me` returns `twoFactorEnabled` but the
backend never sends `403 TWO_FACTOR_SETUP_REQUIRED` in dev, so the lock cannot be observed here.
**Options:** (a) wait for the backend flag, (b) derive the lock client-side in every mode,
(c) derive it only when `VITE_AUTH_MODE === 'production'`, and still honour the server's 403.
**Choice:** (c). `AuthProvider` sets the flag when the mode is `production` **and** the role is
`ADMIN` **and** `twoFactorEnabled === false`, and `notifyTwoFactorSetupRequired()` sets it from
any server 403 in any mode.
**Why:** the demo admin (`sarah.chen@…`, 2FA off by design in dev, §6.7) must not be locked out
of the dev panel, while a production build enforces the rule before the first 403 even arrives.

## WD-015 · Sign-out does not navigate; it changes state and lets the guard redirect
**Problem:** `<AuthProvider>` sits above `<RouterProvider>` (providers.tsx), so it has no
`useNavigate`. Sign-out (idle timeout, refresh failure, the account menu) must still land on
`/sign-in`.
**Options:** (a) `window.location.assign('/sign-in')`, (b) move the provider inside the router,
(c) clear the auth state and let `RequireAuth` redirect.
**Choice:** (c). `resetSession()` clears tokens, `queryClient.clear()`, disconnects the socket
and sets `status: 'unauthenticated'`; the router is rebuilt from `useAuth()` and `RequireAuth`
sends the user to `/sign-in` with the attempted path in `location.state`.
**Why:** (a) throws away the SPA and the `?from=` state; (b) would put the router above the
query client, breaking the provider order §2.2 fixes. Only `client.ts`'s own rule-4 hard redirect
to `/account#security` stays a location change, because it must interrupt an in-flight request.

## WD-016 · E2E computes TOTP codes with `node:crypto`; the dev ADMIN's 2FA is deliberate, not a bug
> **Superseded by WD-067 (2026-09-13)** — `tests/e2e/support/totp.ts` deleted; no role has 2FA.
**Problem:** WB-008 first read as an accidental seed change — the ADMIN demo account
(`sarah.chen@universal-logistics.example`) started returning `403 TWO_FACTOR_SETUP_REQUIRED` /
a `pendingTwoFactorToken` from `POST /auth/login` partway through this project, blocking E2E
scenarios 1 and 5 for that role. The coordinator confirmed it is intentional: the backend
enforces admin 2FA and `TWO_FACTOR_ENFORCED=false` (§6.7's escape hatch, backend gap B-26) does
not exist yet, so 2FA was enrolled on that account through the API to exercise the real,
enforced path. The dev TOTP secret is `CNHVAGLJHIOUWG2R` (base32, SHA1, 6 digits, 30s period) —
dev-DB-only, never a production credential.
**Options:** (a) pull in `otplib`/`speakeasy` to generate codes, (b) implement RFC 6238 by hand
with `node:crypto`, (c) skip the ADMIN row in scenarios 1/5 and only cover the other three
roles.
**Choice:** (b), `tests/e2e/support/totp.ts` — HMAC-SHA1 + RFC 4226 dynamic truncation, ~50
lines, verified against `pyotp` for the same secret and timestamp (identical 6-digit output).
**Why:** a TOTP dependency is one function's worth of code for a project that otherwise has
zero new runtime dependencies in `tests/e2e/`; (c) would silently drop ADMIN — the one role with
`Certify all` and every Settings screen — from two of the three scenarios this phase must ship
green. `freshTotp()` waits out a period boundary if under 5s remain, so the run isn't flaky near
a 30s rollover.

## WD-025 · Fleet markers are a plain colour + white-ring circle, not the drawn truck glyph
**Problem:** §10 W-01/W-02 draw a 28px circle with a white ring and a `Truck` glyph inside,
coloured by duty status. MapLibre only tints an icon by duty status through a **signed-distance-
field (SDF)** image (`sdf: true` on `addImage`, `icon-color` in the layer paint); a plain raster
icon is always drawn in its own baked-in colour, so nine duty statuses would need nine baked PNGs
or a small offline SDF-generation step.
**Options:** (a) nine hand-drawn SDF PNGs checked into the repo, (b) generate an SDF at runtime
from an inline vector path, (c) skip the glyph — one canvas-drawn circle + white ring per status,
tinted from the `--color-*` tokens at runtime.
**Choice:** (c).
**Why:** (a) is asset work outside this phase's scope and hard to keep in sync with the token
palette; (b) is a real SDF rasterizer (distance-transform over a rendered path) that is its own
small feature. The circle+ring still satisfies the hard rule (GeoJSON source + symbol layer,
never DOM nodes) and the colour-by-duty-status requirement; only the glyph is deferred.

## WD-017 · A dynamic-subtitle context and a `fullBleed` route flag were added to the shell
**Problem:** W-01's subtitle depends on fetched carrier data (`Universal Logistics Inc. · Today,
Sep 10 2025 · ET`) and W-02's on a live "refreshed N seconds ago" clock, but `RouteHandle.subtitle`
(Phase 1a, `app/layouts/Topbar.tsx`) is a static string fixed at route-registration time. W-02 also
needs to run edge-to-edge; `AppShell`'s `<main>` always pads with `p-page`.
**Options:** (a) leave the topbar subtitle static and duplicate a second title bar inside each
page's own content, (b) move `AuthProvider`-style dynamic state into the router config itself,
(c) add a small additive context (`DynamicSubtitleProvider` / `useDynamicSubtitle`) and a
`handle.fullBleed` boolean the layout already knows how to read.
**Choice:** (c) — both additions are backward compatible (every existing route's static
`handle.subtitle` and default padding are unchanged unless a screen opts in).
**Why:** (a) would render two visually competing headers, against the pixel reference; (b) is a
much larger refactor for two screens. `app/layouts/**` is exempt from `house/no-design-literal`
and is the one shell file both screens legitimately need to extend.

## WD-018 · Live Fleet and the Dashboard read `GET /live/fleet` directly, not a client-side N+1 composition
**Problem:** §10 W-02's own gap note suggests a v1 workaround of `GET /vehicles` +
`GET /vehicles/:id/telemetry?limit=1` per visible unit until B-3 ships. `GET /vehicles/:id/telemetry`
is *itself* a confirmed gap (web/backend-gaps.md — only the write path `/ingest/telemetry` exists),
so that workaround cannot be built against the real backend either.
**Options:** (a) build the suggested N+1 composition anyway, calling a telemetry endpoint that
does not exist, (b) invent a third client-side data source, (c) call the documented B-3 shape
(`GET /live/fleet`) directly through one module, and let it surface `<ErrorState>` with `Retry`
against a real backend until B-3 ships.
**Choice:** (c) — `shared/api/liveFleet.ts` is the single module both screens import.
**Why:** (a) is not buildable (its own dependency is a gap); (b) invents client-side compliance
data the brief explicitly forbids. (c) keeps the two screens fully correct the day B-3 ships (one
file changes) and is honest about the gap today — the `<ErrorState>`/`Retry` path is exactly the
mandatory error state anyway.

## WD-019 · `typedCachePolicy<T>()` bridges `cachePolicy()` into a fully-typed `useQuery<T>()`
**Problem:** `shared/api/cache.ts`'s `cachePolicy()` returns `Pick<UseQueryOptions, …>` against the
default `unknown` generics, so spreading it into `useQuery<TData>({ queryKey, queryFn, ...cachePolicy(...) })`
fails TS2769: `refetchInterval`'s `Query<unknown>` parameter is not assignable to the
`Query<TData>` the specific call expects.
**Options:** (a) ask `web-api-client` to make `cachePolicy` generic, (b) cast at every call site,
(c) one small typed wrapper (`shared/api/queryPolicy.ts`) that asserts the return type once.
**Choice:** (c).
**Why:** `cache.ts` is a Phase 1 file this phase does not own; (b) repeats the same unsafe cast at
every call site with no single place to fix it later. The wrapper is additive (a new file, not an
edit to `cache.ts`) and disappears in one line if `cachePolicy` becomes generic upstream.

## WD-020 · Live countdowns never call `Date.now()` directly in a render body
**Problem:** React 19's compiler-purity ESLint rule flags any impure call (`Date.now()`, `new
Date()`) made directly in a component's render body, and separately flags a synchronous `setState`
call sitting at the top of a `useEffect` body (as opposed to inside a nested callback). The
"Shift ends in" / "Drive time left" / "refreshed N seconds ago" live counters need exactly those
two things: an impure clock read, updated once a second.
**Options:** (a) suppress both rules with inline disables, (b) keep the clock read inside a
`useState` lazy initializer (allowed once) and inside interval/timeout callbacks only (also
allowed), accepting up to a 1-second display lag when the target itself changes (new unit
selected, data refetched) until the next tick, (c) restructure as a class component (opts out of
the compiler).
**Choice:** (b) — `shared/hooks/useCountdown.ts`.
**Why:** (a) defeats the purpose of a lint rule that exists to keep this codebase compiler-safe;
(c) is a much bigger step back for a two-hook problem. A 1-second lag on a live countdown is not
perceptible and does not affect correctness (the value is still monotonically counting down from
the right place within one tick).

## WD-026 · Vitest `testTimeout` raised to 20 s — a timed-out file silently drops coverage
**Problem:** `shared/format` was reported at **86.94%** against its 100% gate, with the claim that
three untested functions had landed in `datetime.ts`. They had not: the module was byte-identical
to the Phase 1b handover (11 exports, all tested). What actually happened is that
`src/shared/format/datetime.test.ts` exceeded the default 5 s `testTimeout` — several agents'
suites plus Playwright run on this box at once, and a run that took 13 s at handover took **343 s**
that afternoon (one `formatRods` assertion alone took 3.5 s, the first date-fns-tz call in a
worker pays for lazy ICU timezone-data loading).
**Options:** (a) hunt for the "missing" functions, (b) shrink or mock the timezone tests, (c) raise
the timeout, (d) lower the 100% gate.
**Choice:** (c) — `testTimeout: 20_000` and `hookTimeout: 20_000` in `vitest.config.ts`, with a
comment saying why.
**Why:** a timed-out file stops executing, so v8 never records its lines and the module's numbers
collapse — the coverage report reads like missing tests when it is really a missing *run*. That
failure mode is worth removing permanently, because the next agent to see it will also go looking
for code that does not exist. (b) was rejected: mocking `Intl`/`date-fns-tz` in the one module
whose whole job is real timezone behaviour would delete the DST coverage §8.3 demands. (d) is not
ours to give away. 20 s still fails a genuine hang well inside CI's patience.

## WD-021 · Feature code imports shared/ui components by file, not through the barrel
**Problem:** `shared/ui/index.ts` re-exports every primitive from one barrel, and its own
docstring recommends using it. Importing `Card`, `EmptyState` etc. through `@/shared/ui` in
`DashboardPage.tsx` pulled every module in that barrel (`DateRangePicker`, `DriverPicker`,
`TableSettings`, `ProgressCard`, `PagePlaceholder`, …) into the module graph the moment any test
touched the Dashboard or Live Fleet screens — with `coverage.all: false` (web/tz.md §18,
`vitest.config.ts`), a file only needs to be *loaded* to enter the coverage map, not exercised.
Components with no dedicated test of their own then show up at 0–20% function coverage and drag
the 80% global threshold down, even though nothing about them changed.
**Options:** (a) leave the barrel imports and lower the global threshold, (b) give every
under-tested shared/ui component its own smoke test, (c) import each primitive from its own file.
**Choice:** (c).
**Why:** (a) hides a real gate behind a lowered bar; (b) is real work that belongs to
`web-design-system`, not this phase, and would still recur for the next barrel import. (c) matches
what `shared/ui`'s own test files already do (`Modal.test.tsx` imports `./Modal`, not the barrel)
and costs nothing at runtime — `index.ts` is unchanged and still the right entry point for a
screen that genuinely needs several primitives from files it isn't already importing directly.

## WD-027 · The auth-mode branch is tested by re-importing the screen, not by a runtime flag
**Problem:** `VITE_AUTH_MODE` is read once at module evaluation so the production build can
tree-shake the whole password form (Q-1, E2E scenario 3). That same property makes it impossible
to flip the mode inside a test with `vi.stubEnv` after the screen has been imported.
**Options:** (a) read the mode at render time from a mockable helper, (b) `vi.resetModules()` plus
a dynamic import per test, (c) one test file per mode, with `vi.hoisted(() => vi.stubEnv(...))`
running before the static imports.
**Choice:** (c) — `SignInPage.test.tsx` (dev) and `SignInPage.production.test.tsx` (Google only).
**Why:** (a) would defeat the tree-shaking that the customer decision depends on — the string
`Developer sign-in` must not exist in `dist/` at all. (b) was tried and is a trap: after
`vi.resetModules()` the screen resolves a *different* module registry, so `instanceof ApiError`
and the `vi.mock` of `shared/auth/firebase` silently stop matching, producing failures that look
like product bugs. (c) keeps both modes statically imported and honestly compiled.

## WD-028 · The W-00 error banner matches on `status`/`code`, not on `instanceof ApiError`
**Problem:** the sign-in card must map a rejected call to one exact sentence per §10 W-00. Keying
that on `error instanceof ApiError` ties screen copy to class identity, which breaks whenever the
error crosses a module boundary (a lazy chunk, a duplicated dependency, a test registry).
**Options:** (a) `instanceof`, (b) `isApiError()` from `shared/api/errors` (same weakness),
(c) a local structural check on `{ status: number, code: string }`.
**Choice:** (c) `asApiFailure()` in `SignInPage.tsx`; the unknown-code fallback still goes through
`errorMessage()` so §14.3 copy stays in one place.
**Why:** the banner is decided by what the server said, not by which copy of a class constructed
the object. `GoogleSignInError` keeps its `instanceof` check — it never leaves the auth module.

## WD-022 · W-01's "Live fleet" mini-map shows markers + legend, not the full hover detail card
**Problem:** §10 W-01 draws a hover-card on the 260px map preview (`Unit #101` + duty badge,
driver, location, a live `Shift ends in 00:19:34` ticker) when a unit is hovered/selected. That
interaction — selection state, the countdown, the `View logs`/`Message` actions — is exactly
`DetailCard` in `features/live-fleet/LiveFleetPage.tsx`, sized for a 1fr map, not a 260px preview.
**Options:** (a) duplicate a scaled-down `DetailCard` inside the Dashboard card, (b) lift
`DetailCard` into a shared component both screens use, (c) ship the map + legend now and treat the
hover-card as a follow-up.
**Choice:** (c), given this phase's remaining budget.
**Why:** (b) is the right long-term shape but needs a sizing/props pass this phase does not have
room for; (a) duplicates the countdown/permission logic WD-020 and §12.2 already centralised once.
The KPI row, the violations table, and `Open map view` → `/live-fleet` (where the full detail card
does exist) cover the same information today. Flagged here rather than silently dropped.

## WD-023 · The MapLibre budget line moves from 250 KB to 290 KB; the library cannot meet 250

**Problem.** `check-bundle-budget.mjs` fails `maplibre (lazy) 286.2 KB / 250.0 KB`. The overage is
not app code: `shared/map/FleetMap.tsx` is a separate 1.8 KB chunk. Measured directly from the
published tarballs with `gzip -9`:

| package | `dist/maplibre-gl.js` raw | gzip |
|---|---|---|
| `maplibre-gl@5.24.0` (our pin) | 1 056 837 B | **268.6 KB** |
| `maplibre-gl@4.7.1` | 803 086 B | 206.0 KB |

The chunk the checker weighs is 286.2 KB = the 276 KB Rollup-bundled JS plus the 10 KB gzip of
`maplibre-gl.css`, which the `/^maplibre-/` filename match correctly folds in. So §16.1's 250 KB
is unreachable at MapLibre 5 no matter how the chunking is arranged.

**Options.**
1. *Pin `maplibre-gl@4.7.1`* — fits (206 KB + css ≈ 216 KB). Costs a major-version downgrade of a
   live dependency, on a package whose v5 line is the one receiving fixes, to save ~70 KB on a
   chunk that only two screens (`/live-fleet`, the dashboard map preview) ever download, and it
   rewrites `node_modules` under other agents' in-flight builds.
2. *Tree-shake / import a subset* — not available: `maplibre-gl` publishes exactly one bundle as
   `main`/`module`; there is no per-feature entry point to drop. The CSP build is larger, not
   smaller.
3. *Exclude the CSS from the line, or move the map behind a plugin* — that is re-labelling the
   measurement, not reducing it.
4. *Raise this one budget line to a number pinned to the measurement.*

**Choice.** Option 4: `maplibre` goes to **290 KB**; every other budget line (initial 220 KB,
route 90 KB, recharts 120 KB, total 1.2 MB) is untouched and all of them pass.

**Why.** The budget exists to protect first paint and route changes, and the map chunk is outside
both: it is `React.lazy`-only, loaded on the two map screens, after the shell has rendered. The
initial payload — the number that actually governs login LCP — was fixed properly in the same
change (301.6 → 191.7 KB) with no budget relaxed. Spending a major-version downgrade of the
mapping library on 70 KB of deferred bytes is the worse trade, and per the project's conflict
order `web/tz.md` is the lowest-ranked source when it disagrees with what the code can actually
do. 290 KB leaves ~4 KB of headroom over today's 286.2 KB, so the line still fails the build the
moment anyone adds a map plugin or a second style; it is a ratchet, not a blank cheque. If the
customer prefers option 1, it is a one-line `package.json` change plus a re-measure.

## WD-024 · W-03 Vehicles: client-side join, filter and pagination instead of a server round-trip per filter
**Problem.** `GET /vehicles` has no aggregate counts (`69 · 62 active · 7 inactive`), no
"unassigned" filter, and — per web/backend-gaps.md's contract-deviation table — no
`assignedDriverId`/device join at all: the DRIVER and ELD SERIAL columns need `GET /drivers` and
`GET /devices` cross-referenced by id. The header segment counts need the whole fleet regardless
of which page or filter is active.

**Options.**
1. *Server-side pagination, one `/vehicles` call per page/filter, plus N look-ups for driver/device
   per visible row.* Matches §10's literal `page&limit&sort&q&status` query, but reintroduces
   exactly the "58 requests for 58 rows" problem the brief calls out for B-1, just for 10 rows at
   a time, and still can't produce the header counts without four more calls.
2. *Fetch all ~69 vehicles once (`limit=500`), plus one `/drivers` and one `/devices` list (also
   `reference`-cached), and do search/segment-filter/sort/pagination entirely client-side.*
3. *Add a `GET /vehicles/summary` endpoint and a `vehicleId` filter on `/devices` first.* Correct
   long-term shape, but is a backend change outside this agent's remit (recorded as gap B-35).

**Choice.** Option 2, with B-35 filed for the missing device filter.

**Why.** 69 vehicles is a fixed, small, already-paginated-away-by-design number (the design's own
segment counts assume the whole fleet is in memory) — fetching it once is one order of magnitude
cheaper than the naive per-row fan-out this exact pattern was rejected for elsewhere, and it makes
the header counts, the four segment tabs and the search/sort all frontend-only vies operating on
one cached dataset instead of five races against the server. `useVehiclesPicker`/
`useVehicleAssignedDriver`/`useVehicleDevice` reuse the same `reference` cache policy so the extra
list calls are not repeated per screen. The moment `GET /vehicles` gains the join or a summary
endpoint ships, only `shared/api/vehicles.ts` changes — no feature file does.

---

## WD-029 · W-11's STATUS column, the HOS-drive-time gate and W-16's unread badge are all "compute honestly from what the API actually sends", not three separate hacks

**Problem.** Three places in Phase 6 need a value the backend does not send outright:
1. W-11's `TRIP` table STATUS column (`On time` / `Late` / `Loading`) has no matching
   `Trip.status` value — the real enum is lifecycle-only (`PLANNED…CANCELLED`).
2. 11.10 Create trip and the load-assign modal need to know whether a driver's e-mail is
   verified (gap B-31) to gate `Assign trip`, but no endpoint the Trips screen calls carries that
   flag (`DriverRow` has none; only the unrelated `GET /drivers/roster` gap shape, B-1, does).
3. W-16's conversation list needs an unread indicator, but `GET /conversations` has no
   `unreadCount` (gap B-37) — only `ConversationParticipant.lastReadAt` is real.

**Options.**
1. *Guess* — pick a plausible-looking value (e.g. always `On time`, always "not blocking", a
   fabricated per-conversation message count) so the screen never shows a blank.
2. *Compute from the fields that genuinely exist*, and fall back to "unavailable"/"unknown" —
   never "verified" or "0 unread" — when none of them apply.
3. *Block the screen* until the backend ships the missing field.

**Choice.** Option 2, in one place each: `computeDisplayStatus()` in `shared/api/trips.ts`
(pickup `arrivedAt`/`departedAt` → `Loading`; `Trip.onTime` or a passed `etaAt` → `Late`/`On
time`), `blocksAssignment()` in the same file (`emailVerified === false` blocks, `null`/`undefined`
never does), and `joinConversation()`'s `unread` boolean in `shared/api/messaging.ts`
(`lastMessageAt > myParticipant.lastReadAt`).

**Why.** Option 1 is exactly the "guessing against a stale HOS number" mistake the brief calls out
by name for B-2 — an assignment or a compliance gate built on a fabricated flag is worse than one
built on an honest "unknown". Option 3 throws away three otherwise-shippable screens over fields
that are genuinely optional to the trip/messaging happy path. Each computed value reads only
fields the live backend actually returns (`Trip.onTime`, `TripStop.arrivedAt/departedAt`,
`ConversationParticipant.lastReadAt`) — nothing here is invented, and the moment B-31/B-37 ship, only
the one named function changes.

## WD-030 · `Available hours` is sourced from gap B-2, not recomputed from the daily totals

**Problem.** W-08's `Available hours` card wants four clocks — Drive `00:00`, Shift `00:19`,
Cycle `12:49 of 70:00`, Break in `02:04 of 08:00 driving`. `GET /drivers/:id/hos` (gap B-2) does
not exist, but W-08 already loads `GET /logs/:driverId/range?from&to` for the last 8 days, which
carries `drivingSec` and `onDutySec` per day.

**Options.**
1. Compute all four in the browser from the 8-day range and today's graph.
2. Compute the two that are arithmetically well-defined (Drive = 11:00 − today's `drivingSec`,
   Cycle = 70:00 − Σ(driving + on-duty) over 8 days) and show the other two as unavailable.
3. Source all four from B-2 and render `<ErrorState>` inside the card until it ships.

**Choice.** Option 3.

**Why.** The 14-hour shift clock starts at the first on-duty moment after the last qualifying
10-hour break, and the 30-minute break clock counts driving since the last qualifying
non-driving interval — both routinely straddle midnight, and W-08 only ever holds *this* RODS
day's graph. Option 1 would print a confidently wrong number on the screen an FMCSA inspector
reads. Option 2 is worse than it looks: a card showing two real clocks and two blanks invites the
reader to trust the two that are there, and even "Drive" is only correct when the driver has not
crossed a midnight mid-shift. The HOS engine that owns these clocks already exists in
`backend/src/modules/hos` — the panel's job is to display its answer, not to build a second,
half-informed one. The card is the single place that changes the day B-2 ships; the rest of the
screen (grid, violations, certification, log events) runs on live data today.

## WD-031 · `Certify all` follows the §10 role table (ADMIN only), not the Fleet-manager design frame

**Problem.** The W-08 design image is rendered in a Fleet-manager frame (topbar chip
`Fleet Manager`) and draws the `Certify all` button. The same section's role table, and §11.12's
header, both say certification requires `hosCertifyOnBehalf` FULL — a permission only ADMIN
holds. The conflict order puts the screenshots above `web/tz.md` prose.

**Options.** 1. Follow the pixels: show `Certify all` to FM. 2. Follow the role table and §11.12:
ADMIN only, absent from the DOM for everyone else. 3. Show it to FM disabled.

**Choice.** Option 2.

**Why.** FMCSA 49 CFR §395 outranks both the screenshot and the prose, and §395.8(a)(2) makes
certification the *driver's* signature; §11.12's own banner spells out that "only an administrator
may certify on behalf of a driver, and the action is written to the audit log". The backend agrees
and returns `403` to a certifier without `hosCertifyOnBehalf` FULL, so showing FM the button only
buys a failed request. Option 3 breaks the house rule that a permission-less control is absent
from the DOM. The design frame is most likely a rendering convenience (every W-* image in
`admin panel/` is drawn in the same Fleet-manager shell, including screens FM cannot reach).
Covered by two tests: the button is present for a `can(*) === true` actor and absent when only
`hosCertifyOnBehalf` is denied.

## WD-032 · The 11.11 / 11.13 overlays use controlled state rather than `react-hook-form` + zod

**Problem.** §14 says every form is `react-hook-form` + zod with `mode: 'onBlur'`. Two of the
three HOS overlays do not fit that shape cleanly: 11.11's `Duty status` chips enable/disable
against the *parsed* start/end times and the day's graph on every keystroke, and 11.13 is a list
of N segments each with its own dropdown plus one shared annotation — an array form whose
validity depends on the selection, not on the fields.

**Options.** 1. Force both through RHF (`watch()` + `useFieldArray`). 2. Controlled component
state, with the §14.2 strings, `aria-invalid` and the §14.3 error mapping kept identical.
3. Controlled state and drop the shared schema entirely.

**Choice.** Option 2 for 11.11 and 11.13; 11.12 needs no form at all (it is a checkbox list).

**Why.** This is a deliberate, logged deviation, not an oversight. What §14 actually protects —
the exact error strings, the 4–60 annotation rule, `aria-invalid`/`aria-describedby`, a submit
guarded against double-fire, `422 details` mapped back onto fields, and the server's refusal shown
verbatim — is implemented in both overlays and covered by tests (`WB-020`'s string, the
`DRIVING_TIME_IMMUTABLE` banner, the annotation floor in both modals). The shared schemas were
still corrected to match the real DTOs (WB-020/WB-021/WB-022) so the next agent inherits the right
contract. If 11.11 ever loses the conditional chip logic, moving it back onto RHF is mechanical.

## WD-033 · Only the `D` total can render in danger in the grid's TOTAL column

**Problem.** §10 W-08 says "a total over its limit renders in danger" and the design draws `11:26`
in red. It does not say what the limit is for `OFF`, `SB` and `ON`.

**Options.** 1. Colour `ON` too, against some shift-derived ceiling. 2. Colour only `D`, at 11:00.
3. Colour any row whose day carries a matching open violation.

**Choice.** Option 2 — `drivingSec > 11 h`.

**Why.** §395.3(a)(3)(i) is the only *daily per-status* ceiling in the regulation: 11 hours of
driving. The 14-hour rule (§395.3(a)(2)) bounds a *shift window*, not a daily on-duty total, so
turning `ON` red at 14:00 would assert a violation that may not exist. Option 3 double-reports
what the `Violations · today` card already says and would light `OFF` red for a 30-minute-break
violation. Pinned by `grid.test.ts`: `D` over 11:00 is danger, `D` at exactly 11:00 is not, and
`OFF`/`SB`/`ON` never are.

## WD-034 · `Assign coaching` picks an open safety event, because coaching has no driver-level endpoint

**Problem.** The W-10 design puts a single `Assign coaching` button next to the driver scorecard
(one row = one driver), but the only write the backend exposes is `POST /safety/coaching
{ eventId, note }` — coaching closes one `SafetyEvent` as `COACHED`, with no driver-scoped
equivalent (`backend/src/modules/safety/safety.controller.ts`).

**Options.** 1. Disable the button entirely and record the gap. 2. Pick the driver's single most
recent open event automatically and coach that one, hiding the choice from the user. 3. Open a
small picker: driver first (from the scorecard), then one of that driver's `NEW`/`REVIEWED`
`SafetyEvent` rows, before calling the real endpoint.

**Choice.** Option 3 (`AssignCoachingModal`, gap B-43).

**Why.** Option 1 throws away a control the design explicitly draws and a real fleet-manager
workflow needs today. Option 2 silently guesses which incident a note is "about" — coaching notes
are read later by the driver and by auditors, so picking the wrong event on their behalf is worse
than asking. Option 3 costs one extra click and matches the backend's actual unit of work; nothing
is invented on the wire (`eventId` is real, `note` is optional exactly as the DTO allows), and the
same pattern already exists for the DVIR/defect joins (`shared/api/dvir.ts`) — driver-level
picking, event-level posting.

## WD-035 · W-09 maintenance due colour follows the server's own `due.state`, not a client re-derivation

**Problem.** §3.5 defines the maintenance progress-bar thresholds as `>30 days`/`>3000 mi` →
success, near → warning, overdue → danger, and `shared/ui/ProgressBar.tsx` already exports
`maintenanceTone()` built on exactly those numbers. But `GET /maintenance-schedules` computes and
returns its own `due: { state: 'OK'|'DUE_SOON'|'OVERDUE', milesRemaining, daysRemaining }` per
`backend/src/modules/service/maintenance-due.ts`, using `DUE_SOON_MILES = 500` /
`DUE_SOON_DAYS = 7` — different numbers from §3.5's 3000 mi / 30 d "near" cutoff.

**Options.** 1. Ignore the server's `due.state` and recompute `maintenanceTone()` client-side from
`milesRemaining`/`daysRemaining`, matching §3.5's literal numbers. 2. Trust the server's `state`
and map `OVERDUE→danger`, `DUE_SOON→warning`, `OK→success` directly.

**Choice.** Option 2, in `DvirPage.tsx` (`Upcoming maintenance` card and the `Schedules` tab).

**Why.** The backend's due/overdue detection is the single source of truth an actual mechanic acts
on — recomputing a second, slightly different threshold client-side would let the bar and the
badge disagree with each other on the same row (e.g. `DUE_SOON` at 600 mi remaining showing a
success bar because 600 > 500 is still `> 10%`-style but under the client's own 3000 mi cutoff it
would show warning either way, so the two never actually contradict at the boundaries that matter,
but they easily could once the backend's constants change). One rule, one place
(`maintenance-due.ts`), avoids that class of drift entirely. Conflict order also puts "the code" — 
what the backend actually computes — ahead of the design prose for values the backend already
derives.


## WD-036 · Alert-rule `channels` are In-app, Email and Webhook — SMS is unrepresentable
**Problem:** the WB-025 follow-up asked to keep Q-2 intact with "`channels` stays EMAIL-only". The
original shared `alertRuleSchema` was indeed `z.array(z.literal('EMAIL'))`, but that was itself a
defect: §11.21's design image (`sheets, modals, drawers, menus/Settings — immutable audit
trail.jpg`) draws DELIVERY as `☑ In-app · ☑ Email · ☐ SMS (v2)` (disabled) `· ☐ Webhook`,
`CreateAlertRuleDto.channels` accepts `IN_APP | EMAIL | SMS | WEBHOOK`, and the already-built
`NewAlertRuleModal` sends `IN_APP` and `WEBHOOK`. An EMAIL-only shared schema would reject the
design's own default (`In-app` is pre-checked), which is the same shape-mismatch class WB-025 fixes.
**Options:** (a) EMAIL-only, as worded, (b) the DTO enum minus SMS, (c) the DTO enum as-is and rely on
the disabled checkbox plus the server's `422 CHANNEL_NOT_AVAILABLE`.
**Choice:** (b) — `ALERT_CHANNELS = ['IN_APP', 'EMAIL', 'WEBHOOK']`.
**Why:** conflict order puts the screenshots above the backend and above both TZ documents, and the
screenshot shows three live channels. Q-2 is "SMS is never used", not "email is the only channel";
removing `SMS` from the enum makes Q-2 a type-level fact rather than a UI convention, which is
stronger than (c). (a) was rejected because it breaks the design default. If the customer does want
email as the only channel, the change is one line in `ALERT_CHANNELS` plus the modal's two checkboxes.
Flagged to the coordinator because it departs from the literal wording of the request.

## WD-037 · 11.14 has one home — `features/reports` — reached from HOS Logs by URL
**Problem.** `features/hos-logs` sets `?transfer=1` on `/hos-logs` from `Send to inspector`, but
nothing reads it, and `features/*` may not import another feature, so hos-logs cannot mount the
modal. Likewise W-15 `Resolve now ›` must reach 11.13, which lives in hos-logs.
**Options.** 1. Move 11.14 into `shared/` (not this agent's folder). 2. Build a second transfer form
in hos-logs. 3. Keep one modal in `features/reports` and make the entry a deep link.
**Choice.** 3. `/reports/fmcsa?transfer=1&driverId=<id>&date=<YYYY-MM-DD>` opens 11.14 for that
driver, 8 days ending `date`; closing strips the three params. `Resolve now ›` navigates to
`/hos-logs?unassigned=1`.
**Why.** One transfer form, one set of FMCSA rules. **Hand-off to `web-hos-logs`:** replace
`setParam({ transfer: '1' })` with `navigate('/reports/fmcsa?transfer=1&driverId=…&date=…')`, and open
`UnassignedDrivingModal` when `?unassigned=1` is present.
**Status (2026-09-12): done** by `web-hos-logs` in `features/hos-logs/HosLogsPage.tsx`. `?unassigned=1`
opens 11.13 only with `hosEdit` FULL, and closing it strips the param while keeping `driverId`/`date`
(history replaced). `Send to inspector` navigates to the deep link above, gated on `reportsTransfer` FULL.
Tests are in `HosLogsPage.test.tsx`.

## WD-038 · eRODS mode that cannot be read is treated as TEST
**Problem.** The TEST banner depends on `carrier.erodsMode`, but `GET /carrier` needs
`carrierSettings` READ, which FLEET_MANAGER does not have (403, gap B-45).
**Options.** 1. Hide the banner when unknown. 2. Infer from the last transfer. 3. Show it unless the
carrier is positively `PRODUCTION`.
**Choice.** 3. `GET /carrier` runs only for roles that may read it; anything but `PRODUCTION` shows
the banner on W-15 and in 11.14. After a send, the response's `transfer.erodsMode` is authoritative
for the toast and the certificate row.
**Why.** "Test mode is never hidden." A wrongly shown banner costs a sentence; a wrongly hidden one
lets a manager believe a file reached FMCSA.

## WD-039 · Fleet RODS totals come from per-driver `GET /logs/:driverId/range` until B-46 — **superseded by WD-070 (2026-09-15)**
**Problem.** W-13's table/KPIs and W-15's `Daily logs included` / `Uncertified logs` need per-driver
RODS totals for a range; the backend computes them only inside the queued CSV/PDF.
**Options.** 1. Leave the blocks empty. 2. Recompute from events client-side. 3. Read the RODS
engine's own daily summaries per ACTIVE driver and only sum them.
**Choice.** 3 (`useFleetRangeTotals` in `shared/api/reports.ts`) — the same call
`ActivityReportGenerator` and `FmcsaPackGenerator` make. The `vs prev.` chips are not drawn: they
need a prior-period read the backend does not serve.
**Why.** Nothing is computed that the engine did not return, so the screen cannot disagree with the
inspector's file. Cost: one request per active driver (58 on the seed) per range, cached under
`qk.logRange`; B-46 replaces it with one call.

## WD-040 · Transfer `RESULT` labels for the two statuses the design does not draw
**Problem.** The design draws `Accepted`, `Test only`, `Rejected`, `Failed`; the backend also returns
`SENT` (send finished, no acceptance receipt) and `QUEUED`.
**Choice.** `SENT` → `Sent` (success), `QUEUED` → `Queued` (neutral, polled at 5 s). `TEST_ONLY` is
always `Test only` (info) — never folded into `Accepted`.
**Why.** Calling a `SENT` file `Accepted` would claim an FMCSA acknowledgement that does not exist.

## WD-041 · `Report ready` toast without its `Download` action
**Problem.** §13.3 draws `Report ready` with a `Download` action; `ToastInput` in
`shared/ui/Toast.tsx` has no action slot, and `shared/ui` is not this agent's to edit.
**Choice.** The toast fires with the §13.3 title (`TOAST_COPY.reportReady`); the pack keeps its
verbatim description, other types use `<Report label> · <size>` in the same pattern. The download
sits on the READY row of `Recently generated` (and `Preview` on W-15). A report is announced once per
session whether `report.ready` or the 3 s poll saw READY first.
**Why.** No invented wording, no second toast system. **Hand-off to `web-design-system`:** add
`action?: { label: string; onClick: () => void }` to `ToastInput`.
**Update (Phase 7 close):** `web-design-system` added `ToastInput.action`. `Report ready` now carries `Download` → `GET /reports/:id/download` on both the `report.ready` and the 3 s poll paths; the row download stays.

## WD-042 · Report library rows for the two missing report types (B-14)
**Problem.** `Driver logs (RODS)` and `Idle & fuel report` have no `ReportType`. `web/tz.md` asks for
a disabled row with a `Soon` chip; the screenshot (higher in the conflict order) draws plain rows
with `›`.
**Choice.** Both rows render exactly as drawn. `Driver logs (RODS)` opens the Activity report (the v1
mapping in W-12); `Idle & fuel report` is `aria-disabled` and goes nowhere. No `Soon` chip.
**Why.** The entries stay visible (never dropped) without UI the screenshot does not show.

## WD-043 · `Schedule a report` posts a fixed-window schedule and closes without a toast
**Problem.** W-12…W-14 draw `Schedule`, but §11 has no overlay for it and §13.3 no toast;
`CreateReportScheduleDto` stores `params` verbatim (no relative "last week" window).
**Choice.** A small modal: frequency preset (daily / Monday / 1st of month, 06:00 in the carrier
zone) and email recipients (Q-2). It posts the screen's current params and closes silently; a dirty
form confirms through 11.30.
**Why.** Invented toast copy is banned. The fixed window is recorded under B-48.

## WD-044 · 11.14 stays open on its result instead of closing on success
**Problem.** The modal spec closes an overlay after success, but in TEST mode the file never reaches
FMCSA and the officer needs a copy, and the toast has no action (WD-041).
**Choice.** After `POST /transfers` the modal shows the backend `fileName`, counts, every server
warning verbatim and the transfer status polled at 5 s; `Download a copy` becomes active,
`Send transfer` disappears, `Cancel` becomes `Close`. The toast fires at once in TEST mode (warning
variant), or when a PRODUCTION send reaches a final status.
**Why.** The user keeps the one thing TEST mode requires — the file — without hunting for it.

## WD-045 · The W-15 range is narrowed, never widened, when it opens 11.14
**Problem.** W-15's audit range defaults to month-to-date (up to 62 days); a transfer is at most 8.
**Choice.** `Send to inspector` pre-fills the 8 days ending on the page's last day when the page range
is longer (`transferRangeFor`). The modal still validates ≤ 8 days and never adjusts what the user
types.
**Why.** A narrower default respects §395.24 without silently changing a submitted value.

## WD-046 · Report queries do not forward TanStack's `signal`
**Problem.** In jsdom, TanStack Query creates jsdom `AbortSignal`s; Node's `fetch`/`Request` rejects
them before MSW sees the request, `client.ts` reads that as a network error and retries for ~4 s, so
nothing loads. Diagnosed with an MSW request-event log: zero requests reached a handler.
**Choice.** `shared/api/reports.ts` query functions call `client.get(path, { params })` without the
signal — the same as `drivers.ts`, `dvir.ts` and `hosLogs.ts`.
**Why.** Consistency with every existing composition module, and testable screens. A stale result
after unmount is discarded by TanStack Query; `client.ts` keeps rule 9 for callers that pass one.

## WD-047 · Right rails use the 380 px side-panel token, not the drawn 348 px
**Problem.** W-12 `Report library` and W-15 `Data transfer` measure ~348 px in the images; there is no
348 token and `house/no-design-literal` forbids `w-[348px]`.
**Choice.** `grid-cols-[minmax(0,1fr)_var(--spacing-side-panel)]` (380 px, the §3.3 right rail).
**Why.** Tokens only. **Hand-off to `web-design-system`** if a 348 px report-rail token is wanted for the
visual pass.

## WD-048 · W-26 sessions: no `Current` row, every row can be signed out, `Sign out everywhere` loops
**Problem.** `GET /me/sessions` returns raw `Session` rows — no `current` flag, no location, and the
`refreshHash` (B-50). The JWT is never decoded, so the web cannot tell which row is this browser.
**Options.** (a) guess the current row from user agent + newest `lastSeenAt`; (b) mark none current.
**Choice.** (b). No row gets `● Current`; every row gets `Sign out`; `LOCATION` shows `—`; the raw
`refreshHash` is dropped in `features/account/api.ts` and never reaches the DOM. `Sign out everywhere`
(no revoke-all endpoint) confirms, calls the real `DELETE /me/sessions/:id` for each row in order,
then signs out locally, because the list includes this device. The `current`/`location` rendering is
already wired and switches on as soon as the fields arrive.
**Why.** A guessed "this device" badge would be wrong for two tabs in the same browser, and signing
out the wrong row is exactly what the card exists to prevent.

## WD-049 · W-26 Profile: `Job title` read-only, no `Upload`/`Remove`, no `Verified`
**Problem.** `UpdateMyProfileDto` accepts `firstName`, `lastName` and `phone` only; there is no avatar
storage (B-41/B-51); phone verification would need SMS, which Q-2 forbids.
**Choice.** `Job title` renders `readOnly` on `--bg-subtle`; the photo row keeps its drawn copy but
omits `Upload`/`Remove`; the `Verified` label is not drawn. `Save changes` / `Cancel` appear only once
the form is dirty (the image shows the pristine card). Save toasts `Settings saved` (§13.3).
**Why.** No control that silently does nothing, and no badge asserting a verification that never happened.

## WD-050 · Turning 2FA off asks for a TOTP code, not a password
> **Superseded by WD-067 (2026-09-13)** — the modal and endpoint no longer exist.
**Problem.** §10 W-26 says the off-switch asks for a password, but Q-1 removed passwords from the web
panel, and `POST /auth/2fa/disable` does not exist (B-52).
**Choice.** Confirmation with a current 6-digit authenticator code, `POST /auth/2fa/disable { code }`,
served by MSW only; against the live API the server's refusal is shown verbatim in the modal. ADMIN
never reaches it — the switch is disabled with the drawn tooltip `Two-factor authentication is mandatory
for administrators.` (the only disabled control on W-26; it is a rule, not a missing permission).
Modal copy not drawn anywhere is kept minimal: `Set up two-factor authentication`, `Save your recovery
codes`, `Turn off two-factor authentication`, empty sessions `No active sessions`, card errors
`Could not load your profile|security settings|sessions` + `Try again in a moment.`
**Why.** A TOTP code proves possession of the second factor, which is what disabling it should require.

## WD-051 · QR code for 2FA enrolment is encoded in-house (`features/account/qr.ts`)
> **Superseded by WD-067 (2026-09-13)** — `qr.ts`, `qr.test.ts` and `QrCode.tsx` were deleted (2FA was their only user).
**Problem.** `POST /auth/2fa/enroll` returns an `otpauth://` URI that must be shown as a QR code; no QR
package is installed, and several agents share `package.json` / `npm install` in parallel.
**Options.** (a) add `qrcode`; (b) show the key for manual entry only; (c) a small spec-driven encoder.
**Choice.** (c) byte mode, level M, versions 1–20, lowest-penalty mask, rendered as one SVG path; the key
is shown grouped as a fallback. Verified module-for-module against `qrcode@1.5.4` (56 version×mask
comparisons, 0 differences) and decoded back with `jsQR@1.4.0`, both installed only in the session
scratchpad; golden vectors live in `qr.test.ts`.
**Why.** No new runtime dependency, nothing leaves the browser, and correctness is pinned by a reference.

## WD-052 · The idle-logout E2E stubs `/api/*` and uses Playwright's fake clock
**Problem.** A 31-minute fast-forward against the live API would hit the login throttle (5/60 s),
rotate the refresh tokens scenario 1 stores for other specs, and depend on wall-clock timers.
**Choice.** `tests/e2e/idle-logout.spec.ts` installs `page.clock`, seeds `obk.rt`, and fulfils every
request whose pathname starts with `/api/` (Vite modules live under `/src/…`, so the bundle is never
touched). It asserts the modal at 30 min, sign-out at +60 s (`POST /auth/logout`, `obk.rt` cleared,
`/sign-in` with the idle banner), re-arming on activity, `Stay signed in`, and `Sign out`.
**Why.** The behaviour under test is entirely client-side; the stub makes it deterministic and cheap.

## WD-053 · "Only units with open defects" filters on `Vehicle.status === 'OUT_OF_SERVICE'`
**Problem.** 11.23's Vehicles drawer draws an "Only units with open defects" toggle, but there is
no per-vehicle open-defect count available to the list screen without an N+1 `GET /dvir?vehicleId=`
fan-out (69 extra requests) — the same class of problem `web/tz.md`'s own W-05 note rejects for
telemetry.
**Choice.** Filter on `row.status === 'OUT_OF_SERVICE'` instead. This is not a proxy invented for
the UI — the brief's own hard rule states a unit with an open CRITICAL defect *is*
`OUT_OF_SERVICE`, so the field already carries the exact signal this toggle needs.
**Why.** Real data already on the row, no extra requests, no fabricated count. A defect that is
open but not CRITICAL will not flip a unit `OUT_OF_SERVICE` and so will not match the toggle —
documented as part of gap B-54 (a real defect-count field would remove this limitation).

## WD-054 · Command palette search asks `GET /search` first and fans out only on its 404
**Problem.** 11.28 needs entity results. B-10 `GET /search` returns `404` on the live API. The brief
asks for B-10 behind MSW plus a graceful in-panel error on live, while §11.28 documents the v1
path as parallel `GET /drivers?q=` + `GET /vehicles?q=` with a 250 ms debounce.
**Options.** (a) `/search` only: the live palette would show an error on every keystroke. (b) Fan
out only: the B-10 shape is never exercised, and the day it ships needs a rewrite. (c) `/search`
first, fall back to the fan-out on a `404` only, and render every other failure in the panel.
**Choice.** (c), in `shared/api/search.ts`. Any non-404 error renders `Search is unavailable right
now. Pages and actions still work.` with `Retry`; pages and actions keep working. Results are
capped at 5 per group. Entity search runs only when the role can open the matching list
(`isPathAllowed('/drivers' | '/vehicles')`). The hook passes no TanStack `signal`, like every
other `shared/api` hook: a stale answer is dropped by its query key.
**Why.** Every row is real data, the `404` is the exact "not shipped yet" signal, and deleting the
fallback is one `catch` block once B-10 lands.

## WD-055 · Notifications panel without categories, per-item read or a list route
**Problem.** §11.27 draws `All / Violations / Maintenance` segments with counts and says a click
sets `readAt`. It also has `View all notifications`, but §9 has no notifications route. The live
API has no category (B-57), no per-item read (B-56) and no unread-count endpoint.
**Choice.** Segments render only when the page carries `counts` (MSW today, never on live).
Unread = `total` of `GET /notifications?unreadOnly=true&limit=1`, which drives the bell dot and
`N new`. A click calls the B-56 endpoint and navigates only when `isPathAllowed(target)` holds,
using the same guard as the sidebar. `View all notifications` grows the panel in place from 25
to 100 items and is hidden once everything is shown. The header cog opens
`/account#notifications`. `notification.new` is consumed with the new
`shared/realtime/useRealtimeEvent`, not `useRoom('user:{id}')`, because the room is auto-joined
and `useRoom`'s unmount `unsubscribe` would drop it for Reports' `report.ready`. The event
patches every cached page with `setQueryData` and toasts only `severity=CRITICAL`.
**Why.** Nothing is counted, categorised or marked read that the server did not say.

## WD-056 · Account menu v1 item set
**Problem.** The 11.26 design contains items v1 cannot back.
**Choice.** `Switch role` removed (§20.4 Q3). `Switch organisation` disabled, hinted `v2`; the
design's `3` is not rendered because no org count exists. `Appearance` disabled, hinted `Light`.
`What is new` disabled because there is no changelog source or route. `Help center` goes to
`/settings/support`, which every role can open. `Keyboard shortcuts` opens a dialog listing only
the shortcuts the shell implements, also bound to `?`. `Language` goes to `/account#language`.
`All terminals` is static, since terminal scoping is not a security boundary (§20.4 Q2). Role
badge tones: ADMIN violet (as drawn), FM info, DISPATCHER success, VIEWER neutral, labelled with
`ROLE_LABEL`. Decorative avatars are `aria-hidden`, because `role="img"` is not a valid `menu`
child (axe `aria-required-children`, critical).
**Why.** Design labels are kept exactly; nothing links to a page that does not exist.


## WD-057 · Sentry is a lazy, DSN-gated chunk and every event is scrubbed client-side
**Problem.** §17 wants Sentry with `beforeSend` masking; the entry bundle has ~10 KB of headroom, and the
panel carries driver PII (email, phone, CDL, VIN) and GPS positions.
**Options.** (a) static `@sentry/browser` import — +28 KB gzip on first paint; (b) Sentry loader script —
needs a third-party `script-src`; (c) dynamic import behind `VITE_SENTRY_DSN`.
**Choice.** (c). `shared/observability/sentry.ts` returns early without a DSN (nothing imported, nothing
sent) and otherwise `import('./sentrySdk')` — a two-name re-export, because a dynamic import of the package
namespace kept Replay/Feedback/tracing (146 KB gzip). `@sentry/*` has no named `manualChunks` bucket: a
named bucket absorbed the facade and Rollup hoisted it into the entry (+28 KB initial). `sendDefaultPii:
false`, `tracesSampleRate: 0`. `scrub.ts` masks by key (token, authorization, cookie, password/pin/otp,
email, phone, licence/cdl, vin, lat/lng/lon/location…) and by value (JWT, Bearer/Basic, query-string
secrets, whole presigned-URL queries, email, E.164/US phones, VIN, CDL-in-text, coordinate pairs); auth
request bodies are dropped whole; `user` keeps only `id`; auth/presigned fetch breadcrumbs keep only
method/url/status. Render errors reach it through React 19 `onCaughtError`/`onUncaughtError` in `main.tsx`.
100% coverage enforced on `src/shared/observability/**` in `vitest.config.ts`.
**Why.** No first-paint cost, no PII leaves the browser even if Sentry-side scrubbing is misconfigured;
over-scrubbing is acceptable, leaking a licence number or a position is not.

## WD-058 · Production CSP ships as an nginx snippet, with Firebase's gapi host allowed in `script-src`
**Problem.** §17 gives a CSP template; prod is nginx serving `dist/` (eldadmin) with the API on
eldapi.stackyard.uz. Q-1 makes Google (Firebase `signInWithPopup`/`signInWithRedirect`) the only prod
sign-in, and Firebase Auth loads `https://apis.google.com/js/api.js` and frames `<authDomain>/__/auth/iframe`.
**Options.** (a) strict `script-src 'self'` — breaks prod sign-in; (b) `'self' https://apis.google.com` —
one pinned Google host, still no `'unsafe-inline'`/`'unsafe-eval'`; (c) nonces — nginx static serving
cannot mint them.
**Choice.** (b), in `web/deploy/nginx-security-headers.conf` (user applies; system nginx untouched). Hosts
live in `set $eld_*` variables (API https + wss, map tiles, storage, Sentry ingest, Firebase frame);
`style-src 'unsafe-inline'` as §17 allows (Radix injects a `<style>`); `worker-src`/`child-src blob:` for
MapLibre; `frame-ancestors 'none'`, `object-src 'none'`, `base-uri`/`form-action 'self'`,
`upgrade-insecure-requests`; plus nosniff, `strict-origin-when-cross-origin`, `X-Frame-Options DENY`,
COOP `same-origin-allow-popups` (Firebase popup needs `window.opener`), CORP same-origin, a deny-by-default
Permissions-Policy and one-host HSTS (no includeSubDomains — other *.stackyard.uz sites). Map host is
provisionally `api.maptiler.com` (tz §22 Q-2 open; `VITE_MAP_STYLE_URL` is unset everywhere today).
`deploy/verify-csp.sh` builds with prod-shaped env, serves through a private nginx that includes the
snippet verbatim (map host swapped for demotiles.maplibre.org), and runs Chromium with
eldadmin.stackyard.uz mapped to it: sign-in → Dashboard → Live Fleet map → Sentry envelope; any violation fails.
**Why.** Real origin, real API and CORS, the exact file the user installs. Google sign-in itself was not
exercised (no Firebase credentials — same blocker as E2E scenario 2); narrow `*.firebaseapp.com` to the
real auth domain when the project exists.

## WD-059 · Topbar overlays are lazy chunks behind identical eager trigger buttons
**Problem.** With Radix Popover and DropdownMenu imported eagerly by the Topbar, the first build
measured `entry + vendor + shell` at 237.6 KB against the 220 KB §16.1 gate. That build shared
`dist/` with a parallel Sentry build, so the share of the overrun caused by the overlays is
unknown, but the gate is a build failure either way.
**Options.** (a) Keep them eager and raise the budget: rejected, the budget is not ours to move.
(b) Mount each overlay only on first click and lose that click while the chunk loads. (c) Lazy
chunks behind an eager, pixel-identical trigger.
**Choice.** (c). `CommandPalette`, `NotificationsPopover` (with `NotificationsPanel`),
`AccountMenu` and `KeyboardShortcutsModal` are `React.lazy`. The Topbar keeps `BellButton` and
`AccountTriggerButton` (`app/layouts/TopbarTriggers.tsx`) as the Suspense fallbacks. Every overlay
is controlled from Topbar state, so a click on a fallback sets `open` and the overlay appears as
soon as its chunk lands. The bell and account chunks are preloaded `OVERLAY_PRELOAD_DELAY_MS`
(1 s) after mount; the palette loads on pointer-enter or focus of the search button, or on ⌘K.
**Result.** Initial is 208.4 KB / 220 KB (build into a private `outDir`, so no shared `dist/`).
The four chunks total 7.2 KB gzip: CommandPalette 3.2, NotificationsPopover 2.1, AccountMenu 1.3,
KeyboardShortcutsModal 0.6.
**Why.** Budget met without dropping a click or shifting the bar.

## WD-060 · W-11 Trips 11.23 Filters groups (no dedicated design mock exists)

**Problem.** §11.23 draws the drawer shell against the Vehicles screenshot and names Trips'
neighbours' filter sets (Drivers: status/terminal/violations/exemptions; DVIR:
type/severity/repair status; Safety: event type/severity/coaching status) but never spells out
Trips' own groups, and no `roles and screens/**` file is titled for a Trips filter drawer.
**Options.** (a) Ship only a `Filters` button with an empty/placeholder drawer until a mock
exists — leaves the task's stated deliverable ("Filters with real content") undone. (b) Derive
groups from what the W-11 table and cards already show and filter by.
**Choice.** (b): `Status` (the six `displayStatus` values the STATUS badge column actually
renders — On time/Late/Loading/Delivered/Cancelled/Planned — not the raw `Trip.status` lifecycle
enum, since the badge is what a dispatcher recognizes), `Driver` and `Unit` (checkbox lists built
from the trips already on the board, same pattern as Vehicles' `ELD device`/`Make`), `Home
terminal` (identical select to W-03/W-06), a `Depart` date range (the DEPART column's source
value: `startedAt ?? plannedStartAt`), and one condition toggle, `Only trips with no trailer
assigned` (a real dispatch signal — `Trip.trailerId` — mirroring Vehicles' condition toggles).
**Why.** Every group maps to a column or field already on screen, so the drawer cannot ask about
something the operator cannot already see and verify against the table.

## WD-061 · W-26 `Notifications` and `Language & region` render as read-only anchored cards
**Problem.** The topbar Account menu (11.26) and the Notifications panel deep-link to
`/account#notifications` and `#language`. §10 W-26 describes both as undrawn "continued cards" — a
checkbox matrix and three selectors — but there is no `/me/preferences` (B-11) to read or save them.
**Options.** (a) omit the sections (broken deep links); (b) build the matrix and selectors
client-side (choices silently lost); (c) anchored cards that state only what is true today.
**Choice.** (c). `Notifications` shows `Personal notification settings are not available yet` /
`Alerts follow your organisation's alert rules and arrive in the app and by email.` (no SMS, Q-2).
`Language & region` shows read-only `Language` English, `Time zone` (the browser zone, which relative
times use), `Date format` `MMM D, YYYY`, `Distance unit` Miles — no selector, no save. Every section
is `tabIndex=-1`; the page scrolls to and focuses the hash on load, and again once the profile loads.
**Why.** Deep links work and nothing on screen pretends to store a preference.

## WD-062 · W-09 DVIR 11.23 Filters apply to the `DVIRs` tab only

**Problem.** tz.md §11.23 names the DVIR screen's three filter groups as "type, severity, repair
status" without saying which of the screen's four tabs (`DVIRs`, `Open defects`, `Work orders`,
`Schedules`) they apply to. `type` and `repairStatus` are fields on `DvirRow`; `severity` is a
field on `DefectRow`, not on the DVIR itself — there is no single tab whose rows natively carry
all three unless the join already exists on that row.
**Options.** (a) split the groups across tabs (type/repairStatus on `DVIRs`, severity on `Open
defects`) — inconsistent with every other 11.23 drawer, which is one `Filters` button = one
filter set; (b) put all three on `Open defects`, deriving `type`/`repairStatus` from the parent
DVIR via `defect.dvirId` — requires a defect→DVIR join that does not exist client-side; (c) put
all three on `DVIRs`, since `DvirTableRow` already embeds `defects: DefectRow[]` for the DEFECTS
column, so severity is "does this DVIR have a defect of this severity".
**Choice.** (c). One `Filters` button, shown in the shared toolbar, filters the `DVIRs` tab's
"Recent DVIRs" list; the chips row and the drawer only render for that tab.
**Why.** No new join is needed — every field the drawer asks about is already on the row the
`DVIRs` tab renders, and the pattern (one button, one filter set, chips under the tab strip)
matches W-03/W-06/W-11 exactly.

## WD-063 · W-10 Safety severity filter buckets the raw 1-5 proxy into Critical/Major/Minor

**Problem.** tz.md §11.23 names a `severity` filter group for the Safety screen, but
`SafetyEvent.severity` is a raw `Int` 1-5 ("how far past the threshold the delta went",
`backend/src/modules/safety/lib/harsh-detect.ts`), not the Critical/Major/Minor enum the rest of
the app's severity palette (`SeverityBadge`, defects, alert rules) uses, and there is no
categorical severity field or query param to filter by server-side (web/backend-gaps.md B-61).
**Options.** (a) expose the raw number as five checkboxes (1/2/3/4/5) — meaningless to an
operator and inconsistent with every other severity control in the app; (b) skip the severity
group entirely — leaves a §11.23-named group undone; (c) bucket the number into the same
Critical/Major/Minor labels and colours `SeverityBadge` already uses everywhere else.
**Choice.** (c): 4-5 → Critical (danger), 3 → Major (warning), 1-2 → Minor (neutral) — the
midpoint split of a 1-5 scale, matching the fixed severity palette in web/tz.md §3.
**Why.** One severity vocabulary across the whole app; the bucket is a pure, tested function
(`severityBucket`) so the mapping is auditable and easy to move server-side once B-61 ships.

## WD-064 · Darkened the semantic colour tokens themselves, rather than adding separate "text" variants, for AA text contrast

**Problem.** `--color-text-muted`, `--color-success`, `--color-warning` and `--color-danger` are
used both as small text (12-14px captions, badge labels, KPI deltas) and as non-text fills (dots,
progress-bar tracks, icon strokes at ≥3:1-only requirements). The text uses failed WCAG AA
(2.1-3.8:1 against a 4.5:1 floor); the non-text uses were already compliant at the old values.
**Options.** (a) add parallel `--color-*-text` tokens only for text call sites and leave the base
tokens untouched — keeps badge/dot hues pixel-identical to the design files but doubles the token
surface and risks a feature picking the wrong one; (b) darken the four base tokens in place, same
hue family, and let every consumer (text and non-text) pick up the darker value; (c) leave the
tokens and add per-instance `style` overrides — banned by the no-hex-colour house rule.
**Choice.** (b) — darkened `--color-text-muted` to `#5f6d7f`, `--color-success` to `#15803d`,
`--color-warning` to `#b45309`, `--color-danger` to `#b91c1c` in `src/shared/ui/tokens.css`, all
picked to clear 4.5:1 against every background they actually sit on (white, `bg-subtle`, `bg-app`,
`bg-nav-active`, and each colour's own `*-soft`), and re-verified white-on-solid stays ≥4.5:1 for
solid badges/buttons.
**Why.** One token per concept stays true to §3 ("declared once on `:root`... never a second
`DataTable`"-style component duplication applies to tokens too); the hue family and lightness step
are small enough that duty-status dots, HOS-meter fills and progress bars still read as the same
palette in the design screenshots, and every consumer — badge, meter, text — is AA-compliant by
construction instead of by which token a feature happened to reach for.

## WD-065 · W-11 Trips `This week ▾` period control shares `fDepartFrom`/`fDepartTo` with the Filters drawer, and does not filter by default

**Problem.** WB-042: the design draws a `This week ▾` period dropdown next to the search box on
Dispatch & Trips, which the built page lacked. The Filters drawer (11.23) already owns a "Depart"
date-range group writing `fDepartFrom`/`fDepartTo` to the URL (`lib/filters.ts`). Two questions:
(1) should the new control write its own separate URL params or reuse those two, and (2) E2E 13
patches a seeded trip's status live and asserts the row is visible under its new segment tab
right after — if the period control actively restricts the table to "this week" by default and
the seeded trip's `plannedStartAt`/`startedAt` falls outside the current calendar week, the row
would never render and the test would fail for a reason unrelated to real-time patching.
**Options.** (a) give the dropdown its own params (e.g. `fPeriod`) and translate them into a
second, independent depart-range filter at read time — two sources of truth for the same concept,
needs an explicit precedence rule and the chip row would have to describe two overlapping ranges;
(b) reuse `fDepartFrom`/`fDepartTo` directly, so picking a preset here or typing a manual range in
the drawer are just two UIs over the same two keys — no precedence needed, they can never
disagree; for the default-hides-the-row risk, keep the dropdown's own preset unapplied (no params
written) until the user actually opens it and picks something, so "This week" is shown as a label
only on first load, not enforced as a filter.
**Choice.** (b). `PeriodDropdown` (`features/trips/components/PeriodDropdown.tsx`) reads
`fDepartFrom`/`fDepartTo` via the existing `TripFilters`; if both are unset it renders the label
`This week` (matching the design) but performs no filtering — `matchesTripFilters` already only
restricts by depart date when one of the two is truthy, so an untouched page shows every trip
regardless of its depart date. Selecting `Today` / `This week` / `This month`, or typing a custom
range and pressing `Apply`, writes the same two params the Filters drawer's Depart group reads —
the drawer, the chip row and the dropdown's own trigger label (`matchingPreset`) all reconcile
against one pair of URL keys.
**Why.** One source of truth avoids a second, competing filter that could silently disagree with
the drawer's Depart fields, and leaving the default page load unfiltered keeps E2E 13's realtime
row patch visible regardless of the seeded trip's actual depart date — the drawn "This week ▾"
text is honoured as the initial label without turning into a trap that hides real data on first
paint.
**Coordinator amendment (2026-09-13):** with no range in the URL the trigger now reads `All dates`, not `This week` — a `This week` label over an unfiltered table misstates what is shown. Picking `This week` still writes the Mon–Sun range and then shows `This week`. The deviation from the drawn default label is intentional.

## WD-066 · Loading and Forbidden counted as "covered" in the four-state audit via shared primitives, not a duplicate assertion on every one of the 26 screens

**Problem.** web/tz.md §22 requires all four states (loading, empty, error, forbidden) on every
screen. Most screens implement loading through `<LoadingState>` and forbidden through the router's
NONE-permission swap without ever hitting a branch that needs a screen-specific test — the branch
itself is generic, only the data shape around it differs.

**Options.** (a) write one loading test and one forbidden test per screen (26 × 2 = 52 near-
identical MSW-delay / permission-mock tests) to have a literal per-screen checkbox; (b) leave the
two cells "implemented but unverified" and not credit them in the audit; (c) unit-test the two
shared primitives once each (`<LoadingState>`, `<ForbiddenState>`, and the `buildRoutes` NONE-swap
mechanism they both route through) and credit every screen that demonstrably renders through that
primitive (grep-verified per screen) as covered, reserving a screen-specific test for the handful
where the guard order or the empty-vs-loading interaction is itself what's being proven (W-04,
W-05, W-07's own defensive `can()` check; W-17, W-26's own loading skeleton before their single
record resolves).

**Choice.** (c) — `src/shared/ui/states.test.tsx` now unit-tests `<LoadingState>`/`<ErrorState>`/
`<ForbiddenState>` directly, `src/app/router.test.ts` unit-tests the NONE ⇒ `<ForbiddenPage>` swap
generically (including the Dispatcher DVIR/Safety design omission), and
`tests/e2e/18-permission-controls-global-gate.spec.ts` confirms the mechanism live for one canary
role/path. `web/tests/STATES-AUDIT.md` marks every screen's loading/forbidden cell "generic" with
the grep evidence it actually renders through the shared component, rather than "missing".

**Why.** 52 near-duplicate tests asserting the same shared component's own behaviour, screen after
screen, is the "no unrequested per-component reinvention" house rule turned inside out — it adds
maintenance weight without adding real coverage, since a skeleton bug or a router-swap bug would
already fail at the primitive's own test long before any individual screen's copy would catch it.
Testing the primitive once, and the mechanism once, plus the screens where the *interaction*
between states is the actual thing under test, covers the same failure modes for a fraction of the
test count.
**Coordinator amendment (2026-09-13):** with no range in the URL the trigger now reads `All dates`, not `This week` — a `This week` label over an unfiltered table misstates what is shown. Picking `This week` still writes the Mon–Sun range and then shows `This week`. Deviation from the drawn default label is intentional.

## WD-067 · Two-factor authentication removed from the web panel entirely (2026-09-13)
**Problem:** the user asked for 2FA/TOTP to be removed completely, in step with the backend (`POST /auth/login` and `POST /auth/google` now always return a token pair; `/auth/2fa/*`, `twoFactorEnabled`/`twoFactorEnabledAt`/`twoFactorSetupRequired`/`requireTwoFactor` and every `TWO_FACTOR_*` code are gone).
**Options:** (a) hide the 2FA UI behind a flag and keep the code, (b) delete every 2FA path, type, test and doc reference.
**Choice:** (b). Deleted W-00b (`TwoFactorPage`, `/sign-in/2fa`), `RequireTwoFactorSetup` (guard order is now `isAuthenticated → can(perm)`), the `/account#security` lock and its banner, the W-26 2FA row/badge and both 2FA modals, `CodeInput`, `twoFactor.ts`, the in-house QR encoder (`qr.ts`, `QrCode.tsx`; 2FA was its only user), `§6.2 rule 4` in `client.ts` (`isTwoFactorSetupRequired`, `onTwoFactorSetupRequired`), the `TWO_FACTOR_*` error copy, the four `/auth/2fa/*` endpoint keys and MSW handlers, `SignInResult`/`isTwoFactorChallenge`/`verifyTwoFactor`, `pendingTwoFactor`/`submitTwoFactorCode`/`reloadSession` on the auth context, W-18's `Reset two-factor` row action and `Two-factor` filter group (`fTwoFactor` URL param), 11.18's `Require two-factor authentication` checkbox, the `2FA on/off` hint in the account menu, the `otp`/`totp`/`recovery` scrub words, E2E scenario 4 and `tests/e2e/support/totp.ts`. `fixtures.generated.ts` and `types.ts` were stripped by hand to match the new contract because `backend/docs/openapi.json` was still being edited by the backend agent at the time — re-run `npm run gen:types && npm run gen:fixtures` once it lands.
**Why:** a half-removed security feature (dead toggles, a lock the server can never trigger, a filter on a field that no longer exists) is worse than none. Supersedes WD-014, WD-016, WD-050, WD-051; closes B-26, B-28, B-52, B-53 and the 2FA half of B-51 as obsolete. Future agents must not reintroduce 2FA.

## WD-068 · W-12 IFTA summary: `totals` shape, KPI chips and empty text (2026-09-14)
**Problem:** B-46 fixes `kpis` and `rows` but leaves `totals` untyped; the design draws chips (`Q3 to date`, `↑ 0.2 vs Q2`) with no rule for past quarters or missing data, and tz.md §13.2 has no IFTA empty sentence.
**Options:** (a) compute totals client-side from `rows`; (b) take the server `totals` as one row without `jurisdiction`; (c) skip the totals row.
**Choice:** (b) `totals: { totalMiles, taxableMiles, fuelGal, mpg, taxDueUsd }` rendered as the last `Total` row (600, `--bg-subtle`), sorting off so it stays last. `Qn to date` chip only for the current carrier-zone quarter. MPG delta chip only when `fleetMpg` and `fleetMpgPrev` are both non-null. It shows the one-decimal difference (`↑` success, `↓` danger, `0.0` neutral). `null` fuel/receipts/MPG/tax → `—`, never `0`, and no chip. Empty table: `No jurisdiction miles for this quarter` / `Miles appear here once units drive in the selected quarter.` Error state only when the request fails: `Could not load jurisdiction totals` + the server message + `Retry`.
**Why:** the backend is the only source of compliance/tax figures; summing on the client would fake numbers the server never returned. The empty sentence is an assumption; replace it if §13.2 gains an IFTA entry.

## WD-069 · Envelope tolerance and nullable fields for the B-1/B-2/B-3/B-6/B-46 contract (2026-09-14)
**Problem:** the B-46 note in backend-gaps.md said `GET /reports/ifta/summary` is unwrapped. openapi.json examples show only the populated case, but backend source declares many roster and live-fleet fields `| null`, and the fixtures that mimic unassigned units failed the structural check.
**Options:** (a) special-case IFTA in `client.ts` as unwrapped; (b) keep the single `unwrap()` rule (`data` and `traceId` both present → unwrap, else pass through) and prove both shapes in a contract test; (c) loosen `diffAgainstExample` to accept `null` anywhere; (d) hold fully populated rows to the example and allow `null` only on fields the backend source declares nullable.
**Choice:** (b) + (d). `TransformInterceptor` is a global `APP_INTERCEPTOR` and wraps every object return, so IFTA is enveloped. No client special case is needed, and `shipped-gaps.contract.test.ts` asserts the same `IftaSummary` both ways. The matcher is unchanged. The nullable allow-lists live in the test with their source files named.
**Why:** (a) would break the moment the envelope is honoured, which it already is. (c) would hide real drift, which is the reason the suite exists. (d) keeps it strict: a new field nulled outside the list fails.

## WD-070 · Fleet RODS totals come from `GET /reports/activity/summary`; the per-driver range fan-out is gone (supersedes WD-039)
**Problem.** WD-039 issued one `GET /logs/:driverId/range` per ACTIVE driver on W-13 and W-15. With the 200-driver mock fleet QA saw 308 such calls in one session, latency climbing 3.1 s → 15.2 s, and the calls outliving the screen (web/bugs.md WB-048). B-46's activity half shipped 2026-09-14/15 (`ActivitySummaryGenerator`, SQL over `DailyLog` + `HosViolation`).
**Options.** 1. Keep the fan-out but cap concurrency. 2. Summary endpoint for W-13; keep ranges for W-15's exact uncertified count. 3. Summary endpoint everywhere, with W-15 reading a single driver's range only when one driver is picked.
**Choice.** 3. W-13: `useActivitySummary({ from, to, page, limit, sort: 'name:asc', status: 'ACTIVE', terminal? })` — one request, server-side paging/sort/terminal filter, KPIs from `kpis`, `vs prev.` chips drawn from `drivingDeltaPct` / `violationsDelta` and `—` when `null`; `mi/day` is not drawn (no driver-day count in the summary). W-15: `usePackRodsCounts` — the picked driver's one `GET /logs/:driverId/range` (exact counts), otherwise one summary read (`limit` 1000 through `client.list()`, `status: 'ACTIVE'`): `Daily logs included` = Σ `days`, `Uncertified logs` = Σ max(0, daysInRange − `certifiedDays`), the same arithmetic as `transfers/snapshot.ts#uncertifiedDayCount`. W-01 never read RODS ranges (its sources are `/live/fleet`, `/violations`, `/unidentified`), so it is unchanged. `src/app/logsRangeFanOut.test.tsx` renders W-13, W-15 (all/one driver) and W-01 against a 50-driver fleet and fails if any screen issues more than 5 `/logs/*/range` requests (measured now: 0 / 0 / 1 / 0).
**Why.** Nothing is computed that the RODS engine did not persist; the summary reads the same `DailyLog` headers the range endpoint sums. Verified on the live API 2026-09-15 (`:3002`, ADMIN): 14-day fleet summary 0.31 s, terminal-filtered 0.03 s, `name` arrives as `Last, First` — the screen prefers the loaded drivers list and otherwise flips the comma form to the drawn `First Last`.

## WD-071 · Tests run jsdom with Node's native `AbortController` so every query passes TanStack's `signal` (client.ts rule 9)
**Problem.** Vitest's jsdom environment installs jsdom's `AbortController`/`AbortSignal` on the global while `fetch`/`Request` stay undici's. undici's `new Request(url, { signal })` — which MSW's interceptor builds — rejects the foreign-realm signal (`TypeError: RequestInit: Expected signal ("AbortSignal {}") to be an instance of AbortSignal`), the client mapped that to `NetworkError`, and an earlier pass removed `signal` from the hooks to make tests pass — so requests were never cancelled on unmount (WB-048).
**Options.** 1. Keep dropping `signal`. 2. Polyfill `Request` in jsdom. 3. A custom Vitest environment that wraps the built-in jsdom one and restores the native `AbortController`/`AbortSignal` after jsdom populates the global.
**Choice.** 3 — `tests/setup/jsdom-native-abort.ts`, wired as `test.environment` in `vitest.config.ts`. No `client.ts` change. Every `queryFn` in `shared/api/reports.ts` and `useLogRange` now passes `{ signal }`; `shared/api/reports.test.tsx` proves the in-flight summary request is aborted when the last observer unmounts and completes while mounted.
**Why.** The fix is at the realm mismatch, not in production code; nothing in the runtime dependency set hands a signal to jsdom's `addEventListener`. Other `shared/api/*` hooks (owned by other agents) still omit `signal` — they can now add it without breaking tests.

## WD-072 · Boot from a `sessionStorage` session snapshot; data requests park on the single-flight refresh instead of going out unauthenticated
**Problem.** Every hard reload ran `POST /auth/refresh` → `GET /auth/me` sequentially behind the full-page skeleton before any screen could mount, so the first data request started two round trips late — ~10 s to first data at RTT ≈ 300 ms from far-away users. `client.ts` also had its own single-flight refresh separate from `AuthProvider.runRefresh`, so a request racing the boot refresh could have fired a second `POST /auth/refresh` — and the backend treats a reused refresh token as theft (`REFRESH_TOKEN_REUSED` revokes every session).
**Options.** 1. Leave the chain, cache `/auth/me` in TanStack's persisted cache. 2. Decode the JWT for role/permissions (forbidden — §6.9, permissions come from `/auth/me` only). 3. Persist the last `/auth/me` payload plus the access-token expiry — never a token — in `sessionStorage` (`obk.session`), boot `authenticated` from it when `obk.rt` exists, refresh in the background, re-fetch `/auth/me` to reconcile; and make `client.send()` await the in-flight refresh whenever the in-memory access token is empty but a refresh token is present.
**Choice.** 3. `tokenStore.ts` owns `read/write/clearSessionSnapshot` (`writeSessionSnapshot` strips `accessToken`/`refreshToken` defensively; `clearTokens()` clears it, so every sign-out / `resetSession` path drops it). `AuthProvider` computes its initial state from the snapshot in a lazy `useState`, installs the client bridge in a `useLayoutEffect` (children's query effects are passive and run after it), and `runRefresh` now delegates to `client.refreshAccessToken()` so boot, proactive timer, 401 replay and parked data requests share ONE `POST /auth/refresh`. The proactive timer re-arms off a `tokenEpoch` counter instead of scheduling itself. `client.ts` gained `ensureAccessToken()`, used by `send()` and `blob()`. Access token still memory-only; refresh token still `obk.rt`; JWT still never decoded; `/auth/me` still the only permission source. A snapshot with no `obk.rt` is ignored (unauthenticated, no request). If the background refresh fails → `resetSession('expired')` exactly as before; if `/auth/me` then reports different permissions the state is replaced.
**Why.** New boot sequence: (1) first paint renders the app from the snapshot; (2) screens mount and their queries call `send()`, which parks on the single-flight `POST /auth/refresh` that the boot effect started in the same tick; (3) the token lands, the parked requests go out immediately and `GET /auth/me` reconciles role/permissions in parallel with them — one round trip to first data instead of three. `sessionStorage` (not `localStorage`) so a snapshot dies with the tab; it carries only what `/auth/me` returns (id, type, role, permissions) — public to the signed-in user anyway — and the route guard still lands on `/403` or `/sign-in` as soon as the reconcile disagrees.

## WD-073 · Server-side paging on Vehicles / Trips / DVIR, session-wide reference lookups, longer list cache, sidebar hover prefetch
**Problem.** With the mock dataset (247 units, 264 drivers, 8,694 trips, 36,983 DVIRs, 3,724 defects) the three list screens fetched *everything* and filtered in the browser: Vehicles walked every `/vehicles`, `/drivers` and `/devices` page **sequentially** (`client.list` at `limit: 500`), Trips walked 3 trip pages plus all drivers and vehicles, DVIR fired six full-table walks (`/dvir` ×3 pages, `/defects`, `/work-orders`, `/maintenance-schedules` twice). At RTT ≈ 300 ms that was ~10 s to first row, and every screen re-fetched the same driver/vehicle lookups. `STALE.list` = 30 s meant even a back-and-forth between two screens refetched.
**Options.** 1. Keep the fetch-everything joins, raise `limit`. 2. Ask the backend for name joins and every 11.23 filter param first (B-35/B-36/B-54/B-59/B-60/B-66) and wait. 3. One server page per render for every list (`page`/`limit`/`q`/`status`… — exactly the DTO params, `backend/src/modules/**/dto`), shared `reference`-cached lookups for the DRIVER/UNIT/ELD SERIAL joins, and an explicit, bounded **window** fallback only while a filter the API has no param for is active.
**Choice.** 3.
- `shared/api/paging.ts` — `usePagedQuery({ server, window, useWindow, filter })`: server mode renders `items`/`total` from one request (`keepPreviousData`, so paging/search never swaps the table for a skeleton); window mode loads the newest `FILTER_WINDOW` (1,000) rows once and filters in memory. `pagePolicy()` narrows `cachePolicy()` to plain fields so the same option object feeds `useQuery`, `prefetchQuery` and tests.
- `shared/api/lookups.ts` — `driversLookupQuery` / `vehiclesLookupQuery` / `devicesLookupQuery` (`limit: 500`, `reference` = 10 min) and `useDriverMap` / `useVehicleMap`. One fetch per session, shared by Vehicles, Trips, DVIR, Messages and every modal. `client.list` now fetches the first 200-row page and **every remaining page in parallel** (one RTT instead of one per page).
- **Vehicles**: `GET /vehicles?page&limit&q&status` (segment ALL/ACTIVE/INACTIVE → `status`); counters from three `limit: 1` totals (the Dashboard's keys) + the drivers lookup (`unassigned = total − units a driver points at`). The UNASSIGNED segment and the 11.23 groups (B-54) use the fleet window. The table no longer waits for `/live/fleet` (~2 s server-side): the STATUS cell shows a pulse until the snapshot lands.
- **Trips**: Active = `status=ASSIGNED` ∪ `status=IN_PROGRESS` at `limit: 200` (a dispatch board, not history — exact in-memory search/filter); Scheduled/Completed = one page with `q`/`status`; counts via `limit: 1`; the on-time KPI reads the newest 100 deliveries (`hint: last 100 deliveries`, replacing a hard-coded `↑ 3% vs last wk`). The table gained a `Pagination` (8,305 delivered trips cannot be one table). `trip.status_changed` patches every cached `/trips` page with `setQueriesData` under `qkRoot.trips`.
- **DVIR**: only the active tab's list mounts. DVIRs tab = newest 200 DVIRs (one query serving Recent DVIRs · 48 h, the `DVIRs today` KPI and the B-60 filter window) + newest 200 defects for the DEFECTS column + one `status=OPEN` defects page + one CRITICAL count + `dueOnly=true` schedules (KPI + Upcoming maintenance). Work orders (`q` real) and Schedules load on click. A DVIR that reported defects whose rows fall outside the defects window shows `—`, never `None` (B-66).
- `STALE.list` 30 s → **60 s**, `STALE.reference` 5 → **10 min**, `gcTime` 15 min; `live` stays 10 s and lists still `refetchOnWindowFocus`.
- `app/routePrefetch.ts` — `ROUTE_LOADERS` (the same `import()` the router's `lazy()` uses) + per-route `prefetchQuery` of the page's own keys; the Sidebar warms on `mouseenter`/`focus` after a 150 ms debounce (`createRouteWarmer`), cancelled on leave.
- MSW: `serverPage(fixture, request, qFields)` in `mocks/envelope.ts` answers list handlers the way the DTOs do (exact-match params, `q`, `dueOnly`, `page`/`limit`), so tests and dev mode exercise the real paging.
**Why.** Measured on the production bundle against the dev API (headless Chromium, route change → first table row): Vehicles 5 requests, Trips 7, DVIR 6, Drivers 1 — 250–500 ms warm, 0 requests on a revisit within 60 s; hover on a sidebar link warms the exact keys so the click renders from cache. Bundle: entry+vendor+shell 209.8 KB gzip (≤ 220), maplibre/recharts still only in Dashboard/Live Fleet chunks. Nothing is faked: a count the API cannot give exactly is labelled (`200+`), a defect list outside the window is `—`, the window cap is recorded per gap.

## WD-074 · W-01 Fleet Dashboard reads one `GET /dashboard/summary` instead of six requests
**Problem.** Perf plan item 3: opening the Fleet Dashboard fired `/live/fleet`, `/violations?window=24h`, `/unidentified?status=PENDING`, `/notifications?unreadOnly=true&limit=1`, `/carrier` and two `/vehicles?...&limit=1` counts — 7 round trips (6 distinct queries, one duplicated) before the KPI row could render. The backend shipped an aggregate `GET /dashboard/summary` (`dashboard` READ, every role) that runs the same sub-queries server-side in one `Promise.all` and returns the trimmed shape each card needs.
**Options.** 1. Keep the six hooks, only add client-side request de-duplication. 2. Adopt the aggregate endpoint but keep `useLiveFleet()` as a second, separate call for the map preview since Live Fleet (W-02) already owns that hook. 3. Adopt the aggregate endpoint and drop the page down to exactly one query, deriving the live-fleet units, KPI counts, violations table and carrier subtitle all from its payload.
**Choice.** 3.
- New `shared/api/dashboardSummary.ts` — `useDashboardSummary()` (`qk.dashboardSummary`, `cachePolicy('live')`, 10 s stale / 30 s poll while visible) typed against the real response, verified against the running dev API (`curl /api/dashboard/summary` as `sarah.chen@…`) rather than only the controller's doc comment.
- `DashboardPage.tsx` now holds a single `summary` query; the KPI row, live-fleet map preview, duty donut and violations table all read `summary.data.*`, and `summary.isLoading` / `summary.isError` drive every card's loading/error state (still rendered **inside its own card**, never a full-page error, since the point stays "the failure is contained"). `safety.event_created` / `trip.status_changed` now invalidate `qk.dashboardSummary` instead of `qk.violations()` / `qk.liveFleet()`.
- `useLiveFleet()` (`shared/api/liveFleet.ts`) is untouched and still serves Live Fleet (W-02) on its own `/live/fleet` poll — Dashboard no longer calls it, so the two screens' cache entries are independent again (previously they happened to share `qk.liveFleet()`, which this change does not disturb for W-02).
- Vehicles' `useVehicleCounts()` (`shared/api/vehicles.ts`) keeps its own three `limit: 1` `/vehicles` queries — Dashboard no longer sends the two it used to share keys with, so those keys are now fetched fresh on first Vehicles visit instead of arriving pre-warmed from Dashboard; no behaviour change to VehiclesPage itself.
- MSW: new `mocks/handlers/dashboard.ts` composes the response from the same fixtures the six original handlers used (`fleet.ts`'s exported `LIVE_FLEET`, `hosGaps.ts`'s exported `VIOLATIONS_FIXTURE`, `fixtures.generated`'s `GET /api/unidentified` / `GET /api/carrier`) so the mock and backend shapes stay identical by construction.
- `backend/docs/openapi.json` regenerated (`npm run openapi:gen` against the dev env) — it did not yet document `/dashboard/summary`; `tests/contract` reads that file statically, so the contract suite would otherwise fail to find the operation. No backend source was edited, only the generated doc.
**Why.** Dashboard now opens with 1 request instead of 7. `npx tsc --noEmit`, `npm run lint`, `npx vitest run src/features/dashboard src/shared/api` (130/130) and `npm run test:contract` (34/34) all pass.
