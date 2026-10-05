// owner: web-settings-admin — W-19 permission matrix labels and grouping (web/tz.md §10 W-19).
// The design draws 11 rows; the remaining 11 of the 22 backend keys are added in the same format,
// slotted into the group the note prescribes. `users`+`roles` share one row ("Manage users &
// roles") and are always written to the same level together — the one place a single control
// spans two backend keys.
import type { PermissionKey } from '@/shared/auth/permissions';
import type { RoleRow } from '@/shared/api/settingsAdmin';
import { ROLE_COPY } from '../lib/copy';

export interface MatrixRow {
  id: string;
  label: string;
  keys: PermissionKey[];
}

export interface MatrixGroup {
  title: string;
  rows: MatrixRow[];
}

export const PERMISSION_MATRIX_GROUPS: MatrixGroup[] = [
  {
    title: 'FLEET',
    rows: [
      { id: 'dashboard', label: 'View dashboard', keys: ['dashboard'] },
      { id: 'liveFleet', label: 'View live fleet map', keys: ['liveFleet'] },
      { id: 'vehicles', label: 'View vehicles / Add & edit vehicles', keys: ['vehicles'] },
      { id: 'devices', label: 'View ELD devices / Register & pair devices', keys: ['devices'] },
    ],
  },
  {
    title: 'DRIVERS',
    rows: [{ id: 'drivers', label: 'View drivers / Add & edit drivers', keys: ['drivers'] }],
  },
  {
    title: 'OPERATIONS',
    rows: [
      { id: 'trips', label: 'View trips / Dispatch & edit trips', keys: ['trips'] },
      { id: 'messaging', label: 'View & send messages', keys: ['messaging'] },
    ],
  },
  {
    title: 'COMPLIANCE',
    rows: [
      { id: 'hos', label: 'View HOS logs', keys: ['hos'] },
      { id: 'hosEdit', label: 'Request driver log edit', keys: ['hosEdit'] },
      {
        id: 'hosCertifyOnBehalf',
        label: 'Certify on behalf of driver',
        keys: ['hosCertifyOnBehalf'],
      },
      { id: 'reports', label: 'View & generate reports', keys: ['reports'] },
      { id: 'reportsTransfer', label: ROLE_COPY.transferMatrixRow, keys: ['reportsTransfer'] },
      // B-95 (shipped 2026-09-24) — `dataTransfer` is its own 23rd permission key.
      { id: 'dataTransfer', label: ROLE_COPY.dataTransferMatrixRow, keys: ['dataTransfer'] },
    ],
  },
  {
    title: 'MAINTENANCE',
    rows: [
      { id: 'dvir', label: 'View DVIRs & defects / Manage DVIRs & defects', keys: ['dvir'] },
      { id: 'maintenance', label: 'View & schedule maintenance', keys: ['maintenance'] },
      { id: 'safety', label: 'View & manage safety events', keys: ['safety'] },
    ],
  },
  {
    title: 'ADMINISTRATION',
    rows: [
      { id: 'usersRoles', label: 'Manage users & roles', keys: ['users', 'roles'] },
      { id: 'carrierSettings', label: 'Carrier settings', keys: ['carrierSettings'] },
      { id: 'integrations', label: 'Manage integrations & API keys', keys: ['integrations'] },
      { id: 'auditLog', label: 'View audit log', keys: ['auditLog'] },
      { id: 'alertRules', label: 'Manage alert rules', keys: ['alertRules'] },
      { id: 'support', label: 'Support', keys: ['support'] },
    ],
  },
];

export interface RoleColumn {
  key: RoleRow['key'];
  label: string;
  custom: boolean;
}

const BUILT_IN_COLUMNS: RoleColumn[] = [
  { key: 'SUPER_ADMIN', label: 'SUPER ADMIN', custom: false },
  { key: 'ADMIN', label: 'ADMIN', custom: false },
  { key: 'FLEET_MANAGER', label: 'FLEET MANAGER', custom: false },
  { key: 'DISPATCHER', label: 'DISPATCHER', custom: false },
  { key: 'VIEWER', label: 'VIEWER', custom: false },
];

/**
 * WB-QA-S-02 — the matrix used to draw only the four built-in columns, so a custom role from
 * `GET /roles` could only be seen or changed through the Edit role modal. Built-ins keep their
 * drawn order; every other role follows, by name.
 */
export function matrixColumns(roles: RoleRow[]): RoleColumn[] {
  const present = new Set(roles.map((r) => r.key));
  const builtIn = new Set(BUILT_IN_COLUMNS.map((c) => c.key));
  // ADMIN always shows (locked, "Admin cannot be edited"). A built-in role missing from
  // `GET /roles` is not drawn: its cells would read "No access" and ignore every click.
  const builtInCols = BUILT_IN_COLUMNS.filter((c) => c.key === 'ADMIN' || present.has(c.key));
  const custom = roles
    .filter((r) => !builtIn.has(r.key))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((r) => ({ key: r.key, label: r.name, custom: true }));
  return [...builtInCols, ...custom];
}
