// owner: web-dvir-safety — W-09 DVIR & Maintenance DEMO DATA (not app logic).
//
// Realistic fleet records the DVIR page falls back to while the API has nothing to show (empty
// list or a failed request). Wired in `./useDvirMock.ts`; switched by `VITE_DVIR_MOCK`
// (see that file). To remove the demo entirely: delete this `mock/` folder and point the hook
// imports in `DvirPage.tsx` / `components/DvirDrawer.tsx` back at `@/shared/api/dvir`.
//
// Every timestamp is relative to the moment the page loads, so the "Last 48 hours" table and
// the `DVIRs today` KPI stay populated whatever day the demo is opened. Rows are already joined
// (driver / vehicle) in the exact `*TableRow` shapes `shared/api/dvir.ts` produces.
import type {
  DefectRow,
  DefectSeverity,
  DefectStatus,
  DvirDetail,
  DvirTableRow,
  DvirType,
  MaintenanceDueState,
  RepairStatus,
  ScheduleTableRow,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderTableRow,
  DefectTableRow,
} from '@/shared/api/dvir';
import type { DriverRow, VehicleRow } from '@/shared/api/vehicles';

/** Every mock id starts with this — how the drawer tells a demo DVIR from a real one. */
export const MOCK_ID_PREFIX = 'mock-';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/* --------------------------------------------------------------------- vehicles */

type VehicleSpec = [unit: string, make: string, model: string, year: number, odometerMi: number, plate: string, state: string, status: VehicleRow['status']];

const VEHICLE_SPECS: VehicleSpec[] = [
  ['101', 'Freightliner', 'Cascadia 126', 2022, 412_380, 'R82-4471', 'TX', 'ACTIVE'],
  ['104', 'Kenworth', 'T680', 2021, 538_912, 'GA7-3310', 'GA', 'ACTIVE'],
  ['117', 'Peterbilt', '579', 2023, 186_445, 'AZ1-9902', 'AZ', 'ACTIVE'],
  ['122', 'Volvo', 'VNL 860', 2020, 702_118, 'TN4-5517', 'TN', 'OUT_OF_SERVICE'],
  ['135', 'International', 'LT625', 2022, 329_870, 'OH2-8846', 'OH', 'ACTIVE'],
  ['148', 'Freightliner', 'Cascadia 126', 2024, 94_210, 'R91-2208', 'TX', 'ACTIVE'],
  ['152', 'Mack', 'Anthem 64T', 2021, 471_560, 'AR6-1173', 'AR', 'OUT_OF_SERVICE'],
  ['160', 'Kenworth', 'W990', 2023, 158_034, 'CA8-6624', 'CA', 'ACTIVE'],
];

/* --------------------------------------------------------------------- drivers */

type DriverSpec = [key: string, first: string, last: string, cdlState: string, terminal: string, timezone: string, unit: string];

const DRIVER_SPECS: DriverSpec[] = [
  ['marcus', 'Marcus', 'Johnson', 'TX', 'Dallas, TX', 'America/Chicago', '101'],
  ['tyler', 'Tyler', 'Brooks', 'GA', 'Atlanta, GA', 'America/New_York', '104'],
  ['luis', 'Luis', 'Ramirez', 'AZ', 'Phoenix, AZ', 'America/Phoenix', '117'],
  ['deshawn', 'DeShawn', 'Carter', 'TN', 'Memphis, TN', 'America/Chicago', '122'],
  ['kevin', 'Kevin', "O'Brien", 'OH', 'Columbus, OH', 'America/New_York', '135'],
  ['angela', 'Angela', 'Martinez', 'TX', 'Laredo, TX', 'America/Chicago', '148'],
  ['robert', 'Robert', 'Nguyen', 'CA', 'Sacramento, CA', 'America/Los_Angeles', '160'],
];

/* --------------------------------------------------------------------- DVIRs + defects */

interface DefectSpec {
  category: string;
  part: 'TRUCK' | 'TRAILER';
  severity: DefectSeverity;
  description: string;
  status: DefectStatus;
  outOfService?: boolean;
  /** For REPAIRED / DEFERRED rows — who closed it and what they wrote. */
  resolution?: { correctedBy: string; note: string; afterHours: number; laborHours?: number; partsCostUsd?: number };
}

interface DvirSpec {
  /** Hours before page load the DVIR was submitted. */
  hoursAgo: number;
  driver: string;
  unit: string;
  type: DvirType;
  location: string;
  lat: number;
  lng: number;
  trailer: string | null;
  notes?: string;
  defects?: DefectSpec[];
}

