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
];

const ROSTER_RESPONSE: DriverRosterResponse = {
  items: ROSTER_ENTRIES,
  page: 1,
  limit: 25,
  total: 58,
  totalPages: 3,
};

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
  http.get(url(endpoints.drivers.roster), () => ok(ROSTER_RESPONSE)),
  http.get(url(endpoints.drivers.hos(':id')), () => ok(HOS_RIGHT_NOW)),
  http.get(url(endpoints.vehicles.activities(':id')), () => ok(VEHICLE_ACTIVITIES)),
  http.get(url(endpoints.vehicles.histories(':id')), () => ok(VEHICLE_HISTORIES)),
];
