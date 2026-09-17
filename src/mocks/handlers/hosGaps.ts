// owner: web-hos-logs — B-6 `GET /violations` + `POST /violations/:id/resolve` (shipped 2026-09-14).
// Test doubles only: both bodies follow the documented example in backend/docs/openapi.json and
// are validated by tests/contract/shipped-gaps.contract.test.ts (WB-045).
import { http } from 'msw';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { endpoints } from '@/shared/api/endpoints';
import type {
  HosViolation,
  LogDayResponse,
  LogEventView,
  LogRangeResponse,
  LogEventsResponse,
  RodsCertification,
  RodsDaySummary,
  RodsDutyStatus,
  RodsGraphSegment,
  SpecialDrivingCategory,
} from '@/shared/api/hosLogs';
import { ok, url } from '../envelope';
import { DRIVER_ROWS } from './vehiclesDriversGaps';

/** Shared with `dashboard.ts` (§20 dashboard summary MSW handler) so the two responses agree. */
export const VIOLATIONS_FIXTURE = [
  {
    id: 'vio_1',
    driverId: 'drv_1',
    dailyLogId: 'dl_1',
    logDate: '2026-09-14',
    type: 'DRIVING_11',
    occurredAt: '2026-09-14T14:26:00.000Z',
    exceededBySec: 1560,
    detail: 'Driving 11h26m',
    status: 'OPEN',
    resolvedAt: null,
    resolvedById: null,
    resolutionNote: null,
    severity: 'VIOLATION',
    driverName: 'John Smith',
    vehicleId: 'veh_1',
    unitNumber: '101',
    event: '11-hour driving limit exceeded',
    locationLabel: '1.04 mi W of Harrisburg, OH',
    date: '2026-09-14',
  },
];

/* ──────────────────────────────────────────────────────────────────────────────────────────────
 * W-08 RODS mock — `GET /logs/:driverId`, `/range`, `/events`.
 *
 * WB-049 — the generated fixture `GET /api/logs/{driverId}` is a five-field stub (no
 * `certification`, no `events`, no `violations`, and a `summary` that is not a `RodsDaySummary`),
 * so the page crashed on `day.certification.certified`. These handlers build a complete
 * `LogDayResponse` instead, in the driver's OWN home-terminal timezone, and are registered before
 * `fleetHandlers` (first match wins) so the fixture variants never answer.
 *
 * The day is derived, never hand-listed: segments are cumulative offsets from local midnight and
 * the last one is clamped to the real end of the RODS day, so a 23- or 25-hour DST day still adds
 * up (§23) and `dayLengthSec` stays honest.
 * ────────────────────────────────────────────────────────────────────────────────────────────── */

const DEFAULT_TZ = 'America/New_York';

function driverTimezone(driverId: string): string {
  return DRIVER_ROWS.find((row) => row.id === driverId)?.homeTerminalTimezone ?? DEFAULT_TZ;
}

/** UTC instant of local midnight for `date` in `timezone` (DST-safe: two passes). */
function dayStartMs(date: string, timezone: string): number {
  return fromZonedTime(`${date}T00:00:00`, timezone).getTime();
}

const iso = (ms: number): string => new Date(ms).toISOString();
const MIN = 60_000;

interface SegmentPlan {
  status: RodsDutyStatus;
  special: SpecialDrivingCategory;
  /** Minutes from local midnight. */
  startMin: number;
  location: string;
  odometerMi: number;
  annotation?: string;
}

/** One realistic property-carrying day: sleeper → pre-trip → drive → 30-min break → drive →
 *  yard move → drive → post-trip → personal conveyance → off duty. */
const DAY_PLAN: SegmentPlan[] = [
  { status: 'SB', special: 'NONE', startMin: 0, location: 'Columbus terminal, OH', odometerMi: 993_120 },
  { status: 'OFF', special: 'NONE', startMin: 345, location: 'Columbus terminal, OH', odometerMi: 993_120 },
  { status: 'ON', special: 'NONE', startMin: 375, location: 'Columbus terminal, OH', odometerMi: 993_120, annotation: 'Pre-trip inspection completed.' },
  { status: 'D', special: 'NONE', startMin: 405, location: '1.04 mi W of Harrisburg, OH', odometerMi: 993_128 },
  { status: 'OFF', special: 'NONE', startMin: 675, location: '3.2 mi E of Zanesville, OH', odometerMi: 993_401, annotation: '30-minute break taken at the Zanesville plaza.' },
  { status: 'ON', special: 'NONE', startMin: 705, location: '3.2 mi E of Zanesville, OH', odometerMi: 993_401, annotation: 'Fueling at the Zanesville plaza.' },
  { status: 'D', special: 'NONE', startMin: 735, location: '3.2 mi E of Zanesville, OH', odometerMi: 993_403 },
  { status: 'ON', special: 'YM', startMin: 1035, location: 'Florence yard, KY', odometerMi: 993_712, annotation: 'Yard move across the Florence lot.' },
  { status: 'D', special: 'NONE', startMin: 1065, location: 'Florence yard, KY', odometerMi: 993_715 },
  { status: 'ON', special: 'NONE', startMin: 1181, location: '0.64 mi N of Florence, KY', odometerMi: 993_812, annotation: 'Post-trip inspection, no defects found.' },
  { status: 'OFF', special: 'PC', startMin: 1211, location: '0.64 mi N of Florence, KY', odometerMi: 993_812, annotation: 'Personal conveyance to the motel.' },
  { status: 'OFF', special: 'NONE', startMin: 1241, location: 'Florence, KY', odometerMi: 993_821 },
];

