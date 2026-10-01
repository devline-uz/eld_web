// owner: web-api-client — ⭐ every API URL in the app lives in this file (web/tz.md §2.2 rule 2).
// Paths are written WITHOUT the `/api` prefix; the prefix is part of VITE_API_BASE_URL.
// The backend is unversioned (`/api/vehicles`, never `/api/v1/vehicles`) — web/tz.md §6.1.
//
// Every path below was checked against backend/docs/openapi.json (183 paths, 233 operations,
// regenerated 2026-09-24 after backend Phase 13). Every former `⛔ GAP` path shipped; the contract
// suite (tests/contract/endpoints.contract.test.ts) fails on any path the backend does not document.

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
    /** B-84 (shipped) — completes a `PATCH /users/:id { email }` re-verification link. */
    emailVerify: '/auth/email/verify',
  },

  // --- carrier and account (W-17, W-26) ------------------------------------------------------
  carrier: {
    root: '/carrier',
    /** B-45 (shipped) — timezone + Appendix A ids + erodsMode, gated `reports` READ (not carrierSettings). */
    transferConfig: '/carrier/transfer-config',
  },
  /** B-41 (shipped) — 15-minute presigned GET for one DVIR/defect/ticket attachment. Never cached. */
  attachments: { presign: (id: string) => `/attachments/${id}/presign` },
  /** Perf plan item 3 — W-01 Fleet Dashboard's single aggregate call (WD-074). */
  dashboard: { summary: '/dashboard/summary' },
  me: {
    profile: '/me/profile',
    /** GET lists; DELETE (B-50) signs out every OTHER session → `{ revoked }`. */
    sessions: '/me/sessions',
    session: (id: string) => `/me/sessions/${id}`,
    /** B-11 (shipped) — GET / PUT (full replace). */
    preferences: '/me/preferences',
    /** B-51 (shipped) — POST multipart `file` (PNG/JPG ≥ 256×256) / DELETE. */
    avatar: '/me/avatar',
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
    /** Shipped 2026-09-24 — newest-first points, `?from&to&limit≤2000`. */
    telemetry: (id: string) => `/vehicles/${id}/telemetry`,
    /** B-4 (shipped) — W-05 day segmentation, `?date=`. */
    histories: (id: string) => `/vehicles/${id}/histories`,
    /** B-5 (shipped) — W-04 activity tab. */
    activities: (id: string) => `/vehicles/${id}/activities`,
    /** B-71 (shipped) — PATCH `{ ids, status }` → `{ updated, failed }`. Static path: its MSW handler must precede the vehicle-by-id one. */
    bulkStatus: '/vehicles/bulk-status',
  },
  /** Vehicle groups (backend D-107, 2026-09-25) — W-12 `Vehicle group`, W-13 `Group by`. */
  vehicleGroups: {
    list: '/vehicle-groups',
    create: '/vehicle-groups',
    detail: (id: string) => `/vehicle-groups/${id}`,
    update: (id: string) => `/vehicle-groups/${id}`,
    remove: (id: string) => `/vehicle-groups/${id}`,
    /** PUT `{ vehicleIds }` — replaces the membership. */
    members: (id: string) => `/vehicle-groups/${id}/vehicles`,
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
    /** B-81 (shipped) — `drivers` FULL, audited. */
    resetPassword: (id: string) => `/drivers/${id}/reset-password`,
    /** B-29/B-30 (shipped) — emails a verification token to `Driver.email`. */
    sendVerification: (id: string) => `/drivers/${id}/send-verification`,
    verifyEmail: (id: string) => `/drivers/${id}/verify-email`,
    /** B-94 (shipped) — GET list / POST metadata → presigned PUT `uploadUrl`. */
    documents: (id: string) => `/drivers/${id}/documents`,
    document: (id: string, docId: string) => `/drivers/${id}/documents/${docId}`,
  },
  /** B-7 (shipped) — W-04 co-driver row. */
  coDriverPairings: {
    list: '/co-driver-pairings',
    create: '/co-driver-pairings',
    end: (id: string) => `/co-driver-pairings/${id}/end`,
  },

  // --- ⭐ HOS (W-08) -------------------------------------------------------------------------
  logs: {
    day: (driverId: string) => `/logs/${driverId}`,
    range: (driverId: string) => `/logs/${driverId}/range`,
    events: (driverId: string) => `/logs/${driverId}/events`,
    /** B-72 (shipped) — POST a proposed record on a day with no duty record (recordStatus 3, inert). */
    proposeEvent: (driverId: string) => `/logs/${driverId}/events`,
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
    /** B-75 (shipped) — §396.11 PDF (binary; `client.blob`). */
    pdf: (id: string) => `/dvir/${id}/pdf`,
    /** B-47 (shipped) — expected vs submitted PRE_TRIP DVIRs, `?from&to`. Static path: its MSW handler must precede the DVIR-by-id one. */
    compliance: '/dvir/compliance',
    mechanicSignoff: (id: string) => `/dvir/${id}/mechanic-signoff`,
    nextDriverReview: (id: string) => `/dvir/${id}/next-driver-review`,
  },
  defects: {
    list: '/defects',
    detail: (id: string) => `/defects/${id}`,
    /** B-68/B-70 — `resolutionType` REPAIRED | NOT_REQUIRED | DEFERRED (+ repair record fields). */
    resolve: (id: string) => `/defects/${id}/resolve`,
    /** B-40 (shipped) — `{ assigneeId: string | null }`. */
    assign: (id: string) => `/defects/${id}/assign`,
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
    /** B-67 (shipped) — marks the caller's copy read up to now. */
    read: (id: string) => `/conversations/${id}/read`,
    broadcast: '/messages/broadcast',
  },
  notifications: { list: '/notifications', readAll: '/notifications/read-all' },
  /** B-87 (shipped) — org-level email / webhook toggles, GET / PATCH. */
  notificationChannels: { root: '/notification-channels' },

  // --- reports and transfers (W-12…W-15) -----------------------------------------------------
  reports: {
    list: '/reports',
    detail: (id: string) => `/reports/${id}`,
    download: (id: string) => `/reports/${id}/download`,
    generate: '/reports/generate',
    ifta: '/reports/ifta',
    /** B-46 (IFTA half shipped 2026-09-14) — JSON KPIs + `Miles by jurisdiction` for W-12. */
    iftaSummary: '/reports/ifta/summary',
    /** Backend D-107 (2026-09-25) — W-12 `Jurisdiction` menu options. Static path: its MSW handler precedes `:id`. */
    iftaJurisdictions: '/reports/ifta/jurisdictions',
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
    /** B-8 (shipped) — 11.20 `Test connection`. */
    diagnostics: (id: string) => `/devices/${id}/diagnostics`,
  },
  alertRules: {
    list: '/alert-rules',
    create: '/alert-rules',
    detail: (id: string) => `/alert-rules/${id}`,
    update: (id: string) => `/alert-rules/${id}`,
    remove: (id: string) => `/alert-rules/${id}`,
    /** B-9 (shipped) — 11.21 `Test rule`. */
    test: (id: string) => `/alert-rules/${id}/test`,
  },
  integrations: {
    list: '/integrations',
    /** B-89 (shipped) — marketplace catalog. Static path: its MSW handler must precede the by-provider one. */
    catalog: '/integrations/catalog',
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
    /** B-90 (shipped) — opens a SUPPORT conversation; replies arrive on `conversation:{id}`. */
    chats: '/support/chats',
    feedback: '/feedback',
  },

  // --- command palette (11.28) ---------------------------------------------------------------
  /** B-10 (shipped) — `?q&limit`. */
  search: { root: '/search' },

  // --- notifications panel (11.27) — appended by web-architect, Phase 9 ----------------------
  /** B-56 (shipped) — per-item `readAt`. */
  notificationItem: { markRead: (id: string) => `/notifications/${id}/read` },
} as const;

export type Endpoints = typeof endpoints;

/** Third-party, not the ELD API: MapTiler forward geocoding, `{base}/{query}.json?key=…`. MapTiler is
 * the provisional map provider (tz §22 Q-2, WD CSP note) — the same host the CSP already allows for
 * tiles, keyed by `VITE_MAP_API_KEY`. Called with plain `fetch`, never through `client.ts`. */
export const GEOCODING_BASE_URL = 'https://api.maptiler.com/geocoding';
