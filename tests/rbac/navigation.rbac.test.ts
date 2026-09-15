// owner: web-qa-a11y — web/tz.md §4.2 sidebar table, exercised against the real
// `NAV_SECTIONS` + `isNavItemVisible` from src/app/navigation.ts (not a re-implementation).
import { describe, expect, it } from 'vitest';
import { isNavItemVisible, NAV_SECTIONS, SETTINGS_NAV, firstPermittedSettingsRoute } from '@/app/navigation';
import { hasPermission, type Role } from '@/shared/auth/permissions';
import { ROLE_PERMISSIONS } from '../fixtures/rolePermissions';

const ROLES: Role[] = ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER', 'VIEWER'];

function visibleTopLevelLabels(role: Role): string[] {
  const can = (key: Parameters<typeof hasPermission>[1], level?: 'READ' | 'FULL') =>
    hasPermission(ROLE_PERMISSIONS[role], key, level);
  return NAV_SECTIONS.flatMap((section) =>
    section.items.filter((item) => isNavItemVisible(item, can, role)).map((item) => item.label),
  );
}

// web/tz.md §4.2 — the exact sidebar per role.
const EXPECTED: Record<Role, string[]> = {
  ADMIN: [
    'Dashboard',
    'Live Fleet',
    'Vehicles',
    'Drivers',
    'Dispatch & Trips',
    'HOS Logs',
    'DVIR & Maintenance',
    'Safety',
    'Reports',
    'Messages',
    'Settings',
  ],
  FLEET_MANAGER: [
    'Dashboard',
    'Live Fleet',
    'Vehicles',
    'Drivers',
    'Dispatch & Trips',
    'HOS Logs',
    'DVIR & Maintenance',
    'Safety',
    'Reports',
    'Messages',
    'Settings',
  ],
  DISPATCHER: [
    'Dashboard',
    'Live Fleet',
    'Vehicles',
    'Drivers',
    'Dispatch & Trips',
    'HOS Logs',
    'Reports',
    'Messages',
    'Settings',
  ],
  VIEWER: [
    'Dashboard',
    'Live Fleet',
    'Vehicles',
    'Drivers',
    'HOS Logs',
    'DVIR & Maintenance',
    'Safety',
    'Reports',
    'Settings',
  ],
};

describe('Sidebar navigation — web/tz.md §4.2', () => {
  it.each(ROLES)('%s sees exactly its §4.2 sidebar, in order', (role) => {
    expect(visibleTopLevelLabels(role)).toEqual(EXPECTED[role]);
  });

  it('Dispatcher never sees DVIR & Maintenance or Safety even though the backend grants READ', () => {
    expect(visibleTopLevelLabels('DISPATCHER')).not.toContain('DVIR & Maintenance');
    expect(visibleTopLevelLabels('DISPATCHER')).not.toContain('Safety');
  });

  it('Viewer never sees Dispatch & Trips or Messages (NONE)', () => {
    expect(visibleTopLevelLabels('VIEWER')).not.toContain('Dispatch & Trips');
    expect(visibleTopLevelLabels('VIEWER')).not.toContain('Messages');
  });

  it('Settings is always visible (every role has at least Support)', () => {
    for (const role of ROLES) expect(visibleTopLevelLabels(role)).toContain('Settings');
  });
});

describe('Settings sub-nav — web/tz.md §4.6', () => {
  const can = (role: Role) => (key: Parameters<typeof hasPermission>[1], level?: 'READ' | 'FULL') =>
    hasPermission(ROLE_PERMISSIONS[role], key, level);

  it('/settings redirects ADMIN to company, FM to devices, DISPATCHER/VIEWER to support', () => {
    expect(firstPermittedSettingsRoute(can('ADMIN'), 'ADMIN')).toBe('/settings/company');
    expect(firstPermittedSettingsRoute(can('FLEET_MANAGER'), 'FLEET_MANAGER')).toBe(
      '/settings/devices',
    );
    expect(firstPermittedSettingsRoute(can('DISPATCHER'), 'DISPATCHER')).toBe('/settings/support');
    expect(firstPermittedSettingsRoute(can('VIEWER'), 'VIEWER')).toBe('/settings/support');
  });

  it('only ADMIN sees Company profile, Users, Roles, Integrations, Audit log', () => {
    const adminOnly = ['Company profile', 'Users', 'Roles & permissions', 'Integrations', 'Audit log'];
    for (const label of adminOnly) {
      const item = SETTINGS_NAV.find((i) => i.label === label)!;
      expect(isNavItemVisible(item, can('ADMIN'), 'ADMIN')).toBe(true);
      expect(isNavItemVisible(item, can('FLEET_MANAGER'), 'FLEET_MANAGER')).toBe(false);
      expect(isNavItemVisible(item, can('DISPATCHER'), 'DISPATCHER')).toBe(false);
      expect(isNavItemVisible(item, can('VIEWER'), 'VIEWER')).toBe(false);
    }
  });

  it('Support is visible to every role', () => {
    const support = SETTINGS_NAV.find((i) => i.label === 'Support')!;
    for (const role of ROLES) expect(isNavItemVisible(support, can(role), role)).toBe(true);
  });
});
