// owner: web-dvir-safety — the endpoints W-09/W-10 need beyond the phase 1–2 base set
// (`GET /dvir` and `GET /safety/events`/`scorecard` already live in `fleetHandlers`). Every
// handler answers the shape recorded in `backend/docs/openapi.json` (see fixtures.generated.ts).
import { http } from 'msw';
import { endpoints } from '@/shared/api/endpoints';
import { fixture } from '../fixtures.generated';
import { ok, url } from '../envelope';

export const dvirSafetyGapHandlers = [
  http.get(url(endpoints.dvir.detail(':id')), () => ok(fixture('GET /api/dvir/{id}'))),
  http.post(url(endpoints.dvir.mechanicSignoff(':id')), () => ok(fixture('POST /api/dvir/{id}/mechanic-signoff'))),
  http.patch(url(endpoints.dvir.nextDriverReview(':id')), () => ok(fixture('PATCH /api/dvir/{id}/next-driver-review'))),

  http.get(url(endpoints.defects.list), () => ok(fixture('GET /api/defects'))),
  http.get(url(endpoints.defects.detail(':id')), () => ok(fixture('GET /api/defects/{id}'))),
  http.patch(url(endpoints.defects.resolve(':id')), () => ok(fixture('PATCH /api/defects/{id}/resolve'))),
  http.patch(url(endpoints.defects.workOrder(':id')), () => ok(fixture('PATCH /api/defects/{id}/work-order'))),

  http.get(url(endpoints.workOrders.list), () => ok(fixture('GET /api/work-orders'))),
  http.post(url(endpoints.workOrders.create), () => ok(fixture('POST /api/work-orders'), 201)),
  http.get(url(endpoints.workOrders.detail(':id')), () => ok(fixture('GET /api/work-orders/{id}'))),
  http.patch(url(endpoints.workOrders.update(':id')), () => ok(fixture('PATCH /api/work-orders/{id}'))),
  http.post(url(endpoints.workOrders.close(':id')), () => ok(fixture('POST /api/work-orders/{id}/close'), 201)),
  http.post(url(endpoints.workOrders.cancel(':id')), () => ok(fixture('POST /api/work-orders/{id}/cancel'), 201)),
  http.post(url(endpoints.workOrders.attachDefect(':id', ':defectId')), () => ok(fixture('POST /api/work-orders/{id}/defects/{defectId}'), 201)),

  http.get(url(endpoints.maintenanceSchedules.list), () => ok(fixture('GET /api/maintenance-schedules'))),
  http.post(url(endpoints.maintenanceSchedules.create), () => ok(fixture('POST /api/maintenance-schedules'), 201)),
  http.get(url(endpoints.maintenanceSchedules.detail(':id')), () => ok(fixture('GET /api/maintenance-schedules/{id}'))),
  http.patch(url(endpoints.maintenanceSchedules.update(':id')), () => ok(fixture('PATCH /api/maintenance-schedules/{id}'))),
  http.delete(url(endpoints.maintenanceSchedules.remove(':id')), () => ok(fixture('DELETE /api/maintenance-schedules/{id}'))),
  http.post(url(endpoints.maintenanceSchedules.complete(':id')), () => ok(fixture('POST /api/maintenance-schedules/{id}/complete'), 201)),

  http.patch(url(endpoints.safety.event(':id')), () => ok(fixture('PATCH /api/safety/events/{id}'))),
  http.post(url(endpoints.safety.coaching), () => ok(fixture('POST /api/safety/coaching'), 201)),
];
