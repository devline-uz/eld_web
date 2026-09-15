# features/drivers

Owner: `web-vehicles-drivers`.

Design files this feature is built from (`web/roles and screens/`):

- `admin panel/Driver roster with live HOS clocks and violations.jpg`
- `admin panel/Driver profile — HOS clocks, violations, logs.jpg`

Rules: this folder never imports another `features/*` (shared code moves to `src/shared/`);
URLs come from `shared/api/endpoints.ts`, query keys from `shared/api/queryKeys.ts`,
colours and sizes from the token layer only.
