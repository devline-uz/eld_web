---
name: web-testing-gates
description: Test strategy, coverage gates, the 16 mandatory E2E scenarios, accessibility, performance budgets and CI for the OneBook ELD web panel. Use when writing tests, wiring CI, or deciding whether a screen is done.
---

# Gates (tz.md §15–§18)

**Code first:** `vitest.config.ts` (thresholds), `vitest.contract.config.ts`, `tests/{contract,rbac,e2e,visual,fixtures,setup}`,
`playwright.config.ts`, `scripts/check-bundle-budget.mjs`, `tests/README.md`. Run only the
touched files (`npx vitest run <path>`); the full pipeline once, at the end, when the brief asks.

## Coverage gates (enforced in config — never weakened)
`shared/format` **100%** · `shared/auth/permissions` **100%** · other units ≥ 80% · lint 0 warnings · 0 type errors.
Component: DataTable sort/pagination/selection, HosMeter thresholds, Modal focus trap, EmptyState.
Contract: every endpoint vs `openapi.json` (MSW). RBAC: 4 roles × 26 screens, visible **and absent**.
A11y: axe 0 critical/serious per screen. Visual: Playwright screenshots compared by hand to `roles and screens/` (not pixel-diffed).
CI order: `npm ci → typecheck → lint → test:unit → test:contract → build (budget) → playwright`.

## 16 E2E scenarios (§18.1) — all mandatory
1 dev-mode sign-in for 4 accounts + `Demo accounts` link · 2 prod Google sign-in, `USER_NOT_INVITED` banner, redirect fallback · 3 **`dist/` contains no `Developer sign-in`** · 4 retired (no 2FA) · 5 sidebar per role = §4.2 · 6 Add driver (email required/unique) · 7 Add/edit/delete unit with confirm text · 8 CSV import 38 rows summary · 9 HOS: driver → date → grid → log edit → `DRIVING_TIME_IMMUTABLE` shown · 10 `Certify all` ADMIN only · 11 unassigned: assign 2 → toast → counter −2 · 12 FMCSA pack → test-mode banner → `Test only` row · 13 `trip.status_changed` updates row · 14 offline banner/disable/refetch · 15 Viewer sees no write control on its 16 screens · 16 SMS never clickable, never sent.

## A11y (WCAG 2.1 AA)
Contrast ≥ 4.5:1 (`--text-muted` only for secondary > 12px, never sole meaning) · colour never the only signal · keyboard everywhere, `Enter` opens a row · visible focus · `Skip to content` · landmarks `<nav aria-label="Main">`, `<main>`, `<aside aria-label="Context">` · real `<table>` with `<th scope>`, `aria-sort`, sr-only caption · toast `role="status"`, errors `role="alert"` · every input labelled, icon buttons `aria-label` · Live Fleet left column = keyboard equivalent of the map · 24-hour grid `role="img"` + summary + sr-only table · `prefers-reduced-motion` · no clipping at 200%.

## Performance (§16)
Gzip: entry+vendor+shell ≤ 220 KB · route chunk ≤ 90 KB · MapLibre ≤ 250 KB lazy · Recharts ≤ 120 KB lazy · total ≤ 1.2 MB — build fails over budget. Runtime: login LCP < 1.5 s · dashboard warm < 1 s / cold < 2.5 s · route < 300 ms · modal < 100 ms · 69 markers < 1.5 s · WS→UI < 200 ms · grid < 50 ms. Route-level `React.lazy`; virtualise only > 500 rows; GeoJSON markers; `setQueryData` patches; `React.memo` only after measuring.

## Security (§17)
CSP `default-src 'self'; script-src 'self'; frame-ancestors 'none'` + tile/API/WS hosts · `dangerouslySetInnerHTML` lint error · tokens never in URL · logout clears tokens, `queryClient.clear()`, socket disconnect · 30 min idle → 60 s warning → logout · presigned URLs never logged/cached · Sentry `beforeSend` masks token/email/VIN/CDL · no `console.log` in prod · `npm audit --production`, high+ fails.

Never weaken a failing gate. Paste failing assertions verbatim.
