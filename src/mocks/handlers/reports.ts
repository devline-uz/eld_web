// owner: web-reports-transfer — W-12…W-15 + 11.14. Shapes are the RAW Prisma rows the live API
// returns (web/decisions.md WD-039), not the openapi examples.
//
// `reportsHandlers` (reports + transfers only) joins the default set. `reportScreenHandlers` add
// driver/unit/DVIR/RODS data with the fields the report screens read; they are opt-in via
// `server.use(...)` so they never shadow another feature's fixtures.
import { http, HttpResponse } from 'msw';
import { endpoints } from '@/shared/api/endpoints';
import { ok, url } from '../envelope';

export const MB_2_4 = 2_516_582;

const report = (over: Record<string, unknown>) => ({
  id: 'rpt_x',
  type: 'IFTA',
  format: 'CSV',
  params: { quarter: '2026-Q2' },
  status: 'READY',
  fileKey: 'reports/rpt_x.csv',
  fileSizeBytes: MB_2_4,
  rowCount: 5,
  error: null,
  requestedById: 'usr_fleet_manager',
  requestedAt: '2026-07-03T13:12:00.000Z',
  completedAt: '2026-07-03T13:12:04.000Z',
  expiresAt: '2028-07-03T13:12:04.000Z',
  ...over,
});

export const reportRows = [
  report({ id: 'rpt_ready' }),
  report({
    id: 'rpt_queued',
    type: 'FMCSA_PACK',
    format: 'PDF',
    params: { from: '2026-06-01', to: '2026-06-30' },
    status: 'QUEUED',
    fileKey: null,
    requestedById: 'usr_someone_else',
  }),
];

export const transferRows = [
  {
    id: 'trf_test',
    driverId: 'drv_1',
    method: 'WEB_SERVICES',
    rangeStart: '2026-09-03T00:00:00.000Z',
    rangeEnd: '2026-09-10T00:00:00.000Z',
    outputFileComment: 'ROADSIDE INSPECTION 2026-09-10',
    fileName: 'SMITH38018.csv',
    fileSizeBytes: 2048,
    encrypted: false,
    status: 'TEST_ONLY',
    erodsMode: 'TEST',
    referenceId: null,
    responseCode: 'TEST_ONLY',
    responseBody: null,
    attempts: 1,
    requestedById: 'usr_fleet_manager',
    createdAt: '2026-09-10T15:41:00.000Z',
    sentAt: null,
  },
  {
    id: 'trf_failed',
    driverId: 'drv_2',
    method: 'EMAIL',
    rangeStart: '2026-08-20T00:00:00.000Z',
    rangeEnd: '2026-08-27T00:00:00.000Z',
    outputFileComment: 'ROADSIDE OH-4471',
    fileName: 'BONDW27018.csv',
    fileSizeBytes: 1024,
    encrypted: true,
    status: 'FAILED',
    erodsMode: 'TEST',
    referenceId: null,
    responseCode: '503',
    responseBody: 'Service unavailable',
    attempts: 3,
    requestedById: 'usr_someone_else',
    createdAt: '2026-08-27T16:40:00.000Z',
    sentAt: null,
  },
];

/**
 * `GET /reports/ifta/summary?quarter=` (gap B-46) — the jurisdiction rows drawn in
 * `IFTA by jurisdiction and the report library.jpg`; `totals` and `kpis` are their sums.
 */
