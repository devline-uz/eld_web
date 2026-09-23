// W-08 HOS — the day, the 8-day range, the event audit trail and every write the screen makes
// (certify on behalf, log edit requests, accept/reject, unassigned-segment resolution). Only the
// thin generated examples were served before: `GET /logs/:id/range` had no handler at all in the
// default set (it lived in `reports.ts`'s opt-in `reportScreenHandlers`, so the Dashboard's
// `/logs/drv_1/range` fell through to `localhost:3002`), and `GET /logs/:id/events` answered a
// single `recordStatus: 2` row — superseded, which the page filters out, so the events table was
// always empty and the edit flow unreachable (mock-layer audit, 2026-09-23).
//
// Event rows carry BOTH spellings on purpose: the app's `LogEventView` names
// (`eventDateTime` / `status` / `totalVehicleMiles`) and the documented example's names
// (`occurredAt` / `dutyStatus` / `odometerMiles`), which are a recorded contract deviation.
import { http } from 'msw';
import { endpoints } from '@/shared/api/endpoints';
import type { LogEventView, RodsDaySummary, RodsDutyStatus, RodsGraphSegment } from '@/shared/api/hosLogs';
import { fixture } from '../fixtures.generated';
import { fail, ok, url } from '../envelope';
import { DRIVERS, mockId } from './mockState';

const TZ = 'America/New_York';
const SEC = 1000;

/** A deterministic duty day: off → on (pre-trip) → drive → break → drive → on → off. */
const SHIFT: Array<{ status: RodsDutyStatus; durationSec: number }> = [
  { status: 'OFF', durationSec: 5 * 3600 },
  { status: 'ON', durationSec: 1800 },
  { status: 'D', durationSec: 5 * 3600 },
  { status: 'OFF', durationSec: 1800 },
  { status: 'D', durationSec: 4 * 3600 },
  { status: 'ON', durationSec: 3600 },
  { status: 'SB', durationSec: 7 * 3600 },
  { status: 'OFF', durationSec: 86_400 - (5 * 3600 + 1800 + 5 * 3600 + 1800 + 4 * 3600 + 3600 + 7 * 3600) },
];

const LOCATIONS = [
  '1.04 mi W of Harrisburg, OH',
  '4 mi N of Fredericksburg, VA',
  '0.64 mi N of Florence, KY',
  'Iowa 80 Truckstop, Walcott, IA',
  '9 mi E of Alma, AR',
];

/** Midnight of `date` in the driver's home terminal offset — close enough for a fixture, and the
 * page re-formats everything through `formatRods` anyway. */
function dayStart(date: string): number {
  return new Date(`${date}T04:00:00.000Z`).getTime();
}

function graphFor(date: string): RodsGraphSegment[] {
  let cursor = dayStart(date);
  return SHIFT.map((slot) => {
    const startAt = new Date(cursor).toISOString();
    cursor += slot.durationSec * SEC;
    return {
      status: slot.status,
      effective: slot.status,
      special: 'NONE' as const,
      startAt,
      endAt: new Date(cursor).toISOString(),
      durationSec: slot.durationSec,
    };
  });
}

function summaryFor(date: string, graph: RodsGraphSegment[], violationCount: number): RodsDaySummary {
  const total = (status: RodsDutyStatus) =>
    graph.filter((s) => s.effective === status).reduce((sum, s) => sum + s.durationSec, 0);
  return {
    date,
    timezone: TZ,
    offDutySec: total('OFF'),
    sleeperSec: total('SB'),
    drivingSec: total('D'),
    onDutySec: total('ON'),
    totalDistanceMi: Math.round(total('D') / 3600) * 52,
    dayLengthSec: 86_400,
    certified: certifiedDates.has(date),
    certifiedAt: certifiedDates.get(date) ?? null,
    certificationCount: certifiedDates.has(date) ? 1 : 0,
    hasViolation: violationCount > 0,
    violationCount,
    hasUnassigned: false,
    hasEdits: false,
  };
}

/** Dates certified through `POST /logs/:id/certify` in this session. */
const certifiedDates = new Map<string, string>();

type MockLogEvent = LogEventView & Record<string, unknown>;

