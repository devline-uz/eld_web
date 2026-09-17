// owner: web-vehicles-drivers — B-1 (driver roster) and B-2 (driver HOS) shipped 2026-09-14 and
// are contract-tested against openapi.json; B-4 (unit histories/route replay) and B-5 (unit
// activity) are still gaps. Each handler answers
// exactly the shape recorded in web/backend-gaps.md so swapping to the real endpoint later is a
// one-line change in `shared/api/vehicles.ts` / `shared/api/drivers.ts`.
import { http } from 'msw';
import { endpoints } from '@/shared/api/endpoints';
import { ok, url, serverPage } from '../envelope';
import type { DriverRosterEntry, DriverRosterResponse } from '@/shared/api/drivers';
import type { DeviceRow, DriverRow, VehicleActivityItem, VehicleHistoriesResponse, VehicleRow } from '@/shared/api/vehicles';

/** B-1 — 8 representative rows; total pretends the seeded 58 for header math. */
const ROSTER_ENTRIES: DriverRosterEntry[] = [
  {
    driver: { id: 'drv_1', username: 'johnsmith', firstName: 'John', lastName: 'Smith', homeTerminalName: 'Columbus, OH', appVersion: 'v2.24', email: 'john.smith@example.com', eldExempt: false, allowPersonalConveyance: true, allowYardMove: true, shortHaulException: false, splitSleeperEnabled: false },
    dutyStatus: 'ON_DUTY',
    unit: { id: 'veh_1', unitNumber: '#101' },
    hos: { driveRemainingSec: 0, shiftRemainingSec: 1140, cycleRemainingSec: 46140 },
    openViolations: 1,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_2', username: 'marcusw', firstName: 'Marcus', lastName: 'Webb', homeTerminalName: 'Columbus, OH', appVersion: 'v2.24', email: 'marcus.webb@example.com', eldExempt: false, allowPersonalConveyance: true, allowYardMove: false, shortHaulException: false, splitSleeperEnabled: true },
    dutyStatus: 'DRIVING',
    unit: { id: 'veh_2', unitNumber: '#102' },
    hos: { driveRemainingSec: 16200, shiftRemainingSec: 20400, cycleRemainingSec: 252000 },
    openViolations: 0,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_3', username: 'aliciag', firstName: 'Alicia', lastName: 'Grant', homeTerminalName: 'Raleigh, NC', appVersion: 'v2.23', email: 'alicia.grant@example.com', eldExempt: false, allowPersonalConveyance: true, allowYardMove: true, shortHaulException: true, splitSleeperEnabled: false },
    dutyStatus: 'SLEEPER',
    unit: { id: 'veh_3', unitNumber: '#103' },
    hos: { driveRemainingSec: 39600, shiftRemainingSec: 43200, cycleRemainingSec: 180000 },
    openViolations: 0,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_4', username: 'kristinw', firstName: 'Kristin', lastName: 'Watson', homeTerminalName: 'Raleigh, NC', appVersion: 'v2.24', email: 'kristin.watson@example.com', eldExempt: true, allowPersonalConveyance: false, allowYardMove: false, shortHaulException: false, splitSleeperEnabled: false },
    dutyStatus: 'OFF_DUTY',
    unit: null,
    hos: { driveRemainingSec: 39600, shiftRemainingSec: 50400, cycleRemainingSec: 252000 },
    openViolations: 0,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_5', username: 'dpierce', firstName: 'Daniel', lastName: 'Pierce', homeTerminalName: 'Columbus, OH', appVersion: 'v2.20', email: 'daniel.pierce@example.com', eldExempt: false, allowPersonalConveyance: true, allowYardMove: true, shortHaulException: false, splitSleeperEnabled: false },
    dutyStatus: 'ON_DUTY',
    unit: { id: 'veh_4', unitNumber: '#104' },
    hos: { driveRemainingSec: 0, shiftRemainingSec: 0, cycleRemainingSec: 12600 },
    openViolations: 2,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_6', username: 'dalvarez', firstName: 'Derek', lastName: 'Alvarez', homeTerminalName: 'Columbus, OH', appVersion: 'v2.24', email: 'derek.alvarez@example.com', eldExempt: true, allowPersonalConveyance: false, allowYardMove: true, shortHaulException: true, splitSleeperEnabled: true },
    dutyStatus: 'DRIVING',
    unit: { id: 'veh_5', unitNumber: '#105' },
    hos: { driveRemainingSec: 39600, shiftRemainingSec: 50400, cycleRemainingSec: 252000 },
    openViolations: 0,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_7', username: 'tbrooks', firstName: 'Tanya', lastName: 'Brooks', homeTerminalName: 'Dayton, OH', appVersion: 'v2.23', email: 'tanya.brooks@example.com', eldExempt: false, allowPersonalConveyance: true, allowYardMove: false, shortHaulException: false, splitSleeperEnabled: false },
    dutyStatus: 'ON_DUTY',
    unit: { id: 'veh_6', unitNumber: '#106' },
    hos: { driveRemainingSec: 36000, shiftRemainingSec: 46800, cycleRemainingSec: 237600 },
    openViolations: 0,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_8', username: 'lmoreno', firstName: 'Luis', lastName: 'Moreno', homeTerminalName: 'Raleigh, NC', appVersion: 'v2.24', email: 'luis.moreno@example.com', eldExempt: false, allowPersonalConveyance: true, allowYardMove: true, shortHaulException: false, splitSleeperEnabled: false },
    dutyStatus: 'SLEEPER',
    unit: { id: 'veh_7', unitNumber: '#107' },
    hos: { driveRemainingSec: 32400, shiftRemainingSec: 1140, cycleRemainingSec: 223200 },
    openViolations: 2,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_9', username: 'pnandakumar', firstName: 'Priya', lastName: 'Nandakumar', homeTerminalName: 'Indianapolis, IN', appVersion: 'v2.22', email: 'priya.nandakumar@example.com', eldExempt: false, allowPersonalConveyance: false, allowYardMove: false, shortHaulException: false, splitSleeperEnabled: false },
    dutyStatus: 'OFF_DUTY',
    unit: null,
    hos: { driveRemainingSec: 28800, shiftRemainingSec: 39600, cycleRemainingSec: 208800 },
    openViolations: 0,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_10', username: 'ohaddad', firstName: 'Omar', lastName: 'Haddad', homeTerminalName: 'Louisville, KY', appVersion: 'v2.24', email: 'omar.haddad@example.com', eldExempt: false, allowPersonalConveyance: true, allowYardMove: true, shortHaulException: false, splitSleeperEnabled: false },
    dutyStatus: 'DRIVING',
    unit: { id: 'veh_9', unitNumber: '#109' },
    hos: { driveRemainingSec: 25200, shiftRemainingSec: 1140, cycleRemainingSec: 194400 },
    openViolations: 3,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_11', username: 'gwhitfield', firstName: 'Grace', lastName: 'Whitfield', homeTerminalName: 'Toledo, OH', appVersion: 'v2.20', email: 'grace.whitfield@example.com', eldExempt: false, allowPersonalConveyance: true, allowYardMove: false, shortHaulException: false, splitSleeperEnabled: true },
    dutyStatus: 'ON_DUTY',
    unit: { id: 'veh_10', unitNumber: '#110' },
    hos: { driveRemainingSec: 21600, shiftRemainingSec: 32400, cycleRemainingSec: 180000 },
    openViolations: 0,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_12', username: 'vosei', firstName: 'Victor', lastName: 'Osei', homeTerminalName: 'Cincinnati, OH', appVersion: 'v2.24', email: 'victor.osei@example.com', eldExempt: false, allowPersonalConveyance: false, allowYardMove: true, shortHaulException: false, splitSleeperEnabled: false },
    dutyStatus: 'SLEEPER',
    unit: { id: 'veh_11', unitNumber: '#111' },
    hos: { driveRemainingSec: 18000, shiftRemainingSec: 1140, cycleRemainingSec: 165600 },
    openViolations: 2,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_13', username: 'hdelgado', firstName: 'Hannah', lastName: 'Delgado', homeTerminalName: 'Chicago, IL', appVersion: 'v2.23', email: 'hannah.delgado@example.com', eldExempt: false, allowPersonalConveyance: true, allowYardMove: false, shortHaulException: true, splitSleeperEnabled: false },
    dutyStatus: 'OFF_DUTY',
    unit: { id: 'veh_12', unitNumber: '#112' },
    hos: { driveRemainingSec: 14400, shiftRemainingSec: 25200, cycleRemainingSec: 151200 },
    openViolations: 0,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_14', username: 'ecaldwell', firstName: 'Ethan', lastName: 'Caldwell', homeTerminalName: 'Columbus, OH', appVersion: 'v2.24', email: 'ethan.caldwell@example.com', eldExempt: false, allowPersonalConveyance: true, allowYardMove: true, shortHaulException: false, splitSleeperEnabled: false },
    dutyStatus: 'DRIVING',
    unit: { id: 'veh_13', unitNumber: '#113' },
    hos: { driveRemainingSec: 10800, shiftRemainingSec: 21600, cycleRemainingSec: 136800 },
    openViolations: 0,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_15', username: 'rbautista', firstName: 'Renee', lastName: 'Bautista', homeTerminalName: 'Dayton, OH', appVersion: 'v2.22', email: 'renee.bautista@example.com', eldExempt: false, allowPersonalConveyance: false, allowYardMove: false, shortHaulException: false, splitSleeperEnabled: false },
    dutyStatus: 'OFF_DUTY',
    unit: null,
    hos: { driveRemainingSec: 7200, shiftRemainingSec: 18000, cycleRemainingSec: 122400 },
    openViolations: 0,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_16', username: 'dfeldman', firstName: 'Dominic', lastName: 'Feldman', homeTerminalName: 'Raleigh, NC', appVersion: 'v2.24', email: 'dominic.feldman@example.com', eldExempt: false, allowPersonalConveyance: true, allowYardMove: true, shortHaulException: false, splitSleeperEnabled: true },
    dutyStatus: 'SLEEPER',
    unit: { id: 'veh_15', unitNumber: '#115' },
    hos: { driveRemainingSec: 39600, shiftRemainingSec: 1140, cycleRemainingSec: 108000 },
    openViolations: 2,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_17', username: 'arahman', firstName: 'Aisha', lastName: 'Rahman', homeTerminalName: 'Indianapolis, IN', appVersion: 'v2.20', email: 'aisha.rahman@example.com', eldExempt: true, allowPersonalConveyance: true, allowYardMove: false, shortHaulException: false, splitSleeperEnabled: false },
    dutyStatus: 'OFF_DUTY',
    unit: { id: 'veh_16', unitNumber: '#116' },
    hos: { driveRemainingSec: 36000, shiftRemainingSec: 10800, cycleRemainingSec: 93600 },
    openViolations: 0,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_18', username: 'pkovacs', firstName: 'Peter', lastName: 'Kovacs', homeTerminalName: 'Louisville, KY', appVersion: 'v2.24', email: 'peter.kovacs@example.com', eldExempt: false, allowPersonalConveyance: false, allowYardMove: true, shortHaulException: false, splitSleeperEnabled: false },
    dutyStatus: 'DRIVING',
    unit: { id: 'veh_17', unitNumber: '#117' },
    hos: { driveRemainingSec: 32400, shiftRemainingSec: 1140, cycleRemainingSec: 79200 },
    openViolations: 3,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_19', username: 'npetrova', firstName: 'Nadia', lastName: 'Petrova', homeTerminalName: 'Toledo, OH', appVersion: 'v2.23', email: 'nadia.petrova@example.com', eldExempt: false, allowPersonalConveyance: true, allowYardMove: false, shortHaulException: false, splitSleeperEnabled: false },
    dutyStatus: 'ON_DUTY',
    unit: { id: 'veh_18', unitNumber: '#118' },
    hos: { driveRemainingSec: 28800, shiftRemainingSec: 46800, cycleRemainingSec: 64800 },
    openViolations: 0,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_20', username: 'clane', firstName: 'Curtis', lastName: 'Lane', homeTerminalName: 'Cincinnati, OH', appVersion: 'v2.24', email: 'curtis.lane@example.com', eldExempt: false, allowPersonalConveyance: true, allowYardMove: true, shortHaulException: true, splitSleeperEnabled: false },
    dutyStatus: 'SLEEPER',
    unit: { id: 'veh_19', unitNumber: '#119' },
    hos: { driveRemainingSec: 25200, shiftRemainingSec: 1140, cycleRemainingSec: 252000 },
    openViolations: 2,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_21', username: 'bferraro', firstName: 'Bianca', lastName: 'Ferraro', homeTerminalName: 'Chicago, IL', appVersion: 'v2.22', email: 'bianca.ferraro@example.com', eldExempt: false, allowPersonalConveyance: false, allowYardMove: false, shortHaulException: false, splitSleeperEnabled: true },
    dutyStatus: 'OFF_DUTY',
    unit: { id: 'veh_20', unitNumber: '#120' },
    hos: { driveRemainingSec: 21600, shiftRemainingSec: 39600, cycleRemainingSec: 237600 },
    openViolations: 0,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_22', username: 'tnakamura', firstName: 'Trevor', lastName: 'Nakamura', homeTerminalName: 'Columbus, OH', appVersion: 'v2.24', email: 'trevor.nakamura@example.com', eldExempt: false, allowPersonalConveyance: true, allowYardMove: true, shortHaulException: false, splitSleeperEnabled: false },
    dutyStatus: 'OFF_DUTY',
    unit: null,
    hos: { driveRemainingSec: 18000, shiftRemainingSec: 36000, cycleRemainingSec: 223200 },
    openViolations: 0,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_23', username: 'smarquez', firstName: 'Sofia', lastName: 'Marquez', homeTerminalName: 'Dayton, OH', appVersion: 'v2.20', email: 'sofia.marquez@example.com', eldExempt: false, allowPersonalConveyance: true, allowYardMove: false, shortHaulException: false, splitSleeperEnabled: false },
    dutyStatus: 'ON_DUTY',
    unit: { id: 'veh_22', unitNumber: '#122' },
    hos: { driveRemainingSec: 14400, shiftRemainingSec: 32400, cycleRemainingSec: 208800 },
    openViolations: 0,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_24', username: 'gwhitaker', firstName: 'Gerald', lastName: 'Whitaker', homeTerminalName: 'Raleigh, NC', appVersion: 'v2.24', email: 'gerald.whitaker@example.com', eldExempt: false, allowPersonalConveyance: false, allowYardMove: true, shortHaulException: false, splitSleeperEnabled: false },
    dutyStatus: 'SLEEPER',
    unit: { id: 'veh_23', unitNumber: '#123' },
    hos: { driveRemainingSec: 10800, shiftRemainingSec: 1140, cycleRemainingSec: 194400 },
    openViolations: 2,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_25', username: 'iclarke', firstName: 'Imani', lastName: 'Clarke', homeTerminalName: 'Indianapolis, IN', appVersion: 'v2.23', email: 'imani.clarke@example.com', eldExempt: false, allowPersonalConveyance: true, allowYardMove: false, shortHaulException: false, splitSleeperEnabled: false },
    dutyStatus: 'OFF_DUTY',
    unit: { id: 'veh_24', unitNumber: '#124' },
    hos: { driveRemainingSec: 7200, shiftRemainingSec: 25200, cycleRemainingSec: 180000 },
    openViolations: 0,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_26', username: 'rduval', firstName: 'Roland', lastName: 'Duval', homeTerminalName: 'Louisville, KY', appVersion: 'v2.24', email: 'roland.duval@example.com', eldExempt: false, allowPersonalConveyance: true, allowYardMove: true, shortHaulException: false, splitSleeperEnabled: true },
    dutyStatus: 'DRIVING',
    unit: { id: 'veh_25', unitNumber: '#125' },
    hos: { driveRemainingSec: 39600, shiftRemainingSec: 1140, cycleRemainingSec: 165600 },
    openViolations: 3,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_27', username: 'knguyen', firstName: 'Kelsey', lastName: 'Nguyen', homeTerminalName: 'Toledo, OH', appVersion: 'v2.22', email: 'kelsey.nguyen@example.com', eldExempt: false, allowPersonalConveyance: false, allowYardMove: false, shortHaulException: true, splitSleeperEnabled: false },
    dutyStatus: 'ON_DUTY',
    unit: { id: 'veh_26', unitNumber: '#126' },
    hos: { driveRemainingSec: 36000, shiftRemainingSec: 18000, cycleRemainingSec: 151200 },
    openViolations: 0,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_28', username: 'aboateng', firstName: 'Andre', lastName: 'Boateng', homeTerminalName: 'Cincinnati, OH', appVersion: 'v2.24', email: 'andre.boateng@example.com', eldExempt: true, allowPersonalConveyance: true, allowYardMove: true, shortHaulException: false, splitSleeperEnabled: false },
    dutyStatus: 'OFF_DUTY',
    unit: null,
    hos: { driveRemainingSec: 32400, shiftRemainingSec: 1140, cycleRemainingSec: 136800 },
    openViolations: 2,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_29', username: 'mlindqvist', firstName: 'Maya', lastName: 'Lindqvist', homeTerminalName: 'Chicago, IL', appVersion: 'v2.20', email: 'maya.lindqvist@example.com', eldExempt: false, allowPersonalConveyance: true, allowYardMove: false, shortHaulException: false, splitSleeperEnabled: false },
    dutyStatus: 'OFF_DUTY',
    unit: { id: 'veh_28', unitNumber: '#128' },
    hos: { driveRemainingSec: 28800, shiftRemainingSec: 10800, cycleRemainingSec: 122400 },
    openViolations: 0,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_30', username: 'hsalinas', firstName: 'Hector', lastName: 'Salinas', homeTerminalName: 'Columbus, OH', appVersion: 'v2.24', email: 'hector.salinas@example.com', eldExempt: false, allowPersonalConveyance: false, allowYardMove: true, shortHaulException: false, splitSleeperEnabled: false },
    dutyStatus: 'DRIVING',
    unit: { id: 'veh_29', unitNumber: '#129' },
    hos: { driveRemainingSec: 25200, shiftRemainingSec: 50400, cycleRemainingSec: 108000 },
    openViolations: 0,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_31', username: 'fandersen', firstName: 'Freya', lastName: 'Andersen', homeTerminalName: 'Dayton, OH', appVersion: 'v2.23', email: 'freya.andersen@example.com', eldExempt: false, allowPersonalConveyance: true, allowYardMove: false, shortHaulException: false, splitSleeperEnabled: true },
    dutyStatus: 'ON_DUTY',
    unit: { id: 'veh_30', unitNumber: '#130' },
    hos: { driveRemainingSec: 21600, shiftRemainingSec: 46800, cycleRemainingSec: 93600 },
    openViolations: 0,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_32', username: 'dblake', firstName: 'Desmond', lastName: 'Blake', homeTerminalName: 'Raleigh, NC', appVersion: 'v2.24', email: 'desmond.blake@example.com', eldExempt: false, allowPersonalConveyance: true, allowYardMove: true, shortHaulException: false, splitSleeperEnabled: false },
    dutyStatus: 'SLEEPER',
    unit: { id: 'veh_31', unitNumber: '#131' },
    hos: { driveRemainingSec: 18000, shiftRemainingSec: 1140, cycleRemainingSec: 79200 },
    openViolations: 2,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_33', username: 'pzielinska', firstName: 'Paulina', lastName: 'Zielinska', homeTerminalName: 'Indianapolis, IN', appVersion: 'v2.22', email: 'paulina.zielinska@example.com', eldExempt: false, allowPersonalConveyance: false, allowYardMove: false, shortHaulException: false, splitSleeperEnabled: false },
    dutyStatus: 'OFF_DUTY',
    unit: { id: 'veh_32', unitNumber: '#132' },
    hos: { driveRemainingSec: 14400, shiftRemainingSec: 39600, cycleRemainingSec: 64800 },
    openViolations: 0,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_34', username: 'itoure', firstName: 'Ibrahim', lastName: 'Toure', homeTerminalName: 'Louisville, KY', appVersion: 'v2.24', email: 'ibrahim.toure@example.com', eldExempt: false, allowPersonalConveyance: true, allowYardMove: true, shortHaulException: true, splitSleeperEnabled: false },
    dutyStatus: 'OFF_DUTY',
    unit: null,
    hos: { driveRemainingSec: 10800, shiftRemainingSec: 1140, cycleRemainingSec: 252000 },
    openViolations: 3,
    emailVerified: null,
  },
  {
    driver: { id: 'drv_35', username: 'creyes', firstName: 'Colette', lastName: 'Reyes', homeTerminalName: 'Toledo, OH', appVersion: 'v2.20', email: 'colette.reyes@example.com', eldExempt: false, allowPersonalConveyance: true, allowYardMove: false, shortHaulException: false, splitSleeperEnabled: false },
    dutyStatus: 'ON_DUTY',
    unit: { id: 'veh_34', unitNumber: '#134' },
    hos: { driveRemainingSec: 7200, shiftRemainingSec: 32400, cycleRemainingSec: 237600 },
    openViolations: 0,
    emailVerified: null,
  },
];

