// owner: web-realtime — socket event names and payload types (web/tz.md §7.3–§7.4).
//
// Verified against backend/src/modules/realtime/realtime.gateway.ts and every
// `EventBusService.publish('realtime.push', { room, event, payload })` call site
// (trips.service.ts, messaging.service.ts, ingest.service.ts, safety-detect.processor.ts,
// alert.processor.ts, report.processor.ts) — not against backend/tz.md.

/** Rooms the gateway's `ALLOWED_ROOM_PATTERN` accepts. `user:{id}` / `driver:{id}` are joined
 * automatically on connect; everything else needs an explicit `subscribe`. */
export type RoomName =
  | 'fleet'
  | 'violations'
  | `vehicle:${string}`
  | `driver:${string}`
  | `user:${string}`
  | `conversation:${string}`;

/** §7.3 — the nine events the backend actually emits today. */
export interface RealtimeEventPayloads {
  /** room: `user:{id}` (or `driver:{id}`) */
  'notification.new': {
    notification: {
      id: string;
      type: string;
      title: string;
      body?: string;
      severity?: 'INFO' | 'WARNING' | 'CRITICAL';
      createdAt?: string;
      [key: string]: unknown;
    };
  };
  /** room: `conversation:{id}` */
  'message.new': {
    message: {
      id: string;
      conversationId: string;
      body: string;
      senderUserId?: string | null;
      senderDriverId?: string | null;
      createdAt?: string;
      [key: string]: unknown;
    };
  };
  /** room: `fleet` */
  'trip.status_changed': {
    tripId: string;
    status: string;
    eta: string | null;
  };
  /** room: `fleet` */
  'safety.event_created': {
    vehicleId: string;
    driverId: string | null;
    type: string;
    severity: string;
  };
  /** room: `fleet` */
  'geofence.transition': {
    vehicleId: string;
    geofenceId: string;
    kind: string;
  };
  /** room: `user:{id}` */
  'report.ready': {
    reportId: string;
    type: string;
    status: string;
  };
  /** room: `vehicle:{id}` */
  'eld.events_ingested': {
    vehicleId: string;
    count: number;
  };
  /** room: `vehicle:{id}` — high-frequency, throttle before touching state (§7.2). */
  'telemetry.point': {
    vehicleId: string;
    count: number;
  };
  /** room: `vehicle:{id}` (falls back to `vehicle:unassigned`) */
  'device.ble_state': {
    deviceSerial: string;
    state: string;
  };
}

export type RealtimeEventName = keyof RealtimeEventPayloads;

export const REALTIME_EVENTS = [
  'notification.new',
  'message.new',
  'trip.status_changed',
  'safety.event_created',
  'geofence.transition',
  'report.ready',
  'eld.events_ingested',
  'telemetry.point',
  'device.ble_state',
] as const satisfies readonly RealtimeEventName[];

/**
 * §7.4 — events the design describes but the gateway does not emit. Nobody may write a handler
 * for one of these; the named polling constants in `./polling.ts` are the documented substitute
 * until the backend ships them. Keeping the list here (rather than deleting it) is deliberate —
 * it is the single place a screen agent checks before wiring a "new" event.
 */
export const PHANTOM_REALTIME_EVENTS = [
  'fleet.position',
  'driver.status_changed',
  'hos.updated',
  'violation.created',
  'unidentified.created',
  'dvir.submitted',
  'defect.created',
  'edit_request.created',
  'edit_request.resolved',
  'device.backlog',
  'sync.required',
] as const;

export type PhantomRealtimeEvent = (typeof PHANTOM_REALTIME_EVENTS)[number];

/** High-frequency events that must go through the 200 ms throttle (§7.2) before any
 * `setQueryData` patch — currently just `telemetry.point`; `fleet.position` will join this list
 * the day it ships, not before. */
export const THROTTLED_EVENTS = ['telemetry.point'] as const satisfies readonly RealtimeEventName[];
