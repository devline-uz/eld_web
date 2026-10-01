// The in-memory mock database shared by every write handler (mock-layer audit, 2026-09-23).
//
// The generated `fixtures.generated.ts` rows come straight out of `openapi.json`'s *examples* —
// one vehicle, one driver with no name, one ADMIN role with `permissions: {}`. They prove the
// shape and nothing else, so every screen that ranks, filters, pages or bulk-selects renders
// empty or "undefined undefined" against them. This module seeds the same shapes with a fleet's
// worth of internally consistent rows and keeps them mutable, so a `POST /vehicles` or a
// `PATCH /carrier` is visible in the next `GET`.
//
// Consistency rules the seeds keep:
//   • driver ids/names are the SAME identities `vehiclesDriversGaps.ts` serves on `/drivers/roster`
//     (58 drivers, drv_1…drv_58), so Messages, the HOS picker, the scorecard and the Activity
//     report all print real names for the same id;
//   • every `assignedVehicleId` points at a vehicle that exists in `VEHICLES`;
//   • `SEARCH` scope counts and the dashboard's vehicle tile are derived, never hardcoded.
import {
  PERMISSION_KEYS,
  ROLE_PERMISSIONS,
  type PermissionKey,
  type PermissionLevel,
  type Role,
} from '@/shared/auth/permissions';
import type { DriverRow, VehicleRow } from '@/shared/api/vehicles';
import type {
  AlertRuleRow,
  DeviceRow,
  ApiKeyRow,
  AuditEntry,
  CarrierRow,
  IntegrationRow,
  RoleRow,
  TicketRow,
  UserRow,
} from '@/shared/api/settingsAdmin';
import type { DriverScoreRow, SafetyEventRow, SafetyEventType } from '@/shared/api/safety';
import { ROSTER_ENTRIES } from './vehiclesDriversGaps';

const DAY = 86_400_000;
const HOUR = 3_600_000;
/** Deterministic "now" offsets — a re-run never shuffles a screenshot, but the data stays recent. */
export const ago = (ms: number): string => new Date(Date.now() - ms).toISOString();
export const daysAgo = (days: number): string => ago(days * DAY);

/* ------------------------------------------------------------------ vehicles */

const MAKES = [
  ['Freightliner', 'Cascadia'],
  ['Peterbilt', '579'],
  ['Kenworth', 'T680'],
  ['Volvo', 'VNL 760'],
  ['International', 'LT625'],
  ['Mack', 'Anthem'],
] as const;
const PLATE_STATES = ['OH', 'NC', 'CO', 'TX', 'PA', 'IN'];

/** 24 units — three pages at the W-03 default `limit: 10`, one page at the API default 25 (the
 * vehicles contract test pins `totalPages === 1` for `limit: 25`). */
export const VEHICLE_COUNT = 24;

function seedVehicle(n: number): VehicleRow {
  const i = n - 1;
  const [make, model] = MAKES[i % MAKES.length]!;
  const status = n % 11 === 0 ? 'OUT_OF_SERVICE' : n % 7 === 0 ? 'INACTIVE' : 'ACTIVE';
  const odometerMi = 993_589 - i * 31_447;
  return {
    id: `veh_${n}`,
    unitNumber: `#${100 + n}`,
    vin: `1FUJGLDR${String(8_000_000 + n * 1_117).padStart(7, '0')}L${String(1234 + n)}`,
    make,
    model,
    year: 2019 + (i % 6),
    licensePlate: `OBK-${String(1000 + n * 7)}`,
    plateState: PLATE_STATES[i % PLATE_STATES.length]!,
    fuelType: 'DIESEL',
    sleeperBerth: i % 3 !== 0,
    odometerMi,
    deviceOdometerMi: i % 5 === 0 ? null : odometerMi - 12,
    odometerOffsetMi: i % 5 === 0 ? 0 : 12,
    odometerCalibratedAt: i % 5 === 0 ? null : daysAgo(20 + i),
    engineHours: 12_400 + i * 311,
    busType: null,
    status,
    notes: i % 6 === 0 ? 'Spare tractor — yard only.' : null,
    activatedAt: daysAgo(400 - i * 5),
    createdAt: daysAgo(420 - i * 5),
    // Backend D-107 — seeded vehicle groups live in `handlers/vehicleGroups.ts`.
    groupId: n % 3 === 0 ? null : n % 3 === 1 ? 'vg_1' : 'vg_2',
  };
}