const effectiveOf = (plan: SegmentPlan): RodsDutyStatus =>
  plan.special === 'PC' ? 'OFF' : plan.special === 'YM' ? 'ON' : plan.status;

interface BuiltDay {
  timezone: string;
  startMs: number;
  lengthSec: number;
  graph: RodsGraphSegment[];
  plans: SegmentPlan[];
}

function buildGraph(date: string, timezone: string): BuiltDay {
  const startMs = dayStartMs(date, timezone);
  const endMs = dayStartMs(shiftDate(date, 1), timezone);
  const lengthSec = Math.round((endMs - startMs) / 1000);
  const plans = DAY_PLAN.filter((plan) => plan.startMin * MIN < endMs - startMs);
  const graph = plans.map((plan, index) => {
    const segmentStart = startMs + plan.startMin * MIN;
    const next = plans[index + 1];
    const segmentEnd = next ? Math.min(startMs + next.startMin * MIN, endMs) : endMs;
    return {
      status: plan.status,
      effective: effectiveOf(plan),
      special: plan.special,
      startAt: iso(segmentStart),
      endAt: iso(segmentEnd),
      durationSec: Math.round((segmentEnd - segmentStart) / 1000),
    } satisfies RodsGraphSegment;
  });
  return { timezone, startMs, lengthSec, graph, plans };
}

function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Certified once the day is more than one day old — so `Certify all` always has work to do. */
function isCertified(date: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return date < shiftDate(today, -1);
}

function buildSummary(driverId: string, date: string): RodsDaySummary {
  const timezone = driverTimezone(driverId);
  const { graph, lengthSec } = buildGraph(date, timezone);
  const totalOf = (status: RodsDutyStatus): number =>
    graph.filter((s) => s.effective === status).reduce((sum, s) => sum + s.durationSec, 0);
  const certified = isCertified(date);
  return {
    date,
    timezone,
    offDutySec: totalOf('OFF'),
    sleeperSec: totalOf('SB'),
    drivingSec: totalOf('D'),
    onDutySec: totalOf('ON'),
    totalDistanceMi: 701,
    dayLengthSec: lengthSec,
    certified,
    certifiedAt: certified ? iso(dayStartMs(shiftDate(date, 1), timezone) + 45 * MIN) : null,
    certificationCount: certified ? 1 : 0,
    hasViolation: true,
    violationCount: 1,
    hasUnassigned: false,
    hasEdits: true,
  };
}

/** §395.3(a)(3)(i) — driving passes 11 h inside the last driving block; the server records it. */
function buildViolations(driverId: string, date: string): HosViolation[] {
  const timezone = driverTimezone(driverId);
  const { graph } = buildGraph(date, timezone);
  const drivingSec = graph.filter((s) => s.effective === 'D').reduce((sum, s) => sum + s.durationSec, 0);
  const exceededBySec = drivingSec - 39_600;
  if (exceededBySec <= 0) return [];
  const lastDrive = [...graph].reverse().find((s) => s.effective === 'D');
  return [
    {
      id: `vio_${driverId}_${date}`,
      driverId,
      dailyLogId: `dl_${driverId}_${date}`,
      logDate: date,
      type: 'DRIVING_11',
      occurredAt: iso(Date.parse(lastDrive?.endAt ?? `${date}T23:00:00.000Z`) - exceededBySec * 1000),
      exceededBySec,
      detail: `Driving ${Math.floor(drivingSec / 3600)}h${String(Math.round((drivingSec % 3600) / 60)).padStart(2, '0')}m`,
      status: 'OPEN',
      resolvedAt: null,
      resolvedById: null,
      resolutionNote: null,
    },
  ];
}

const DUTY_EVENT_CODE: Record<RodsDutyStatus, number> = { OFF: 1, SB: 2, D: 3, ON: 4 };

/**
 * §395.8 event list. `active` only unless `withAudit`, which adds the superseded original (2) and
 * the carrier's proposed replacement (3) behind `Show superseded and proposed records`.
 */
