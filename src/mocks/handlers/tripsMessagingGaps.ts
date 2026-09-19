// owner: web-dispatch-messaging — richer W-11/W-16 fixtures than the generated OpenAPI examples
// (`fixtures.generated.ts` only has one bare trip/conversation). Every shape here matches a real,
// existing endpoint (`GET /trips`, `GET /trips/unassigned-loads`, `GET /conversations`, …) — none
// of this is a backend-gap stub; it just gives the design's populated states something to render
// against in dev/tests. Registered ahead of `fleetHandlers`' bare `GET /api/trips` (same
// first-match-wins rule as `vehiclesDriversGaps.ts`, web/bugs.md WB-018).
import { http } from 'msw';
import { endpoints } from '@/shared/api/endpoints';
import { ok, url, serverPage } from '../envelope';
import type { StopStatus, StopType, TripRow, TripStopRow } from '@/shared/api/trips';
import type { ConversationRow, MessageRow } from '@/shared/api/messaging';

/** One trip stop. Coordinates are real places on the unit's corridor so the W-02 `Trips` layer
 * draws them; the `[lat, lon]` pair lands in `latitude`/`longitude` exactly as the DTO carries them. */
function stop(
  tripId: string,
  sequence: number,
  type: StopType,
  name: string,
  address: string | null,
  [latitude, longitude]: readonly [number, number],
  status: StopStatus,
  times: { scheduledAt?: string; arrivedAt?: string; departedAt?: string } = {},
): TripStopRow {
  return {
    id: `stp_${tripId.slice(4)}_${sequence}`,
    tripId,
    sequence,
    type,
    name,
    address,
    latitude,
    longitude,
    scheduledAt: times.scheduledAt ?? null,
    arrivedAt: times.arrivedAt ?? null,
    departedAt: times.departedAt ?? null,
    status,
    note: null,
  };
}