const DVIR_SPECS: DvirSpec[] = [
  // ---- inside the "Last 48 hours" window
  { hoursAgo: 0.4, driver: 'marcus', unit: '101', type: 'PRE_TRIP', location: 'Dallas, TX', lat: 32.7767, lng: -96.797, trailer: 'TRL-53201' },
  {
    hoursAgo: 1.1, driver: 'luis', unit: '117', type: 'PRE_TRIP', location: 'Phoenix, AZ', lat: 33.4484, lng: -112.074, trailer: 'TRL-53214',
    defects: [{ category: 'Lights - Turn signals', part: 'TRUCK', severity: 'MINOR', status: 'OPEN', description: 'Left rear turn signal lens cracked; bulb flickers intermittently.' }],
  },
  { hoursAgo: 1.8, driver: 'angela', unit: '148', type: 'PRE_TRIP', location: 'Laredo, TX', lat: 27.5306, lng: -99.4803, trailer: 'TRL-48807' },
  {
    hoursAgo: 2.6, driver: 'deshawn', unit: '122', type: 'PRE_TRIP', location: 'Memphis, TN', lat: 35.1495, lng: -90.049, trailer: 'TRL-53177',
    notes: 'Unit tagged out of service at the yard. Did not depart.',
    defects: [
      { category: 'Brakes', part: 'TRUCK', severity: 'CRITICAL', status: 'OPEN', outOfService: true, description: 'Pushrod stroke on axle 3 right exceeds the 2.5 in adjustment limit.' },
      { category: 'Air lines', part: 'TRAILER', severity: 'MAJOR', status: 'OPEN', description: 'Audible air leak at the service gladhand seal, trailer side.' },
    ],
  },
  {
    hoursAgo: 3.5, driver: 'kevin', unit: '135', type: 'INTERMEDIATE', location: 'Columbus, OH', lat: 39.9612, lng: -82.9988, trailer: 'TRL-50122',
    defects: [{ category: 'Tires', part: 'TRUCK', severity: 'MAJOR', status: 'IN_PROGRESS', description: 'Right steer tire tread depth 3/32 in — below the 4/32 in minimum.' }],
  },
  { hoursAgo: 5, driver: 'robert', unit: '160', type: 'PRE_TRIP', location: 'Sacramento, CA', lat: 38.5816, lng: -121.4944, trailer: null },
  {
    hoursAgo: 7.2, driver: 'tyler', unit: '104', type: 'POST_TRIP', location: 'Atlanta, GA', lat: 33.749, lng: -84.388, trailer: 'TRL-47730',
    defects: [{
      category: 'Windshield wipers', part: 'TRUCK', severity: 'MINOR', status: 'REPAIRED', description: 'Passenger-side wiper blade torn, streaking in rain.',
      resolution: { correctedBy: 'Dale Whitaker', note: 'Replaced both wiper blades with 26 in winter blades.', afterHours: 2, laborHours: 0.3, partsCostUsd: 38.5 },
    }],
  },
  { hoursAgo: 9.5, driver: 'marcus', unit: '101', type: 'POST_TRIP', location: 'Texarkana, AR', lat: 33.4418, lng: -94.0377, trailer: 'TRL-53201' },
  { hoursAgo: 12, driver: 'luis', unit: '117', type: 'POST_TRIP', location: 'Flagstaff, AZ', lat: 35.1983, lng: -111.6513, trailer: 'TRL-53214' },
  {
    hoursAgo: 14.5, driver: 'deshawn', unit: '152', type: 'PRE_TRIP', location: 'Little Rock, AR', lat: 34.7465, lng: -92.2896, trailer: 'TRL-51009',
    defects: [{ category: 'Coupling devices', part: 'TRUCK', severity: 'CRITICAL', status: 'OPEN', outOfService: true, description: 'Fifth wheel locking jaw not fully closing around the kingpin; release handle sticks.' }],
  },
  {
    hoursAgo: 18, driver: 'angela', unit: '148', type: 'POST_TRIP', location: 'San Antonio, TX', lat: 29.4241, lng: -98.4936, trailer: 'TRL-48807',
    defects: [{
      category: 'Reflectors', part: 'TRAILER', severity: 'MINOR', status: 'DEFERRED', description: 'Two sections of conspicuity tape peeling on the trailer rear.',
      resolution: { correctedBy: 'Maria Lopez', note: 'Deferred to next PM — remaining tape still meets §393.13 coverage.', afterHours: 3 },
    }],
  },
  {
    hoursAgo: 21, driver: 'kevin', unit: '135', type: 'PRE_TRIP', location: 'Indianapolis, IN', lat: 39.7684, lng: -86.1581, trailer: 'TRL-50122',
    defects: [{
      category: 'Lights - Headlamps', part: 'TRUCK', severity: 'MAJOR', status: 'REPAIRED', description: 'Driver-side low beam headlamp out.',
      resolution: { correctedBy: "Love's Truck Care – Indianapolis", note: 'Replaced H11 low beam bulb, checked aim.', afterHours: 1.5, laborHours: 0.5, partsCostUsd: 24.99 },
    }],
  },
  { hoursAgo: 24.5, driver: 'robert', unit: '160', type: 'POST_TRIP', location: 'Reno, NV', lat: 39.5296, lng: -119.8138, trailer: null },
  {
    hoursAgo: 28, driver: 'tyler', unit: '104', type: 'PRE_TRIP', location: 'Chattanooga, TN', lat: 35.0456, lng: -85.3097, trailer: 'TRL-47730',
    defects: [{ category: 'Rear vision mirrors', part: 'TRUCK', severity: 'MINOR', status: 'OPEN', description: 'Passenger mirror housing loose; vibrates at highway speed.' }],
  },
  { hoursAgo: 31, driver: 'marcus', unit: '101', type: 'INTERMEDIATE', location: 'Shreveport, LA', lat: 32.5252, lng: -93.7502, trailer: 'TRL-53201' },
  {
    hoursAgo: 36, driver: 'luis', unit: '117', type: 'PRE_TRIP', location: 'Albuquerque, NM', lat: 35.0844, lng: -106.6504, trailer: 'TRL-53214',
    defects: [{
      category: 'Horn', part: 'TRUCK', severity: 'MINOR', status: 'REPAIRED', description: 'Air horn weak — barely audible.',
      resolution: { correctedBy: 'Dale Whitaker', note: 'Cleared moisture from horn solenoid, drained air tanks.', afterHours: 4, laborHours: 0.7 },
    }],
  },
  { hoursAgo: 40, driver: 'angela', unit: '148', type: 'PRE_TRIP', location: 'Laredo, TX', lat: 27.5306, lng: -99.4803, trailer: 'TRL-48807' },
  {
    hoursAgo: 45, driver: 'deshawn', unit: '122', type: 'POST_TRIP', location: 'West Memphis, AR', lat: 35.1465, lng: -90.1845, trailer: 'TRL-53177',
    defects: [{ category: 'Suspension', part: 'TRAILER', severity: 'MAJOR', status: 'OPEN', description: 'Cracked leaf spring, trailer axle 2 left side.' }],
  },

  // ---- older DVIRs — outside the 48 h table, but their defects feed the defect lists
  {
    hoursAgo: 4 * 24 + 6, driver: 'kevin', unit: '135', type: 'PRE_TRIP', location: 'Dayton, OH', lat: 39.7589, lng: -84.1916, trailer: 'TRL-50122',
    defects: [{ category: 'Exhaust system', part: 'TRUCK', severity: 'MAJOR', status: 'IN_PROGRESS', description: 'Exhaust leak at the turbo downpipe clamp; soot trail on the firewall.' }],
  },
  {
    hoursAgo: 7 * 24 + 3, driver: 'robert', unit: '160', type: 'PRE_TRIP', location: 'Stockton, CA', lat: 37.9577, lng: -121.2908, trailer: null,
    defects: [{ category: 'Wheels and rims', part: 'TRUCK', severity: 'MAJOR', status: 'OPEN', description: 'Two lug nuts missing, right drive axle outer wheel.' }],
  },
  {
    hoursAgo: 11 * 24 + 9, driver: 'tyler', unit: '104', type: 'POST_TRIP', location: 'Atlanta, GA', lat: 33.749, lng: -84.388, trailer: 'TRL-47730',
    defects: [{ category: 'Landing gear', part: 'TRAILER', severity: 'MINOR', status: 'IN_PROGRESS', description: 'Landing gear crank binds in low gear.' }],
  },
  {
    hoursAgo: 16 * 24 + 2, driver: 'marcus', unit: '101', type: 'PRE_TRIP', location: 'Dallas, TX', lat: 32.7767, lng: -96.797, trailer: 'TRL-53201',
    defects: [{
      category: 'Fuel system', part: 'TRUCK', severity: 'MAJOR', status: 'REPAIRED', description: 'Diesel weeping at the fuel filter housing.',
      resolution: { correctedBy: 'Rush Truck Center – Dallas', note: 'Replaced filter housing O-rings and primary filter; no further leak.', afterHours: 20, laborHours: 1.5, partsCostUsd: 118.75 },
    }],
  },
  {
    hoursAgo: 22 * 24 + 5, driver: 'angela', unit: '148', type: 'PRE_TRIP', location: 'Laredo, TX', lat: 27.5306, lng: -99.4803, trailer: 'TRL-48807',
    defects: [{
      category: 'Emergency equipment', part: 'TRUCK', severity: 'MINOR', status: 'REPAIRED', description: 'Fire extinguisher gauge in the red zone.',
      resolution: { correctedBy: 'Maria Lopez', note: 'Swapped in a new 5 lb ABC extinguisher.', afterHours: 6, laborHours: 0.2, partsCostUsd: 64.99 },
    }],
  },
  {
    hoursAgo: 29 * 24 + 1, driver: 'luis', unit: '117', type: 'PRE_TRIP', location: 'Phoenix, AZ', lat: 33.4484, lng: -112.074, trailer: 'TRL-53214',
    defects: [{
      category: 'Steering mechanism', part: 'TRUCK', severity: 'CRITICAL', status: 'REPAIRED', outOfService: false, description: 'Excessive steering wheel lash, about 3 in of free play.',
      resolution: { correctedBy: 'Peterbilt of Phoenix', note: 'Adjusted steering gear sector shaft, replaced worn drag link end.', afterHours: 40, laborHours: 6.5, partsCostUsd: 1_120.4 },
    }],
  },
  {
    hoursAgo: 38 * 24 + 4, driver: 'deshawn', unit: '152', type: 'POST_TRIP', location: 'Memphis, TN', lat: 35.1495, lng: -90.049, trailer: 'TRL-51009',
    defects: [{ category: 'Mud flaps', part: 'TRAILER', severity: 'MINOR', status: 'OPEN', description: 'Right rear mud flap missing.' }],
  },
  {
    hoursAgo: 47 * 24 + 7, driver: 'kevin', unit: '135', type: 'POST_TRIP', location: 'Columbus, OH', lat: 39.9612, lng: -82.9988, trailer: 'TRL-50122',
    defects: [{
      category: 'Trailer doors', part: 'TRAILER', severity: 'MINOR', status: 'DEFERRED', description: 'Right swing door seal torn at the bottom corner.',
      resolution: { correctedBy: 'Dale Whitaker', note: 'Deferred — seal ordered, cargo not moisture sensitive.', afterHours: 5 },
    }],
  },
  {
    hoursAgo: 55 * 24 + 8, driver: 'robert', unit: '160', type: 'PRE_TRIP', location: 'Sacramento, CA', lat: 38.5816, lng: -121.4944, trailer: null,
    defects: [{
      category: 'Brakes', part: 'TRUCK', severity: 'MAJOR', status: 'REPAIRED', description: 'Brake chamber diaphragm leaking, axle 2 left.',
      resolution: { correctedBy: 'FleetPride – Sacramento', note: 'Replaced type 30/30 spring brake chamber; adjusted slack.', afterHours: 18, laborHours: 2, partsCostUsd: 486.2 },
    }],
  },
];