function buildEvents(driverId: string, date: string, withAudit: boolean): LogEventView[] {
  const timezone = driverTimezone(driverId);
  const { graph, plans } = buildGraph(date, timezone);
  const vehicleId = DRIVER_ROWS.find((row) => row.id === driverId)?.assignedVehicleId ?? 'veh_1';
  const events: LogEventView[] = graph.map((segment, index) => {
    const plan = plans[index]!;
    return {
      id: `evt_${date}_${index + 1}`,
      eventType: plan.special === 'NONE' ? 1 : 3,
      eventCode: plan.special === 'PC' ? 1 : plan.special === 'YM' ? 2 : DUTY_EVENT_CODE[segment.status],
      eventSequenceId: 1000 + index + 1,
      eventDateTime: segment.startAt,
      recordStatus: 1,
      recordOrigin: index === 2 ? 2 : 1,
      status: segment.status,
      locationName: plan.location,
      totalVehicleMiles: plan.odometerMi,
      annotation: plan.annotation ?? null,
      comment: null,
      supersedesId: null,
      editedById: null,
      editorType: index === 2 ? 'DRIVER' : null,
      editReason: null,
      vehicleId,
    };
  });
  if (!withAudit || graph.length === 0) return events;
  const anchor = events[2]!;
  return [
    ...events,
    {
      ...anchor,
      id: `${anchor.id}_superseded`,
      eventSequenceId: anchor.eventSequenceId + 500,
      recordStatus: 2,
      recordOrigin: 1,
      status: 'OFF',
      annotation: 'Automatic record replaced by the driver.',
      editorType: 'SYSTEM',
    },
    {
      ...anchor,
      id: `${anchor.id}_proposed`,
      eventSequenceId: anchor.eventSequenceId + 501,
      recordStatus: 3,
      recordOrigin: 3,
      status: 'ON',
      annotation: 'Carrier proposes On duty for the loading window at shipper #4821.',
      supersedesId: anchor.id,
      editedById: 'usr_1',
      editorType: 'CARRIER',
      editReason: 'Driver forgot to switch to On duty while loading.',
    },
  ];
}

function buildCertification(date: string, driverId: string): RodsCertification {
  const certified = isCertified(date);
  return {
    certified,
    certifiedAt: certified ? iso(dayStartMs(shiftDate(date, 1), driverTimezone(driverId)) + 45 * MIN) : null,
    certifiedById: certified ? driverId : null,
    certifierType: certified ? 'DRIVER' : null,
    certificationCount: certified ? 1 : 0,
    signatureUrl: null,
    recertificationRequired: certified,
  };
}

function buildDay(driverId: string, date: string): LogDayResponse {
  const timezone = driverTimezone(driverId);
  return {
    driverId,
    date,
    timezone,
    summary: buildSummary(driverId, date),
    graph: buildGraph(date, timezone).graph,
    events: buildEvents(driverId, date, false),
    violations: buildViolations(driverId, date),
    certification: buildCertification(date, driverId),
  };
}

/** `?date=` defaults to today in the driver's home-terminal zone, like the real controller. */
function dateParam(request: Request, timezone: string): string {
  const asked = new URL(request.url).searchParams.get('date');
  return asked ?? formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd');
}

export const hosGapHandlers = [
  http.get(url(endpoints.violations.list), () =>
    ok({
      items: VIOLATIONS_FIXTURE,
      total: 1,
      page: 1,
      limit: 25,
      totalPages: 1,
    }),
  ),
  // W-08 RODS day / range / events — registered before `fleetHandlers`' fixture variants.
  http.get(url(endpoints.logs.day(':driverId')), ({ params, request }) => {
    const driverId = String(params.driverId);
    return ok(buildDay(driverId, dateParam(request, driverTimezone(driverId))));
  }),
  http.get(url(endpoints.logs.range(':driverId')), ({ params, request }) => {
    const driverId = String(params.driverId);
    const timezone = driverTimezone(driverId);
    const query = new URL(request.url).searchParams;
    const to = query.get('to') ?? formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd');
    const from = query.get('from') ?? shiftDate(to, -7);
    const days: RodsDaySummary[] = [];
    // §11.12 caps the log range at 62 days; the mock refuses to build more, like the controller.
    for (let cursor = from; cursor <= to && days.length < 62; cursor = shiftDate(cursor, 1)) {
      days.push(buildSummary(driverId, cursor));
    }
    return ok({ driverId, from, to, days } satisfies LogRangeResponse);
  }),
  http.get(url(endpoints.logs.events(':driverId')), ({ params, request }) => {
    const driverId = String(params.driverId);
    const timezone = driverTimezone(driverId);
    const date = dateParam(request, timezone);
    // §395.8 audit trail: superseded (2) and proposed (3) records are always in the payload; the
    // page decides what to show.
    return ok({
      driverId,
      date,
      timezone,
      events: buildEvents(driverId, date, true),
    } satisfies LogEventsResponse);
  }),
  http.post(url(endpoints.violations.resolve(':id')), async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as { resolutionNote?: string };
    return ok({
      id: String(params.id),
      status: 'RESOLVED',
      resolvedAt: new Date().toISOString(),
      resolutionNote: body.resolutionNote ?? '',
    });
  }),
];