export const iftaSummaryFixture = {
  quarter: '2026-Q3',
  unitCount: 69,
  kpis: {
    totalMiles: 314_560,
    taxableMiles: 300_170,
    taxablePct: 95.4,
    fuelGal: 47_900,
    receiptCount: 1_842,
    fleetMpg: 6.6,
    fleetMpgPrev: 6.4,
  },
  rows: [
    { jurisdiction: 'OH', totalMiles: 96_420, taxableMiles: 92_110, fuelGal: 14_980, mpg: 6.4, taxDueUsd: 2_184.3 },
    { jurisdiction: 'KY', totalMiles: 71_880, taxableMiles: 68_240, fuelGal: 10_410, mpg: 6.6, taxDueUsd: 1_602.75 },
    { jurisdiction: 'IN', totalMiles: 58_110, taxableMiles: 55_900, fuelGal: 8_720, mpg: 6.3, taxDueUsd: 1_398.1 },
    { jurisdiction: 'IL', totalMiles: 49_640, taxableMiles: 47_020, fuelGal: 7_880, mpg: 6.1, taxDueUsd: 1_240.6 },
    { jurisdiction: 'ON', totalMiles: 38_510, taxableMiles: 36_900, fuelGal: 5_910, mpg: 6.2, taxDueUsd: 871.05 },
  ],
  totals: { totalMiles: 314_560, taxableMiles: 300_170, fuelGal: 47_900, mpg: 6.6, taxDueUsd: 7_296.8 },
};

const page = <T,>(items: T[], limit = 25) => ({ items, page: 1, limit, total: items.length, totalPages: 1 });

/** Pack jobs queued through the shortcut remember their params, so the detail read can echo them. */
const queuedPackParams = new Map<string, Record<string, string>>();
let queuedCounter = 0;

export const reportsHandlers = [
  http.get(url(endpoints.reports.list), () => ok(page(reportRows))),
  http.get(url(endpoints.reports.schedules), () => ok({ items: [] })),
  http.post(url(endpoints.reports.schedules), async ({ request }) =>
    ok({ id: 'sch_1', ...((await request.json()) as object), nextRunAt: '2026-09-14T10:00:00.000Z' }, 201),
  ),
  http.post(url(endpoints.reports.generate), () => ok({ reportId: 'rpt_generated', status: 'QUEUED' }, 202)),
  http.get(url(endpoints.reports.ifta), () => ok({ reportId: 'rpt_export_ifta', status: 'QUEUED' }, 202)),
  http.get(url(endpoints.reports.iftaSummary), ({ request }) =>
    ok({ ...iftaSummaryFixture, quarter: new URL(request.url).searchParams.get('quarter') ?? iftaSummaryFixture.quarter }),
  ),
  // Static `/summary` before any `:id` route (first match wins).
  http.get(url(endpoints.reports.activitySummary), ({ request }) => ok(activitySummaryFixture(new URL(request.url).searchParams))),
  http.get(url(endpoints.reports.activity), () => ok({ reportId: 'rpt_export_activity', status: 'QUEUED' }, 202)),
  http.get(url(endpoints.reports.dvir), () => ok({ reportId: 'rpt_export_dvir', status: 'QUEUED' }, 202)),
  http.get(url(endpoints.reports.fmcsaPack), ({ request }) => {
    queuedCounter += 1;
    const id = `rpt_pack_${queuedCounter}`;
    queuedPackParams.set(id, Object.fromEntries(new URL(request.url).searchParams));
    return ok({ reportId: id, status: 'QUEUED' }, 202);
  }),
  http.get(url(endpoints.reports.download(':id')), ({ params }) =>
    ok({ downloadUrl: `http://127.0.0.1:19000/onebook-dev/reports/${String(params.id)}.csv`, expiresAt: '2026-09-19T00:00:00.000Z', fileName: `${String(params.id)}.csv` }),
  ),
  http.get(url(endpoints.reports.detail(':id')), ({ params }) => {
    const id = String(params.id);
    const known = reportRows.find((r) => r.id === id);
    if (known) return ok({ ...known, status: 'READY' });
    const packParams = queuedPackParams.get(id);
    if (packParams) return ok(report({ id, type: 'FMCSA_PACK', format: 'PDF', params: packParams }));
    return ok(report({ id }));
  }),

  http.get(url(endpoints.transfers.list), () => ok(page(transferRows))),
  http.get(url(endpoints.transfers.detail(':id')), ({ params }) =>
    ok(transferRows.find((t) => t.id === params.id) ?? { ...transferRows[0], id: String(params.id) }),
  ),
  http.post(url(endpoints.transfers.create), () =>
    ok(
      {
        transfer: { ...transferRows[0], id: 'trf_new', status: 'QUEUED' },
        warnings: [{ code: 'ERODS_TEST_MODE', level: 'warning', message: 'eRODS is in TEST mode.' }],
        counts: { header: 9, events: 42 },
      },
      201,
    ),
  ),
  http.get(url(endpoints.transfers.download(':id')), () =>
    new HttpResponse('Header,OBK1,Universal Logistics Inc.,1234567\n', { headers: { 'Content-Type': 'text/csv' } }),
  ),
];