/* --------------------------------------------------------------------- work orders */

interface WorkOrderSpec {
  number: string;
  unit: string;
  title: string;
  description: string | null;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  vendor: string | null;
  costUsd: number | null;
  openedDaysAgo: number;
  /** Days from page load (negative = already past). */
  dueInDays: number | null;
  closedDaysAgo?: number;
  estimatedLaborHours?: number;
  keepOutOfService?: boolean;
  /** Defect descriptions (prefix match) this work order covers. */
  defects?: string[];
}

const WORK_ORDER_SPECS: WorkOrderSpec[] = [
  { number: 'WO-1043', unit: '117', title: 'Replace turn signal lens', description: 'Left rear turn signal lens cracked; replace lens and socket.', priority: 'LOW', status: 'OPEN', vendor: 'In-house shop', costUsd: null, openedDaysAgo: 0.04, dueInDays: 7, estimatedLaborHours: 0.5, defects: ['Left rear turn signal'] },
  { number: 'WO-1042', unit: '122', title: 'Brake adjustment axle 3 + gladhand seal', description: 'Readjust/replace slack adjuster axle 3 R; replace trailer service gladhand seal.', priority: 'URGENT', status: 'IN_PROGRESS', vendor: 'Rush Truck Center – Memphis', costUsd: null, openedDaysAgo: 0.1, dueInDays: 1, estimatedLaborHours: 3, keepOutOfService: true, defects: ['Pushrod stroke', 'Audible air leak'] },
  { number: 'WO-1041', unit: '152', title: 'Fifth wheel jaw rebuild', description: 'Rebuild fifth wheel locking mechanism; inspect kingpin wear.', priority: 'URGENT', status: 'OPEN', vendor: 'TA Truck Service – Little Rock', costUsd: null, openedDaysAgo: 0.5, dueInDays: 1, estimatedLaborHours: 4, keepOutOfService: true, defects: ['Fifth wheel locking jaw'] },
  { number: 'WO-1040', unit: '135', title: 'Replace steer tires (pair)', description: 'Mount and balance two 295/75R22.5 steer tires.', priority: 'HIGH', status: 'IN_PROGRESS', vendor: "Love's Truck Care – Indianapolis", costUsd: 1_186.4, openedDaysAgo: 0.2, dueInDays: 2, estimatedLaborHours: 1.5, defects: ['Right steer tire'] },
  { number: 'WO-1039', unit: '135', title: 'Turbo downpipe exhaust clamp', description: 'Replace V-band clamp and gasket at turbo outlet.', priority: 'HIGH', status: 'IN_PROGRESS', vendor: 'In-house shop', costUsd: 245, openedDaysAgo: 4, dueInDays: -1, estimatedLaborHours: 2, defects: ['Exhaust leak'] },
  { number: 'WO-1038', unit: '160', title: 'Replace missing lug nuts, re-torque', description: 'Install two lug nuts, re-torque all drive wheels to 475 ft-lb.', priority: 'HIGH', status: 'OPEN', vendor: null, costUsd: null, openedDaysAgo: 7, dueInDays: 3, estimatedLaborHours: 0.5, defects: ['Two lug nuts'] },
  { number: 'WO-1037', unit: '104', title: 'Trailer landing gear service', description: 'Lube and adjust landing gear gearbox; replace crank if worn.', priority: 'NORMAL', status: 'OPEN', vendor: 'In-house shop', costUsd: null, openedDaysAgo: 11, dueInDays: 5, estimatedLaborHours: 1, defects: ['Landing gear crank'] },
  { number: 'WO-1036', unit: '101', title: 'Fuel filter housing reseal', description: null, priority: 'NORMAL', status: 'DONE', vendor: 'Rush Truck Center – Dallas', costUsd: 318.75, openedDaysAgo: 16, dueInDays: -14, closedDaysAgo: 15, defects: ['Diesel weeping'] },
  { number: 'WO-1035', unit: '148', title: 'Fire extinguisher replacement', description: null, priority: 'LOW', status: 'DONE', vendor: 'In-house shop', costUsd: 64.99, openedDaysAgo: 22, dueInDays: -20, closedDaysAgo: 21, defects: ['Fire extinguisher'] },
  { number: 'WO-1034', unit: '117', title: 'Steering gear inspection & adjust', description: 'Free play out of spec — inspect gear box, drag link and tie rod ends.', priority: 'URGENT', status: 'DONE', vendor: 'Peterbilt of Phoenix', costUsd: 1_742.1, openedDaysAgo: 29, dueInDays: -28, closedDaysAgo: 27, defects: ['Excessive steering'] },
  { number: 'WO-1033', unit: '152', title: 'Replace trailer mud flap', description: null, priority: 'LOW', status: 'OPEN', vendor: null, costUsd: null, openedDaysAgo: 38, dueInDays: 10, defects: ['Right rear mud flap'] },
  { number: 'WO-1032', unit: '101', title: 'PM-A service (25,000 mi)', description: 'Oil and filters, chassis lube, brake and tire inspection.', priority: 'NORMAL', status: 'DONE', vendor: 'In-house shop', costUsd: 412, openedDaysAgo: 33, dueInDays: -31, closedDaysAgo: 32, estimatedLaborHours: 3 },
  { number: 'WO-1031', unit: '104', title: 'DOT annual inspection', description: 'FMCSA §396.17 periodic inspection.', priority: 'NORMAL', status: 'DONE', vendor: 'Kenworth of Atlanta', costUsd: 225, openedDaysAgo: 41, dueInDays: -39, closedDaysAgo: 40 },
  { number: 'WO-1030', unit: '122', title: 'Replace DEF level sensor', description: 'Cancelled — fault code cleared after DEF system recalibration.', priority: 'NORMAL', status: 'CANCELLED', vendor: 'Volvo Trucks – Memphis', costUsd: null, openedDaysAgo: 44, dueInDays: -40, closedDaysAgo: 43 },
  { number: 'WO-1029', unit: '148', title: 'Alignment & tire rotation', description: null, priority: 'NORMAL', status: 'DONE', vendor: "Love's Truck Care – Laredo", costUsd: 289.5, openedDaysAgo: 50, dueInDays: -48, closedDaysAgo: 49 },
  { number: 'WO-1028', unit: '160', title: 'Brake chamber replacement axle 2', description: null, priority: 'HIGH', status: 'DONE', vendor: 'FleetPride – Sacramento', costUsd: 486.2, openedDaysAgo: 55, dueInDays: -54, closedDaysAgo: 54, defects: ['Brake chamber diaphragm'] },
  { number: 'WO-1027', unit: '135', title: 'APU annual service', description: 'Customer requested reschedule — moved to PM-B visit.', priority: 'LOW', status: 'CANCELLED', vendor: 'Thermo King of Columbus', costUsd: null, openedDaysAgo: 58, dueInDays: -45, closedDaysAgo: 52 },
];

