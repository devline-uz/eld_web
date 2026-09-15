// owner: web-qa-a11y — the 4 demo-role permission maps, transcribed verbatim from
// backend/src/modules/roles/permission-matrix.ts (DEFAULT_ROLE_MATRIX). Read-only reference:
// backend/ is never edited, this is a test fixture copy for the RBAC suite and mockAuth.
//
// Two known, screenshot-confirmed design overrides on top of this raw matrix are handled in
// rbacScreens.ts, not here: Dispatcher's `dvir`/`safety`/`reports·dvir` routes 403 despite READ
// (web/tz.md §4.2), and Dispatcher additionally has no `Settings · ELD devices` and no
// `Reports · IFTA` tab even though the backend grants `devices`/`reports` READ — a discrepancy
// the design images show but web/tz.md §12.1's prose table does not call out (see web/bugs.md).
import type { PermissionKey, PermissionMap, Role } from '@/shared/auth/permissions';
import { PERMISSION_KEYS } from '@/shared/auth/permissions';

function matrix(overrides: Partial<Record<PermissionKey, PermissionMap[PermissionKey]>>): PermissionMap {
  const level: PermissionMap[PermissionKey] = 'FULL';
  const base = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, level])) as PermissionMap;
  return { ...base, ...overrides };
}

export const ROLE_PERMISSIONS: Record<Role, PermissionMap> = {
  ADMIN: matrix({}),
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
    dvir: 'READ',
    maintenance: 'READ',
    safety: 'READ',
    reports: 'READ',
    reportsTransfer: 'NONE',
    devices: 'READ',
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