function eventsFor(driverId: string, date: string): MockLogEvent[] {
  const graph = graphFor(date);
  const vehicleId = DRIVERS.find((d) => d.id === driverId)?.assignedVehicleId ?? 'veh_1';
  const rows: MockLogEvent[] = graph.map((segment, i) => {
    const status = segment.status;
    const eventCode = status === 'OFF' ? 1 : status === 'SB' ? 2 : status === 'D' ? 3 : 4;
    return {
      id: `evt_${date.replace(/-/g, '')}_${i + 1}`,
      eventType: 1,
      eventCode,
      eventSequenceId: 1000 + i,
      eventDateTime: segment.startAt,
      // recordStatus 1 = active. The page's default view keeps only these (§395.8, WB-065).
      recordStatus: 1,
      recordOrigin: i === 1 ? 2 : 1,
      status,
      locationName: LOCATIONS[i % LOCATIONS.length]!,
      totalVehicleMiles: 993_100 + i * 47,
      totalEngineHours: 12_400 + i,
      annotation: i === 5 ? 'Loading at shipper #4821' : null,
      comment: null,
      supersedesId: null,
      editedById: null,
      editorType: null,
      editReason: null,
      vehicleId,
      // Documented spellings (openapi.json example) — the contract deviation is recorded.
      occurredAt: segment.startAt,
      dutyStatus: status === 'D' ? 'D' : status === 'OFF' ? 'OFF' : status === 'SB' ? 'SB' : 'ON',
      odometerMiles: 993_100 + i * 47,
      latitude: 39.9612,
      longitude: -82.9988,
      locationDescription: LOCATIONS[i % LOCATIONS.length]!,
      checksumValid: true,
    } satisfies MockLogEvent;
  });

  // One superseded record and one pending driver proposal, so the `Show all records` checkbox
  // and the "N driver edits pending review" subtitle both have something to show.
  const base = rows[2]!;
  rows.push(
    {
      ...base,
      id: `${base.id}_old`,
      eventSequenceId: 990,
      recordStatus: 2,
      recordOrigin: 1,
      status: 'ON',
      dutyStatus: 'ON',
      annotation: 'Superseded by a carrier edit',
    },
    {
      ...base,
      id: `${base.id}_prop`,
      eventSequenceId: 1100,
      recordStatus: 3,
      recordOrigin: 2,
      status: 'ON',
      dutyStatus: 'ON',
      editorType: 'DRIVER',
      editedById: driverId,
      editReason: 'Forgot to switch to On duty while loading',
      annotation: 'Proposed by driver — awaiting review',
    },
  );
  return rows;
}