/* --------------------------------------------------------------------- maintenance schedules */

interface ScheduleSpec {
  unit: string;
  name: string;
  intervalMi?: number;
  /** Miles driven since the last service (vs the unit's odometer). */
  milesSinceService?: number;
  intervalDays?: number;
  daysSinceService: number;
}

const SCHEDULE_SPECS: ScheduleSpec[] = [
  { unit: '101', name: 'PM-A oil & filters', intervalMi: 25_000, milesSinceService: 23_900, daysSinceService: 33 },
  { unit: '104', name: 'PM-A oil & filters', intervalMi: 25_000, milesSinceService: 26_400, daysSinceService: 44 },
  { unit: '117', name: 'PM-A oil & filters', intervalMi: 25_000, milesSinceService: 8_050, daysSinceService: 15 },
  { unit: '122', name: 'PM-B chassis lube & inspection', intervalMi: 50_000, milesSinceService: 51_200, daysSinceService: 96 },
  { unit: '135', name: 'PM-A oil & filters', intervalMi: 25_000, milesSinceService: 22_800, daysSinceService: 39 },
  { unit: '148', name: 'PM-A oil & filters', intervalMi: 25_000, milesSinceService: 12_500, daysSinceService: 22 },
  { unit: '160', name: 'PM-A oil & filters', intervalMi: 25_000, milesSinceService: 9_600, daysSinceService: 18 },
  { unit: '117', name: 'Air dryer cartridge', intervalMi: 100_000, milesSinceService: 97_000, daysSinceService: 210 },
  { unit: '135', name: 'Coolant flush', intervalMi: 150_000, milesSinceService: 109_000, daysSinceService: 260 },
  { unit: '152', name: 'Annual DOT inspection', intervalDays: 365, daysSinceService: 372 },
  { unit: '122', name: 'Annual DOT inspection', intervalDays: 365, daysSinceService: 380 },
  { unit: '160', name: 'Annual DOT inspection', intervalDays: 365, daysSinceService: 353 },
  { unit: '101', name: 'Annual DOT inspection', intervalDays: 365, daysSinceService: 120 },
  { unit: '104', name: 'Brake inspection', intervalDays: 90, daysSinceService: 96 },
  { unit: '148', name: 'Brake inspection', intervalDays: 90, daysSinceService: 81 },
  { unit: '152', name: 'Reefer unit service', intervalDays: 180, daysSinceService: 64 },
];

