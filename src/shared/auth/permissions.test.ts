// owner: web-auth-rbac — web/tz.md §6.9 / §18: `shared/auth/permissions.ts` is a 100% coverage
// gate. 22 keys × 4 roles × 3 levels, plus every helper branch.
import { describe, expect, it } from 'vitest';
import {
  NO_PERMISSIONS,
  PERMISSION_KEYS,
  ROLE_LABEL,
  ROLE_PERMISSIONS,
  hasPermission,
  isPermissionKey,
  isRole,
  toPermissionMap,
  type PermissionKey,
  type PermissionLevel,
  type PermissionMap,
  type Role,
} from './permissions';

const ROLES: Role[] = ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER', 'VIEWER'];
const LEVELS: PermissionLevel[] = ['NONE', 'READ', 'FULL'];

describe('the 22 permission keys', () => {
  it('is exactly the §6.9 key list, in order, with no duplicates', () => {
    expect(PERMISSION_KEYS).toEqual([
      'dashboard',
      'liveFleet',
      'vehicles',
      'drivers',
      'hos',
      'hosEdit',
      'hosCertifyOnBehalf',
      'dvir',
      'maintenance',
      'safety',
      'trips',
      'reports',
      'reportsTransfer',
      'messaging',
      'devices',
      'alertRules',
      'users',
      'roles',
      'integrations',
      'auditLog',
      'support',
      'carrierSettings',
    ]);
    expect(new Set(PERMISSION_KEYS).size).toBe(22);
  });

  it('NO_PERMISSIONS denies all 22 keys', () => {
    for (const key of PERMISSION_KEYS) {
      expect(NO_PERMISSIONS[key]).toBe('NONE');
      expect(hasPermission(NO_PERMISSIONS, key)).toBe(false);
      expect(hasPermission(NO_PERMISSIONS, key, 'FULL')).toBe(false);
    }
  });
});

describe('hasPermission — 22 keys × 3 levels', () => {
  for (const key of PERMISSION_KEYS) {
    for (const level of LEVELS) {
      it(`${key} @ ${level}`, () => {
        const map: PermissionMap = { ...NO_PERMISSIONS, [key]: level };
        // READ is the default level and means "not NONE"; FULL means exactly FULL.
        expect(hasPermission(map, key)).toBe(level !== 'NONE');
        expect(hasPermission(map, key, 'READ')).toBe(level !== 'NONE');
        expect(hasPermission(map, key, 'FULL')).toBe(level === 'FULL');
      });
    }
  }
});

describe('the role matrix — 4 roles × 22 keys', () => {
  for (const role of ROLES) {
    it(`${role} declares all 22 keys with a valid level`, () => {
      const map = ROLE_PERMISSIONS[role];
      expect(Object.keys(map).sort()).toEqual([...PERMISSION_KEYS].sort());
      for (const key of PERMISSION_KEYS) expect(LEVELS).toContain(map[key]);
    });
  }

  it('ADMIN is FULL on all 22 keys', () => {
    for (const key of PERMISSION_KEYS) expect(ROLE_PERMISSIONS.ADMIN[key]).toBe('FULL');
  });

  it('hosCertifyOnBehalf is ADMIN-only (Certify all, 11.12)', () => {
    expect(hasPermission(ROLE_PERMISSIONS.ADMIN, 'hosCertifyOnBehalf', 'FULL')).toBe(true);
    for (const role of ['FLEET_MANAGER', 'DISPATCHER', 'VIEWER'] as const) {
      expect(ROLE_PERMISSIONS[role].hosCertifyOnBehalf).toBe('NONE');
    }
  });

  it('VIEWER is never FULL anywhere (§12.2 read-only)', () => {
    for (const key of PERMISSION_KEYS) expect(ROLE_PERMISSIONS.VIEWER[key]).not.toBe('FULL');
  });

  it('matches the live GET /auth/me of the four demo accounts (2026-09-12)', () => {
    // FLEET_MANAGER — no users/roles/integrations/auditLog/carrierSettings, no certify-on-behalf.
    expect(ROLE_PERMISSIONS.FLEET_MANAGER.reportsTransfer).toBe('FULL');
    expect(ROLE_PERMISSIONS.FLEET_MANAGER.users).toBe('NONE');
    // DISPATCHER — trips FULL, reportsTransfer NONE, hosEdit NONE.
    expect(ROLE_PERMISSIONS.DISPATCHER.trips).toBe('FULL');
    expect(ROLE_PERMISSIONS.DISPATCHER.reportsTransfer).toBe('NONE');
    expect(ROLE_PERMISSIONS.DISPATCHER.hosEdit).toBe('NONE');
    // VIEWER — no trips, no messaging, support READ only.
    expect(ROLE_PERMISSIONS.VIEWER.trips).toBe('NONE');
    expect(ROLE_PERMISSIONS.VIEWER.messaging).toBe('NONE');
    expect(ROLE_PERMISSIONS.VIEWER.support).toBe('READ');
  });

  it('labels every role; ADMIN has a label but no topbar chip (§4.4)', () => {
    for (const role of ROLES) expect(ROLE_LABEL[role]).toBeTruthy();
    expect(ROLE_LABEL.VIEWER).toBe('Viewer');
  });
});

describe('guards', () => {
  it('isRole accepts the four roles and rejects anything else', () => {
    for (const role of ROLES) expect(isRole(role)).toBe(true);
    expect(isRole('SUPERUSER')).toBe(false);
    expect(isRole(null)).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(7)).toBe(false);
  });

  it('isPermissionKey accepts the 22 keys and rejects anything else', () => {
    for (const key of PERMISSION_KEYS) expect(isPermissionKey(key)).toBe(true);
    expect(isPermissionKey('billing')).toBe(false);
    expect(isPermissionKey(null)).toBe(false);
    expect(isPermissionKey(42)).toBe(false);
  });
});

describe('toPermissionMap — whatever GET /auth/me sent', () => {
  it('keeps the 22 known keys with their level', () => {
    expect(toPermissionMap(ROLE_PERMISSIONS.DISPATCHER)).toEqual(ROLE_PERMISSIONS.DISPATCHER);
  });

  it('defaults a missing key to NONE and never invents a permission', () => {
    const map = toPermissionMap({ dashboard: 'FULL' });
    expect(map.dashboard).toBe('FULL');
    expect(map.users).toBe('NONE');
    expect(Object.keys(map)).toHaveLength(22);
  });

  it('drops unknown keys and unknown levels', () => {
    const map = toPermissionMap({ billing: 'FULL', hos: 'SUPER', dvir: 'READ' });
    expect((map as Record<string, unknown>).billing).toBeUndefined();
    expect(map.hos).toBe('NONE');
    expect(map.dvir).toBe('READ');
  });

  it('survives null and undefined', () => {
    expect(toPermissionMap(null)).toEqual(NO_PERMISSIONS);
    expect(toPermissionMap(undefined)).toEqual(NO_PERMISSIONS);
  });

  it('never mutates NO_PERMISSIONS', () => {
    toPermissionMap({ users: 'FULL' } satisfies Partial<Record<PermissionKey, PermissionLevel>>);
    expect(NO_PERMISSIONS.users).toBe('NONE');
  });
});
