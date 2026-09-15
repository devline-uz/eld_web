// owner: web-qa-a11y — the single RBAC source of truth: 4 roles × 26 screens.
//
// `visibleForRole` is transcribed from the actual file counts in `web/roles and screens/`
// (26 admin / 21 fleet manager / 14 dispatcher / 16 viewer — web/tz.md §12.1's own
// cross-check), which outranks both the §12.1 prose table and the backend permission matrix
// per the project conflict order. Two places where the screenshots disagree with a literal
// reading of §12.1 / the backend matrix are called out below and logged in web/bugs.md:
//   - Dispatcher has no `Settings · ELD devices` screenshot even though `devices` = READ.
//   - Dispatcher has no `Reports · IFTA` screenshot even though `reports` = READ; only the
//     Activity report is present for that role.
// Every feature agent asserts its screen's RBAC test against this fixture, not against its
// own reading of the matrix.
import type { PermissionKey, Role } from '@/shared/auth/permissions';

export interface RbacScreen {
  /** Stable id — matches the `W-NN` screen id in web/tz.md §10 where one exists. */
  id: string;
  label: string;
  route: string;
  perm?: PermissionKey;
  /** The exact filename under `web/roles and screens/<role folder>/`, for visual QA cross-refs. */
  designImage: string;
  visibleForRole: Record<Role, boolean>;
}

const ALL: Record<Role, boolean> = { ADMIN: true, FLEET_MANAGER: true, DISPATCHER: true, VIEWER: true };

