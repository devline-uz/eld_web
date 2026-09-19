// Phase 1–2 — the lists the Dashboard, Live Fleet and the shell need.
import { http } from 'msw';
import { endpoints } from '@/shared/api/endpoints';
import { fixture } from '../fixtures.generated';
import { ok, url, serverPage } from '../envelope';
import type { GeofenceRow } from '@/shared/api/geofences';

/**
 * B-3 `GET /live/fleet` (shipped 2026-09-14) — same 17 fields + `generatedAt` as backend
 * `live-fleet.mapper.ts`; validated against openapi.json by the contract suite.
 */
export const LIVE_FLEET = {
  items: [
    {
      vehicleId: 'veh_1',
      unitNumber: '#101',
      driverId: 'drv_1',
      driverName: 'John Smith',
      driverPhone: '+1 334 765 4888',
      dutyStatus: 'ON_DUTY',
      speedMph: 0,
      headingDeg: 274,
      odometerMi: 993589,
      // I-80 westbound, fuelling at the Iowa 80 Truckstop — between trp_1001's Chicago pickup and its Colfax fuel stop.
      lat: 41.5911,
      lon: -90.7852,
      locationLabel: 'Iowa 80 Truckstop, Walcott, IA',
      lastSeenAt: '2026-09-12T15:39:00.000Z',
      driveRemainingSec: 0,
      shiftEndsAt: '2026-09-12T15:59:34.000Z',
      eldSerial: 'PT30_A86E',
      bleState: 'CONNECTED',
    },
    {
      vehicleId: 'veh_2',
      unitNumber: '#102',
      driverId: 'drv_2',
      driverName: 'Marcus Webb',
      driverPhone: '+1 614 555 0142',
      dutyStatus: 'DRIVING',
      speedMph: 61,
      headingDeg: 88,
      odometerMi: 741220,
      // I-40 eastbound — between trp_1002's Oklahoma City pickup and its Russellville fuel stop.
      lat: 35.4815,
      lon: -94.0290,
      locationLabel: '9 mi E of Alma, AR',
      lastSeenAt: '2026-09-12T15:39:10.000Z',
      driveRemainingSec: 16200,
      shiftEndsAt: '2026-09-12T21:10:00.000Z',
      eldSerial: 'PT30_11B2',
      bleState: 'CONNECTED',
    },
    {
      vehicleId: 'veh_3',
      unitNumber: '#103',
      driverId: 'drv_3',
      driverName: 'Alicia Grant',
      driverPhone: '+1 216 555 0198',
      dutyStatus: 'SLEEPER',
      speedMph: 0,
      headingDeg: 0,
      odometerMi: 512004,
      // I-10 — sleeping at the Ontario yard before trp_1006 (ASSIGNED) picks up there.
      lat: 34.0606,
      lon: -117.5637,
      locationLabel: 'Ontario terminal, CA',
      lastSeenAt: '2026-09-12T15:20:00.000Z',
      driveRemainingSec: 39600,
      shiftEndsAt: '2026-09-13T05:20:00.000Z',
      eldSerial: 'PT30_7C10',
      bleState: 'CONNECTED',
    },
    {
      vehicleId: 'veh_4',
      unitNumber: '#104',
      driverId: null,
      driverName: null,
      driverPhone: null,
      dutyStatus: 'ELD_OFFLINE',
      speedMph: null,
      headingDeg: null,
      odometerMi: 302118,
      // Last fix before the ELD dropped — at the Houston yard, trp_1007's (ASSIGNED) pickup on I-10.
      lat: 29.7755,
      lon: -95.2795,
      locationLabel: '2.1 mi E of Houston, TX',
      lastSeenAt: '2026-09-12T14:02:00.000Z',
      driveRemainingSec: null,
      shiftEndsAt: null,
      eldSerial: 'PT30_9931',
      bleState: 'DISCONNECTED',
    },
    {
      // drv_6 / veh_6 match the generated roster row in vehiclesDriversGaps.ts (James Johnson · #106).
      vehicleId: 'veh_6',
      unitNumber: '#106',
      driverId: 'drv_6',
      driverName: 'James Johnson',
      driverPhone: '+1 804 555 0176',
      dutyStatus: 'DRIVING',
      speedMph: 64,
      headingDeg: 28,
      odometerMi: 418733,
      // I-95 northbound — between trp_1005's Richmond pickup and its Jessup fuel stop.
      lat: 38.3627,
      lon: -77.4981,
      locationLabel: '4 mi N of Fredericksburg, VA',
      lastSeenAt: '2026-09-12T15:39:05.000Z',
      driveRemainingSec: 21600,
      shiftEndsAt: '2026-09-12T23:30:00.000Z',
      eldSerial: 'PT30_4C27',
      bleState: 'CONNECTED',
    },
  ],
  generatedAt: '2026-09-12T15:39:10.000Z',
};