export let VEHICLES: VehicleRow[] = [];

/** Units the API still lists — `DELETE /vehicles/:id` is a soft delete (tz.md §11.3): the row
 * stays in `VEHICLES` with `deletedAt` + `status: 'INACTIVE'` but drops out of every list, count,
 * lookup and `GET /vehicles/:id` (404). A unit only "Set inactive" has no `deletedAt` and stays. */
export const liveVehicles = (): VehicleRow[] => VEHICLES.filter((v) => v.deletedAt == null);

/* ------------------------------------------------------------------ drivers */

/** The same 58 identities `/drivers/roster` serves, widened to the full raw `Driver` row. A unit
 * is only carried over when that vehicle really exists, so the DRIVER column, the `Unassigned`
 * segment counter and the assign-driver picker all agree. */
function seedDrivers(): DriverRow[] {
  return ROSTER_ENTRIES.map((entry, i) => {
    const d = entry.driver;
    const unitId = entry.unit?.id ?? null;
    const assignedVehicleId = unitId && Number(unitId.slice(4)) <= VEHICLE_COUNT ? unitId : null;
    return {
      id: d.id,
      username: d.username,
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email ?? `${d.username}@universal-logistics.example`,
      phone: `+1 614 555 ${String(1000 + i).slice(-4)}`,
      cdlNumber: `W${String(8_569_238 + i * 913)}`,
      cdlState: PLATE_STATES[i % PLATE_STATES.length]!,
      status: i % 17 === 16 ? 'INACTIVE' : 'ACTIVE',
      homeTerminalName: d.homeTerminalName,
      homeTerminalTimezone:
        d.homeTerminalName === 'Denver, CO'
          ? 'America/Denver'
          : d.homeTerminalName === 'Dallas, TX'
            ? 'America/Chicago'
            : 'America/New_York',
      fleetManagerId: 'usr_2',
      assignedVehicleId,
      allowPersonalConveyance: d.allowPersonalConveyance,
      allowYardMove: d.allowYardMove,
      adverseDrivingEnabled: i % 4 === 0,
      shortHaulException: d.shortHaulException,
      splitSleeperEnabled: d.splitSleeperEnabled,
      eldExempt: d.eldExempt,
      eldExemptReason: d.eldExempt ? 'Pre-2000 engine' : null,
      appVersion: d.appVersion,
      appPlatform: i % 2 === 0 ? 'iOS' : 'Android',
      registeredAt: daysAgo(300 - i * 2),
      // B-31 shipped — most seeded drivers have a verified email; every 9th one does not, to
      // exercise the "Email not verified" badge without making it the majority state.
      emailVerifiedAt: i % 9 === 0 ? null : daysAgo(250 - i * 2),
    };
  });
}

export let DRIVERS: DriverRow[] = [];

/* ------------------------------------------------------------------ ELD devices */

/** Serials for units #101–#106 match `fleet.ts` LIVE_FLEET's `eldSerial`, so the map callout, the
 * Vehicles table's ELD SERIAL column and W-20 all name the same box. */
const KNOWN_SERIALS: Record<string, string> = {
  veh_1: 'PT30_A86E',
  veh_2: 'PT30_11B2',
  veh_3: 'PT30_7C10',
  veh_4: 'PT30_9931',
  veh_6: 'PT30_4C27',
};

