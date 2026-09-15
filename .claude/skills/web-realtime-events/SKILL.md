---
name: web-realtime-events
description: Socket.IO contract for the OneBook ELD web panel — namespace, handshake auth, rooms, events that exist and that do not, polling fallback, offline. Use when wiring live updates, the offline banner, or reconnect behaviour.
---

# Real-time (tz.md §7, §13.4)

**Code first:** `src/shared/realtime/` — `RealtimeProvider.tsx`, `useRoom.ts`, `useRealtimeEvent.ts`,
`events.ts` (names + payload types), `polling.ts` (named fallback intervals), `throttle.ts`,
`useThrottledPatch.ts`. Verify a room/event against the gateway source
`../backend/src/modules/realtime/realtime.gateway.ts` (grep, don't read whole) — never against `../backend/tz.md`.

## Backend reality
Namespace `/realtime`. Token in the **handshake** `auth` (never query string); bad token → `disconnect(true)` → treat as sign-out, not retry. Auto-joins `user:{id}`. `socket.emit('subscribe', room, cb)` → `{ ok }`; `unsubscribe` likewise. Rooms: `fleet`, `violations`, `vehicle:{id}`, `driver:{id}`, `user:{id}`, `conversation:{id}`. **No `resume`/`seq`, no token renewal.** Web origin must be in backend `CORS_ORIGINS` — check before reporting a connection bug.

## Client rules
1. Connect once after auth, under `AuthProvider`. 2. On token refresh: `socket.auth = { token }`, then `disconnect().connect()`. 3. No resume ⇒ on `reconnect` invalidate every query of the current screen. 4. `useRoom()` subscribes on mount / unsubscribes on unmount; never global. 5. Throttle `telemetry.point` (and future `fleet.position`) to 200 ms; patch with `setQueryData`, don't invalidate whole lists. 6. Disconnected → `<OfflineBanner>`; recovery → green `Reconnected` toast, 3 s.

## Events that exist
`notification.new` (`user:{id}`: bell dot, panel cache, toast if CRITICAL) · `message.new` (`conversation:{id}`: append, reorder, unread) · `trip.status_changed` (`fleet`: patch row, invalidate KPIs) · `safety.event_created` (`fleet`: invalidate list, Safety badge +1) · `geofence.transition` (`fleet`: flash unit) · `report.ready` (`user:{id}`: toast with Download, invalidate reports) · `eld.events_ingested` (`vehicle:{id}`: invalidate `logDay`/`logEvents`) · `telemetry.point` (`vehicle:{id}`: Live status card, throttled) · `device.ble_state` (`vehicle:{id}`: BLE chip, Devices table).

## Events that do NOT exist (§7.4) — never write handlers for them
`fleet.position driver.status_changed hos.updated violation.created unidentified.created dvir.submitted defect.created edit_request.created edit_request.resolved device.backlog sync.required`.
Fallback: Dashboard/Live Fleet poll 30 s, HOS Logs 60 s, only while visible, one named constant per screen in `polling.ts`.

## Rooms per screen (§7.5)
Dashboard `fleet`+`violations` · Live Fleet `fleet` (+`vehicle:{id}` selected) · Vehicles `fleet` · Unit detail/Histories `vehicle:{id}` · Drivers `fleet`+`violations` · Driver detail `driver:{id}` · HOS Logs `driver:{id}`+`violations` · DVIR `fleet`+`violations` · Safety `fleet` · Trips `fleet` · Messages `conversation:{id}` · Reports `user:{id}` (auto) · Settings › Devices `fleet`.

## Offline
`navigator.onLine === false` or WS down + two failed requests → banner. `GET` from cache ignoring `staleTime`; every write button disabled with tooltip `You are offline`. **No offline queue** on web.
