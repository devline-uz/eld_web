// owner: web-qa-a11y — the 4 demo-role permission maps, transcribed verbatim from
// backend/src/modules/roles/permission-matrix.ts (DEFAULT_ROLE_MATRIX). Read-only reference:
// backend/ is never edited, this is a test fixture copy for the RBAC suite and mockAuth.
//
// CODE-085 — Dispatcher's `dvir`, `maintenance`, `safety` and `devices` are NONE in the backend
// matrix too, so its DVIR, Safety, DVIR report and ELD devices routes 403 by permission. One
// role override remains in rbacScreens.ts: `Reports · IFTA` shares `reports` with the Activity
// report Dispatcher keeps, so it is still blocked by role (see web/bugs.md WB-002).
import type { PermissionKey, PermissionMap, Role } from '@/shared/auth/permissions';
import { PERMISSION_KEYS } from '@/shared/auth/permissions';

function matrix(overrides: Partial<Record<PermissionKey, PermissionMap[PermissionKey]>>): PermissionMap {
  const level: PermissionMap[PermissionKey] = 'FULL';
  const base = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, level])) as PermissionMap;
  return { ...base, ...overrides };
}

export const ROLE_PERMISSIONS: Record<Role, PermissionMap> = {
  ADMIN: matrix({ hosCertifyOnBehalf: 'NONE' }), // CODE-029 — retired key, NONE for every role
  FLEET_MANAGER: matrix({
    hosCertifyOnBehalf: 'NONE',
    users: 'NONE',
    roles: 'NONE',
    integrations: 'NONE',
    auditLog: 'NONE',
    carrierSettings: 'NONE',
  }),
  DISPATCHER: matrix({
    vehicles: 'READ',
    drivers: 'READ',
    hos: 'READ',
    hosEdit: 'NONE',
    hosCertifyOnBehalf: 'NONE',
    dvir: 'NONE',
    maintenance: 'NONE',
    safety: 'NONE',
    reports: 'READ',
    reportsTransfer: 'NONE',
    devices: 'NONE',
    alertRules: 'NONE',
    users: 'NONE',
    roles: 'NONE',
    integrations: 'NONE',
    auditLog: 'NONE',
    carrierSettings: 'NONE',
  }),
  VIEWER: matrix({
    dashboard: 'READ',
    liveFleet: 'READ',
    vehicles: 'READ',
    drivers: 'READ',
    hos: 'READ',
    hosEdit: 'NONE',
    hosCertifyOnBehalf: 'NONE',
    dvir: 'READ',
    maintenance: 'READ',
    safety: 'READ',
    trips: 'NONE',
    reports: 'READ',
    reportsTransfer: 'NONE',
    messaging: 'NONE',
    devices: 'NONE',
    alertRules: 'NONE',
    users: 'NONE',
    roles: 'NONE',
    integrations: 'NONE',
    auditLog: 'NONE',
    carrierSettings: 'NONE',
    support: 'READ',
  }),
};

export const DEMO_ACCOUNTS: Record<Role, { email: string; password: string }> = {
  ADMIN: { email: 'sarah.chen@universal-logistics.example', password: 'Onebook2026' },
  FLEET_MANAGER: { email: 'mike.torres@universal-logistics.example', password: 'Onebook2026' },
  DISPATCHER: { email: 'carlos.ramirez@universal-logistics.example', password: 'Onebook2026' },
  VIEWER: { email: 'diane.foster@universal-logistics.example', password: 'Onebook2026' },
};
