// owner: web-dispatch-messaging — richer W-11/W-16 fixtures than the generated OpenAPI examples
// (`fixtures.generated.ts` only has one bare trip/conversation). Every shape here matches a real,
// existing endpoint (`GET /trips`, `GET /trips/unassigned-loads`, `GET /conversations`, …) — none
// of this is a backend-gap stub; it just gives the design's populated states something to render
// against in dev/tests. Registered ahead of `fleetHandlers`' bare `GET /api/trips` (same
// first-match-wins rule as `vehiclesDriversGaps.ts`, web/bugs.md WB-018).
import { http } from 'msw';
import { endpoints } from '@/shared/api/endpoints';
import { ok, url, serverPage } from '../envelope';
import type { TripRow, TripStatus, TripStopRow } from '@/shared/api/trips';
import type { ConversationRow, MessageRow } from '@/shared/api/messaging';

const TRIPS: TripRow[] = [
  {
    id: 'trp_1001',
    number: 'TR-4821',
    driverId: 'drv_1',
    vehicleId: 'veh_1',
    trailerId: null,
    status: 'IN_PROGRESS',
    shippingDocument: 'BOL #4821-A',
    commodity: 'Palletized dry goods',
    weightLbs: 38500,
    pieces: null,
    plannedStartAt: '2026-09-12T05:30:00.000Z',
    plannedEndAt: null,
    startedAt: '2026-09-12T05:30:00.000Z',
    completedAt: null,
    etaAt: '2026-09-12T17:40:00.000Z',
    onTime: true,
    notes: null,
    createdById: 'usr_1',
    createdAt: '2026-09-11T18:09:14.598Z',
    stops: [
      {
        id: 'stp_1',
        tripId: 'trp_1001',
        sequence: 1,
        type: 'PICKUP',
        name: 'Columbus, OH',
        address: 'Shipper #4821',
        latitude: null,
        longitude: null,
        scheduledAt: '2026-09-12T05:30:00.000Z',
        arrivedAt: '2026-09-12T05:30:00.000Z',
        departedAt: '2026-09-12T05:41:00.000Z',
        status: 'COMPLETED',
        note: null,
      },
      {
        id: 'stp_2',
        tripId: 'trp_1001',
        sequence: 2,
        type: 'FUEL',
        name: 'Pilot #482, Cincinnati, OH',
        address: null,
        latitude: null,
        longitude: null,
        scheduledAt: '2026-09-12T09:12:00.000Z',
        arrivedAt: '2026-09-12T09:12:00.000Z',
        departedAt: '2026-09-12T09:30:00.000Z',
        status: 'COMPLETED',
        note: null,
      },
      {
        id: 'stp_3',
        tripId: 'trp_1001',
        sequence: 3,
        type: 'DELIVERY',
        name: 'Florence, KY',
        address: 'Major Retail Co.',
        latitude: null,
        longitude: null,
        scheduledAt: '2026-09-12T17:40:00.000Z',
        arrivedAt: null,
        departedAt: null,
        status: 'PENDING',
        note: null,
      },
    ],
  },
  {
    id: 'trp_1002',
    number: 'TR-4822',
    driverId: 'drv_2',
    vehicleId: 'veh_2',
    trailerId: null,
    status: 'IN_PROGRESS',
    shippingDocument: null,
    commodity: 'Retail goods',
    weightLbs: 21000,
    pieces: null,
    plannedStartAt: '2026-09-12T04:00:00.000Z',
    plannedEndAt: null,
    startedAt: '2026-09-12T04:00:00.000Z',
    completedAt: null,
    etaAt: '2026-09-12T02:00:00.000Z',
    onTime: false,
    notes: null,
    createdById: 'usr_1',
    createdAt: '2026-09-11T12:00:00.000Z',
    stops: [
      {
        id: 'stp_4',
        tripId: 'trp_1002',
        sequence: 1,
        type: 'PICKUP',
        name: 'Toledo, OH',
        address: 'Shipper Co.',
        latitude: null,
        longitude: null,
        scheduledAt: '2026-09-12T04:00:00.000Z',
        arrivedAt: '2026-09-12T04:00:00.000Z',
        departedAt: '2026-09-12T04:12:00.000Z',
        status: 'COMPLETED',
        note: null,
      },
      {
        id: 'stp_5',
        tripId: 'trp_1002',
        sequence: 2,
        type: 'DELIVERY',
        name: 'Dayton, OH',
        address: null,
        latitude: null,
        longitude: null,
        scheduledAt: '2026-09-12T02:00:00.000Z',
        arrivedAt: null,
        departedAt: null,
        status: 'PENDING',
        note: null,
      },
    ],
  },
  {
    id: 'trp_1003',
    number: 'TR-4823',
    driverId: null,
    vehicleId: null,
    trailerId: null,
    status: 'PLANNED',
    shippingDocument: null,
    commodity: null,
    weightLbs: null,
    pieces: null,
    plannedStartAt: '2026-09-14T06:00:00.000Z',
    plannedEndAt: null,
    startedAt: null,
    completedAt: null,
    etaAt: null,
    onTime: null,
    notes: null,
    createdById: 'usr_1',
    createdAt: '2026-09-11T10:00:00.000Z',
    stops: [],
  },
  {
    id: 'trp_1004',
    number: 'TR-4801',
    driverId: 'drv_3',
    vehicleId: 'veh_3',
    trailerId: null,
    status: 'DELIVERED',
    shippingDocument: null,
    commodity: null,
    weightLbs: 18400,
    pieces: null,
    plannedStartAt: '2026-09-10T05:00:00.000Z',
    plannedEndAt: null,
    startedAt: '2026-09-10T05:00:00.000Z',
    completedAt: '2026-09-10T15:00:00.000Z',
    etaAt: '2026-09-10T15:00:00.000Z',
    onTime: true,
    notes: null,
    createdById: 'usr_1',
    createdAt: '2026-09-09T10:00:00.000Z',
    stops: [],
  },
];


