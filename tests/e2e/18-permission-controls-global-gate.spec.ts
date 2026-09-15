// web/tz.md §12.2 / §22 — global gate audit: a permission-less write control is **absent from
// the DOM**, never rendered disabled. This is the 4-role × 26-screen table-driven sweep the
// per-screen feature tests and scenario 15 (Viewer only) don't add up to on their own: for every
// (role, screen) pair where the screen is visible but the role's permission level for that
// screen is READ (not FULL), every §12.2 write control must be absent. NONE-level pairs are
// covered by RBAC_SCREENS.visibleForRole itself (the route is not even registered — see
// tests/rbac/navigation.rbac.test.ts) and are re-asserted here as one canary screen per role
// rather than all 26, to keep this spec's runtime reasonable. `buildRoutes` swaps the feature
// element for `<ForbiddenPage>` in place at the same URL (src/app/router.tsx `toRouteObject`,
// unit-tested generically in src/app/router.test.ts) — it does not redirect to a `/403` route.
//
// Documented exceptions (control stays in the DOM at READ level — do not add to the absence list):
//   - W-24 Settings · Support `+ New ticket` and W-25 Feedback `Send feedback` — every role,
//     including a READ-level Viewer, may file its own ticket/feedback (§21.4, web/backend-gaps.md
//     B-12). `assertNoWriteControls` already carves the CTA regex around `New ticket`; `Send
//     feedback` never matches the Add/Create/New/Register/Invite CTA regex or the in-card action
//     list in the first place, so no further exclusion is needed.
import { test, expect } from '@playwright/test';
import { authStatePath, keepAuthStateFresh, signInAsDev, type DemoRole } from './support/auth';
import { assertNoWriteControls } from './support/rbacControls';
import { RBAC_SCREENS } from '../fixtures/rbacScreens';
import { ROLE_PERMISSIONS, type Role } from '@/shared/auth/permissions';

const ROLES: Role[] = ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER', 'VIEWER'];

// One screen per role known to be `NONE` for that role, to assert the guard order still lands
// on `/403` rather than a silently-disabled page. (Full NONE coverage is the nav/route fixture's
// job, not this spec's.)
const NONE_CANARY: Partial<Record<Role, string>> = {
  FLEET_MANAGER: '/settings/users',
  DISPATCHER: '/dvir',
  VIEWER: '/trips',
};

for (const role of ROLES) {
  test.describe(`Global gate audit — ${role}`, () => {
    test.use({ storageState: authStatePath(role) });
    keepAuthStateFresh(role);

    const readOnlyScreens = RBAC_SCREENS.filter((s) => {
      if (!s.visibleForRole[role] || s.route.includes(':id') || !s.perm) return false;
      const level = ROLE_PERMISSIONS[role][s.perm];
      return level === 'READ';
    });

    for (const screen of readOnlyScreens) {
      test(`${screen.id} ${screen.label} — write controls absent (READ, not FULL)`, async ({ page }) => {
        await page.goto(screen.route);
        await page.waitForLoadState('networkidle').catch(() => {});
        await assertNoWriteControls(page, `${role} ${screen.id} ${screen.label}`);
      });
    }

    const canary = NONE_CANARY[role];
    if (canary) {
      test(`NONE-level route ${canary} renders <ForbiddenPage> in place (no chunk import)`, async ({ page }) => {
        // `buildRoutes` (src/app/router.tsx `toRouteObject`) swaps the feature element for
        // `<ForbiddenPage>` at the same path — it does not navigate to a separate `/403` URL.
        await page.goto(canary);
        // web/bugs.md WB-035 — a concurrent spec run (this project's other agents share the same
        // demo accounts and the same persisted `tests/.auth/*.json`) can rotate this role's
        // refresh token out from under an otherwise-valid storageState between the moment it was
        // written and this navigation. Re-authenticate once, live, rather than fail the whole
        // canary on an unrelated session race.
        if (await page.getByText(/session has expired/i).isVisible().catch(() => false)) {
          await signInAsDev(page, role as DemoRole);
          await page.goto(canary);
        }
        await expect(page.getByText(/do not have access to this page/i)).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`${canary}$`));
      });
    }
  });
}