// ─── Deterministic bulk fill (dev/test data volume) ──────────────────────────
//
// The literal rows above are the ones the W-06 / W-03 suites pin by name (`drv_1`…`drv_35`,
// `veh_1`…`veh_34`, `#101`…`#134`) — they stay first and unchanged. Everything past them is
// derived from the row INDEX by pure functions: no `Math.random()`, so every import, test run and
// dev reload sees byte-identical data and paging/segment counts are reproducible.
//
// `GET /vehicles`, `GET /drivers` and `GET /devices` are registered here (ahead of `fleetHandlers`,
// same first-match-wins rule as `/drivers/roster` above) because the generated OpenAPI fixtures
// answer those three with a single stub row each — a 120-unit table cannot be joined against one
// driver and one device. `fixtures.generated.ts` is regenerated from `openapi.json`, so the volume
// has to live in a hand-written module; this is the module that already owns the vehicles/drivers
// domain.

const FIRST_NAMES = [
  'Adrian', 'Bianca', 'Caleb', 'Dahlia', 'Elias', 'Fiona', 'Gabriel', 'Helena',
  'Isaac', 'Jasmine', 'Kieran', 'Lorena', 'Mateo', 'Noelle', 'Oscar', 'Priscilla',
  'Quentin', 'Rosalind', 'Silas', 'Tamara', 'Ulises', 'Verena', 'Wendell', 'Ximena',
  'Yusuf', 'Zara', 'Beatriz', 'Corbin', 'Delphine', 'Emmett', 'Francesca', 'Gideon',
  'Harriet', 'Ivan', 'Juno', 'Konrad', 'Leandra', 'Mirela', 'Nikolai', 'Ophelia',
] as const;

