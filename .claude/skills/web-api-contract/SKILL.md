---
name: web-api-contract
description: OneBook ELD web API layer contract — base URL, envelope, the nine client.ts rules, query-key factory, cache policy, contract tests, backend gaps. Use before writing any fetch, hook, mutation or MSW handler.
---

# API layer (tz.md §6.1–6.4)

**Code is the source of truth — grep it before reading further:** `src/shared/api/client.ts`,
`endpoints.ts`, `queryKeys.ts` (`qk`), `queryPolicy.ts` (cache policy), `errors.ts`,
`types.ts` (generated from `../backend/docs/openapi.json`), per-domain hooks (`vehicles.ts`, `hosLogs.ts`…).
MSW handlers live in `src/mocks/`; contract tests in `tests/contract/`.

## Rules
- Real URL is `/api/<resource>` — **unversioned**, prefix from `VITE_API_BASE_URL` (dev `http://localhost:3002/api`). Paths in `endpoints.ts` carry no prefix. Never hardcode `/v1`.
- Envelope: success `{ data, traceId, timestamp }` (client unwraps `data`); error `{ statusCode, code, message, details, traceId }`; lists `{ items, page, limit, total, totalPages }` via `?page&limit&sort=field:asc|desc&q=`, `limit` ≤ 200.
- `client.ts` nine rules: (1) `credentials:'omit'` + Bearer · (2) `401 TOKEN_EXPIRED` → **single-flight** `POST /auth/refresh` then replay · (3) refresh 401 → `signOut()` → `/sign-in?reason=expired` · (4) retired (no 2FA) · (5) plain `403` → `<ForbiddenState>`, **no toast** · (6) `422` → `details` into `setError`, unmapped → banner · (7) 5xx/network → toast + `Retry`, only `GET` retries (1 s, 3 s) · (8) `X-Client-Version` header · (9) `AbortController` on unmount.
- Query keys only from `qk`. Add a new key to the factory; never write an array inline.
- Cache policy (add new entries to `queryPolicy.ts`): `me/carrier/roles` 5 min · lists 30 s · Live Fleet/Dashboard 10 s + 30 s poll · HOS day 15 s (invalidated by `eld.events_ingested`) · report status 0 + 3 s until `READY/FAILED` · transfer 0 + 5 s until terminal · audit/reports 60 s · open conversation 0, WS only. Every `refetchInterval` gated on `visibilityState === 'visible'`; `refetchOnWindowFocus` on lists.
- Backend already returns imperial + rounded; the client never converts or rounds.
- Error codes map 1:1 to backend `ERROR_CODES` (§14.3) with exact user strings; unknown → `Something went wrong. Reference: <traceId>`.
- Every endpoint the app calls gets an MSW handler validated against `openapi.json`. A contract test failing on schema drift is doing its job — never loosen it.

## Missing endpoint
Look up the `B-NN` id in `tz.md` §20 (blocking: B-1 `GET /drivers/roster`, B-2 `GET /drivers/:id/hos`, B-3 `GET /live/fleet`, B-4 `GET /vehicles/:id/histories`, B-5 `GET /vehicles/:id/activities`, B-6 `GET /violations` + `POST /violations/:id/resolve`). Record in `backend-gaps.md`, stub in MSW against the documented shape, say so in the report. Never edit `../backend/`.
