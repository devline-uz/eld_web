# features/hos-logs

Owner: `web-hos-logs`.

Design files this feature is built from (`web/roles and screens/`):

- `admin panel/24-hour ELD graph grid, available hours, certification.jpg`

Rules: this folder never imports another `features/*` (shared code moves to `src/shared/`);
URLs come from `shared/api/endpoints.ts`, query keys from `shared/api/queryKeys.ts`,
colours and sizes from the token layer only.

## What lives here (Phase 4, W-08 + 11.11–11.13)

| File | Role |
|---|---|
| `HosLogsPage.tsx` | W-08 · `/hos-logs?driverId=&date=`, perm `hos` READ. Rooms `driver:{id}` + `violations`; `eld.events_ingested` → invalidate `logDay`/`logEvents`; `HOS_LOGS_POLL_MS` stands in for the missing `hos.updated` event. |
| `grid.ts` | The pure maths behind the grid — geometry, DST day start, segment/violation/unassigned plotting, totals, tooltip, spoken summary. No React, 100% line-covered. |
| `components/GraphGrid.tsx` | The hand-built §395.8(g) SVG. |
| `components/{AvailableHours,Violations,Certification,LogEvents}Card.tsx` | The four W-08 blocks. |
| `components/{RequestLogEdit,CertifyLogs,UnassignedDriving}Modal.tsx` | 11.11 / 11.12 / 11.13. |

Hard rules this feature is held to:

- **Every** timestamp is in `driver.homeTerminalTimezone`; `formatLocal` is an ESLint error here.
- `Certify all` and 11.12 need `hosCertifyOnBehalf` FULL — **ADMIN only** (web/decisions.md WD-031).
- `Add / edit event`, `Request an edit`, `Resolve` and the unassigned actions need `hosEdit` FULL;
  a dispatcher sees the unassigned chip but it is not a button.
- `DRIVING_TIME_IMMUTABLE` is rendered verbatim and never retried or worked around.
- `Log events` defaults to `recordStatus = 1`; the checkbox reveals superseded/proposed/rejected.
  The audit trail is never hidden and never the default.
