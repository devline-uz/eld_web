// owner: web-api-client — ⭐ the only query-key factory (web/tz.md §2.2 rule 3, §6.3).
// A hand-written array anywhere else is an ESLint error (`house/no-raw-query-key`).

/** List/query parameter bag — always serialised into the key so filters cache separately. */
export type QueryParams = Record<string, unknown> | undefined;

const p = (params: QueryParams) => params ?? {};

export const qk = {
  // identity and company
  me: ['me'] as const,
  sessions: ['me', 'sessions'] as const,
  /** W-26 — `GET /me/profile` (display fields only; permissions stay on `/auth/me`). */
  profile: ['me', 'profile'] as const,
  carrier: ['carrier'] as const,
  /** Third-party geocoder results (`shared/map/geocode.ts`). */
  places: (query: string) => ['places', query] as const,
  /** W-01 Fleet Dashboard aggregate (`GET /dashboard/summary`, WD-074) — no params, one caller. */
  dashboardSummary: ['dashboard', 'summary'] as const,

  // fleet
  vehicles: (params?: QueryParams) => ['vehicles', p(params)] as const,
  vehicle: (id: string) => ['vehicles', id] as const,
  vehicleTelemetry: (id: string) => ['vehicles', id, 'telemetry'] as const,
  vehicleDtc: (id: string) => ['vehicles', id, 'dtc'] as const,
  vehicleHistories: (id: string, date: string) => ['vehicles', id, 'histories', date] as const,
  vehicleActivities: (id: string, params?: QueryParams) =>
    ['vehicles', id, 'activities', p(params)] as const,
  /** Client-side join against `/drivers`/`/devices` (web/backend-gaps.md B-35). */
  vehicleAssignedDriver: (id: string) => ['vehicles', id, 'assigned-driver'] as const,
  vehicleDevice: (id: string) => ['vehicles', id, 'device'] as const,
  coDriverPairings: (params?: QueryParams) => ['co-driver-pairings', p(params)] as const,
  trailers: (params?: QueryParams) => ['trailers', p(params)] as const,
  trailer: (id: string) => ['trailers', id] as const,

  // drivers
  drivers: (params?: QueryParams) => ['drivers', p(params)] as const,
  driver: (id: string) => ['drivers', id] as const,
  driverRoster: (params?: QueryParams) => ['drivers', 'roster', p(params)] as const,
  driverHos: (id: string) => ['drivers', id, 'hos'] as const,

  // ⭐ HOS — a log key always carries the RODS date in the driver's home terminal zone (§8.3)
  logDay: (driverId: string, date: string) => ['logs', driverId, 'day', date] as const,
  logRange: (driverId: string, from: string, to: string) =>
    ['logs', driverId, 'range', from, to] as const,
  logEvents: (driverId: string, date: string) => ['logs', driverId, 'events', date] as const,
  editRequests: (driverId: string, status?: string) =>
    ['logs', driverId, 'edit-requests', status ?? 'ALL'] as const,
  unidentified: (params?: QueryParams) => ['unidentified', p(params)] as const,
  violations: (params?: QueryParams) => ['violations', p(params)] as const,

  // compliance
  dvirs: (params?: QueryParams) => ['dvir', p(params)] as const,
  dvir: (id: string) => ['dvir', id] as const,
  defects: (params?: QueryParams) => ['defects', p(params)] as const,
  defect: (id: string) => ['defects', id] as const,
  workOrders: (params?: QueryParams) => ['work-orders', p(params)] as const,
  workOrder: (id: string) => ['work-orders', id] as const,
  schedules: (params?: QueryParams) => ['maintenance-schedules', p(params)] as const,

  // operations
  trips: (params?: QueryParams) => ['trips', p(params)] as const,
  trip: (id: string) => ['trips', id] as const,
  unassignedLoads: (params?: QueryParams) => ['trips', 'unassigned-loads', p(params)] as const,
  safetyEvents: (params?: QueryParams) => ['safety', 'events', p(params)] as const,
  scorecard: (params?: QueryParams) => ['safety', 'scorecard', p(params)] as const,
  geofences: (params?: QueryParams) => ['geofences', p(params)] as const,
  liveFleet: (params?: QueryParams) => ['live', 'fleet', p(params)] as const,

  // reports and transfers
  reports: (params?: QueryParams) => ['reports', p(params)] as const,
  report: (id: string) => ['reports', id] as const,
  reportSchedules: (params?: QueryParams) => ['reports', 'schedules', p(params)] as const,
  ifta: (params?: QueryParams) => ['reports', 'ifta', p(params)] as const,
  iftaSummary: (params?: QueryParams) => ['reports', 'ifta', 'summary', p(params)] as const,
  activityReport: (params?: QueryParams) => ['reports', 'activity', p(params)] as const,
  activitySummary: (params?: QueryParams) => ['reports', 'activity', 'summary', p(params)] as const,
  dvirReport: (params?: QueryParams) => ['reports', 'dvir', p(params)] as const,
  fmcsaPack: (params?: QueryParams) => ['reports', 'fmcsa-pack', p(params)] as const,
  transfers: (params?: QueryParams) => ['transfers', p(params)] as const,
  transfer: (id: string) => ['transfers', id] as const,

  // settings and admin
  devices: (params?: QueryParams) => ['devices', p(params)] as const,
  device: (id: string) => ['devices', id] as const,
  users: (params?: QueryParams) => ['users', p(params)] as const,
  user: (id: string) => ['users', id] as const,
  roles: ['roles'] as const,
  role: (id: string) => ['roles', id] as const,
  alertRules: (params?: QueryParams) => ['alert-rules', p(params)] as const,
  alertRule: (id: string) => ['alert-rules', id] as const,
  integrations: ['integrations'] as const,
  integration: (provider: string) => ['integrations', provider] as const,
  apiKeys: ['api-keys'] as const,
  audit: (params?: QueryParams) => ['audit-log', p(params)] as const,

  // support, messaging, notifications
  tickets: (params?: QueryParams) => ['support', 'tickets', p(params)] as const,
  ticket: (id: string) => ['support', 'tickets', id] as const,
  conversations: (params?: QueryParams) => ['conversations', p(params)] as const,
  messages: (id: string, params?: QueryParams) =>
    ['conversations', id, 'messages', p(params)] as const,
  notifications: (params?: QueryParams) => ['notifications', p(params)] as const,
  preferences: ['me', 'preferences'] as const,
  /** `scope` filters drivers/vehicles, so it is part of the key (web/bugs.md WB-090). */
  search: (q: string, scope?: QueryParams) => ['search', q, p(scope)] as const,
} as const;

/** Root of a resource, for `invalidateQueries({ queryKey: qkRoot.vehicles })`. */
export const qkRoot = {
  vehicles: ['vehicles'] as const,
  drivers: ['drivers'] as const,
  logs: ['logs'] as const,
  trips: ['trips'] as const,
  dvir: ['dvir'] as const,
  defects: ['defects'] as const,
  workOrders: ['work-orders'] as const,
  reports: ['reports'] as const,
  transfers: ['transfers'] as const,
  devices: ['devices'] as const,
  users: ['users'] as const,
  conversations: ['conversations'] as const,
  notifications: ['notifications'] as const,
  safety: ['safety'] as const,
  unidentified: ['unidentified'] as const,
  alertRules: ['alert-rules'] as const,
} as const;
