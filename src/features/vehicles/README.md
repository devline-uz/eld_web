# features/vehicles

Owner: `web-vehicles-drivers`.

Design files this feature is built from (`web/roles and screens/`):

- `admin panel/Unit inventory — ELD serial, VIN, odometer.jpg`
- `admin panel/Unit profile — telemetry, details, activity log.jpg`
- `admin panel/Route replay, drive : stop : idle segments.jpg`

Rules: this folder never imports another `features/*` (shared code moves to `src/shared/`);
URLs come from `shared/api/endpoints.ts`, query keys from `shared/api/queryKeys.ts`,
colours and sizes from the token layer only.