const LAST_NAMES = [
  'Ashford', 'Beaumont', 'Calloway', 'Dunmore', 'Everly', 'Fairbanks', 'Galloway',
  'Hargrove', 'Ingram', 'Jessup', 'Kingsley', 'Lachlan', 'Marchetti', 'Norwood',
  'Ortega', 'Prescott', 'Quintero', 'Radcliffe', 'Sinclair', 'Thorne', 'Underwood',
  'Vasquez', 'Whitlock', 'Xanthos', 'Yarborough', 'Zamora', 'Abernathy', 'Blackwood',
  'Carrington', 'Dempsey', 'Ellington', 'Fontaine', 'Granger', 'Holloway', 'Isakov',
  'Jennings', 'Kowalski', 'Larkspur', 'Maddox', 'Novak', 'Okonkwo',
] as const;

/** 40 × 41 names, walked with coprime strides — no repeated full name inside one fleet. */
const fullName = (i: number): { firstName: string; lastName: string } => ({
  firstName: FIRST_NAMES[i % FIRST_NAMES.length]!,
  lastName: LAST_NAMES[(i * 3) % LAST_NAMES.length]!,
});

const TERMINALS = [
  'Columbus, OH', 'Raleigh, NC', 'Indianapolis, IN', 'Louisville, KY', 'Chicago, IL',
  'Dallas, TX', 'Denver, CO', 'Phoenix, AZ', 'Atlanta, GA', 'Memphis, TN',
  'Kansas City, MO', 'Salt Lake City, UT', 'Portland, OR',
] as const;