function seedDevices(): DeviceRow[] {
  return Array.from({ length: VEHICLE_COUNT }, (_, i) => {
    const n = i + 1;
    const vehicleId = `veh_${n}`;
    // Four units run without a box — W-20's `Unassigned` segment and the "Not assigned" cell.
    const paired = n % 7 !== 0;
    const model: DeviceRow['model'] = i % 4 === 3 ? 'PT40' : 'PT30';
    return {
      id: `dev_${n}`,
      serial: KNOWN_SERIALS[vehicleId] ?? `${model}_${(0x1000 + n * 0x137).toString(16).toUpperCase()}`,
      model,
      status: n % 13 === 0 ? 'FAULTY' : paired ? 'ASSIGNED' : 'UNASSIGNED',
      vehicleId: paired ? vehicleId : null,
      bleState: n % 9 === 0 ? 'DISCONNECTED' : n % 5 === 0 ? 'OUT_OF_RANGE' : 'CONNECTED',
      firmwareVersion: i % 6 === 0 ? 'L107' : 'L108',
      firmwareOutdated: i % 6 === 0,
      lastHeartbeatAt: paired ? ago((i % 40) * 60_000) : daysAgo(3 + i),
      storedEventsCount: i % 5,
    };
  });
}

export let DEVICES: DeviceRow[] = [];

/* ------------------------------------------------------------------ carrier */

function seedCarrier(): CarrierRow {
  return {
    id: 'carrier',
    name: 'Universal Logistics Inc.',
    dotNumber: '1234567',
    mcNumber: 'MC-884201',
    ein: '31-0987654',
    timezone: 'America/New_York',
    hosRuleset: 'US_70_8_PROPERTY',
    distanceUnit: 'MILES',
    cycleRestart: true,
    unassignedThresholdMin: 3,
    dvirRetentionMonths: 18,
    allowPersonalConveyance: true,
    allowYardMove: true,
    addressLine1: '4820 Innovation Way',
    city: 'Columbus',
    state: 'OH',
    zip: '43215',
    phone: '+1 614 555 0100',
    complianceEmail: 'compliance@universal-logistics.example',
    eldIdentifier: 'OBK1',
    eldRegistrationId: null,
    erodsMode: 'PRODUCTION',
  };
}

export let CARRIER: CarrierRow = seedCarrier();

/* ------------------------------------------------------------------ roles */

const ROLE_META: Record<Role, { id: string; name: string; description: string }> = {
  ADMIN: { id: 'rol_admin', name: 'Administrator', description: 'Full access to every screen, including billing, users and carrier settings.' },
  FLEET_MANAGER: { id: 'rol_fleet_manager', name: 'Fleet manager', description: 'Runs the fleet day to day: units, drivers, HOS edits, maintenance and safety.' },
  DISPATCHER: { id: 'rol_dispatcher', name: 'Dispatcher', description: 'Plans and assigns trips, messages drivers, reads compliance data.' },
  VIEWER: { id: 'rol_viewer', name: 'Viewer', description: 'Read-only access for auditors and insurance reviewers.' },
};

const ROLE_ORDER: Role[] = ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER', 'VIEWER'];

/** All 22 keys for all 4 roles — the matrix screen renders a cell per key, so a partial map is
 * an empty matrix (the `permissions: {}` the generated example carries). */
function permissionsFor(role: Role): Record<PermissionKey, PermissionLevel> {
  const source = ROLE_PERMISSIONS[role];
  return Object.fromEntries(PERMISSION_KEYS.map((key) => [key, source[key]])) as Record<
    PermissionKey,
    PermissionLevel
  >;
}

function seedRoles(): RoleRow[] {
  return ROLE_ORDER.map((role) => ({
    id: ROLE_META[role].id,
    key: role,
    name: ROLE_META[role].name,
    description: ROLE_META[role].description,
    isSystem: true,
    permissions: permissionsFor(role),
    userCount: 0,
  }));
}

export let ROLES: RoleRow[] = [];

/* ------------------------------------------------------------------ users */

interface SeedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  role: Role;
  status: UserRow['status'];
}