/**
 * `GET /geofences` for the W-02 `Geofences` layer. The backend's list row (`GeofencesListResponse`)
 * carries no coordinates yet, so every row here is `GeofenceRow` — the documented fields plus the
 * optional `GeofenceGeometrySource` geometry `shared/map/overlays.ts` parses. Two geometry forms
 * only: a CIRCLE is `centerLat` + `centerLng` + `radiusMeters` (`radiusMi` mirrors it for the
 * documented field); a POLYGON is a GeoJSON `geometry` (`radiusMi: 0`, unused). Each sits on a
 * LIVE_FLEET unit or a trip stop in tripsMessagingGaps.ts so the layers overlap on the map.
 */
export const GEOFENCES: { items: GeofenceRow[] } = {
  items: [
    {
      // trp_1001 pickup.
      id: 'gf_1',
      name: 'Chicago terminal, Bedford Park',
      type: 'CIRCLE',
      colour: 'BLUE',
      centerLat: 41.7684,
      centerLng: -87.8134,
      radiusMeters: 4000,
      radiusMi: 2.49,
      alertOnEnter: true,
    },
    {
      // Unit #101 is fuelling inside it.
      id: 'gf_2',
      name: 'Iowa 80 Truckstop, Walcott',
      type: 'POLYGON',
      colour: 'GREEN',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-90.7925, 41.5868],
            [-90.778, 41.5868],
            [-90.778, 41.596],
            [-90.7925, 41.596],
            [-90.7925, 41.5868],
          ],
        ],
      },
      radiusMi: 0,
      alertOnEnter: false,
    },
    {
      // trp_1002 delivery.
      id: 'gf_3',
      name: 'Memphis delivery zone',
      type: 'CIRCLE',
      colour: 'AMBER',
      centerLat: 35.11,
      centerLng: -89.97,
      radiusMeters: 16000,
      radiusMi: 9.94,
      alertOnEnter: true,
    },
    {
      // trp_1005 delivery.
      id: 'gf_4',
      name: 'Port Newark / Elizabeth terminals',
      type: 'POLYGON',
      colour: 'RED',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-74.176, 40.698],
            [-74.125, 40.696],
            [-74.118, 40.662],
            [-74.145, 40.64],
            [-74.18, 40.655],
            [-74.176, 40.698],
          ],
        ],
      },
      radiusMi: 0,
      alertOnEnter: true,
    },
    {
      // Unit #103's yard and trp_1006 pickup.
      id: 'gf_5',
      name: 'Ontario yard (I-10)',
      type: 'CIRCLE',
      colour: 'VIOLET',
      centerLat: 34.055,
      centerLng: -117.56,
      radiusMeters: 3000,
      radiusMi: 1.86,
      alertOnEnter: false,
    },
  ],
};

export const fleetHandlers = [
  http.get(url(endpoints.vehicles.list), ({ request }) => ok(serverPage(fixture('GET /api/vehicles'), request, ['unitNumber', 'vin', 'make', 'model', 'licensePlate']))),
  http.get(url(endpoints.vehicles.detail(':id')), () => ok(fixture('GET /api/vehicles/{id}'))),
  http.get(url(endpoints.vehicles.dtc(':id')), () => ok(fixture('GET /api/vehicles/{id}/dtc'))),
  http.get(url(endpoints.drivers.list), ({ request }) => ok(serverPage(fixture('GET /api/drivers'), request, ['firstName', 'lastName', 'username', 'cdlNumber']))),
  http.get(url(endpoints.drivers.detail(':id')), () => ok(fixture('GET /api/drivers/{id}'))),
  http.get(url(endpoints.trailers.list), () => ok(fixture('GET /api/trailers'))),
  http.get(url(endpoints.devices.list), ({ request }) => ok(serverPage(fixture('GET /api/devices'), request, ['serial', 'model']))),
  http.get(url(endpoints.geofences.list), () => ok(GEOFENCES)),
  http.get(url(endpoints.trips.list), ({ request }) => ok(serverPage(fixture('GET /api/trips'), request, ['number', 'shippingDocument']))),
  http.get(url(endpoints.safety.events), () => ok(fixture('GET /api/safety/events'))),
  http.get(url(endpoints.safety.scorecard), () => ok(fixture('GET /api/safety/scorecard'))),
  http.get(url(endpoints.notifications.list), () => ok(fixture('GET /api/notifications'))),
  http.get(url(endpoints.users.list), () => ok(fixture('GET /api/users'))),
  http.get(url(endpoints.logs.day(':driverId')), () => ok(fixture('GET /api/logs/{driverId}'))),
  http.get(url(endpoints.logs.events(':driverId')), () =>
    ok(fixture('GET /api/logs/{driverId}/events')),
  ),
  http.get(url(endpoints.unidentified.list), () => ok(fixture('GET /api/unidentified'))),
  http.get(url(endpoints.dvir.list), ({ request }) => ok(serverPage(fixture('GET /api/dvir'), request))),

  // Gap stubs — served against the shape recorded in web/backend-gaps.md.
  http.get(url(endpoints.live.fleet), () => ok(LIVE_FLEET)),
];
