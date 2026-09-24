// owner: web-auth-rbac — the 23 permission keys (22 from §6.9 + `dataTransfer`, B-95) and the role matrix (web/tz.md §6.9, §12).
// GET /auth/me is the only source of truth at runtime; the matrix copy here exists for tests
// and the Roles & permissions screen. The JWT is never decoded.
// 100% unit coverage (22 keys × 4 roles × 3 levels) is a CI gate.

export const PERMISSION_KEYS = [
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
  // B-95 (shipped 2026-09-24, backend D-101) — additive 23rd key split from `reportsTransfer`:
  // `POST /transfers` (send to FMCSA/inspector) needs `dataTransfer:FULL`; viewing/downloading
  // transfers stays on `reportsTransfer`. WD-121.
  'dataTransfer',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
export type PermissionLevel = 'NONE' | 'READ' | 'FULL';
export type PermissionMap = Record<PermissionKey, PermissionLevel>;

export type Role = 'ADMIN' | 'FLEET_MANAGER' | 'DISPATCHER' | 'VIEWER';

export const NO_PERMISSIONS: PermissionMap = Object.fromEntries(
  PERMISSION_KEYS.map((key) => [key, 'NONE']),
) as PermissionMap;

/** `READ` means "not NONE"; `FULL` means exactly FULL. */
export function hasPermission(
  permissions: PermissionMap,
  key: PermissionKey,
  level: 'READ' | 'FULL' = 'READ',
): boolean {
  const value = permissions[key];
  return level === 'READ' ? value !== 'NONE' : value === 'FULL';
}

/**
 * The role matrix, copied verbatim from `backend/src/modules/roles/permission-matrix.ts`
 * (checked against the live `GET /auth/me` of the four demo accounts on 2026-09-12).
 *
 * ⚠️ This is a TEST AND DISPLAY copy only — W-19 Roles & permissions renders it, and the RBAC
 * fixture asserts against it. The runtime permission map always comes from `GET /auth/me`;
 * nothing in `AuthProvider` reads this table and the JWT is never decoded.
 */
export const ROLE_PERMISSIONS: Record<Role, PermissionMap> = {
  ADMIN: Object.fromEntries(PERMISSION_KEYS.map((key) => [key, 'FULL'])) as PermissionMap,
  FLEET_MANAGER: {
    dashboard: 'FULL',
    liveFleet: 'FULL',
    vehicles: 'FULL',
    drivers: 'FULL',
    hos: 'FULL',
    hosEdit: 'FULL',
    hosCertifyOnBehalf: 'NONE',
    dvir: 'FULL',
    maintenance: 'FULL',
    safety: 'FULL',
    trips: 'FULL',
    reports: 'FULL',
    reportsTransfer: 'FULL',
    messaging: 'FULL',
    devices: 'FULL',
    alertRules: 'FULL',
    users: 'NONE',
    roles: 'NONE',
    integrations: 'NONE',
    auditLog: 'NONE',
    support: 'FULL',
    carrierSettings: 'NONE',
    dataTransfer: 'FULL',
  },
  DISPATCHER: {
    dashboard: 'FULL',
    liveFleet: 'FULL',
    vehicles: 'READ',
    drivers: 'READ',
    hos: 'READ',
    hosEdit: 'NONE',
    hosCertifyOnBehalf: 'NONE',
    dvir: 'READ',
    maintenance: 'READ',
    safety: 'READ',
    trips: 'FULL',
    reports: 'READ',
    reportsTransfer: 'NONE',
    messaging: 'FULL',
    devices: 'READ',
    alertRules: 'NONE',
    users: 'NONE',
    roles: 'NONE',
    integrations: 'NONE',
    auditLog: 'NONE',
    support: 'FULL',
    carrierSettings: 'NONE',
    dataTransfer: 'NONE',
  },
  VIEWER: {
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
    support: 'READ',
    carrierSettings: 'NONE',
    dataTransfer: 'NONE',
  },
};

/** Labels for the topbar chip (§4.4) and the Roles & permissions screen. ADMIN has no chip. */
export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  FLEET_MANAGER: 'Fleet manager',
  DISPATCHER: 'Dispatcher',
  VIEWER: 'Viewer',
};

export function isRole(value: unknown): value is Role {
  return (
    value === 'ADMIN' || value === 'FLEET_MANAGER' || value === 'DISPATCHER' || value === 'VIEWER'
  );
}

export function isPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === 'string' && (PERMISSION_KEYS as readonly string[]).includes(value);
}

/**
 * Normalises whatever `GET /auth/me` returned into a complete 22-key map: unknown keys are
 * dropped, missing keys default to `NONE`, unknown levels degrade to `NONE`. A permission the
 * server did not send is never assumed.
 */
export function toPermissionMap(input: unknown): PermissionMap {
  const source = (input ?? {}) as Record<string, unknown>;
  const out = { ...NO_PERMISSIONS };
  for (const key of PERMISSION_KEYS) {
    const level = source[key];
    if (level === 'READ' || level === 'FULL' || level === 'NONE') out[key] = level;
  }
  return out;
}
