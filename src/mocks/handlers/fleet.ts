// Phase 1–2 — the lists the Dashboard, Live Fleet and the shell need.
import { http } from 'msw';
import { endpoints } from '@/shared/api/endpoints';
import { fixture } from '../fixtures.generated';
import { ok, url, serverPage } from '../envelope';

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
      lat: 39.9612,
      lon: -82.9988,
      locationLabel: '0.64 mi N of Florence, KY',
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
      lat: 39.98,
      lon: -83.02,
      locationLabel: '6 mi NE of Columbus, OH',
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
      lat: 40.02,
      lon: -82.9,
      locationLabel: 'Columbus terminal, OH',
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
      lat: 39.9,
      lon: -83.1,
      locationLabel: '2.1 mi W of Dublin, OH',
      lastSeenAt: '2026-09-12T14:02:00.000Z',
      driveRemainingSec: null,
      shiftEndsAt: null,
      eldSerial: 'PT30_9931',
      bleState: 'DISCONNECTED',
    },
  ],
  generatedAt: '2026-09-12T15:39:10.000Z',
};

export const fleetHandlers = [
  http.get(url(endpoints.vehicles.list), ({ request }) => ok(serverPage(fixture('GET /api/vehicles'), request, ['unitNumber', 'vin', 'make', 'model', 'licensePlate']))),
  http.get(url(endpoints.vehicles.detail(':id')), () => ok(fixture('GET /api/vehicles/{id}'))),
  http.get(url(endpoints.vehicles.dtc(':id')), () => ok(fixture('GET /api/vehicles/{id}/dtc'))),
  http.get(url(endpoints.drivers.list), ({ request }) => ok(serverPage(fixture('GET /api/drivers'), request, ['firstName', 'lastName', 'username', 'cdlNumber']))),
  http.get(url(endpoints.drivers.detail(':id')), () => ok(fixture('GET /api/drivers/{id}'))),
  http.get(url(endpoints.trailers.list), () => ok(fixture('GET /api/trailers'))),
  http.get(url(endpoints.devices.list), ({ request }) => ok(serverPage(fixture('GET /api/devices'), request, ['serial', 'model']))),
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
