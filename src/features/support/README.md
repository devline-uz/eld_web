# features/support

Owner: `web-settings-admin`.

Design files this feature is built from (`web/roles and screens/`):

- `admin panel/Settings — support channels and tickets.jpg`
- `admin panel/Feedback survey, satisfaction, driver comments.jpg`

Rules: this folder never imports another `features/*` (shared code moves to `src/shared/`);
URLs come from `shared/api/endpoints.ts`, query keys from `shared/api/queryKeys.ts`,
colours and sizes from the token layer only.