// ─── Deterministic bulk fill ─────────────────────────────────────────────────
//
// The four literal trips above are the ones the W-11 suite pins (`trp_1001`…`trp_1004`,
// `TR-4821`…); they stay first and unchanged. The rest is derived from the row INDEX by pure
// functions — no `Math.random()`, so the segment counts and page contents are identical on every
// run. `driverId`/`vehicleId` point at rows that really exist in the `/drivers` and `/vehicles`
// lookups (`vehiclesDriversGaps.ts`), otherwise the client-side join (B-36) renders a table of
// blanks.

const LANE_CITIES = [
  'Columbus, OH', 'Cleveland, OH', 'Toledo, OH', 'Cincinnati, OH', 'Indianapolis, IN',
  'Fort Wayne, IN', 'Louisville, KY', 'Lexington, KY', 'Nashville, TN', 'Memphis, TN',
  'Chicago, IL', 'Peoria, IL', 'St. Louis, MO', 'Kansas City, MO', 'Des Moines, IA',
  'Omaha, NE', 'Denver, CO', 'Salt Lake City, UT', 'Phoenix, AZ', 'Albuquerque, NM',
  'Dallas, TX', 'Houston, TX', 'Little Rock, AR', 'Atlanta, GA', 'Charlotte, NC',
  'Raleigh, NC', 'Richmond, VA', 'Harrisburg, PA', 'Pittsburgh, PA', 'Buffalo, NY',
  'Detroit, MI', 'Grand Rapids, MI', 'Milwaukee, WI', 'Minneapolis, MN', 'Birmingham, AL',
  'Jacksonville, FL', 'Orlando, FL', 'Knoxville, TN', 'Springfield, MO', 'Wichita, KS',
  'Tulsa, OK',
] as const;

const COMMODITIES = [
  'Palletized dry goods', 'Retail goods', 'Refrigerated produce', 'Paper products',
  'Automotive parts', 'Building materials', 'Bottled beverages', 'Packaged foods',
  'Consumer electronics', 'Industrial fasteners', 'Furniture', 'Plastic resin',
] as const;

const SHIPPERS = [
  'Midwest Distribution', 'Great Lakes Foods', 'Summit Retail Co.', 'Cardinal Logistics',
  'Buckeye Supply', 'Riverbend Wholesale', 'Northstar Brands', 'Ironline Manufacturing',
] as const;

/** Weighted so the W-11 segments each have rows: mostly delivered/in-progress, a few planned,
 * assigned and cancelled. */
const TRIP_STATUS_CYCLE: TripStatus[] = [
  'IN_PROGRESS', 'DELIVERED', 'DELIVERED', 'PLANNED', 'ASSIGNED',
  'IN_PROGRESS', 'DELIVERED', 'CANCELLED', 'PLANNED', 'DELIVERED',
];

const GENERATED_TRIP_COUNT = 110;
/** Matches the fleet sizes generated in `vehiclesDriversGaps.ts` (115 drivers, 120 units). */
const FLEET_DRIVERS = 115;
const FLEET_VEHICLES = 120;

const isoAt = (dayOffset: number, hour: number, minute: number): string => {
  const base = Date.UTC(2026, 8, 1, 0, 0, 0); // 2026-09-01, the window the literal rows sit in
  return new Date(base + dayOffset * 86_400_000 + hour * 3_600_000 + minute * 60_000).toISOString();
};

