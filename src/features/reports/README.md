# features/reports

Owner: `web-reports-transfer`.

Design files this feature is built from (`web/roles and screens/`):

- `admin panel/IFTA by jurisdiction and the report library.jpg`
- `admin panel/Reports — duty totals and distance by driver.jpg`
- `admin panel/Reports — inspection and defect history.jpg`
- `admin panel/Reports — FMCSA : DOT pack and eRODS transfer.jpg`

Rules: this folder never imports another `features/*` (shared code moves to `src/shared/`);
URLs come from `shared/api/endpoints.ts`, query keys from `shared/api/queryKeys.ts`,
colours and sizes from the token layer only.