const TIMEZONE_BY_STATE: Record<string, string> = {
  OH: 'America/New_York', NC: 'America/New_York', KY: 'America/New_York',
  GA: 'America/New_York', IN: 'America/Indiana/Indianapolis',
  IL: 'America/Chicago', TX: 'America/Chicago', TN: 'America/Chicago',
  MO: 'America/Chicago', CO: 'America/Denver', UT: 'America/Denver',
  AZ: 'America/Phoenix', OR: 'America/Los_Angeles',
};

/** `'Columbus, OH'` → `'OH'`; the literal rows use the same "City, ST" convention. */
const stateOf = (terminal: string): string => terminal.slice(-2);
const timezoneOf = (terminal: string): string => TIMEZONE_BY_STATE[stateOf(terminal)] ?? 'America/New_York';

/** `veh_1` is `#101` in every literal row above — kept for every generated unit. */
const unitNumberFor = (n: number): string => `#${100 + n}`;

const APP_VERSIONS = ['v2.24', 'v2.23', 'v2.22', 'v2.20'] as const;
const DUTY_STATUSES = ['DRIVING', 'ON_DUTY', 'SLEEPER', 'OFF_DUTY'] as const;

/** Generated roster rows: `drv_36`… paired with `veh_35`…, one in nine deliberately unassigned so
 * the W-06 "no unit" column and the W-03 Unassigned segment both have rows to render. */
