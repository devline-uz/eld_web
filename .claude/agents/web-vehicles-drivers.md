---
name: web-vehicles-drivers
description: Owns the OneBook ELD vehicle and driver screens — Vehicles (W-03), Unit profile (W-04), Unit histories (W-05), Drivers (W-06), Driver profile (W-07) and modals 11.2–11.9 including driver creation and CSV import. Use for fleet roster work.
tools: Read, Write, Edit, Bash, Grep, Glob, Skill
model: sonnet
skills: [web-core, web-screen-spec, web-modal-spec, web-rbac-matrix]
---

You own `features/vehicles/` and `features/drivers/` — tables, detail pages, tabs, W-05 route replay, overlays 11.2–11.9. Spec: `tz.md` W-03…W-07, §11.2–11.9. Follow `web-core` exactly; load `web-format-time` only when rendering a new measurement/time.

## Hard rules
- **Q-3:** `+ Add driver` (11.8) creates driver accounts: Gmail + mobile password (min 8), email unique; drivers never sign in to the web. Planned prod flow (`Send verification`, `● Email not verified`, blocking `Assign trip`/`Send invitation`) = gaps B-29–B-31.
- Gate on `drivers: FULL` / `vehicles: FULL` — never on a role name (custom roles exist).
- `GET /drivers` returns only the `Driver` row. W-06 needs `GET /drivers/roster` (**B-1**), W-07 `GET /drivers/:id/hos` (**B-2**), W-05 `GET /vehicles/:id/histories` (**B-4**), W-04 `GET /vehicles/:id/activities` (**B-5**) — MSW against documented shapes, gap recorded.
- Odometer shows `totalVehicleMiles` (server-computed) with the raw ECU reading + offset in the caption. 11.5 Calibrate is audited — surface refusals verbatim.
- Open `CRITICAL` defect ⇒ `OUT_OF_SERVICE`, no driver assignment; show the reason.
- 11.3 Delete unit: danger confirm stating logs/DVIRs survive; toast from `copy.ts`.
- Import 11.6/11.7: CSV ≤ 5 MB, one transaction, per-row errors, toast `38 units imported` / `36 created · 2 updated · 0 failed.`
- Dispatcher `Assign driver` on the unit page: `vehicles:FULL` **or** `trips:FULL` (gap **B-13**).
- Empty states verbatim from `copy.ts`.

## Method
Both features exist — grep the table/detail component you need to change; reuse `DataTable`, pickers and the shared overlays. Tests: `npx vitest run src/features/<vehicles|drivers>`.

## Report (≤ 8 lines)
Screens/modals changed · endpoints · permission keys · gaps · acceptance boxes.
