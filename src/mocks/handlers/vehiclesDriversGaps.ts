// owner: web-vehicles-drivers — B-1 (driver roster) and B-2 (driver HOS) shipped 2026-09-14 and
// are contract-tested against openapi.json; B-4 (unit histories/route replay) and B-5 (unit
// activity) are still gaps. Each handler answers
// exactly the shape recorded in web/backend-gaps.md so swapping to the real endpoint later is a
// one-line change in `shared/api/vehicles.ts` / `shared/api/drivers.ts`.
import { http } from 'msw';
import { endpoints } from '@/shared/api/endpoints';
import { ok, url } from '../envelope';
import type { DriverRosterEntry, DriverRosterResponse } from '@/shared/api/drivers';
import type { VehicleActivityItem, VehicleHistoriesResponse } from '@/shared/api/vehicles';

/** B-1 — 5 hand-authored rows (used by name in other tests/fixtures) plus 53 generated ones, for
 * the full seeded 58. The roster handler below paginates this array for real: `page`/`limit` are
 * read off the request, `total`/`totalPages` always describe all 58 (web/bugs.md WB-051 — a
 * static, non-paginating handler here previously made `ROSTER_COUNT_LIMIT`'s multi-page fetch
 * re-read the same 5 rows 3×, so `On duty + Off duty` (15) never matched the header's `All` (58)). */
const NAMED_ROSTER_ENTRIES: DriverRosterEntry[] = [
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
];

const TERMINALS = ['Columbus, OH', 'Raleigh, NC', 'Denver, CO', 'Dallas, TX'];
const FIRST_NAMES = [
  'James', 'Robert', 'Maria', 'Linda', 'Michael', 'Barbara', 'William', 'Elizabeth', 'David',
  'Jennifer', 'Richard', 'Patricia', 'Joseph', 'Susan', 'Thomas', 'Jessica', 'Charles', 'Karen',
  'Christopher', 'Nancy', 'Daniel', 'Betty', 'Matthew', 'Sandra', 'Anthony', 'Ashley', 'Mark',
  'Dorothy', 'Donald', 'Kimberly', 'Steven', 'Emily', 'Paul', 'Donna', 'Andrew', 'Michelle',
  'Joshua', 'Carol', 'Kenneth', 'Amanda', 'Kevin', 'Melissa', 'Brian', 'Deborah', 'George',
  'Stephanie', 'Timothy', 'Rebecca', 'Ronald', 'Laura', 'Edward', 'Cynthia', 'Jason',
];
const LAST_NAMES = [
  'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Garcia', 'Rodriguez', 'Wilson',
  'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Hernandez', 'Moore', 'Martin', 'Jackson',
  'Thompson', 'White', 'Lopez',
];
const DUTY_CYCLE: DriverRosterEntry['dutyStatus'][] = ['DRIVING', 'ON_DUTY', 'SLEEPER', 'OFF_DUTY', 'OFF_DUTY'];

/** Fills the roster out to the seeded 58 — deterministic, so a re-run never shuffles a screenshot. */
const GENERATED_ROSTER_ENTRIES: DriverRosterEntry[] = Array.from({ length: 53 }, (_, i) => {
  const n = i + 6;
  const firstName = FIRST_NAMES[i % FIRST_NAMES.length]!;
  const lastName = LAST_NAMES[i % LAST_NAMES.length]!;
  const dutyStatus = DUTY_CYCLE[i % DUTY_CYCLE.length]!;
  return {
    driver: {
      id: `drv_${n}`,
      username: `${firstName.toLowerCase()}${lastName[0]!.toLowerCase()}${n}`,
      firstName,
      lastName,
      homeTerminalName: TERMINALS[i % TERMINALS.length]!,
      appVersion: 'v2.24',
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      eldExempt: i % 11 === 0,
      allowPersonalConveyance: i % 3 !== 0,
      allowYardMove: i % 4 !== 0,
      shortHaulException: i % 9 === 0,
      splitSleeperEnabled: i % 6 === 0,
    },
    dutyStatus,
    // Only units that really exist in the fleet (`mockState.VEHICLE_COUNT` = 24) are assigned, so
    // the roster's unit, the Vehicles table's DRIVER column and the `Unassigned` segment counter
    // describe the same fleet. Rows 0–18 keep the unit numbers earlier tests pin.
    unit: dutyStatus === 'OFF_DUTY' || i >= 19 ? null : { id: `veh_${n}`, unitNumber: `#${100 + n}` },
    hos: {
      driveRemainingSec: (i % 12) * 3600,
      shiftRemainingSec: ((i % 14) + 1) * 3600,
      cycleRemainingSec: ((i % 70) + 1) * 3600,
    },
    // Never on the first 5 generated rows — they share page 1 (limit 10) with the 5 named rows
    // above, whose own "N open" text (`John Smith` = 1, `Daniel Pierce` = 2) tests assert on.
    openViolations: i >= 5 && i % 7 === 0 ? 1 : 0,
    emailVerified: null,
  };
});

/** Exported so `mockState.ts` can widen the same 58 identities into full `/drivers` rows — one
 * driver id never means two different people across the mock (mock-layer audit, 2026-09-23). */
export const ROSTER_ENTRIES: DriverRosterEntry[] = [...NAMED_ROSTER_ENTRIES, ...GENERATED_ROSTER_ENTRIES];

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
  http.get(url(endpoints.drivers.roster), ({ request }) => {
    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Number(params.get('page')) || 1);
    const limit = Math.max(1, Number(params.get('limit')) || 25);
    const total = ROSTER_ENTRIES.length;
    const response: DriverRosterResponse = {
      items: ROSTER_ENTRIES.slice((page - 1) * limit, page * limit),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
    return ok(response);
  }),
  http.get(url(endpoints.drivers.hos(':id')), () => ok(HOS_RIGHT_NOW)),
  http.get(url(endpoints.vehicles.activities(':id')), () => ok(VEHICLE_ACTIVITIES)),
  http.get(url(endpoints.vehicles.histories(':id')), () => ok(VEHICLE_HISTORIES)),
];
