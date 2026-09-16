// owner: web-api-client — ⭐ every API URL in the app lives in this file (web/tz.md §2.2 rule 2).
// Paths are written WITHOUT the `/api` prefix; the prefix is part of VITE_API_BASE_URL.
// The backend is unversioned (`/api/vehicles`, never `/api/v1/vehicles`) — web/tz.md §6.1.
//
// Every path below was checked against backend/docs/openapi.json (131 paths, 174 operations).
// Paths marked `⛔ GAP B-NN` do not exist on the backend yet (web/backend-gaps.md); they are
// served by MSW only and a screen calling one must show the documented fallback.

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3002/api';

export const endpoints = {
  // --- auth (§6.5–6.7) ----------------------------------------------------------------------
  auth: {
    me: '/auth/me',
    refresh: '/auth/refresh',
    signIn: '/auth/login',
    signInDriver: '/auth/login/driver',
    google: '/auth/google',
    signOut: '/auth/logout',
    passwordForgot: '/auth/password/forgot',
    passwordReset: '/auth/password/reset',
  },

  // --- carrier and account (W-17, W-26) ------------------------------------------------------
  carrier: { root: '/carrier' },
  /** Perf plan item 3 — W-01 Fleet Dashboard's single aggregate call (WD-074). */
  dashboard: { summary: '/dashboard/summary' },
  me: {
    profile: '/me/profile',
    sessions: '/me/sessions',
    session: (id: string) => `/me/sessions/${id}`,
    /** ⛔ GAP B-11 — saved views / column choice; localStorage fallback until it lands. */
    preferences: '/me/preferences',
  },

  // --- fleet (W-03…W-05) ---------------------------------------------------------------------
  vehicles: {
    list: '/vehicles',
    create: '/vehicles',
    detail: (id: string) => `/vehicles/${id}`,
    update: (id: string) => `/vehicles/${id}`,
    remove: (id: string) => `/vehicles/${id}`,
    import: '/vehicles/import',
    export: '/vehicles/export',
    assignDriver: (id: string) => `/vehicles/${id}/assign-driver`,
    unassignDriver: (id: string) => `/vehicles/${id}/unassign-driver`,
    calibrateOdometer: (id: string) => `/vehicles/${id}/calibrate-odometer`,
    dtc: (id: string) => `/vehicles/${id}/dtc`,
    /** ⛔ GAP — live status card on W-04; only the write path /ingest/telemetry exists. */
    telemetry: (id: string) => `/vehicles/${id}/telemetry`,
    /** ⛔ GAP B-4 — W-05 route replay. */
    histories: (id: string) => `/vehicles/${id}/histories`,
    /** ⛔ GAP B-5 — W-04 activity tab. */
    activities: (id: string) => `/vehicles/${id}/activities`,
  },
  trailers: {
    list: '/trailers',
    create: '/trailers',
    detail: (id: string) => `/trailers/${id}`,
    update: (id: string) => `/trailers/${id}`,
    remove: (id: string) => `/trailers/${id}`,
    import: '/trailers/import',
    export: '/trailers/export',
  },

  // --- drivers (W-06, W-07) ------------------------------------------------------------------
  drivers: {
    list: '/drivers',
    create: '/drivers',
    detail: (id: string) => `/drivers/${id}`,
    update: (id: string) => `/drivers/${id}`,
    remove: (id: string) => `/drivers/${id}`,
    import: '/drivers/import',
    export: '/drivers/export',
    /** B-1 (shipped 2026-09-14) — W-06 roster (HOS hours, duty status, unit, open violations). */
    roster: '/drivers/roster',
    /** B-2 (shipped 2026-09-14) — W-07 / W-16 / W-08 HOS clocks right now. */
    hos: (id: string) => `/drivers/${id}/hos`,
  },
  /** ⛔ GAP B-7 — W-04 co-driver row. */
  coDriverPairings: { list: '/co-driver-pairings', create: '/co-driver-pairings' },

  // --- ⭐ HOS (W-08) -------------------------------------------------------------------------
  logs: {
    day: (driverId: string) => `/logs/${driverId}`,
    range: (driverId: string) => `/logs/${driverId}/range`,
    events: (driverId: string) => `/logs/${driverId}/events`,
    certify: (driverId: string) => `/logs/${driverId}/certify`,
    editRequests: (driverId: string) => `/logs/${driverId}/edit-requests`,
    createEditRequest: (driverId: string) => `/logs/${driverId}/edit-requests`,
    acceptEditRequest: (id: string) => `/logs/edit-requests/${id}/accept`,
    rejectEditRequest: (id: string) => `/logs/edit-requests/${id}/reject`,
  },
  unidentified: {
    list: '/unidentified',
    detail: (id: string) => `/unidentified/${id}`,
    assign: (id: string) => `/unidentified/${id}/assign`,
    annotate: (id: string) => `/unidentified/${id}/annotate`,
    reject: (id: string) => `/unidentified/${id}/reject`,
    confirm: (id: string) => `/unidentified/${id}/confirm`,
  },
  /** B-6 (shipped 2026-09-14) — W-01 violations panel, W-08 `Resolve`. */
  violations: { list: '/violations', resolve: (id: string) => `/violations/${id}/resolve` },

  // --- compliance (W-09) ---------------------------------------------------------------------
  dvir: {
    list: '/dvir',
    detail: (id: string) => `/dvir/${id}`,
    mechanicSignoff: (id: string) => `/dvir/${id}/mechanic-signoff`,
    nextDriverReview: (id: string) => `/dvir/${id}/next-driver-review`,
  },
  defects: {
    list: '/defects',
    detail: (id: string) => `/defects/${id}`,
    resolve: (id: string) => `/defects/${id}/resolve`,
    workOrder: (id: string) => `/defects/${id}/work-order`,
  },
  workOrders: {
    list: '/work-orders',
    create: '/work-orders',
    detail: (id: string) => `/work-orders/${id}`,
    update: (id: string) => `/work-orders/${id}`,
    close: (id: string) => `/work-orders/${id}/close`,
    cancel: (id: string) => `/work-orders/${id}/cancel`,
    attachDefect: (id: string, defectId: string) => `/work-orders/${id}/defects/${defectId}`,
  },
  maintenanceSchedules: {
    list: '/maintenance-schedules',
    create: '/maintenance-schedules',
    detail: (id: string) => `/maintenance-schedules/${id}`,
    update: (id: string) => `/maintenance-schedules/${id}`,
    remove: (id: string) => `/maintenance-schedules/${id}`,
    complete: (id: string) => `/maintenance-schedules/${id}/complete`,
  },

  // --- operations (W-10, W-11, W-02) ---------------------------------------------------------
  trips: {
    list: '/trips',
    create: '/trips',
    detail: (id: string) => `/trips/${id}`,
    update: (id: string) => `/trips/${id}`,
    assign: (id: string) => `/trips/${id}/assign`,
    autoAssign: '/trips/auto-assign',
    unassignedLoads: '/trips/unassigned-loads',
  },
  safety: {
    events: '/safety/events',
    event: (id: string) => `/safety/events/${id}`,
    scorecard: '/safety/scorecard',
    coaching: '/safety/coaching',
  },
  geofences: {
    list: '/geofences',
    create: '/geofences',
    detail: (id: string) => `/geofences/${id}`,
    update: (id: string) => `/geofences/${id}`,
    remove: (id: string) => `/geofences/${id}`,
  },
  /** B-3 (shipped 2026-09-14) — W-02 Live Fleet and the W-01 map preview. */
  live: { fleet: '/live/fleet' },

  // --- messaging (W-16) ----------------------------------------------------------------------
  conversations: {
    list: '/conversations',
    create: '/conversations',
    messages: (id: string) => `/conversations/${id}/messages`,
    sendMessage: (id: string) => `/conversations/${id}/messages`,
    broadcast: '/messages/broadcast',
  },
  notifications: { list: '/notifications', readAll: '/notifications/read-all' },

  // --- reports and transfers (W-12…W-15) -----------------------------------------------------
  reports: {
    list: '/reports',
    detail: (id: string) => `/reports/${id}`,
    download: (id: string) => `/reports/${id}/download`,
    generate: '/reports/generate',
    ifta: '/reports/ifta',
    /** B-46 (IFTA half shipped 2026-09-14) — JSON KPIs + `Miles by jurisdiction` for W-12. */
    iftaSummary: '/reports/ifta/summary',
    activity: '/reports/activity',
    /** B-46 (activity half, backend landing in parallel) — W-13 KPIs + paged per-driver duty totals. */
    activitySummary: '/reports/activity/summary',
    dvir: '/reports/dvir',
    fmcsaPack: '/reports/fmcsa-pack',
    schedules: '/reports/schedules',
    schedule: (id: string) => `/reports/schedules/${id}`,
  },
  transfers: {
    list: '/transfers',
    create: '/transfers',
    detail: (id: string) => `/transfers/${id}`,
    download: (id: string) => `/transfers/${id}/download`,
  },

  // --- settings and admin (W-18…W-25) --------------------------------------------------------
  users: {
    list: '/users',
    create: '/users',
    detail: (id: string) => `/users/${id}`,
    update: (id: string) => `/users/${id}`,
    remove: (id: string) => `/users/${id}`,
    resendInvite: (id: string) => `/users/${id}/resend-invite`,
  },
  roles: {
    list: '/roles',
    create: '/roles',
    detail: (id: string) => `/roles/${id}`,
    update: (id: string) => `/roles/${id}`,
    remove: (id: string) => `/roles/${id}`,
  },
  devices: {
    list: '/devices',
    create: '/devices',
    detail: (id: string) => `/devices/${id}`,
    update: (id: string) => `/devices/${id}`,
    remove: (id: string) => `/devices/${id}`,
    import: '/devices/import',
    export: '/devices/export',
    pair: (id: string) => `/devices/${id}/pair`,
    unpair: (id: string) => `/devices/${id}/unpair`,
    firmware: (id: string) => `/devices/${id}/firmware`,
    bleStatus: (id: string) => `/devices/${id}/ble-status`,
    /** ⛔ GAP B-8 — 11.20 `Test connection`. */
    diagnostics: (id: string) => `/devices/${id}/diagnostics`,
  },
  alertRules: {
    list: '/alert-rules',
    create: '/alert-rules',
    detail: (id: string) => `/alert-rules/${id}`,
    update: (id: string) => `/alert-rules/${id}`,
    remove: (id: string) => `/alert-rules/${id}`,
    /** ⛔ GAP B-9 — 11.21 `Test rule`. */
    test: (id: string) => `/alert-rules/${id}/test`,
  },
  integrations: {
    list: '/integrations',
    detail: (provider: string) => `/integrations/${provider}`,
    update: (provider: string) => `/integrations/${provider}`,
    remove: (provider: string) => `/integrations/${provider}`,
    testWebhook: '/integrations/webhook/test',
  },
  apiKeys: {
    list: '/api-keys',
    create: '/api-keys',
    remove: (id: string) => `/api-keys/${id}`,
    scopes: (id: string) => `/api-keys/${id}/scopes`,
  },
  auditLog: { list: '/audit-log' },

  // --- support (W-24, W-25) ------------------------------------------------------------------
  support: {
    tickets: '/support/tickets',
    createTicket: '/support/tickets',
    ticket: (id: string) => `/support/tickets/${id}`,
    updateTicket: (id: string) => `/support/tickets/${id}`,
    feedback: '/feedback',
  },

  // --- command palette (11.28) ---------------------------------------------------------------
  /** ⛔ GAP B-10 — until it lands the palette fans out to /vehicles + /drivers. */
  search: { root: '/search' },

  // --- notifications panel (11.27) — appended by web-architect, Phase 9 ----------------------
  /** ⛔ GAP B-56 — per-item `readAt`; only `POST /notifications/read-all` exists today. */
  notificationItem: { markRead: (id: string) => `/notifications/${id}/read` },
} as const;

export type Endpoints = typeof endpoints;