function generatedTrip(i: number): TripRow {
  const id = `trp_${1100 + i}`;
  const status = TRIP_STATUS_CYCLE[i % TRIP_STATUS_CYCLE.length]!;
  const planned = status === 'PLANNED';
  const day = i % 24;
  const startHour = 4 + (i % 9);
  const transitHours = 6 + (i % 7);
  const origin = LANE_CITIES[i % LANE_CITIES.length]!;
  const destination = LANE_CITIES[(i * 7 + 5) % LANE_CITIES.length]!;
  const plannedStartAt = isoAt(day, startHour, (i % 4) * 15);
  const etaAt = isoAt(day, startHour + transitHours, (i % 4) * 15);
  const started = status !== 'PLANNED' && status !== 'CANCELLED';
  const completed = status === 'DELIVERED';
  const late = i % 7 === 3;
  const stops: TripStopRow[] = [
    {
      id: `stp_${id}_1`,
      tripId: id,
      sequence: 1,
      type: 'PICKUP',
      name: origin,
      address: `${SHIPPERS[i % SHIPPERS.length]!} · Dock ${1 + (i % 12)}`,
      latitude: null,
      longitude: null,
      scheduledAt: plannedStartAt,
      arrivedAt: started ? plannedStartAt : null,
      // One trip in eleven is still sitting on the shipper's dock → "Loading" display status.
      departedAt: started && i % 11 !== 6 ? isoAt(day, startHour, (i % 4) * 15 + 18) : null,
      status: started ? (i % 11 !== 6 ? 'COMPLETED' : 'ARRIVED') : 'PENDING',
      note: null,
    },
    {
      id: `stp_${id}_2`,
      tripId: id,
      sequence: 2,
      type: 'DELIVERY',
      name: destination,
      address: `${SHIPPERS[(i * 3) % SHIPPERS.length]!} DC`,
      latitude: null,
      longitude: null,
      scheduledAt: etaAt,
      arrivedAt: completed ? etaAt : null,
      departedAt: completed ? isoAt(day, startHour + transitHours, (i % 4) * 15 + 25) : null,
      status: completed ? 'COMPLETED' : status === 'CANCELLED' ? 'SKIPPED' : 'PENDING',
      note: null,
    },
  ];
  return {
    id,
    number: `TR-${4900 + i}`,
    // Planned loads are not dispatched yet — the W-11 "unassigned" reality, and a null the join
    // has to survive.
    driverId: planned ? null : `drv_${1 + (i % FLEET_DRIVERS)}`,
    vehicleId: planned ? null : `veh_${1 + ((i * 3) % FLEET_VEHICLES)}`,
    trailerId: null,
    status,
    shippingDocument: i % 5 === 2 ? null : `BOL #${4900 + i}-${String.fromCharCode(65 + (i % 6))}`,
    commodity: COMMODITIES[i % COMMODITIES.length]!,
    weightLbs: 12_000 + ((i * 1_370) % 32_000),
    pieces: i % 3 === 0 ? 12 + (i % 40) : null,
    plannedStartAt,
    plannedEndAt: etaAt,
    startedAt: started ? plannedStartAt : null,
    completedAt: completed ? isoAt(day, startHour + transitHours, (i % 4) * 15 + 25) : null,
    etaAt: status === 'CANCELLED' ? null : etaAt,
    onTime: started ? !late : null,
    notes: status === 'CANCELLED' ? 'Cancelled by shipper' : null,
    createdById: 'usr_1',
    createdAt: isoAt(day - 1, 10, 0),
    stops,
  };
}

const TRIPS_ALL: TripRow[] = [
  ...TRIPS,
  ...Array.from({ length: GENERATED_TRIP_COUNT }, (_, i) => generatedTrip(i)),
];

const UNASSIGNED_LOADS: TripRow[] = [
  {
    id: 'trp_2001',
    number: 'LD-9912',
    driverId: null,
    vehicleId: null,
    trailerId: null,
    status: 'PLANNED',
    shippingDocument: null,
    commodity: null,
    weightLbs: 21300,
    pieces: null,
    plannedStartAt: '2026-09-11T06:00:00.000Z',
    plannedEndAt: null,
    startedAt: null,
    completedAt: null,
    etaAt: null,
    onTime: null,
    notes: null,
    createdById: 'usr_1',
    createdAt: '2026-09-10T10:00:00.000Z',
    // ⛔ GAP B-36 — `unassignedLoads()` in the repository does not `include: { stops: true }`;
    // the real endpoint answers with no stops at all. Left empty here to match the live shape.
    stops: [],
  },
];

