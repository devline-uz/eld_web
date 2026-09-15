# features/account

Owner: `web-auth-rbac`.

Design files this feature is built from (`web/roles and screens/`):

- `admin panel/Personal account — profile, security, sessions.jpg`

Rules: this folder never imports another `features/*` (shared code moves to `src/shared/`);
URLs come from `shared/api/endpoints.ts`, query keys from `shared/api/queryKeys.ts`,
colours and sizes from the token layer only.

## W-26 status (web-auth-rbac, 2026-09-13)

- `AccountPage.tsx` — `/account`, every role, no permission key. Three cards with scroll anchors
  `#profile`, `#security`, `#notifications`, `#language`, `#sessions` (scroll + focus on load).
  `#notifications` and `#language` are read-only anchored cards until B-11 `/me/preferences` (WD-061).
- Real endpoints: `GET/PATCH /me/profile`, `GET /me/sessions`, `DELETE /me/sessions/:id`.
- Gaps: B-50 sessions (`current`, location, `refreshHash` leak, revoke-all), B-51 profile
  (`jobTitle` PATCH, avatar).
- Security card shows the sign-in method only; see `web/decisions.md` WD-067 before adding anything to it.
- Decisions WD-048, WD-049, WD-052, WD-061, WD-067; bugs WB-034, WB-036.