function violationsFor(driverId: string, date: string) {
  if (driverId !== 'drv_1') return [];
  return [
    {
      id: `vio_${date}`,
      driverId,
      dailyLogId: `dl_${date}`,
      logDate: date,
      type: 'DRIVING_11',
      occurredAt: `${date}T18:26:00.000Z`,
      exceededBySec: 1560,
      detail: 'Driving 11h26m',
      status: 'OPEN',
      resolvedAt: null,
      resolvedById: null,
      resolutionNote: null,
    },
  ];
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function body(request: Request): Promise<Record<string, unknown>> {
  return ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
}

const editRequests = new Map<string, Record<string, unknown>[]>();

export const hosWriteHandlers = [
  /* ---------------------------------------------------------------- reads */
  http.get(url(endpoints.logs.day(':driverId')), ({ params, request }) => {
    const driverId = String(params.driverId);
    const date = new URL(request.url).searchParams.get('date') ?? today();
    const graph = graphFor(date);
    const violations = violationsFor(driverId, date);
    const certifiedAt = certifiedDates.get(date) ?? null;
    return ok({
      driverId,
      date,
      timezone: TZ,
      summary: summaryFor(date, graph, violations.length),
      graph,
      events: eventsFor(driverId, date),
      violations,
      certification: {
        certified: Boolean(certifiedAt),
        certifiedAt,
        certifiedById: certifiedAt ? 'usr_1' : null,
        certifierType: certifiedAt ? 'CARRIER' : null,
        certificationCount: certifiedAt ? 1 : 0,
        signatureUrl: certifiedAt ? 'signatures/drv_1.png' : null,
        recertificationRequired: false,
      },
    });
  }),

  http.get(url(endpoints.logs.events(':driverId')), ({ params, request }) => {
    const driverId = String(params.driverId);
    const date = new URL(request.url).searchParams.get('date') ?? today();
    return ok({ driverId, date, timezone: TZ, events: eventsFor(driverId, date) });
  }),

  /** Registered at last (it only existed inside `reports.ts`'s opt-in set) and generated for ANY
   * driver and window, so the Dashboard's boot-time `/logs/drv_1/range` is answered too. */
  http.get(url(endpoints.logs.range(':driverId')), ({ params, request }) => {
    const search = new URL(request.url).searchParams;
    const to = search.get('to') ?? today();
    const from = search.get('from') ?? new Date(Date.parse(to) - 7 * 86_400_000).toISOString().slice(0, 10);
    const days: RodsDaySummary[] = [];
    for (let t = Date.parse(from); t <= Date.parse(to); t += 86_400_000) {
      const date = new Date(t).toISOString().slice(0, 10);
      const graph = graphFor(date);
      days.push(summaryFor(date, graph, String(params.driverId) === 'drv_1' && days.length === 1 ? 1 : 0));
    }
    return ok({ driverId: String(params.driverId), from, to, days });
  }),

  http.get(url(endpoints.logs.editRequests(':driverId')), ({ params }) =>
    ok({ items: editRequests.get(String(params.driverId)) ?? [] }),
  ),

  /* ---------------------------------------------------------------- writes */
  http.post(url(endpoints.logs.certify(':driverId')), async ({ params, request }) => {
    const dto = (await body(request)) as { dates?: string[] };
    const dates = dto.dates ?? [];
    if (!dates.length) {
      return fail(422, 'VALIDATION_ERROR', 'Select at least one day to certify.', {
        dates: 'Select at least one day to certify.',
      });
    }
    const certifiedAt = new Date().toISOString();
    for (const date of dates) certifiedDates.set(date, certifiedAt);
    return ok({
      driverId: String(params.driverId),
      certified: dates.map((date) => ({
        date,
        certifiedAt,
        certifiedBy: 'usr_1',
        onBehalf: true,
        signatureCount: 1,
      })),
    });
  }),

  http.post(url(endpoints.logs.createEditRequest(':driverId')), async ({ params, request }) => {
    const driverId = String(params.driverId);
    const dto = await body(request);
    const reason = String(dto.reason ?? '');
    if (reason.trim().length < 4 || reason.length > 60) {
      return fail(422, 'VALIDATION_ERROR', 'Check the highlighted fields.', {
        reason: 'The reason must be 4–60 characters (§395 Appendix A).',
      });
    }
    const created = {
      id: mockId('edt'),
      status: 'PENDING' as const,
      driverId,
      originalEventId: String(dto.originalEventId ?? ''),
      proposedStatus: dto.proposedStatus,
      proposedStart: dto.proposedStart,
      proposedEnd: dto.proposedEnd ?? null,
      reason,
      // §395.30 — a proposal changes nothing until the driver accepts it in the mobile app.
      applied: false as const,
      createdAt: new Date().toISOString(),
      date: String(dto.proposedStart ?? today()).slice(0, 10),
      requestedBy: 'usr_1',
    };
    editRequests.set(driverId, [created, ...(editRequests.get(driverId) ?? [])]);
    return ok(created, 201);
  }),

  http.post(url(endpoints.logs.acceptEditRequest(':id')), ({ params }) =>
    ok({ ...(fixture('POST /api/logs/edit-requests/{id}/accept') as Record<string, unknown>), id: String(params.id) }),
  ),
  http.post(url(endpoints.logs.rejectEditRequest(':id')), ({ params }) =>
    ok({ ...(fixture('POST /api/logs/edit-requests/{id}/reject') as Record<string, unknown>), id: String(params.id) }),
  ),

  /* ---------------------------------------------------------------- 11.13 unassigned driving */
  http.get(url(endpoints.unidentified.detail(':id')), ({ params }) =>
    ok({ ...(fixture('GET /api/unidentified/{id}') as Record<string, unknown>), id: String(params.id) }),
  ),
  http.post(url(endpoints.unidentified.assign(':id')), async ({ params, request }) => {
    const dto = await body(request);
    if (!dto.driverId) {
      return fail(422, 'VALIDATION_ERROR', 'Check the highlighted fields.', { driverId: 'Select a driver.' });
    }
    return ok({
      ...(fixture('POST /api/unidentified/{id}/assign') as Record<string, unknown>),
      id: String(params.id),
      status: 'ASSIGNED',
      assignedDriverId: dto.driverId,
      assignedById: 'usr_1',
      assignedAt: new Date().toISOString(),
    });
  }),
  http.post(url(endpoints.unidentified.annotate(':id')), async ({ params, request }) => {
    const dto = await body(request);
    return ok({
      ...(fixture('POST /api/unidentified/{id}/annotate') as Record<string, unknown>),
      id: String(params.id),
      status: 'ANNOTATED',
      annotation: dto.annotation ?? null,
    });
  }),
  http.post(url(endpoints.unidentified.reject(':id')), async ({ params, request }) => {
    const dto = await body(request);
    return ok({
      ...(fixture('POST /api/unidentified/{id}/reject') as Record<string, unknown>),
      id: String(params.id),
      status: 'REJECTED',
      annotation: dto.annotation ?? null,
    });
  }),
  http.post(url(endpoints.unidentified.confirm(':id')), ({ params }) =>
    ok({ ...(fixture('POST /api/unidentified/{id}/confirm') as Record<string, unknown>), id: String(params.id) }),
  ),
];

/** Tests call this in `afterEach` — certification and edit requests live between requests. */
export function resetHosWriteState(): void {
  certifiedDates.clear();
  editRequests.clear();
}