const CONVERSATIONS: ConversationRow[] = [
  {
    id: 'cnv_1',
    type: 'DIRECT',
    title: null,
    lastMessageAt: '2026-09-12T15:39:00.000Z',
    createdById: 'usr_1',
    createdAt: '2026-09-10T09:00:00.000Z',
    participants: [
      { id: 'cp_1', conversationId: 'cnv_1', userId: 'usr_1', driverId: null, lastReadAt: '2026-09-12T15:00:00.000Z', mutedUntil: null },
      { id: 'cp_2', conversationId: 'cnv_1', userId: null, driverId: 'drv_1', lastReadAt: null, mutedUntil: null },
    ],
  },
  {
    id: 'cnv_2',
    type: 'DIRECT',
    title: null,
    lastMessageAt: '2026-09-12T14:20:00.000Z',
    createdById: 'usr_1',
    createdAt: '2026-09-09T09:00:00.000Z',
    participants: [
      { id: 'cp_3', conversationId: 'cnv_2', userId: 'usr_1', driverId: null, lastReadAt: '2026-09-12T14:25:00.000Z', mutedUntil: null },
      { id: 'cp_4', conversationId: 'cnv_2', userId: null, driverId: 'drv_2', lastReadAt: null, mutedUntil: null },
    ],
  },
];

const MESSAGES: Record<string, MessageRow[]> = {
  cnv_1: [
    {
      id: 'msg_1',
      conversationId: 'cnv_1',
      senderUserId: 'usr_1',
      senderDriverId: null,
      body: 'How is the load looking?',
      attachmentId: null,
      clientId: null,
      sentAt: '2026-09-12T15:00:00.000Z',
      deliveredAt: '2026-09-12T15:00:05.000Z',
      readAt: '2026-09-12T15:01:00.000Z',
    },
    {
      id: 'msg_2',
      conversationId: 'cnv_1',
      senderUserId: null,
      senderDriverId: 'drv_1',
      body: 'On schedule.',
      attachmentId: null,
      clientId: null,
      sentAt: '2026-09-12T15:39:00.000Z',
      deliveredAt: null,
      readAt: null,
    },
  ],
  cnv_2: [
    {
      id: 'msg_3',
      conversationId: 'cnv_2',
      senderUserId: null,
      senderDriverId: 'drv_2',
      body: 'Confirmed.',
      attachmentId: null,
      clientId: null,
      sentAt: '2026-09-12T14:20:00.000Z',
      deliveredAt: null,
      readAt: null,
    },
  ],
};

export const tripsMessagingGapHandlers = [
  http.get(url(endpoints.trips.list), ({ request }) => ok(serverPage(TRIPS_ALL, request, ['number', 'shippingDocument']))),
  http.get(url(endpoints.trips.unassignedLoads), () => ok({ items: UNASSIGNED_LOADS })),
  http.post(url(endpoints.trips.create), () =>
    ok({ ...TRIPS[0], id: 'trp_new', number: 'TR-4834' }, 201),
  ),
  http.post(url(endpoints.trips.assign(':id')), () => ok({ id: 'trp_2001', status: 'ASSIGNED', driverId: 'drv_1' })),
  http.post(url(endpoints.trips.autoAssign), () => ok({ assigned: [{ tripId: 'trp_2001', driverId: 'drv_3' }], skipped: 0 })),

  http.get(url(endpoints.conversations.list), () => ok({ items: CONVERSATIONS })),
  http.get(url(endpoints.conversations.messages(':id')), ({ params }) => {
    const id = params.id as string;
    const items = MESSAGES[id] ?? [];
    return ok({ items, page: 1, limit: 100, total: items.length, totalPages: 1 });
  }),
  http.post(url(endpoints.conversations.sendMessage(':id')), async ({ request, params }) => {
    const body = (await request.json()) as { body: string; clientId?: string };
    return ok(
      {
        id: `msg_${Date.now()}`,
        conversationId: params.id as string,
        senderUserId: 'usr_1',
        senderDriverId: null,
        body: body.body,
        attachmentId: null,
        clientId: body.clientId ?? null,
        sentAt: new Date().toISOString(),
        deliveredAt: null,
        readAt: null,
      },
      201,
    );
  }),
  http.post(url(endpoints.conversations.create), () =>
    ok({ id: 'cnv_new', type: 'DIRECT', title: null, lastMessageAt: null, createdById: 'usr_1', createdAt: new Date().toISOString(), participants: [] }, 201),
  ),
  http.post(url(endpoints.conversations.broadcast), () =>
    ok({ sent: 2, deliveries: [{ conversationId: 'cnv_3', messageId: 'msg_9', driverId: 'drv_1' }] }),
  ),
];
