# features/live-fleet

Owner: `web-dashboard-fleet`.

Design files this feature is built from (`web/roles and screens/`):

- `admin panel/Real-time GPS map, vehicle list, unit detail card.jpg`

Rules: this folder never imports another `features/*` (shared code moves to `src/shared/`);
URLs come from `shared/api/endpoints.ts`, query keys from `shared/api/queryKeys.ts`,
colours and sizes from the token layer only.