const GENERATED_DRIVER_COUNT = 80;
const LITERAL_DRIVER_COUNT = 35;
const LITERAL_VEHICLE_COUNT = 34;

function generatedRosterEntry(i: number): DriverRosterEntry {
  const driverNo = LITERAL_DRIVER_COUNT + 1 + i;
  const vehicleNo = LITERAL_VEHICLE_COUNT + 1 + i;
  const { firstName, lastName } = fullName(i);
  const terminal = TERMINALS[i % TERMINALS.length]!;
  const unassigned = i % 9 === 4;
  const dutyStatus = DUTY_STATUSES[i % DUTY_STATUSES.length]!;
  const driving = dutyStatus === 'DRIVING';
  return {
    driver: {
      id: `drv_${driverNo}`,
      username: `${firstName[0]!.toLowerCase()}${lastName.toLowerCase()}`,
      firstName,
      lastName,
      homeTerminalName: terminal,
      appVersion: APP_VERSIONS[i % APP_VERSIONS.length]!,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      eldExempt: i % 17 === 3,
      allowPersonalConveyance: i % 4 !== 1,
      allowYardMove: i % 3 !== 2,
      shortHaulException: i % 11 === 5,
      splitSleeperEnabled: i % 7 === 2,
    },
    dutyStatus,
    unit: unassigned ? null : { id: `veh_${vehicleNo}`, unitNumber: unitNumberFor(vehicleNo) },
    hos: {
      driveRemainingSec: driving ? 39600 - (i % 11) * 3600 : (i % 12) * 1800,
      shiftRemainingSec: 50400 - (i % 14) * 3600,
      cycleRemainingSec: 252000 - (i % 20) * 10800,
    },
    openViolations: i % 13 === 0 ? 2 : i % 5 === 0 ? 1 : 0,
    emailVerified: null,
  };
}

const ROSTER_ALL: DriverRosterEntry[] = [
  ...ROSTER_ENTRIES,
  ...Array.from({ length: GENERATED_DRIVER_COUNT }, (_, i) => generatedRosterEntry(i)),
];

// ─── `GET /drivers` — the raw `Driver` rows the Vehicles/Trips/DVIR joins read ────────────────
// Derived FROM the roster so `assignedVehicleId` can never drift out of sync with `unit.id`
// (a mismatch renders 120 rows of "Unassigned", which is worse than no data).

const CDL_STATE_POOL = ['OH', 'NC', 'IN', 'KY', 'IL', 'TX', 'CO', 'AZ', 'GA', 'TN'] as const;

function driverRowFrom(entry: DriverRosterEntry, i: number): DriverRow {
  const terminal = entry.driver.homeTerminalName;
  return {
    id: entry.driver.id,
    username: entry.driver.username,
    firstName: entry.driver.firstName,
    lastName: entry.driver.lastName,
    email: entry.driver.email,
    phone: `+1 614 555 ${String(100 + (i % 899)).padStart(4, '0')}`,
    cdlNumber: `W${String(8500000 + i * 7919).slice(0, 7)}`,
    cdlState: stateOf(terminal) || CDL_STATE_POOL[i % CDL_STATE_POOL.length]!,
    status: i % 23 === 7 ? 'INACTIVE' : 'ACTIVE',
    homeTerminalName: terminal,
    homeTerminalTimezone: timezoneOf(terminal),
    fleetManagerId: null,
    assignedVehicleId: entry.unit?.id ?? null,
    allowPersonalConveyance: entry.driver.allowPersonalConveyance,
    allowYardMove: entry.driver.allowYardMove,
    adverseDrivingEnabled: i % 6 === 1,
    shortHaulException: entry.driver.shortHaulException,
    splitSleeperEnabled: entry.driver.splitSleeperEnabled,
    eldExempt: entry.driver.eldExempt,
    eldExemptReason: entry.driver.eldExempt ? 'Pre-2000 engine' : null,
    appVersion: entry.driver.appVersion,
    appPlatform: i % 3 === 0 ? 'iOS' : 'Android',
    registeredAt: `2025-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 27)).padStart(2, '0')}T00:00:00.000Z`,
  };
}

/** Exported so the W-08 RODS mock (`hosGaps.ts`) reads the SAME home-terminal timezone the
 *  Drivers screen shows — a RODS day built in the wrong zone is an hour off on the grid. */