/* --------------------------------------------------------------------- builder */

export interface DvirMockData {
  vehicles: VehicleRow[];
  drivers: DriverRow[];
  /** Every DVIR, newest first — the hook trims it to the 48 h window like the real query. */
  dvirs: DvirTableRow[];
  dvirDetails: Map<string, DvirDetail>;
  defects: DefectTableRow[];
  workOrders: WorkOrderTableRow[];
  schedules: ScheduleTableRow[];
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function deriveRepairStatus(defects: DefectRow[]): RepairStatus {
  if (defects.length === 0) return 'NOT_REQUIRED';
  if (defects.some((d) => d.status === 'OPEN' || d.status === 'IN_PROGRESS')) return 'PENDING';
  if (defects.every((d) => d.status === 'DEFERRED')) return 'DEFERRED';
  return 'REPAIRED';
}

function dueState(remaining: number, soonThreshold: number): MaintenanceDueState {
  if (remaining < 0) return 'OVERDUE';
  return remaining <= soonThreshold ? 'DUE_SOON' : 'OK';
}

export function buildDvirMockData(now: number = Date.now()): DvirMockData {
  const vehicles: VehicleRow[] = VEHICLE_SPECS.map(([unit, make, model, year, odometerMi, plate, state, status], i) => ({
    id: `${MOCK_ID_PREFIX}veh-${unit}`,
    unitNumber: unit,
    vin: `1XKYD49X${String(year).slice(2)}J${String(270_000 + i * 1_337).padStart(6, '0')}`,
    make,
    model,
    year,
    licensePlate: plate,
    plateState: state,
    fuelType: 'DIESEL',
    sleeperBerth: true,
    odometerMi,
    deviceOdometerMi: null,
    odometerOffsetMi: 0,
    odometerCalibratedAt: null,
    engineHours: Math.round(odometerMi / 38),
    busType: null,
    status,
    notes: status === 'OUT_OF_SERVICE' ? 'Placed out of service pending repair.' : null,
    activatedAt: iso(now - 400 * DAY),
    createdAt: iso(now - 400 * DAY),
  }));
  const vehicleByUnit = new Map(vehicles.map((v) => [v.unitNumber, v]));
  const vehicleOf = (unit: string): VehicleRow => vehicleByUnit.get(unit) as VehicleRow;

  const drivers: DriverRow[] = DRIVER_SPECS.map(([key, first, last, cdlState, terminal, timezone, unit], i) => ({
    id: `${MOCK_ID_PREFIX}drv-${key}`,
    username: `${first[0]}${last}`.toLowerCase().replace(/[^a-z]/g, ''),
    firstName: first,
    lastName: last,
    email: `${key}.${last.toLowerCase().replace(/[^a-z]/g, '')}@example.com`,
    phone: `+1 555 01${String(10 + i).padStart(2, '0')}`,
    cdlNumber: `${cdlState}${String(40_118_200 + i * 7_919)}`,
    cdlState,
    status: 'ACTIVE',
    homeTerminalName: terminal,
    homeTerminalTimezone: timezone,
    fleetManagerId: null,
    assignedVehicleId: vehicleOf(unit).id,
    allowPersonalConveyance: true,
    allowYardMove: true,
    adverseDrivingEnabled: false,
    shortHaulException: false,
    splitSleeperEnabled: false,
    eldExempt: false,
    eldExemptReason: null,
    appVersion: '2.8.1',
    appPlatform: 'ANDROID',
    registeredAt: iso(now - 300 * DAY),
    emailVerifiedAt: iso(now - 299 * DAY),
  }));
  const driverByKey = new Map(DRIVER_SPECS.map(([key], i) => [key, drivers[i] as DriverRow]));

  // Work-order ids are known up front so defects can point at them.
  const workOrderIdByDefectText = new Map<string, string>();
  for (const wo of WORK_ORDER_SPECS) {
    for (const text of wo.defects ?? []) workOrderIdByDefectText.set(text, `${MOCK_ID_PREFIX}wo-${wo.number}`);
  }
  const workOrderFor = (description: string): string | null => {
    for (const [text, id] of workOrderIdByDefectText) if (description.startsWith(text)) return id;
    return null;
  };

  const dvirs: DvirTableRow[] = [];
  const dvirDetails = new Map<string, DvirDetail>();
  const defects: DefectTableRow[] = [];
  let defectSeq = 0;

  DVIR_SPECS.forEach((spec, index) => {
    const id = `${MOCK_ID_PREFIX}dvir-${String(index + 1).padStart(3, '0')}`;
    const vehicle = vehicleOf(spec.unit);
    const driver = driverByKey.get(spec.driver) ?? null;
    const submittedMs = now - spec.hoursAgo * HOUR;
    // Odometer creeps back in time from the unit's current reading (~55 mph average day).
    const odometerMi = Math.max(0, Math.round(vehicle.odometerMi - spec.hoursAgo * 22));

    const ownDefects: DefectTableRow[] = (spec.defects ?? []).map((d) => {
      defectSeq += 1;
      const resolved = d.status === 'REPAIRED' || d.status === 'DEFERRED';
      const resolvedMs = d.resolution ? Math.min(now, submittedMs + d.resolution.afterHours * HOUR) : null;
      return {
        id: `${MOCK_ID_PREFIX}def-${String(defectSeq).padStart(3, '0')}`,
        dvirId: id,
        vehicleId: vehicle.id,
        category: d.category,
        part: d.part,
        severity: d.severity,
        description: d.description,
        status: d.status,
        outOfService: d.outOfService ?? false,
        workOrderId: workOrderFor(d.description),
        resolvedAt: resolved && resolvedMs ? iso(resolvedMs) : null,
        resolvedById: null,
        resolutionNote: d.resolution?.note ?? null,
        resolutionType: d.status === 'REPAIRED' ? 'REPAIRED' : d.status === 'DEFERRED' ? 'DEFERRED' : null,
        correctedBy: d.resolution?.correctedBy ?? null,
        completedAt: resolved && resolvedMs ? iso(resolvedMs) : null,
        laborHours: d.resolution?.laborHours ?? null,
        partsCostUsd: d.resolution?.partsCostUsd ?? null,
        assigneeId: null,
        createdAt: iso(submittedMs),
        photos: [],
        vehicle,
      };
    });
    defects.push(...ownDefects);

    const repairStatus = deriveRepairStatus(ownDefects);
    const signed = repairStatus === 'REPAIRED' || repairStatus === 'DEFERRED';
    const signoff = ownDefects.find((d) => d.correctedBy);
    const signedMs = signed && signoff?.completedAt ? new Date(signoff.completedAt).getTime() : null;

    const row: DvirTableRow = {
      id,
      driverId: driver?.id ?? '',
      vehicleId: vehicle.id,
      trailerId: spec.trailer,
      type: spec.type,
      submittedAt: iso(submittedMs),
      odometerMi,
      latitude: spec.lat,
      longitude: spec.lng,
      locationName: spec.location,
      vehicleCondition: ownDefects.length ? 'DEFECTS_FOUND' : 'SATISFACTORY',
      driverSignatureUrl: '',
      notes: spec.notes ?? null,
      mechanicName: signed ? signoff?.correctedBy ?? null : null,
      mechanicSignedAt: signedMs ? iso(signedMs) : null,
      mechanicNote: signed ? signoff?.resolutionNote ?? null : null,
      repairStatus,
      nextDriverReviewedAt: signedMs && signedMs + 10 * HOUR < now ? iso(signedMs + 10 * HOUR) : null,
      createdAt: iso(submittedMs),
      driver,
      vehicle,
      defects: ownDefects,
      defectsKnown: true,
    };
    dvirs.push(row);
    dvirDetails.set(id, { ...row, defects: ownDefects, photos: [] });
  });
  dvirs.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  defects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const workOrders: WorkOrderTableRow[] = WORK_ORDER_SPECS.map((wo) => {
    const vehicle = vehicleOf(wo.unit);
    return {
      id: `${MOCK_ID_PREFIX}wo-${wo.number}`,
      number: wo.number,
      vehicleId: vehicle.id,
      title: wo.title,
      description: wo.description,
      priority: wo.priority,
      status: wo.status,
      vendor: wo.vendor,
      // Decimal → string on the wire, as the real API sends it.
      costUsd: wo.costUsd == null ? null : wo.costUsd.toFixed(2),
      odometerMi: Math.round(vehicle.odometerMi - wo.openedDaysAgo * 520),
      openedById: `${MOCK_ID_PREFIX}usr-fleet-manager`,
      openedAt: iso(now - wo.openedDaysAgo * DAY),
      dueAt: wo.dueInDays == null ? null : iso(now + wo.dueInDays * DAY),
      closedAt: wo.closedDaysAgo == null ? null : iso(now - wo.closedDaysAgo * DAY),
      estimatedLaborHours: wo.estimatedLaborHours ?? null,
      keepOutOfService: wo.keepOutOfService ?? false,
      notifyDriver: true,
      blockDispatchAssignment: wo.keepOutOfService ?? false,
      vehicle,
    };
  }).sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());