export const RBAC_SCREENS: RbacScreen[] = [
  {
    id: 'W-01',
    label: 'Fleet Dashboard',
    route: '/',
    perm: 'dashboard',
    designImage: 'Fleet overview — KPIs, live map, duty mix, violation feed.jpg',
    visibleForRole: ALL,
  },
  {
    id: 'W-02',
    label: 'Live Fleet',
    route: '/live-fleet',
    perm: 'liveFleet',
    designImage: 'Real-time GPS map, vehicle list, unit detail card.jpg',
    visibleForRole: ALL,
  },
  {
    id: 'W-03',
    label: 'Vehicles',
    route: '/vehicles',
    perm: 'vehicles',
    designImage: 'Unit inventory — ELD serial, VIN, odometer.jpg',
    visibleForRole: ALL,
  },
  {
    id: 'W-04',
    label: 'Unit profile',
    route: '/vehicles/:id',
    perm: 'vehicles',
    designImage: 'Unit profile — telemetry, details, activity log.jpg',
    visibleForRole: ALL,
  },
  {
    id: 'W-05',
    label: 'Unit histories',
    route: '/vehicles/:id/histories',
    perm: 'vehicles',
    designImage: 'Route replay, drive : stop : idle segments.jpg',
    visibleForRole: ALL,
  },
  {
    id: 'W-06',
    label: 'Drivers',
    route: '/drivers',
    perm: 'drivers',
    designImage: 'Driver roster with live HOS clocks and violations.jpg',
    visibleForRole: ALL,
  },
  {
    id: 'W-07',
    label: 'Driver profile',
    route: '/drivers/:id',
    perm: 'drivers',
    designImage: 'Driver profile — HOS clocks, violations, logs.jpg',
    visibleForRole: ALL,
  },
  {
    id: 'W-11',
    label: 'Dispatch & Trips',
    route: '/trips',
    perm: 'trips',
    designImage: 'Active trips, route timeline, unassigned loads.jpg',
    visibleForRole: { ADMIN: true, FLEET_MANAGER: true, DISPATCHER: true, VIEWER: false },
  },
  {
    id: 'W-08',
    label: 'HOS Logs',
    route: '/hos-logs',
    perm: 'hos',
    designImage: '24-hour ELD graph grid, available hours, certification.jpg',
    visibleForRole: ALL,
  },
  {
    id: 'W-09',
    label: 'DVIR & Maintenance',
    route: '/dvir',
    perm: 'dvir',
    designImage: 'DVIRs, open defects, preventive maintenance.jpg',
    visibleForRole: { ADMIN: true, FLEET_MANAGER: true, DISPATCHER: false, VIEWER: true },
  },
  {
    id: 'W-10',
    label: 'Safety',
    route: '/safety',
    perm: 'safety',
    designImage: 'Harsh driving, speeding, fleet score, scorecard.jpg',
    visibleForRole: { ADMIN: true, FLEET_MANAGER: true, DISPATCHER: false, VIEWER: true },
  },
  {
    id: 'W-12',
    label: 'Reports · IFTA',
    route: '/reports/ifta',
    perm: 'reports',
    designImage: 'IFTA by jurisdiction and the report library.jpg',
    // Screenshot-confirmed: Dispatcher has no IFTA screenshot even though `reports` = READ.
    visibleForRole: { ADMIN: true, FLEET_MANAGER: true, DISPATCHER: false, VIEWER: true },
  },
  {
    id: 'W-13',
    label: 'Reports · Activity',
    route: '/reports/activity',
    perm: 'reports',
    designImage: 'Reports — duty totals and distance by driver.jpg',
    visibleForRole: ALL,
  },
  {
    id: 'W-14',
    label: 'Reports · DVIR',
    route: '/reports/dvir',
    perm: 'reports',
    designImage: 'Reports — inspection and defect history.jpg',
    visibleForRole: { ADMIN: true, FLEET_MANAGER: true, DISPATCHER: false, VIEWER: true },
  },
  {
    id: 'W-15',
    label: 'Reports · FMCSA / DOT audit pack',
    route: '/reports/fmcsa',
    perm: 'reportsTransfer',
    designImage: 'Reports — FMCSA : DOT pack and eRODS transfer.jpg',
    visibleForRole: { ADMIN: true, FLEET_MANAGER: true, DISPATCHER: false, VIEWER: false },
  },
  {
    id: 'W-16',
    label: 'Messages',
    route: '/messages',
    perm: 'messaging',
    designImage: 'Three-pane driver messaging with context panel.jpg',
    visibleForRole: { ADMIN: true, FLEET_MANAGER: true, DISPATCHER: true, VIEWER: false },
  },
  {
    id: 'W-17',
    label: 'Settings · Company profile',
    route: '/settings/company',
    perm: 'carrierSettings',
    designImage: 'Settings — company profile and HOS ruleset.jpg',
    visibleForRole: { ADMIN: true, FLEET_MANAGER: false, DISPATCHER: false, VIEWER: false },
  },
  {
    id: 'W-18',
    label: 'Settings · Users',
    route: '/settings/users',
    perm: 'users',
    designImage: 'Settings — back-office users and invitations.jpg',
    visibleForRole: { ADMIN: true, FLEET_MANAGER: false, DISPATCHER: false, VIEWER: false },
  },
  {
    id: 'W-19',
    label: 'Settings · Roles & permissions',
    route: '/settings/roles',
    perm: 'roles',
    designImage: 'Settings — permission matrix across roles.jpg',
    visibleForRole: { ADMIN: true, FLEET_MANAGER: false, DISPATCHER: false, VIEWER: false },
  },
  {
    id: 'W-20',
    label: 'Settings · ELD devices',
    route: '/settings/devices',
    perm: 'devices',
    designImage: 'Settings — ELD devices, firmware, heartbeats.jpg',
    // Screenshot-confirmed: Dispatcher has no devices screenshot even though `devices` = READ
    // (web/bugs.md — router.tsx SETTINGS_ROUTES needs a blockedRoles: ['DISPATCHER'] entry).
    visibleForRole: { ADMIN: true, FLEET_MANAGER: true, DISPATCHER: false, VIEWER: false },
  },
  {
    id: 'W-21',
    label: 'Settings · Alert rules',
    route: '/settings/alerts',
    perm: 'alertRules',
    designImage: 'Settings — notification channels and alert rules.jpg',
    visibleForRole: { ADMIN: true, FLEET_MANAGER: true, DISPATCHER: false, VIEWER: false },
  },
  {
    id: 'W-22',
    label: 'Settings · Integrations',
    route: '/settings/integrations',
    perm: 'integrations',
    designImage: 'Settings — integrations and API keys.jpg',
    visibleForRole: { ADMIN: true, FLEET_MANAGER: false, DISPATCHER: false, VIEWER: false },
  },
  {
    id: 'W-23',
    label: 'Settings · Audit log',
    route: '/settings/audit',
    perm: 'auditLog',
    designImage: 'Settings — immutable audit trail.jpg',
    visibleForRole: { ADMIN: true, FLEET_MANAGER: false, DISPATCHER: false, VIEWER: false },
  },
  {
    id: 'W-24',
    label: 'Settings · Support',
    route: '/settings/support',
    perm: 'support',
    designImage: 'Settings — support channels and tickets.jpg',
    visibleForRole: ALL,
  },
  {
    id: 'W-25',
    label: 'Support · Feedback',
    route: '/settings/support/feedback',
    perm: 'support',
    designImage: 'Feedback survey, satisfaction, driver comments.jpg',
    visibleForRole: ALL,
  },
  {
    id: 'W-26',
    label: 'My profile',
    route: '/account',
    designImage: 'Personal account — profile, security, sessions.jpg',
    visibleForRole: ALL,
  },
];

/** web/tz.md §12.1 / §22.1 cross-check — must equal 26 / 21 / 14 / 16. */
export const EXPECTED_SCREEN_COUNT: Record<Role, number> = {
  ADMIN: 26,
  FLEET_MANAGER: 21,
  DISPATCHER: 14,
  VIEWER: 16,
};