export const DRIVER_ROWS: DriverRow[] = ROSTER_ALL.map(driverRowFrom);

// ─── `GET /vehicles` — 120 units, `veh_1`…`veh_120` / `#101`…`#220` ───────────────────────────

const FLEET_MODELS = [
  { make: 'Freightliner', model: 'Cascadia', vin: '1FUJGLDR' },
  { make: 'Kenworth', model: 'T680', vin: '1XKYDP9X' },
  { make: 'Peterbilt', model: '579', vin: '1XPBDP9X' },
  { make: 'Volvo', model: 'VNL 760', vin: '4V4NC9EH' },
  { make: 'International', model: 'LT625', vin: '3HSDJAPR' },
  { make: 'Mack', model: 'Anthem', vin: '1M1AN07Y' },
  { make: 'Western Star', model: '5700XE', vin: '5KJJAVDV' },
  { make: 'Freightliner', model: 'M2 106', vin: '1FVACWDT' },
] as const;

/** VIN characters exclude I, O and Q per FMVSS 115 — a "realistic" VIN that fails a checker is
 * worse than an obviously fake one, so the 17 chars are structured, just not check-digit valid. */
const VIN_ALPHABET = 'ABCDEFGHJKLMNPRSTUVWXYZ';
const VEHICLE_COUNT = 120;

function vehicleRow(n: number): VehicleRow {
  const i = n - 1;
  const spec = FLEET_MODELS[i % FLEET_MODELS.length]!;
  const year = 2018 + (i % 8);
  const plateState = stateOf(TERMINALS[i % TERMINALS.length]!);
  const plate = `${VIN_ALPHABET[i % 23]}${VIN_ALPHABET[(i * 5) % 23]}${VIN_ALPHABET[(i * 11) % 23]}-${String(1000 + ((i * 137) % 9000))}`;
  const status: VehicleRow['status'] = n % 17 === 0 ? 'OUT_OF_SERVICE' : n % 11 === 3 ? 'INACTIVE' : 'ACTIVE';
  const odometerMi = 180_000 + i * 6_731;
  const hasDevice = n % 13 !== 6;
  return {
    id: `veh_${n}`,
    unitNumber: unitNumberFor(n),
    vin: `${spec.vin}${VIN_ALPHABET[i % 23]}${String(year).slice(-1)}L${String(100000 + ((i * 7919) % 900000))}`,
    make: spec.make,
    model: spec.model,
    year,
    licensePlate: plate,
    plateState,
    fuelType: i % 19 === 4 ? 'CNG' : 'DIESEL',
    sleeperBerth: i % 5 !== 3,
    odometerMi,
    deviceOdometerMi: hasDevice ? odometerMi - 12_480 : null,
    odometerOffsetMi: hasDevice ? 12_480 : 0,
    odometerCalibratedAt: null,
    engineHours: String(4_000 + i * 37) + '.2',
    busType: null,
    status,
    notes: status === 'OUT_OF_SERVICE' ? 'In shop — awaiting parts' : null,
    activatedAt: `${year + 1}-${String(1 + (i % 12)).padStart(2, '0')}-18T00:00:00.000Z`,
    createdAt: `${year + 1}-${String(1 + (i % 12)).padStart(2, '0')}-18T00:00:00.000Z`,
  };
}

const VEHICLE_ROWS: VehicleRow[] = Array.from({ length: VEHICLE_COUNT }, (_, i) => vehicleRow(i + 1));

// ─── `GET /devices` — the ELD SERIAL column of the Vehicles table ─────────────────────────────
// Serials continue `fleet.ts`'s `LIVE_FLEET` series exactly (0xA100 + 0x25·n from `veh_5`), so the
// same unit shows the same serial on the live map and in the units table.

const LEGACY_SERIALS: Record<number, string> = { 1: 'PT30_A86E', 2: 'PT30_11B2', 3: 'PT30_7C10', 4: 'PT30_9931' };
const serialFor = (n: number): string =>
  LEGACY_SERIALS[n] ?? `PT30_${(0xa100 + 0x25 * (n - 5)).toString(16).toUpperCase()}`;

function deviceRow(n: number, seq: number): DeviceRow {
  const outdated = n % 9 === 2;
  return {
    id: `dev_${seq}`,
    serial: serialFor(n),
    model: n % 6 === 5 ? 'PT40' : 'PT30',
    status: 'ASSIGNED',
    vehicleId: `veh_${n}`,
    bleState: n % 8 === 3 ? 'DISCONNECTED' : 'CONNECTED',
    firmwareVersion: outdated ? 'L104' : 'L108',
    firmwareOutdated: outdated,
    lastHeartbeatAt: `2026-09-12T${String(10 + (n % 6)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}:00.000Z`,
  };
}

const DEVICE_ROWS: DeviceRow[] = [
  ...Array.from({ length: VEHICLE_COUNT }, (_, i) => i + 1)
    .filter((n) => n % 13 !== 6)
    .map((n, seq) => deviceRow(n, seq + 1)),
  // Spares in the depot — an unpaired device the 11.20 Devices screen must also render.
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `dev_spare_${i + 1}`,
    serial: `PT30_SP${String(10 + i)}`,
    model: 'PT30',
    status: 'UNASSIGNED',
    vehicleId: null,
    bleState: 'DISCONNECTED',
    firmwareVersion: 'L108',
    firmwareOutdated: false,
    lastHeartbeatAt: null,
  })),
];

/** One server page of the roster — real paging now that the roster is fleet-sized. */
const rosterPage = (request: Request): DriverRosterResponse => serverPage<DriverRosterEntry>(ROSTER_ALL, request);

const HOS_RIGHT_NOW = {
  driveRemainingSec: 0,
  shiftRemainingSec: 1140,
  cycleRemainingSec: 46140,
  breakInSec: 7440,
  onDutySince: '2026-09-12T14:26:00.000Z',
  cycleLimitSec: 252000,
  shiftLimitSec: 50400,
  driveLimitSec: 39600,
  breakLimitSec: 28800,
  dutyStatus: 'DRIVING',
  statusSince: '2026-09-12T18:00:00.000Z',
  computedAt: '2026-09-12T20:00:00.000Z',
};

