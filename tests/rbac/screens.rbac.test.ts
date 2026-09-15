// owner: web-qa-a11y — sanity-checks the RBAC fixture itself against web/tz.md §12.1's own
// cross-check (26 / 21 / 14 / 16, matching the file counts under `web/roles and screens/`).
import { describe, expect, it } from 'vitest';
import { EXPECTED_SCREEN_COUNT, RBAC_SCREENS } from '../fixtures/rbacScreens';
import type { Role } from '@/shared/auth/permissions';

const ROLES: Role[] = ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER', 'VIEWER'];

describe('RBAC fixture — web/tz.md §12.1 / §22.1', () => {
  it('has exactly 26 screens, one W-NN id and one design image each', () => {
    expect(RBAC_SCREENS).toHaveLength(26);
    expect(new Set(RBAC_SCREENS.map((s) => s.id)).size).toBe(26);
    expect(new Set(RBAC_SCREENS.map((s) => s.route)).size).toBe(26);
    expect(new Set(RBAC_SCREENS.map((s) => s.designImage)).size).toBe(26);
  });

  it.each(ROLES)('role %s sees the exact screen count from §12.1', (role) => {
    const visible = RBAC_SCREENS.filter((s) => s.visibleForRole[role]).length;
    expect(visible).toBe(EXPECTED_SCREEN_COUNT[role]);
  });

  it('ADMIN sees every screen', () => {
    expect(RBAC_SCREENS.every((s) => s.visibleForRole.ADMIN)).toBe(true);
  });
});
