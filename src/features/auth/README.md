# features/auth

Owner: `web-auth-rbac`.

Design files this feature is built from (`web/roles and screens/`):

- `sheets, modals, drawers, menus/Sign in — split brand panel with SSO.jpg`

Rules: this folder never imports another `features/*` (shared code moves to `src/shared/`);
URLs come from `shared/api/endpoints.ts`, query keys from `shared/api/queryKeys.ts`,
colours and sizes from the token layer only.

Sign-in is a single step: the token pair arrives directly (`web/decisions.md` WD-067).