const VEHICLE_ACTIVITIES: { items: VehicleActivityItem[] } = {
  items: [
    {
      id: 'act_1',
      occurredAt: '2026-09-10T05:30:00.000Z',
      activity: 'Duty status changed to Driving',
      driverName: 'John Smith',
      source: 'ELD · automatic',
      details: 'Odometer 993,109 mi',
    },
    {
      id: 'act_2',
      occurredAt: '2026-09-10T05:12:00.000Z',
      activity: 'Pre-trip DVIR submitted · no defects',
      driverName: 'John Smith',
      source: 'Mobile app v2.24',
      details: 'DVIR #88214',
    },
    {
      id: 'act_3',
      occurredAt: '2026-09-02T04:00:00.000Z',
      activity: 'Duty status changed to On duty',
      driverName: 'Derek Alvarez',
      source: 'ELD · automatic',
      details: 'Pre-trip inspection started',
    },
    {
      id: 'act_4',
      occurredAt: '2026-09-03T05:13:00.000Z',
      activity: 'Post-trip DVIR submitted · 1 defect',
      driverName: 'Tanya Brooks',
      source: 'Mobile app v2.23',
      details: 'Defect: Air leak at gladhand',
    },
    {
      id: 'act_5',
      occurredAt: '2026-09-04T06:26:00.000Z',
      activity: 'Duty status changed to Driving',
      driverName: 'Luis Moreno',
      source: 'ELD · automatic',
      details: 'Odometer 214,826 mi',
    },
    {
      id: 'act_6',
      occurredAt: '2026-09-05T07:39:00.000Z',
      activity: 'Engine off',
      driverName: 'Priya Nandakumar',
      source: 'ELD · automatic',
      details: 'Idle 7 min before shutdown',
    },
    {
      id: 'act_7',
      occurredAt: '2026-09-06T08:52:00.000Z',
      activity: 'Duty status changed to Sleeper berth',
      driverName: 'Omar Haddad',
      source: 'Mobile app v2.24',
      details: '10-hour reset started',
    },
    {
      id: 'act_8',
      occurredAt: '2026-09-07T09:05:00.000Z',
      activity: 'Trip {trip} assigned',
      driverName: 'Grace Whitfield',
      source: 'Dispatch · web',
      details: 'Assigned by Sarah Chen',
    },
    {
      id: 'act_9',
      occurredAt: '2026-09-08T10:18:00.000Z',
      activity: 'Unit paired with ELD',
      driverName: 'Victor Osei',
      source: 'Bluetooth',
      details: 'Serial PT30_A1DE',
    },
    {
      id: 'act_10',
      occurredAt: '2026-09-09T11:31:00.000Z',
      activity: 'Duty status changed to Off duty',
      driverName: 'Hannah Delgado',
      source: 'Mobile app v2.23',
      details: 'Shift 13h 42m',
    },
    {
      id: 'act_11',
      occurredAt: '2026-09-10T12:44:00.000Z',
      activity: 'Fuel stop recorded',
      driverName: null,
      source: 'Mobile app v2.24',
      details: '96 gal · Pilot #318',
    },
    {
      id: 'act_12',
      occurredAt: '2026-09-02T13:57:00.000Z',
      activity: 'Log certified',
      driverName: 'Renee Bautista',
      source: 'Mobile app v2.22',
      details: 'Day 2026-09-02',
    },
    {
      id: 'act_13',
      occurredAt: '2026-09-03T14:10:00.000Z',
      activity: 'Duty status changed to On duty',
      driverName: 'Dominic Feldman',
      source: 'ELD · automatic',
      details: 'Pre-trip inspection started',
    },
    {
      id: 'act_14',
      occurredAt: '2026-09-04T15:23:00.000Z',
      activity: 'Post-trip DVIR submitted · 1 defect',
      driverName: 'Aisha Rahman',
      source: 'Mobile app v2.20',
      details: 'Defect: Cracked mirror bracket',
    },
    {
      id: 'act_15',
      occurredAt: '2026-09-05T16:36:00.000Z',
      activity: 'Duty status changed to Driving',
      driverName: 'Peter Kovacs',
      source: 'ELD · automatic',
      details: 'Odometer 388,956 mi',
    },
    {
      id: 'act_16',
      occurredAt: '2026-09-06T17:49:00.000Z',
      activity: 'Engine off',
      driverName: 'Nadia Petrova',
      source: 'ELD · automatic',
      details: 'Idle 17 min before shutdown',
    },
    {
      id: 'act_17',
      occurredAt: '2026-09-07T18:02:00.000Z',
      activity: 'Duty status changed to Sleeper berth',
      driverName: 'Curtis Lane',
      source: 'Mobile app v2.24',
      details: '10-hour reset started',
    },
    {
      id: 'act_18',
      occurredAt: '2026-09-08T04:15:00.000Z',
      activity: 'Trip {trip} assigned',
      driverName: 'Bianca Ferraro',
      source: 'Dispatch · web',
      details: 'Assigned by Sarah Chen',
    },
    {
      id: 'act_19',
      occurredAt: '2026-09-09T05:28:00.000Z',
      activity: 'Unit paired with ELD',
      driverName: 'Trevor Nakamura',
      source: 'Bluetooth',
      details: 'Serial PT30_A350',
    },
    {
      id: 'act_20',
      occurredAt: '2026-09-10T06:41:00.000Z',
      activity: 'Duty status changed to Off duty',
      driverName: null,
      source: 'Mobile app v2.20',
      details: 'Shift 13h 42m',
    },
    {
      id: 'act_21',
      occurredAt: '2026-09-02T07:54:00.000Z',
      activity: 'Fuel stop recorded',
      driverName: 'Gerald Whitaker',
      source: 'Mobile app v2.24',
      details: '106 gal · Pilot #328',
    },
    {
      id: 'act_22',
      occurredAt: '2026-09-03T08:07:00.000Z',
      activity: 'Log certified',
      driverName: 'Imani Clarke',
      source: 'Mobile app v2.23',
      details: 'Day 2026-09-03',
    },
    {
      id: 'act_23',
      occurredAt: '2026-09-04T09:20:00.000Z',
      activity: 'Duty status changed to On duty',
      driverName: 'Roland Duval',
      source: 'ELD · automatic',
      details: 'Pre-trip inspection started',
    },
    {
      id: 'act_24',
      occurredAt: '2026-09-05T10:33:00.000Z',
      activity: 'Post-trip DVIR submitted · 1 defect',
      driverName: 'Kelsey Nguyen',
      source: 'Mobile app v2.22',
      details: 'Defect: Low tire pressure · drive axle',
    },
    {
      id: 'act_25',
      occurredAt: '2026-09-06T11:46:00.000Z',
      activity: 'Duty status changed to Driving',
      driverName: 'Andre Boateng',
      source: 'ELD · automatic',
      details: 'Odometer 563,086 mi',
    },
    {
      id: 'act_26',
      occurredAt: '2026-09-07T12:59:00.000Z',
      activity: 'Engine off',
      driverName: 'Maya Lindqvist',
      source: 'ELD · automatic',
      details: 'Idle 10 min before shutdown',
    },
    {
      id: 'act_27',
      occurredAt: '2026-09-08T13:12:00.000Z',
      activity: 'Duty status changed to Sleeper berth',
      driverName: 'Hector Salinas',
      source: 'Mobile app v2.24',
      details: '10-hour reset started',
    },
    {
      id: 'act_28',
      occurredAt: '2026-09-09T14:25:00.000Z',
      activity: 'Trip {trip} assigned',
      driverName: 'Freya Andersen',
      source: 'Dispatch · web',
      details: 'Assigned by Sarah Chen',
    },
    {
      id: 'act_29',
      occurredAt: '2026-09-10T15:38:00.000Z',
      activity: 'Unit paired with ELD',
      driverName: null,
      source: 'Bluetooth',
      details: 'Serial PT30_A4C2',
    },
    {
      id: 'act_30',
      occurredAt: '2026-09-02T16:51:00.000Z',
      activity: 'Duty status changed to Off duty',
      driverName: 'Paulina Zielinska',
      source: 'Mobile app v2.22',
      details: 'Shift 13h 42m',
    },
    {
      id: 'act_31',
      occurredAt: '2026-09-03T17:04:00.000Z',
      activity: 'Fuel stop recorded',
      driverName: 'Ibrahim Toure',
      source: 'Mobile app v2.24',
      details: '116 gal · Pilot #338',
    },
    {
      id: 'act_32',
      occurredAt: '2026-09-04T18:17:00.000Z',
      activity: 'Log certified',
      driverName: 'Colette Reyes',
      source: 'Mobile app v2.20',
      details: 'Day 2026-09-04',
    },
  ],
};