// Active trips (ASSIGNED ∪ IN_PROGRESS) — the W-02 `Trips` layer's data. Each IN_PROGRESS trip's
// unit in `fleet.ts` LIVE_FLEET is reporting from a point between its last completed stop and its
// next PENDING one, so the map draws the live-position → next-stop line too.
const TRIPS: TripRow[] = [
  {
    // I-80 westbound · unit #101 at the Iowa 80 Truckstop.
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
    plannedStartAt: '2026-09-12T08:45:00.000Z',
    plannedEndAt: null,
    startedAt: '2026-09-12T08:40:00.000Z',
    completedAt: null,
    etaAt: '2026-09-12T22:45:00.000Z',
    onTime: true,
    notes: null,
    createdById: 'usr_1',
    createdAt: '2026-09-11T18:09:14.598Z',
    stops: [
      stop('trp_1001', 1, 'PICKUP', 'Bedford Park, IL', 'Shipper #4821, Bedford Park, IL 60638', [41.7684, -87.8134], 'COMPLETED', {
        scheduledAt: '2026-09-12T08:45:00.000Z',
        arrivedAt: '2026-09-12T08:40:00.000Z',
        departedAt: '2026-09-12T09:05:00.000Z',
      }),
      stop('trp_1001', 2, 'FUEL', "Love's Travel Stop, Colfax, IA", 'I-80 exit 164, Colfax, IA', [41.6608, -93.2255], 'PENDING', {
        scheduledAt: '2026-09-12T18:30:00.000Z',
      }),
      stop('trp_1001', 3, 'DELIVERY', 'Omaha, NE', 'Major Retail Co. DC, Omaha, NE 68137', [41.2067, -96.108], 'PENDING', {
        scheduledAt: '2026-09-12T22:45:00.000Z',
      }),
    ],
  },
  {
    // I-40 eastbound · unit #102 driving past Alma, AR — running late.
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
    plannedStartAt: '2026-09-12T08:00:00.000Z',
    plannedEndAt: null,
    startedAt: '2026-09-12T10:00:00.000Z',
    completedAt: null,
    etaAt: '2026-09-13T01:30:00.000Z',
    onTime: false,
    notes: null,
    createdById: 'usr_1',
    createdAt: '2026-09-11T12:00:00.000Z',
    stops: [
      stop('trp_1002', 1, 'PICKUP', 'Oklahoma City, OK', 'Shipper Co., Oklahoma City, OK 73129', [35.4676, -97.5164], 'COMPLETED', {
        scheduledAt: '2026-09-12T08:00:00.000Z',
        arrivedAt: '2026-09-12T10:00:00.000Z',
        departedAt: '2026-09-12T10:40:00.000Z',
      }),
      stop('trp_1002', 2, 'FUEL', 'Pilot Travel Center, Russellville, AR', 'I-40 exit 84, Russellville, AR', [35.279, -93.135], 'PENDING', {
        scheduledAt: '2026-09-12T16:30:00.000Z',
      }),
      stop('trp_1002', 3, 'DELIVERY', 'Memphis, TN', 'Memphis, TN 38118', [35.052, -89.942], 'PENDING', {
        scheduledAt: '2026-09-13T00:00:00.000Z',
      }),
    ],
  },
  {
    // I-95 northbound · unit #106 driving past Fredericksburg, VA.
    id: 'trp_1005',
    number: 'TR-4825',
    driverId: 'drv_6',
    vehicleId: 'veh_6',
    trailerId: null,
    status: 'IN_PROGRESS',
    shippingDocument: 'BOL #4825-C',
    commodity: 'Refrigerated produce',
    weightLbs: 42000,
    pieces: 24,
    plannedStartAt: '2026-09-12T12:30:00.000Z',
    plannedEndAt: null,
    startedAt: '2026-09-12T12:30:00.000Z',
    completedAt: null,
    etaAt: '2026-09-12T20:45:00.000Z',
    onTime: true,
    notes: null,
    createdById: 'usr_1',
    createdAt: '2026-09-11T20:15:00.000Z',
    stops: [
      stop('trp_1005', 1, 'PICKUP', 'Richmond, VA', 'Richmond, VA 23234', [37.47, -77.46], 'COMPLETED', {
        scheduledAt: '2026-09-12T12:30:00.000Z',
        arrivedAt: '2026-09-12T12:25:00.000Z',
        departedAt: '2026-09-12T13:10:00.000Z',
      }),
      stop('trp_1005', 2, 'FUEL', 'TA Travel Center, Jessup, MD', 'I-95 exit 41, Jessup, MD', [39.148, -76.79], 'PENDING', {
        scheduledAt: '2026-09-12T17:30:00.000Z',
      }),
      stop('trp_1005', 3, 'DELIVERY', 'Port Newark, NJ', 'Port Newark, NJ 07114', [40.684, -74.1502], 'PENDING', {
        scheduledAt: '2026-09-12T21:00:00.000Z',
      }),
    ],
  },
  {
    // I-10 eastbound · unit #103 sleeping at the Ontario yard until pickup.
    id: 'trp_1006',
    number: 'TR-4826',
    driverId: 'drv_3',
    vehicleId: 'veh_3',
    trailerId: null,
    status: 'ASSIGNED',
    shippingDocument: null,
    commodity: 'Building materials',
    weightLbs: 36800,
    pieces: null,
    plannedStartAt: '2026-09-13T05:00:00.000Z',
    plannedEndAt: '2026-09-13T12:30:00.000Z',
    startedAt: null,
    completedAt: null,
    etaAt: '2026-09-13T12:30:00.000Z',
    onTime: null,
    notes: null,
    createdById: 'usr_1',
    createdAt: '2026-09-12T09:00:00.000Z',
    stops: [
      stop('trp_1006', 1, 'PICKUP', 'Ontario, CA', 'Ontario, CA 91761', [34.045, -117.555], 'PENDING', {
        scheduledAt: '2026-09-13T05:00:00.000Z',
      }),
      stop('trp_1006', 2, 'FUEL', "Love's Travel Stop, Blythe, CA", 'I-10 exit 240, Blythe, CA', [33.61, -114.596], 'PENDING', {
        scheduledAt: '2026-09-13T08:30:00.000Z',
      }),
      stop('trp_1006', 3, 'DELIVERY', 'Phoenix, AZ', 'Phoenix, AZ 85043', [33.433, -112.17], 'PENDING', {
        scheduledAt: '2026-09-13T12:30:00.000Z',
      }),
    ],
  },
  {
    // I-10 eastbound · unit #104 (ELD offline) parked at the Houston yard.
    id: 'trp_1007',
    number: 'TR-4827',
    driverId: 'drv_5',
    vehicleId: 'veh_4',
    trailerId: null,
    status: 'ASSIGNED',
    shippingDocument: null,
    commodity: 'Chemicals (non-hazmat)',
    weightLbs: 40100,
    pieces: null,
    plannedStartAt: '2026-09-13T13:00:00.000Z',
    plannedEndAt: '2026-09-13T20:00:00.000Z',
    startedAt: null,
    completedAt: null,
    etaAt: '2026-09-13T20:00:00.000Z',
    onTime: null,
    notes: null,
    createdById: 'usr_1',
    createdAt: '2026-09-12T11:30:00.000Z',
    stops: [
      stop('trp_1007', 1, 'PICKUP', 'Houston, TX', 'Houston, TX 77029', [29.765, -95.26], 'PENDING', {
        scheduledAt: '2026-09-13T13:00:00.000Z',
      }),
      stop('trp_1007', 2, 'FUEL', 'Pilot Travel Center, Sulphur, LA', 'I-10 exit 20, Sulphur, LA', [30.235, -93.36], 'PENDING', {
        scheduledAt: '2026-09-13T16:30:00.000Z',
      }),
      stop('trp_1007', 3, 'DELIVERY', 'Baton Rouge, LA', 'Baton Rouge, LA 70805', [30.48, -91.15], 'PENDING', {
        scheduledAt: '2026-09-13T20:00:00.000Z',
      }),
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
  http.get(url(endpoints.trips.list), ({ request }) => ok(serverPage(TRIPS, request, ['number', 'shippingDocument']))),
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