/* ------------------------------------------------------------------ screen data (opt-in) */

const driver = (id: string, firstName: string, lastName: string, terminal: string) => ({
  id,
  username: `${firstName.toLowerCase()}${lastName.toLowerCase()}`,
  firstName,
  lastName,
  email: null,
  status: 'ACTIVE',
  homeTerminalName: terminal,
  homeTerminalTimezone: 'America/New_York',
  assignedVehicleId: 'veh_101',
});

export const reportDrivers = [
  driver('drv_1', 'John', 'Smith', 'Columbus, OH'),
  driver('drv_2', 'William', 'Bond', 'Dayton, OH'),
  { ...driver('drv_3', 'Retired', 'Driver', 'Columbus, OH'), status: 'INACTIVE' },
];

const day = (date: string, over: Record<string, unknown> = {}) => ({
  date,
  timezone: 'America/New_York',
  offDutySec: 86_400,
  sleeperSec: 0,
  drivingSec: 0,
  onDutySec: 0,
  totalDistanceMi: 0,
  dayLengthSec: 86_400,
  certified: false,
  certifiedAt: null,
  certificationCount: 0,
  hasViolation: false,
  violationCount: 0,
  hasUnassigned: false,
  hasEdits: false,
  ...over,
});

/** drv_1: 2 active days (9 h + 8 h driving, 2 h + 1 h on duty, 850 mi, 1 violation, 1 certified). */
export const rangeDays: Record<string, ReturnType<typeof day>[]> = {
  drv_1: [
    day('2026-09-08', { offDutySec: 46_800, drivingSec: 32_400, onDutySec: 7_200, totalDistanceMi: 450, certified: true, violationCount: 1, hasViolation: true }),
    day('2026-09-09', { offDutySec: 54_000, drivingSec: 28_800, onDutySec: 3_600, totalDistanceMi: 400 }),
    day('2026-09-10'),
  ],
  drv_2: [day('2026-09-08'), day('2026-09-09'), day('2026-09-10')],
};

export const reportVehicles = [
  { id: 'veh_101', unitNumber: '101', vin: '1FUJGLDR8LLLL1234', status: 'ACTIVE', odometerMi: 993_589 },
  { id: 'veh_110', unitNumber: '110', vin: '1FUJGLDR8LLLL5678', status: 'ACTIVE', odometerMi: 812_004 },
];

const dvir = (over: Record<string, unknown>) => ({
  id: 'dvir_x',
  driverId: 'drv_1',
  vehicleId: 'veh_101',
  trailerId: null,
  type: 'PRE_TRIP',
  submittedAt: '2026-09-10T09:12:00.000Z',
  odometerMi: 993_500,
  latitude: null,
  longitude: null,
  locationName: null,
  vehicleCondition: 'SATISFACTORY',
  driverSignatureUrl: 'signatures/x.png',
  notes: null,
  mechanicName: null,
  mechanicSignedAt: null,
  mechanicNote: null,
  repairStatus: 'NOT_REQUIRED',
  nextDriverReviewedAt: null,
  createdAt: '2026-09-10T09:12:00.000Z',
  ...over,
});

export const reportDvirs = [
  dvir({ id: 'dvir_1', vehicleId: 'veh_110', vehicleCondition: 'DEFECTS_FOUND', repairStatus: 'PENDING' }),
  dvir({ id: 'dvir_2', driverId: 'drv_2', type: 'POST_TRIP', submittedAt: '2026-09-09T22:40:00.000Z', mechanicName: 'Mike Rowan · Shop A' }),
  dvir({ id: 'dvir_old', submittedAt: '2026-07-01T09:00:00.000Z' }),
];