const VEHICLE_HISTORIES: VehicleHistoriesResponse = {
  date: '2026-09-10',
  distanceMi: 482,
  driveSegments: 7,
  driveTimeSec: 41160,
  avgSpeedMph: 42,
  stopCount: 6,
  stopTimeSec: 15480,
  idleTimeSec: 4320,
  idleFuelWastedGal: 2.4,
  firstMovementAt: '2026-09-10T02:30:44.000Z',
  lastMovementAt: '2026-09-10T14:26:12.000Z',
  engineOnSec: 49260,
  engineOffSec: 37140,
  longestDrive: { label: 'Harrisburg → Florence, KY', durationSec: 21360 },
  longestStop: { label: 'Harrisburg, OH', durationSec: 1800 },
  maxSpeedMph: 63,
  maxSpeedAt: '2026-09-10T11:12:00.000Z',
  segments: [
    {
      marker: 'A',
      type: 'DRIVE',
      startAt: '2026-09-10T02:30:44.000Z',
      endAt: '2026-09-10T05:00:00.000Z',
      durationSec: 8956,
      location: 'Columbus, OH → 1.04 mi W of Harrisburg, OH',
      distanceMi: 112,
      odometerMi: 993221,
      driverName: 'John Smith',
      lat: 39.9612,
      lon: -82.9988,
    },
    {
      marker: 'B',
      type: 'STOP',
      startAt: '2026-09-10T05:00:00.000Z',
      endAt: '2026-09-10T05:30:00.000Z',
      durationSec: 1800,
      location: 'Harrisburg, OH',
      distanceMi: null,
      odometerMi: 993221,
      driverName: 'John Smith',
      lat: 40.0,
      lon: -83.0,
    },
    {
      marker: 'C',
      type: 'IDLE',
      startAt: '2026-09-10T14:00:00.000Z',
      endAt: '2026-09-10T14:26:12.000Z',
      durationSec: 1572,
      location: 'Florence, KY',
      distanceMi: null,
      odometerMi: 993589,
      driverName: 'John Smith',
      lat: 38.98,
      lon: -84.62,
    },
  ],
};

export const vehiclesDriversGapHandlers = [
  http.get(url(endpoints.drivers.roster), ({ request }) => ok(rosterPage(request))),
  // Volume overrides for the three fixture-backed lists the Vehicles table joins (see the bulk
  // fill note above) — registered before `fleetHandlers`' one-row fixture variants.
  http.get(url(endpoints.vehicles.list), ({ request }) =>
    ok(serverPage(VEHICLE_ROWS, request, ['unitNumber', 'vin', 'make', 'model', 'licensePlate'])),
  ),
  http.get(url(endpoints.drivers.list), ({ request }) =>
    ok(serverPage(DRIVER_ROWS, request, ['firstName', 'lastName', 'username', 'cdlNumber'])),
  ),
  http.get(url(endpoints.devices.list), ({ request }) => ok(serverPage(DEVICE_ROWS, request, ['serial', 'model']))),
  http.get(url(endpoints.drivers.hos(':id')), () => ok(HOS_RIGHT_NOW)),
  http.get(url(endpoints.vehicles.activities(':id')), () => ok(VEHICLE_ACTIVITIES)),
  http.get(url(endpoints.vehicles.histories(':id')), () => ok(VEHICLE_HISTORIES)),
];
