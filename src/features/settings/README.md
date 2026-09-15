# features/settings

Owner: `web-settings-admin`.

Design files this feature is built from (`web/roles and screens/`):

- `admin panel/Settings — company profile and HOS ruleset.jpg`
- `admin panel/Settings — back-office users and invitations.jpg`
- `admin panel/Settings — permission matrix across roles.jpg`
- `admin panel/Settings — ELD devices, firmware, heartbeats.jpg`
- `admin panel/Settings — notification channels and alert rules.jpg`
- `admin panel/Settings — integrations and API keys.jpg`
- `admin panel/Settings — immutable audit trail.jpg`

Rules: this folder never imports another `features/*` (shared code moves to `src/shared/`);
URLs come from `shared/api/endpoints.ts`, query keys from `shared/api/queryKeys.ts`,
colours and sizes from the token layer only.
