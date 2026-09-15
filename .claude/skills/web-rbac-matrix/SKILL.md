---
name: web-rbac-matrix
description: The 22 permission keys, 4 roles, three enforcement layers and read-only rules for the OneBook ELD web panel. Use when adding a route, nav item, button, table column or bulk action, and when writing RBAC tests.
---

# Permissions (tz.md §6.9, §12)

**Code first:** `src/shared/auth/permissions.ts` (keys, test/display copy), `usePermission.ts`,
`Can.tsx`, `src/app/guards.tsx`, `src/app/navigation.ts`; RBAC fixtures in `tests/rbac/`.
Runtime source is **only** `GET /auth/me` → `permissions` (22 keys → `NONE|READ|FULL`). The JWT is never decoded.

`can(key, level='READ')`: READ ⇒ `!== 'NONE'`; FULL ⇒ `=== 'FULL'`.

## Three layers
1. Route guard `isAuthenticated → can(perm)` (no 2FA). `NONE` ⇒ route not registered ⇒ `/403`.
2. Navigation — `NONE` ⇒ no menu item.
3. Element — `<Can perm="hosEdit" level="FULL">` around button/column/menu item.

Hidden ⇒ **absent from the DOM**, never disabled (exception: `Admin cannot be edited` chip).

## Keys
`dashboard liveFleet vehicles drivers hos hosEdit hosCertifyOnBehalf(ADMIN only: Certify all, 11.12) dvir maintenance safety trips reports reportsTransfer(Send to inspector, Generate pack, transfers) messaging devices alertRules users roles integrations auditLog support carrierSettings`.
Never hardcode a role name where a permission check works (custom roles exist).

## Nav by role (§4.2) — the design wins over the backend matrix
All four see Dashboard, Live Fleet, Vehicles, Drivers, HOS Logs, Reports, Settings.
VIEWER: no Trips, no Messages. **DISPATCHER: no DVIR, no Safety** (backend grants READ; direct URL → `/403`; backend unchanged).
Settings sub-nav: Company profile / Users / Roles & permissions / Integrations / Audit log → ADMIN · ELD devices, Alert rules → ADMIN+FM · Support → all. `/settings` → first permitted item.
Role chip: ADMIN none · FM `● Fleet manager` primary-soft · DISPATCHER `● Dispatcher` success-soft · VIEWER `● Read-only · Viewer` neutral-soft.

## Read-only (§12.2) — removed, not disabled
Removed: primary CTA (`+ Add/Create/New`, `Invite user`, `Register device`), `Import`, selection checkbox column + header checkbox, row `…` column, bulk bar, in-card actions (`Edit`, `Resolve`, `Certify all`, `Assign coaching`, `Calibrate odometer`, `New work order`, `Schedule`, `Generate report`), detail header `Edit`; toggles → static badges; remaining inputs `readOnly` on `--bg-subtle`.
Kept: nav, filters, search, sort, pagination, `Export`, `Print`, `Download PDF`, detail pages/drawers.
Bulk bar (§12.5): fixed bottom-centre, `--bg-inverse`, 56px, min 520px, FULL only; selection clears on page change; no "select all N".

## Tests
`permissions.ts` 100% (22 × 4 × 3). RBAC fixture 4 roles × 26 screens asserting visible **and absent**.