const SEED_USERS: SeedUser[] = [
  { id: 'usr_1', email: 'sarah.chen@universal-logistics.example', firstName: 'Sarah', lastName: 'Chen', jobTitle: 'Director of compliance', role: 'ADMIN', status: 'ACTIVE' },
  { id: 'usr_2', email: 'mike.torres@universal-logistics.example', firstName: 'Mike', lastName: 'Torres', jobTitle: 'Fleet manager', role: 'FLEET_MANAGER', status: 'ACTIVE' },
  { id: 'usr_3', email: 'carlos.ramirez@universal-logistics.example', firstName: 'Carlos', lastName: 'Ramirez', jobTitle: 'Dispatch lead', role: 'DISPATCHER', status: 'ACTIVE' },
  { id: 'usr_4', email: 'diane.foster@universal-logistics.example', firstName: 'Diane', lastName: 'Foster', jobTitle: 'Insurance auditor', role: 'VIEWER', status: 'ACTIVE' },
  { id: 'usr_5', email: 'priya.nair@universal-logistics.example', firstName: 'Priya', lastName: 'Nair', jobTitle: 'Safety analyst', role: 'FLEET_MANAGER', status: 'ACTIVE' },
  { id: 'usr_6', email: 'anna.weiss@universal-logistics.example', firstName: 'Anna', lastName: 'Weiss', jobTitle: 'Night dispatcher', role: 'DISPATCHER', status: 'INVITED' },
  { id: 'usr_7', email: 'tom.becker@universal-logistics.example', firstName: 'Tom', lastName: 'Becker', jobTitle: 'Maintenance planner', role: 'FLEET_MANAGER', status: 'DISABLED' },
  { id: 'usr_8', email: 'grace.liu@universal-logistics.example', firstName: 'Grace', lastName: 'Liu', jobTitle: 'Compliance associate', role: 'ADMIN', status: 'ACTIVE' },
];

const TERMINALS = ['Columbus, OH', 'Raleigh, NC', 'Denver, CO', 'Dallas, TX'];

function seedUsers(): UserRow[] {
  return SEED_USERS.map((u, i) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    jobTitle: u.jobTitle,
    phone: `+1 614 555 ${String(2000 + i).slice(-4)}`,
    status: u.status,
    lastActiveAt: u.status === 'INVITED' ? null : ago((i + 1) * HOUR),
    invitedByName: u.status === 'INVITED' ? 'Sarah Chen' : null,
    invitedAt: u.status === 'INVITED' ? daysAgo(2) : null,
    expiresAt: u.status === 'INVITED' ? new Date(Date.now() + 5 * DAY).toISOString() : null,
    homeTerminalName: TERMINALS[i % TERMINALS.length]!,
    role: { id: ROLE_META[u.role].id, key: u.role, name: ROLE_META[u.role].name },
  }));
}

export let USERS: UserRow[] = [];

/* ------------------------------------------------------------------ alert rules */

function seedAlertRules(): AlertRuleRow[] {
  return [
    { id: 'alr_1', key: 'hos_violation', name: 'HOS violation', severity: 'CRITICAL', conditions: [{ event: 'hos.violation' }], channels: ['IN_APP', 'EMAIL'], recipients: { roles: ['ADMIN', 'FLEET_MANAGER'], subjectDriver: true }, throttle: { perDriverPerDay: 5, cooldownMin: 30 }, enabled: true, isSystem: true },
    { id: 'alr_2', key: 'eld_disconnected', name: 'ELD disconnected', severity: 'CRITICAL', conditions: [{ event: 'device.offline', params: { minutes: 30 } }], channels: ['IN_APP', 'EMAIL'], recipients: { roles: ['FLEET_MANAGER'] }, throttle: { cooldownMin: 60 }, enabled: true, isSystem: true },
    { id: 'alr_3', key: 'unassigned_driving', name: 'Unassigned driving', severity: 'WARNING', conditions: [{ event: 'unidentified.created', params: { minutes: 3 } }], channels: ['IN_APP'], recipients: { roles: ['FLEET_MANAGER', 'DISPATCHER'] }, enabled: true, isSystem: true },
    { id: 'alr_4', key: 'break_due', name: 'Break due soon', severity: 'WARNING', conditions: [{ event: 'hos.break_due', params: { minutes: 20 } }], channels: ['IN_APP'], recipients: { subjectDriver: true }, quietHours: { from: '22:00', to: '06:00', timezone: 'America/New_York' }, enabled: true, isSystem: false },
    { id: 'alr_5', key: 'maintenance_overdue', name: 'Maintenance overdue', severity: 'WARNING', conditions: [{ event: 'maintenance.overdue' }], channels: ['IN_APP', 'EMAIL'], recipients: { roles: ['FLEET_MANAGER'] }, enabled: true, isSystem: false },
    { id: 'alr_6', key: 'harsh_event', name: 'Harsh driving event', severity: 'INFO', conditions: [{ event: 'safety.harsh', params: { severity: 3 } }], channels: ['IN_APP'], recipients: { roles: ['FLEET_MANAGER'] }, enabled: false, isSystem: false },
    { id: 'alr_7', key: 'geofence_exit', name: 'Geofence exit', severity: 'INFO', conditions: [{ event: 'geofence.exit' }], channels: ['IN_APP', 'WEBHOOK'], recipients: { roles: ['DISPATCHER'] }, enabled: false, isSystem: false },
  ];
}