export const reportDefects = [
  { id: 'def_1', dvirId: 'dvir_1', vehicleId: 'veh_110', category: 'Brakes', part: 'TRUCK', severity: 'CRITICAL', description: 'Soft pedal', status: 'OPEN', outOfService: true, workOrderId: null, resolvedAt: null, resolvedById: null, resolutionNote: null, createdAt: '2026-09-10T09:12:00.000Z' },
  { id: 'def_2', dvirId: 'dvir_1', vehicleId: 'veh_110', category: 'Lights', part: 'TRUCK', severity: 'MAJOR', description: 'Stop lamp', status: 'REPAIRED', outOfService: false, workOrderId: null, resolvedAt: '2026-09-11T09:12:00.000Z', resolvedById: 'usr_1', resolutionNote: 'Bulb', createdAt: '2026-09-10T09:12:00.000Z' },
];

/**
 * `GET /reports/activity/summary?from&to&page&limit` (B-46, backend landing in parallel) — the same
 * two ACTIVE drivers as `rangeDays`: drv_1 = 2 active days, 9 h + 8 h driving, 2 h + 1 h on duty,
 * 850 mi, 1 violation, 1 certified; drv_2 = no duty time. `kpis` are their sums; both deltas are
 * `null` (no prior period in the fixture) unless a test overrides them.
 */
export const activitySummaryItems = [
  { driverId: 'drv_1', name: 'Smith, John', days: 2, offSec: 100_800, sbSec: 0, drivingSec: 61_200, onSec: 10_800, distanceMi: 850, violations: 1, certifiedDays: 1 },
  { driverId: 'drv_2', name: 'Bond, William', days: 0, offSec: 0, sbSec: 0, drivingSec: 0, onSec: 0, distanceMi: 0, violations: 0, certifiedDays: 0 },
];

const activityTerminal: Record<string, string> = { drv_1: 'Columbus, OH', drv_2: 'Dayton, OH' };

export function activitySummaryFixture(search: URLSearchParams) {
  const page = Math.max(1, Number(search.get('page')) || 1);
  const limit = Math.min(200, Math.max(1, Number(search.get('limit')) || 25));
  const terminal = search.get('terminal');
  // Both fixture drivers are ACTIVE; any other `status` filter matches none of them.
  const status = search.get('status');
  const all = activitySummaryItems.filter(
    (i) => (!terminal || activityTerminal[i.driverId] === terminal) && (!status || status === 'ACTIVE'),
  );
  const sum = (pick: (i: (typeof activitySummaryItems)[number]) => number) => all.reduce((acc, i) => acc + pick(i), 0);
  return {
    kpis: {
      drivingSec: sum((i) => i.drivingSec),
      drivingDeltaPct: null as number | null,
      onDutySec: sum((i) => i.onSec),
      distanceMi: sum((i) => i.distanceMi),
      violations: sum((i) => i.violations),
      violationsDelta: null as number | null,
    },
    items: all.slice((page - 1) * limit, page * limit),
    page,
    limit,
    total: all.length,
    totalPages: Math.max(1, Math.ceil(all.length / limit)),
  };
}

export const reportScreenHandlers = [
  http.get(url(endpoints.drivers.list), () => ok(page(reportDrivers, 200))),
  http.get(url(endpoints.vehicles.list), () => ok(page(reportVehicles, 200))),
  http.get(url(endpoints.logs.range(':driverId')), ({ params, request }) => {
    const search = new URL(request.url).searchParams;
    return ok({ driverId: params.driverId, from: search.get('from'), to: search.get('to'), days: rangeDays[String(params.driverId)] ?? [] });
  }),
  http.get(url(endpoints.dvir.list), () => ok(page(reportDvirs, 200))),
  http.get(url(endpoints.defects.list), () => ok(page(reportDefects, 200))),
  http.get(url(endpoints.unidentified.list), () => ok({ items: [], total: 3, page: 1, limit: 1, totalPages: 3 })),
  http.get(url(endpoints.carrier.root), () =>
    ok({ id: 'carrier', name: 'Universal Logistics Inc.', timezone: 'America/New_York', eldIdentifier: 'OBK1', eldRegistrationId: null, erodsMode: 'PRODUCTION' }),
  ),
];
