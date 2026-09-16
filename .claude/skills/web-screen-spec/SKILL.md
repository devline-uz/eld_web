---
name: web-screen-spec
description: The mandatory 10-point procedure for building or changing one OneBook ELD web screen (W-00…W-26) from tz.md §10 and its design image. Use before touching a page under src/features/, and before claiming a screen is done.
---

# One screen (tz.md §10)

Done = all ten points, not "it renders". Most screens already exist under `src/features/<name>/`
(each has a `README.md` naming its design file) — **extend the existing feature**; start by
`grep -rn` for the route in `src/app/router.tsx` and the feature folder.

## Before code (read each once)
1. `grep -n '^### W-' tz.md` → read only your `W-NN` section.
2. Open the one design image that section names (under `roles and screens/`). Image wins over prose and taste: same title, UPPERCASE column headers, button labels, badge colours, empty-state sentences — English as drawn. Skip this step only when the brief changes nothing visual.
3. `grep` the backend controller for the real path/shape (`../backend/src/modules/<m>/*.controller.ts` + DTO). `../backend/tz.md` may describe endpoints that do not exist.

## Ten points
1. **Route** in `src/app/router.tsx` with exact path/query params (§9); deep links (`/vehicles/:id`, `/hos-logs?driverId=&date=`, `/vehicles/:id/histories?date=`, `/reports/*`) restore state from the URL.
2. **Permission** — guard `isAuthenticated → can(perm)`; `NONE` ⇒ route not registered ⇒ `/403`; nav hidden per §4.2.
3. **Data** — every query via `endpoints.ts` + `qk.*`, policy from `queryPolicy.ts`; polling only while visible.
4. **Layout** — page padding 24, card 20, gap 16, KPI row 4 cols, `1fr 380px` with a right rail, rows 48/54, header 40.
5. **Header** — exact title/subtitle, breadcrumb on detail pages, actions in drawn order, role chip.
6. **Blocks** — every card/table in the §10 entry with its exact column set and order.
7. **Actions** — button → §11 overlay → endpoint → exact toast (`copy.ts`). Optimistic only where rollback is safe; never for compliance writes.
8. **States** — skeleton, own empty text verbatim (`copy.ts`/§13.2), `<ErrorState>` inside the failing card only, `<ForbiddenState>` full page.
9. **Real-time** — rooms from §7.5 via `useRoom()`; missing events → documented polling.
10. **Acceptance** — walk the ⬜ list at the end of the §10 entry item by item; report each pass/fail.

## Roles
Implement the entry's role table with `<Can>`; honour §12.2 read-only removals (absent from DOM).

## Report line
Route · permission key · endpoints · rooms · acceptance boxes passed/failed · `B-NN` gaps.