export let ALERT_RULES: AlertRuleRow[] = [];

/* ------------------------------------------------------------------ integrations & api keys */

// WB-251 — the `webhook` row mirrors the backend contract: `config.url` + `config.secret`, the
// secret redacted exactly as `redactConfigSecrets` returns it.
function seedIntegrations(): IntegrationRow[] {
  return [
    { id: 'int_1', provider: 'mcleod', enabled: true, status: 'CONNECTED', lastSyncAt: ago(2 * HOUR), config: { baseUrl: 'https://tms.example.com', apiToken: '***' } },
    { id: 'int_2', provider: 'wex', enabled: true, status: 'CONNECTED', lastSyncAt: ago(9 * HOUR), config: { accountId: '4821', apiKey: '***' } },
    { id: 'int_3', provider: 'comdata', enabled: false, status: 'DISCONNECTED', lastSyncAt: null, config: {} },
    { id: 'int_4', provider: 'quickbooks', enabled: false, status: 'DISCONNECTED', lastSyncAt: null, config: {} },
    { id: 'int_5', provider: 'slack', enabled: true, status: 'CONNECTED', lastSyncAt: ago(30 * 60_000), config: { channel: '#dispatch' } },
    { id: 'int_6', provider: 'webhook', enabled: true, status: 'CONNECTED', lastSyncAt: ago(5 * 60_000), config: { url: 'https://hooks.example.com/onebook', secret: '[REDACTED]' } },
  ];
}

export let INTEGRATIONS: IntegrationRow[] = [];

function seedApiKeys(): ApiKeyRow[] {
  return [
    { id: 'key_1', name: 'McLeod TMS', prefix: 'obk_ABCD', scopes: ['logs:read', 'vehicles:read'], createdAt: daysAgo(120), lastUsedAt: ago(3 * HOUR), expiresAt: null, revokedAt: null },
    { id: 'key_2', name: 'BI warehouse export', prefix: 'obk_7K2Q', scopes: ['reports:read', 'drivers:read', 'vehicles:read'], createdAt: daysAgo(64), lastUsedAt: ago(26 * HOUR), expiresAt: new Date(Date.now() + 200 * DAY).toISOString(), revokedAt: null },
    { id: 'key_3', name: 'Old Zapier hook', prefix: 'obk_ZZ19', scopes: ['logs:read'], createdAt: daysAgo(400), lastUsedAt: daysAgo(190), expiresAt: null, revokedAt: daysAgo(40) },
  ];
}

export let API_KEYS: ApiKeyRow[] = [];

/* ------------------------------------------------------------------ audit log */

