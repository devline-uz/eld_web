// owner: web-settings-admin — W-19 permission matrix labels and grouping (web/tz.md §10 W-19).
// The design draws 11 rows; the remaining 11 of the 22 backend keys are added in the same format,
// slotted into the group the note prescribes. `users`+`roles` share one row ("Manage users &
// roles") and are always written to the same level together — the one place a single control
// spans two backend keys.
import type { PermissionKey } from '@/shared/auth/permissions';
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
      { id: 'hosCertifyOnBehalf', label: 'Certify on behalf of driver', keys: ['hosCertifyOnBehalf'] },
      { id: 'reports', label: 'View & generate reports', keys: ['reports'] },
      // WB-234 — one key covers both the pack export and data transfers (B-95).
      { id: 'reportsTransfer', label: ROLE_COPY.transferMatrixRow, keys: ['reportsTransfer'] },
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
