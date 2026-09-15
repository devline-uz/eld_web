# features/dashboard

Owner: `web-dashboard-fleet`.

Design files this feature is built from (`web/roles and screens/`):

- `admin panel/Fleet overview — KPIs, live map, duty mix, violation feed.jpg`

Rules: this folder never imports another `features/*` (shared code moves to `src/shared/`);
URLs come from `shared/api/endpoints.ts`, query keys from `shared/api/queryKeys.ts`,
colours and sizes from the token layer only.