const AUDIT_SEEDS: Array<Pick<AuditEntry, 'action' | 'objectType' | 'objectLabel' | 'details'> & { actor: string }> = [
  { actor: 'Sarah Chen', action: 'UPDATE', objectType: 'Role', objectLabel: 'Dispatcher', details: 'trips: READ → FULL' },
  { actor: 'Mike Torres', action: 'CREATE', objectType: 'Vehicle', objectLabel: '#118', details: 'Unit added' },
  { actor: 'Mike Torres', action: 'UPDATE', objectType: 'Driver', objectLabel: 'John Smith', details: 'Assigned unit #101' },
  { actor: 'Sarah Chen', action: 'DELETE', objectType: 'ApiKey', objectLabel: 'Old Zapier hook', details: 'Key revoked' },
  { actor: 'Carlos Ramirez', action: 'UPDATE', objectType: 'Trip', objectLabel: 'TR-10042', details: 'Driver reassigned' },
  { actor: 'System', action: 'CREATE', objectType: 'Violation', objectLabel: 'DRIVING_11', details: 'Auto-detected' },
  { actor: 'Sarah Chen', action: 'VIEW', objectType: 'Report', objectLabel: 'FMCSA pack Jun 2026', details: 'Downloaded' },
  { actor: 'Mike Torres', action: 'UPDATE', objectType: 'AlertRule', objectLabel: 'Harsh driving event', details: 'enabled: true → false' },
  { actor: 'Sarah Chen', action: 'CREATE', objectType: 'User', objectLabel: 'anna.weiss@universal-logistics.example', details: 'Invited as Dispatcher' },
  { actor: 'Mike Torres', action: 'UPDATE', objectType: 'Carrier', objectLabel: 'Universal Logistics Inc.', details: 'complianceEmail changed' },
  { actor: 'Carlos Ramirez', action: 'CREATE', objectType: 'Trip', objectLabel: 'TR-10057', details: 'Load planned' },
  { actor: 'System', action: 'UPDATE', objectType: 'Device', objectLabel: 'PT30_9931', details: 'Firmware 2.4.1 → 2.5.0' },
];

function seedAudit(): AuditEntry[] {
  return AUDIT_SEEDS.map((seed, i) => ({
    id: String(1000 - i),
    createdAt: ago((i + 1) * 3 * HOUR),
    actorType: seed.actor === 'System' ? 'SYSTEM' : 'USER',
    actorId: seed.actor === 'System' ? null : `usr_${(i % 4) + 1}`,
    actorName: seed.actor,
    action: seed.action,
    objectType: seed.objectType,
    objectId: `${seed.objectType.toLowerCase()}_${i + 1}`,
    objectLabel: seed.objectLabel,
    details: seed.details,
    traceId: `01J8X3QK9Z${String(i).padStart(16, '0')}`,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/140.0',
    ipAddress: `203.0.113.${10 + i}`,
  }));
}

export let AUDIT: AuditEntry[] = [];

/* ------------------------------------------------------------------ support tickets */

function seedTickets(): TicketRow[] {
  const seeds: Array<[string, TicketRow['status'], TicketRow['priority'], string]> = [
    ['Device offline on unit #110', 'OPEN', 'HIGH', 'Hardware'],
    ['eRODS transfer rejected by FMCSA', 'IN_PROGRESS', 'URGENT', 'Compliance'],
    ['Driver cannot certify logs in the app', 'OPEN', 'NORMAL', 'Mobile app'],
    ['IFTA report shows the wrong jurisdiction', 'RESOLVED', 'NORMAL', 'Reports'],
    ['Request: add a second admin seat', 'CLOSED', 'LOW', 'Account'],
    ['Bluetooth pairing drops on PT40', 'IN_PROGRESS', 'HIGH', 'Hardware'],
    ['Webhook retries are not firing', 'OPEN', 'NORMAL', 'Integrations'],
  ];
  return seeds.map(([subject, status, priority, category], i) => ({
    id: `tck_${i + 1}`,
    number: `TCK-${String(i + 1).padStart(6, '0')}`,
    subject,
    body: `${subject}. Reported from the web panel; see the attached trace for the failing request.`,
    category,
    priority,
    status,
    requesterType: 'USER',
    requesterId: 'usr_1',
    requesterName: 'Sarah Chen',
    createdAt: ago((i + 1) * 9 * HOUR),
    updatedAt: ago((i + 1) * 2 * HOUR),
  }));
}

export let TICKETS: TicketRow[] = [];

/* ------------------------------------------------------------------ safety */

const SAFETY_TYPES: SafetyEventType[] = ['HARSH_BRAKING', 'HARSH_ACCEL', 'HARSH_TURN', 'SPEEDING', 'SEATBELT'];
const SAFETY_STATUSES: SafetyEventRow['status'][] = ['NEW', 'NEW', 'REVIEWED', 'COACHED', 'COACHED', 'DISMISSED'];
const SAFETY_PLACES = [
  ['I-70 near Columbus, OH', 39.9612, -82.9988],
  ['I-80 near Walcott, IA', 41.5911, -90.7852],
  ['I-40 near Alma, AR', 35.4815, -94.029],
  ['I-95 near Fredericksburg, VA', 38.3627, -77.4981],
  ['I-10 near Ontario, CA', 34.0606, -117.5637],
  ['US-23 near Delaware, OH', 40.2986, -83.068],
] as const;