  const schedules: ScheduleTableRow[] = SCHEDULE_SPECS.map((s, i) => {
    const vehicle = vehicleOf(s.unit);
    const lastServiceAtMs = now - s.daysSinceService * DAY;
    const byMiles = s.intervalMi != null && s.milesSinceService != null;
    const lastServiceMi = byMiles ? vehicle.odometerMi - (s.milesSinceService as number) : null;
    const nextDueMi = byMiles ? (lastServiceMi as number) + (s.intervalMi as number) : null;
    const milesRemaining = byMiles ? (nextDueMi as number) - vehicle.odometerMi : null;
    const nextDueAtMs = s.intervalDays != null ? lastServiceAtMs + s.intervalDays * DAY : null;
    const daysRemaining = nextDueAtMs != null ? Math.round((nextDueAtMs - now) / DAY) : null;
    const state =
      milesRemaining != null
        ? dueState(milesRemaining, Math.max(2_500, (s.intervalMi as number) * 0.1))
        : dueState(daysRemaining ?? 0, 14);
    const nextDueAt = nextDueAtMs != null ? iso(nextDueAtMs) : null;
    return {
      id: `${MOCK_ID_PREFIX}sch-${String(i + 1).padStart(3, '0')}`,
      vehicleId: vehicle.id,
      name: s.name,
      intervalMi: s.intervalMi ?? null,
      intervalDays: s.intervalDays ?? null,
      lastServiceMi,
      lastServiceAt: iso(lastServiceAtMs),
      nextDueMi,
      nextDueAt,
      enabled: true,
      due: { state, nextDueMi, nextDueAt, milesRemaining, daysRemaining },
      vehicle,
    };
  });

  return { vehicles, drivers, dvirs, dvirDetails, defects, workOrders, schedules };
}