/** 46 events spread over the last 29 days — the Events tab pages (25/page), the 30-day KPI window
 * keeps every row, and the Coaching tab has real COACHED rows to show. */
function seedSafetyEvents(): SafetyEventRow[] {
  return Array.from({ length: 46 }, (_, i) => {
    const type = SAFETY_TYPES[i % SAFETY_TYPES.length]!;
    const status = SAFETY_STATUSES[i % SAFETY_STATUSES.length]!;
    const [locationName, latitude, longitude] = SAFETY_PLACES[i % SAFETY_PLACES.length]!;
    // 0…28 days back, deterministic but never all on one day.
    const occurredAt = ago(((i * 15) % 29) * DAY + ((i * 7) % 23) * HOUR);
    const speeding = type === 'SPEEDING';
    const coached = status === 'COACHED';
    return {
      id: `sfe_${i + 1}`,
      driverId: `drv_${(i % 12) + 1}`,
      vehicleId: `veh_${(i % VEHICLE_COUNT) + 1}`,
      type,
      occurredAt,
      severity: (i % 5) + 1,
      speedMph: speeding ? 68 + (i % 9) : null,
      speedLimitMph: speeding ? 65 : null,
      gForce: type.startsWith('HARSH') ? (0.35 + (i % 7) / 20).toFixed(2) : null,
      latitude,
      longitude,
      locationName,
      durationSec: speeding ? 60 + (i % 5) * 45 : null,
      status,
      coachedById: coached ? 'usr_2' : null,
      coachedAt: coached ? ago(((i * 15) % 29) * DAY - 6 * HOUR) : null,
      coachingNote: coached ? 'Reviewed the event with the driver; following up next trip.' : null,
    };
  });
}

export let SAFETY_EVENTS: SafetyEventRow[] = [];

/** 12 ranked drivers — enough that the scorecard is worth ranking and the toast names a real
 * driver (the `driver` object itself is the client-side join against `/drivers`). */
function seedScorecard(): DriverScoreRow[] {
  const periodStart = daysAgo(30).slice(0, 10);
  const periodEnd = daysAgo(0).slice(0, 10);
  return Array.from({ length: 12 }, (_, i) => ({
    id: `dsc_${i + 1}`,
    driverId: `drv_${i + 1}`,
    periodStart,
    periodEnd,
    score: 96 - i * 3,
    harshCount: i % 6,
    speedingCount: (i * 2) % 7,
    milesDriven: 9_400 - i * 420,
    violationCount: i % 4 === 0 ? 1 : 0,
    rank: i + 1,
  }));
}

export let SCORECARD: DriverScoreRow[] = [];
export const SCORECARD_PERIOD = { periodStart: daysAgo(30).slice(0, 10), periodEnd: daysAgo(0).slice(0, 10) };

/* ------------------------------------------------------------------ reset */

let nextId = 0;
export const mockId = (prefix: string): string => `${prefix}_new_${++nextId}`;

/** Re-seeds every table. Called at module load and by tests in `afterEach`. */
export function resetMockState(): void {
  VEHICLES = Array.from({ length: VEHICLE_COUNT }, (_, i) => seedVehicle(i + 1));
  DRIVERS = seedDrivers();
  DEVICES = seedDevices();
  CARRIER = seedCarrier();
  ROLES = seedRoles();
  USERS = seedUsers();
  for (const role of ROLES) {
    role.userCount = USERS.filter((u) => u.role.key === role.key).length;
  }
  ALERT_RULES = seedAlertRules();
  INTEGRATIONS = seedIntegrations();
  API_KEYS = seedApiKeys();
  AUDIT = seedAudit();
  TICKETS = seedTickets();
  SAFETY_EVENTS = seedSafetyEvents();
  SCORECARD = seedScorecard();
  nextId = 0;
}

resetMockState();
