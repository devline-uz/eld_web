// GENERATED FILE — do not edit by hand.
// Source: backend/docs/openapi.json (187 paths, 240 typed operations).
// Regenerate: npm run gen:types   (scripts/generate-api-types.mjs)
//
// The backend documents payloads as OpenAPI examples, so these shapes are inferred structurally.
// The contract suite (tests/contract) is what proves a live response still matches the document.

/** Success envelope produced by the backend TransformInterceptor (web/tz.md §6.1). */
export interface ApiEnvelope<T> {
  data: T;
  traceId: string;
  timestamp: string;
}

/** Error envelope produced by AllExceptionsFilter (web/tz.md §6.1). */
export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  traceId: string;
  timestamp: string;
}

/** Offset pagination envelope — `?page&limit&sort=field:asc|desc&q=`, limit max 200. */
export interface OffsetPage<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Query parameters accepted by every list endpoint (ListQueryDto). */
export interface ListQuery {
  page?: number;
  limit?: number;
  sort?: string;
  q?: string;
  [key: string]: unknown;
}

/** GET /health/live */
export type HealthLiveResponse = {
  status: string;
};

/** GET /health/ready */
export type HealthReadyResponse = {
  status: string;
  info: {
    database: {
      status: string;
    };
  };
  details: {
    database: {
      status: string;
    };
  };
};

/** GET /health/deep */
export type HealthDeepResponse = {
  status: string;
  checks: {
    database: {
      status: string;
      latencyMs: number;
    };
    redis: {
      status: string;
      latencyMs: number;
    };
    storage: {
      status: string;
      latencyMs: number;
    };
  };
};

/** POST /api/auth/login */
export type AuthLoginResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
};

/** POST /api/auth/login/driver */
export type AuthLoginDriverResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  driverId: string;
};

/** POST /api/auth/google */
export type AuthGoogleResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
};

/** POST /api/auth/refresh */
export type AuthRefreshResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
};

/** POST /api/auth/logout */
export type AuthLogoutResponse = {
  success: boolean;
};

/** POST /api/auth/password/forgot */
export type AuthForgotPasswordResponse = {
  success: boolean;
};

/** POST /api/auth/password/reset */
export type AuthResetPasswordResponse = {
  success: boolean;
};

/** POST /api/auth/email/verify */
export type AuthVerifyEmailChangeResponse = {
  success: boolean;
};

/** GET /api/auth/me */
export type AuthMeResponse = {
  id: string;
  type: string;
  role: string;
  permissions: Record<string, unknown>;
  fullName: string;
  email: string;
  avatarUrl: unknown;
  carrierName: string;
  homeTerminalTimezone: string;
};

/** GET /api/carrier */
export type CarrierGetResponse = {
  id: string;
  name: string;
  dotNumber: string;
  eldIdentifier: string;
  erodsMode: string;
};

/** PATCH /api/carrier */
export type CarrierUpdateResponse = {
  id: string;
  name: string;
  dotNumber: string;
  timezone: string;
  eldIdentifier: string;
  eldRegistrationId: unknown;
  erodsMode: string;
};

/** GET /api/carrier/transfer-config */
export type CarrierGetTransferConfigResponse = {
  timezone: string;
  eldIdentifier: string;
  eldRegistrationId: unknown;
  erodsMode: string;
};

/** GET /api/attachments/{id}/presign */
export type AttachmentsPresignResponse = {
  url: string;
  expiresAt: string;
};

/** GET /api/roles */
export type RolesListResponse = Array<{
  key: string;
  isSystem: boolean;
  permissions: Record<string, unknown>;
}>;

/** POST /api/roles */
export type RolesCreateResponse = {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
  permissions: {
    logs: string;
    safety: string;
  };
};

/** GET /api/roles/{id} */
export type RolesGetResponse = {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
  permissions: {
    vehicles: string;
    drivers: string;
    logs: string;
    reportsTransfer: string;
  };
};

/** PATCH /api/roles/{id} */
export type RolesUpdateResponse = {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
  permissions: {
    logs: string;
    safety: string;
  };
};

/** DELETE /api/roles/{id} */
export type RolesRemoveResponse = {
  success: boolean;
};

/** GET /api/users */
export type UsersListResponse = Array<{
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  role: {
    key: string;
    name: string;
  };
  lastActiveAt: string;
}>;

/** POST /api/users */
export type UsersCreateResponse = {
  user: {
    id: string;
    status: string;
  };
  inviteToken: string;
};

/** GET /api/users/{id} */
export type UsersGetResponse = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  role: {
    key: string;
    name: string;
  };
};

/** PATCH /api/users/{id} */
export type UsersUpdateResponse = {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  role: {
    key: string;
    name: string;
  };
};

/** DELETE /api/users/{id} */
export type UsersRemoveResponse = {
  success: boolean;
};

/** POST /api/users/{id}/resend-invite */
export type UsersResendInviteResponse = {
  user: {
    id: string;
    email: string;
    status: string;
  };
  inviteToken: string;
  expiresAt: string;
};

/** GET /api/me/profile */
export type MeProfileResponse = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: {
    key: string;
    name: string;
  };
};

/** PATCH /api/me/profile */
export type MeUpdateProfileResponse = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
};

/** GET /api/me/sessions */
export type MeSessionsResponse = Array<{
  id: string;
  deviceLabel: unknown;
  ip: string;
  userAgent: string;
  location: unknown;
  lastSeenAt: string;
  current: boolean;
}>;

/** DELETE /api/me/sessions */
export type MeRevokeAllSessionsResponse = {
  revoked: number;
};

/** DELETE /api/me/sessions/{id} */
export type MeRevokeSessionResponse = {
  success: boolean;
};

/** POST /api/me/avatar */
export type MeUploadAvatarResponse = {
  id: string;
  avatarUrl: string;
};

/** DELETE /api/me/avatar */
export type MeDeleteAvatarResponse = {
  id: string;
  avatarUrl: unknown;
};

/** GET /api/me/preferences */
export type MeGetPreferencesResponse = {
  language: string;
  timezone: string;
  dateFormat: string;
  distanceUnit: string;
  savedViews: Record<string, unknown>;
  tableColumns: Record<string, unknown>;
};

/** PUT /api/me/preferences */
export type MeUpdatePreferencesResponse = {
  language: string;
  timezone: string;
  dateFormat: string;
  distanceUnit: string;
};

/** GET /api/audit-log */
export type AuditListResponse = {
  items: Array<{
    id: string;
    actorType: string;
    actorName: string;
    actorEmail: string;
    action: string;
    objectType: string;
    objectId: string;
  }>;
  nextCursor: unknown;
};

/** GET /api/api-keys */
export type ApiKeysListResponse = Array<{
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string;
  expiresAt: unknown;
  revokedAt: unknown;
}>;

/** POST /api/api-keys */
export type ApiKeysCreateResponse = {
  apiKey: {
    id: string;
    prefix: string;
  };
  plaintextKey: string;
};

/** PATCH /api/api-keys/{id}/scopes */
export type ApiKeysUpdateScopesResponse = {
  id: string;
  prefix: string;
  scopes: string[];
};

/** DELETE /api/api-keys/{id} */
export type ApiKeysRevokeResponse = {
  success: boolean;
};

/** GET /api/drivers — list item */
export type DriversListItem = {
  id: string;
  username: string;
  cdlNumber: string;
};

/** GET /api/drivers */
export type DriversListResponse = OffsetPage<DriversListItem>;

/** POST /api/drivers */
export type DriversCreateResponse = {
  id: string;
  username: string;
  status: string;
  homeTerminalTimezone: string;
};

/** GET /api/drivers/export */
export type DriversExportResponse = {
  drivers: Array<{
    username: string;
    firstName: string;
    lastName: string;
    cdlNumber: string;
    cdlState: string;
    homeTerminalTimezone: string;
    hosRuleset: string;
  }>;
};

/** GET /api/drivers/roster — list item */
export type DriversRosterItem = {
  driver: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    homeTerminalName: string;
    appVersion: string;
    email: string;
    eldExempt: boolean;
    allowPersonalConveyance: boolean;
    allowYardMove: boolean;
    shortHaulException: boolean;
    splitSleeperEnabled: boolean;
  };
  dutyStatus: string;
  unit: {
    id: string;
    unitNumber: string;
  };
  hos: {
    driveRemainingSec: number;
    shiftRemainingSec: number;
    cycleRemainingSec: number;
  };
  openViolations: number;
  emailVerified: unknown;
};

/** GET /api/drivers/roster */
export type DriversRosterResponse = OffsetPage<DriversRosterItem>;

/** GET /api/drivers/{id}/hos */
export type DriversHosResponse = {
  driveRemainingSec: number;
  shiftRemainingSec: number;
  cycleRemainingSec: number;
  breakInSec: number;
  onDutySince: string;
  cycleLimitSec: number;
  shiftLimitSec: number;
  driveLimitSec: number;
  breakLimitSec: number;
  dutyStatus: string;
  statusSince: string;
  computedAt: string;
};

/** GET /api/drivers/{id} */
export type DriversGetResponse = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  status: string;
  cdlNumber: string;
  cdlState: string;
  homeTerminalTimezone: string;
  assignedVehicleId: string;
  allowPersonalConveyance: boolean;
  allowYardMove: boolean;
};

/** PATCH /api/drivers/{id} */
export type DriversUpdateResponse = {
  id: string;
  username: string;
  status: string;
  allowPersonalConveyance: boolean;
};

/** DELETE /api/drivers/{id} */
export type DriversRemoveResponse = {
  id: string;
  status: string;
  assignedVehicleId: unknown;
};

/** POST /api/drivers/import */
export type DriversImportResponse = {
  imported: number;
  updated: number;
  failed: unknown[];
};

/** POST /api/drivers/{id}/reset-password */
export type DriversResetPasswordResponse = {
  emailedTo: string;
};

/** POST /api/drivers/{id}/send-verification */
export type DriversSendVerificationResponse = {
  emailedTo: string;
};

/** POST /api/drivers/{id}/verify-email */
export type DriversVerifyEmailResponse = {
  id: string;
  email: string;
  emailVerifiedAt: string;
};

/** GET /api/drivers/{id}/documents */
export type DriversListDocumentsResponse = Array<{
  id: string;
  type: string;
  fileName: string;
  expiresAt: string;
  uploadedAt: string;
  url: string;
}>;

/** POST /api/drivers/{id}/documents */
export type DriversCreateDocumentResponse = {
  id: string;
  type: string;
  fileName: string;
  expiresAt: unknown;
  uploadedAt: string;
  url: string;
  uploadUrl: string;
};

/** DELETE /api/drivers/{id}/documents/{docId} */
export type DriversRemoveDocumentResponse = {
  deleted: boolean;
};

/** GET /api/transfers — list item */
export type TransfersListItem = {
  id: string;
  sentAt: string;
  method: string;
  comment: string;
  periodFrom: string;
  periodTo: string;
  status: string;
  sentById: string;
  fileName: string;
};

/** GET /api/transfers */
export type TransfersListResponse = OffsetPage<TransfersListItem>;

/** POST /api/transfers */
export type TransfersCreateResponse = {
  transfer: {
    id: string;
    fileName: string;
    status: string;
    erodsMode: string;
    fileSizeBytes: number;
  };
  warnings: Array<{
    code: string;
    level: string;
    message: string;
  }>;
  counts: {
    header: number;
    events: number;
  };
};

/** GET /api/transfers/{id} */
export type TransfersGetResponse = {
  id: string;
  method: string;
  status: string;
  erodsMode: string;
  comment: string;
  fileName: string;
  fileSizeBytes: number;
  counts: {
    header: number;
    events: number;
  };
  sentAt: string;
};

/** GET /api/mobile/transfers */
export type MobileTransfersListResponse = {
  items: Array<{
    id: string;
    method: string;
    status: string;
    erodsMode: string;
    referenceId: string;
    sentAt: string;
    createdAt: string;
    fileName: string;
    outputFileComment: string;
    rangeStart: string;
    rangeEnd: string;
  }>;
  total: number;
  limit: number;
};

/** POST /api/mobile/transfers */
export type MobileTransfersCreateResponse = {
  id: string;
  method: string;
  status: string;
  erodsMode: string;
  referenceId: unknown;
  sentAt: unknown;
  createdAt: string;
  fileName: string;
  outputFileComment: string;
  rangeStart: string;
  rangeEnd: string;
  warnings: string[];
  counts: {
    header: number;
    events: number;
  };
};

/** GET /api/vehicles — list item */
export type VehiclesListItem = {
  id: string;
  unitNumber: string;
  vin: string;
  status: string;
};

/** GET /api/vehicles */
export type VehiclesListResponse = OffsetPage<VehiclesListItem>;

/** POST /api/vehicles */
export type VehiclesCreateResponse = {
  id: string;
  unitNumber: string;
  vin: string;
  status: string;
  odometerMiles: number;
};

/** GET /api/vehicles/export */
export type VehiclesExportResponse = {
  vehicles: Array<{
    unitNumber: string;
    vin: string;
    make: string;
    model: string;
    year: number;
    fuelType: string;
    odometerMiles: number;
  }>;
};

/** GET /api/vehicles/{id} */
export type VehiclesGetResponse = {
  id: string;
  unitNumber: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  status: string;
  odometerMiles: number;
  odometerOffsetMiles: number;
  assignedDriverId: string;
};

/** PATCH /api/vehicles/{id} */
export type VehiclesUpdateResponse = {
  id: string;
  unitNumber: string;
  status: string;
  licensePlate: string;
  licenseState: string;
};

/** DELETE /api/vehicles/{id} */
export type VehiclesRemoveResponse = {
  id: string;
  status: string;
  assignedDriverId: unknown;
};

/** GET /api/vehicles/{id}/activities */
export type VehiclesActivitiesResponse = {
  items: Array<{
    id: string;
    occurredAt: string;
    activity: string;
    driverName: string;
    source: string;
    details: string;
  }>;
};

/** GET /api/vehicles/{id}/histories */
export type VehiclesHistoriesResponse = {
  date: string;
  distanceMi: number;
  driveSegments: number;
  driveTimeSec: number;
  avgSpeedMph: number;
  stopCount: number;
  stopTimeSec: number;
  idleTimeSec: number;
  idleFuelWastedGal: number;
  firstMovementAt: string;
  lastMovementAt: string;
  engineOnSec: number;
  engineOffSec: number;
  longestDrive: {
    label: string;
    durationSec: number;
  };
  longestStop: {
    label: string;
    durationSec: number;
  };
  maxSpeedMph: number;
  maxSpeedAt: string;
  segments: unknown[];
};

/** GET /api/vehicles/{id}/telemetry */
export type VehiclesTelemetryResponse = {
  items: Array<{
    time: string;
    vehicleId: string;
    speedMph: number;
    latitude: number;
    longitude: number;
  }>;
};

/** POST /api/vehicles/import */
export type VehiclesImportResponse = {
  imported: number;
  updated: number;
  skipped: number;
  failed: unknown[];
};

/** PATCH /api/vehicles/bulk-status */
export type VehiclesBulkUpdateStatusResponse = {
  updated: string[];
  failed: unknown[];
};

/** POST /api/vehicles/{id}/calibrate-odometer */
export type VehiclesCalibrateOdometerResponse = {
  id: string;
  odometerOffsetMiles: number;
  dashOdometerMiles: number;
  deviceOdometerMiles: number;
};

/** POST /api/vehicles/{id}/assign-driver */
export type VehiclesAssignDriverResponse = {
  id: string;
  unitNumber: string;
  assignedDriverId: string;
};

/** POST /api/vehicles/{id}/unassign-driver */
export type VehiclesUnassignDriverResponse = {
  id: string;
  unitNumber: string;
  assignedDriverId: unknown;
};

/** GET /api/trailers */
export type TrailersListResponse = {
  items: Array<{
    id: string;
    number: string;
    vin: string;
    licensePlate: string;
    licenseState: string;
  }>;
};

/** POST /api/trailers */
export type TrailersCreateResponse = {
  id: string;
  number: string;
  licensePlate: string;
  licenseState: string;
};

/** GET /api/trailers/export */
export type TrailersExportResponse = {
  trailers: Array<{
    number: string;
    vin: string;
    licensePlate: string;
    licenseState: string;
  }>;
};

/** GET /api/trailers/{id} */
export type TrailersGetResponse = {
  id: string;
  number: string;
  vin: string;
  licensePlate: string;
  licenseState: string;
};

/** PATCH /api/trailers/{id} */
export type TrailersUpdateResponse = {
  id: string;
  number: string;
  licensePlate: string;
};

/** DELETE /api/trailers/{id} */
export type TrailersRemoveResponse = {
  success: boolean;
};

/** POST /api/trailers/import */
export type TrailersImportResponse = {
  imported: number;
  updated: number;
  failed: unknown[];
};

/** GET /api/vehicle-groups */
export type VehicleGroupsListResponse = {
  items: Array<{
    id: string;
    name: string;
    description: string;
    color: string;
    vehicleCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
};

/** POST /api/vehicle-groups */
export type VehicleGroupsCreateResponse = {
  id: string;
  name: string;
  description: string;
  color: string;
  vehicleCount: number;
  createdAt: string;
  updatedAt: string;
};

/** GET /api/vehicle-groups/{id} */
export type VehicleGroupsGetResponse = {
  id: string;
  name: string;
  description: string;
  color: string;
  vehicleCount: number;
  createdAt: string;
  updatedAt: string;
  vehicles: Array<{
    id: string;
    unitNumber: string;
    vin: string;
    make: string;
    model: string;
    status: string;
  }>;
};

/** PATCH /api/vehicle-groups/{id} */
export type VehicleGroupsUpdateResponse = {
  id: string;
  name: string;
  description: string;
  color: string;
  vehicleCount: number;
  createdAt: string;
  updatedAt: string;
};

/** DELETE /api/vehicle-groups/{id} */
export type VehicleGroupsRemoveResponse = {
  success: boolean;
};

/** PUT /api/vehicle-groups/{id}/vehicles */
export type VehicleGroupsSetMembersResponse = {
  id: string;
  name: string;
  description: string;
  color: string;
  vehicleCount: number;
  createdAt: string;
  updatedAt: string;
};

/** GET /api/alert-rules */
export type AlertRulesListResponse = {
  items: Array<{
    id: string;
    key: string;
    name: string;
    severity: string;
    channels: string[];
    enabled: boolean;
  }>;
};

/** POST /api/alert-rules */
export type AlertRulesCreateResponse = {
  id: string;
  key: string;
  channels: string[];
};

/** GET /api/alert-rules/{id} */
export type AlertRulesGetResponse = {
  id: string;
  key: string;
  channels: string[];
};

/** PATCH /api/alert-rules/{id} */
export type AlertRulesUpdateResponse = {
  id: string;
  enabled: boolean;
};

/** DELETE /api/alert-rules/{id} */
export type AlertRulesRemoveResponse = {
  id: string;
  deleted: boolean;
};

/** POST /api/alert-rules/{id}/test */
export type AlertRulesTestResponse = {
  triggered: boolean;
};

/** GET /api/notifications — list item */
export type NotificationsListItem = {
  id: string;
  type: string;
  kind: string;
  title: string;
  body: string;
  objectType: string;
  objectId: string;
  category: string;
  severity: string;
  readAt: unknown;
};

/** GET /api/notifications */
export type NotificationsListResponse = OffsetPage<NotificationsListItem>;

/** POST /api/notifications/read-all */
export type NotificationsReadAllResponse = {
  updated: number;
};

/** POST /api/notifications/{id}/read */
export type NotificationsMarkReadResponse = {
  id: string;
  readAt: string;
};

/** GET /api/notification-channels */
export type NotificationChannelsGetResponse = {
  email: {
    enabled: boolean;
  };
  webhook: {
    enabled: boolean;
  };
};

/** PATCH /api/notification-channels */
export type NotificationChannelsUpdateResponse = {
  email: {
    enabled: boolean;
  };
  webhook: {
    enabled: boolean;
  };
};

/** POST /api/integrations/webhook/test */
export type WebhooksSendTestResponse = {
  id: string;
  status: string;
  attempts: number;
};

/** GET /api/integrations */
export type IntegrationsListResponse = Array<{
  id: string;
  provider: string;
  enabled: boolean;
  status: string;
  lastSyncAt: string;
  config: {
    baseUrl: string;
    apiToken: string;
  };
}>;

/** GET /api/integrations/catalog */
export type IntegrationsCatalogResponse = Array<{
  provider: string;
  name: string;
  description: string;
  category: string;
  available: boolean;
}>;

/** GET /api/integrations/{provider} */
export type IntegrationsGetResponse = {
  id: string;
  provider: string;
  enabled: boolean;
  status: string;
  config: {
    accountId: string;
    apiKey: string;
  };
};

/** PUT /api/integrations/{provider} */
export type IntegrationsUpsertResponse = {
  id: string;
  provider: string;
  enabled: boolean;
  status: string;
};

/** DELETE /api/integrations/{provider} */
export type IntegrationsDisconnectResponse = {
  id: string;
  provider: string;
  enabled: boolean;
  status: string;
};

/** GET /api/mobile/bootstrap */
export type MobileBootstrapGetResponse = {
  serverTime: string;
  hosEngineVersion: string;
  driver: {
    id: string;
    firstName: string;
    lastName: string;
    cdlNumber: string;
    cdlState: string;
  };
  vehicle: {
    id: string;
    unitNumber: string;
  };
  device: {
    id: string;
    serial: string;
    bleState: string;
  };
  hos: {
    state: {
      currentStatus: string;
      driveRemainingSec: number;
    };
  };
  inspectionPacket: {
    days: unknown[];
  };
  syncConfig: {
    batchMaxChanges: number;
    batchMaxBytes: number;
  };
};

/** POST /api/mobile/sync */
export type MobileSyncSyncResponse = {
  accepted: string[];
  rejected: Array<{
    clientId: string;
    code: string;
  }>;
  serverChanges: unknown[];
  serverTime: string;
  hosEngineVersion: string;
  nextSyncAfterSec: number;
};

/** POST /api/mobile/duty-status */
export type MobileDutyStatusChangeResponse = {
  id: string;
  status: string;
  startAt: string;
  recordOrigin: number;
  recordStatus: number;
  applied: boolean;
};

/** POST /api/mobile/signature */
export type MobileDvirUploadSignatureResponse = {
  signatureImageId: string;
  attachmentId: unknown;
  key: string;
  sha256: string;
  sizeBytes: number;
};

/** POST /api/mobile/dvir */
export type MobileDvirSubmitResponse = {
  id: string;
  vehicleId: string;
  type: string;
  vehicleCondition: string;
  defectCount: number;
  photoCount: number;
  outOfService: boolean;
  applied: boolean;
};

/** GET /api/mobile/available-vehicles */
export type MobileVehicleListResponse = Array<{
  id: string;
  unitNumber: string;
  make: string;
  model: string;
  deviceSerial: string;
}>;

/** POST /api/mobile/select-vehicle */
export type MobileVehicleSelectResponse = {
  id: string;
  unitNumber: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  sleeperBerth: boolean;
  status: string;
  odometerMi: number;
};

/** POST /api/mobile/co-driver/switch */
export type MobileCoDriverSwitchResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
};

/** POST /api/mobile/co-driver/leave */
export type MobileCoDriverLeaveResponse = {
  ended: boolean;
};

/** GET /api/mobile/trip */
export type MobileTripGetResponse = {
  id: string;
  number: string;
  status: string;
  stops: unknown[];
  documents: unknown[];
};

/** PATCH /api/mobile/trip */
export type MobileTripPatchResponse = {
  id: string;
  shippingDocument: string;
  trailerId: string;
  notes: string;
};

/** GET /api/mobile/dvirs */
export type MobileDvirHistoryListResponse = Array<{
  id: string;
  vehicleId: string;
  type: string;
  submittedAt: string;
  vehicleCondition: string;
  defectCount: number;
  repairStatus: string;
}>;

/** GET /api/mobile/dvirs/{id} */
export type MobileDvirHistoryGetResponse = {
  id: string;
  vehicleId: string;
  defects: unknown[];
  photos: unknown[];
};

/** GET /api/mobile/contacts */
export type MobileContactsListResponse = Array<{
  id: string;
  name: string;
  role: string;
  phone: string;
}>;

/** POST /api/mobile/push-tokens */
export type PushTokensRegisterResponse = {
  id: string;
  driverId: string;
  platform: string;
  lastSeenAt: string;
};

/** DELETE /api/mobile/push-tokens/{token} */
export type PushTokensRemoveResponse = {
  deleted: boolean;
};

/** GET /api/mobile/device-health */
export type DeviceHealthGetResponse = {
  vehicleId: string;
  device: {
    id: string;
    serial: string;
    firmware: string;
    bleState: string;
    storedEventsCount: number;
  };
  activeCodes: Array<{
    kind: string;
    code: string;
  }>;
  unidentified: {
    windowDays: number;
    pendingCount: number;
    pendingConfirmationRequestIds: string[];
  };
  hosDrift: {
    computedAt: string;
    maxDriftSec: number;
    driftAlerted: boolean;
  };
};

/** GET /api/mobile/conversations */
export type MobileMessagingListConversationsResponse = {
  items: Array<{
    id: string;
    type: string;
    lastMessage: {
      id: string;
      body: string;
    };
    unreadCount: number;
  }>;
};

/** GET /api/mobile/conversations/{id}/messages */
export type MobileMessagingListMessagesResponse = {
  items: Array<{
    id: string;
    body: string;
    sentAt: string;
  }>;
  limit: number;
};

/** POST /api/mobile/conversations/{id}/messages */
export type MobileMessagingSendMessageResponse = {
  id: string;
  body: string;
  sentAt: string;
};

/** POST /api/mobile/conversations/{id}/read */
export type MobileMessagingMarkReadResponse = {
  messagesMarked: number;
};

/** POST /api/logs/edit-requests/{id}/accept */
export type LogsAcceptResponse = {
  id: string;
  status: string;
  resolvedAt: string;
  activeEventId: string;
  supersededEventId: string;
  recertificationRequired: boolean;
};

/** POST /api/logs/edit-requests/{id}/reject */
export type LogsRejectResponse = {
  id: string;
  status: string;
  resolvedAt: string;
  driverComment: string;
};

/** GET /api/logs/{driverId} */
export type LogsGetDayResponse = {
  driverId: string;
  date: string;
  timezone: string;
  summary: {
    drivingSec: number;
    onDutySec: number;
    offDutySec: number;
    sleeperSec: number;
    certified: boolean;
  };
  graph: Array<{
    status: string;
    effective: string;
    startAt: string;
    durationSec: number;
  }>;
};

/** GET /api/logs/{driverId}/range */
export type LogsGetRangeResponse = {
  driverId: string;
  from: string;
  to: string;
  days: Array<{
    date: string;
    drivingSec: number;
    onDutySec: number;
    certified: boolean;
    violations: number;
  }>;
};

/** GET /api/logs/{driverId}/events */
export type LogsGetEventsResponse = {
  driverId: string;
  date: string;
  events: Array<{
    id: string;
    eventType: number;
    eventCode: number;
    eventSequenceId: number;
    recordStatus: number;
    recordOrigin: number;
    dutyStatus: string;
    occurredAt: string;
    odometerMiles: number;
    latitude: number;
    longitude: number;
    locationDescription: string;
    totalEngineHours: number;
    checksumValid: boolean;
  }>;
};

/** POST /api/logs/{driverId}/events */
export type LogsProposeEventResponse = {
  id: string;
  driverId: string;
  status: string;
  kind: string;
  proposedStatus: string;
  proposedSpecial: string;
  eventDateTime: string;
  endDateTime: string;
  annotation: string;
  notifyDriver: boolean;
  recordStatus: number;
  applied: boolean;
};

/** GET /api/logs/{driverId}/edit-requests */
export type LogsListEditRequestsResponse = {
  items: Array<{
    id: string;
    date: string;
    status: string;
    requestedBy: string;
    reason: string;
    createdAt: string;
  }>;
};

/** POST /api/logs/{driverId}/edit-requests */
export type LogsCreateEditRequestResponse = {
  id: string;
  driverId: string;
  status: string;
  date: string;
  reason: string;
  proposed: {
    status: string;
    startAt: string;
    endAt: string;
  };
  proposedSpecial: string;
  notifyDriver: boolean;
  recordStatus: number;
  applied: boolean;
  createdAt: string;
};

/** POST /api/logs/{driverId}/certify */
export type LogsCertifyResponse = {
  driverId: string;
  certified: Array<{
    date: string;
    certifiedAt: string;
    certifiedBy: string;
    onBehalf: boolean;
    signatureCount: number;
  }>;
};

/** POST /api/mobile/log-entries */
export type MobileLogsCreateEntryResponse = {
  id: string;
  eventSequenceId: number;
  recordOrigin: number;
  recordStatus: number;
  dutyStatus: string;
  occurredAt: string;
  annotation: string;
  recertificationRequired: boolean;
};

/** POST /api/mobile/certify */
export type MobileLogsCertifyResponse = {
  driverId: string;
  certified: Array<{
    date: string;
    certifiedAt: string;
    signatureCount: number;
  }>;
};

/** GET /api/mobile/log-edit-requests */
export type MobileLogsListEditRequestsResponse = {
  items: Array<{
    id: string;
    date: string;
    status: string;
    reason: string;
    proposed: {
      status: string;
      startAt: string;
      endAt: string;
    };
  }>;
};

/** GET /api/mobile/logs */
export type MobileLogsGetDayResponse = {
  driverId: string;
  date: string;
  timezone: string;
  summary: {
    drivingSec: number;
    onDutySec: number;
    offDutySec: number;
    sleeperSec: number;
    certified: boolean;
  };
  graph: Array<{
    status: string;
    effective: string;
    startAt: string;
    durationSec: number;
  }>;
};

/** POST /api/ingest/events */
export type IngestEventsResponse = {
  received: number;
  stored: number;
  duplicates: number;
  unidentified: number;
  warnings: unknown[];
  firstEventSequenceId: number;
  lastEventSequenceId: number;
};

/** POST /api/ingest/telemetry */
export type IngestTelemetryResponse = {
  received: number;
  stored: number;
  duplicates: number;
};

/** POST /api/ingest/ble-state */
export type IngestBleStateResponse = {
  deviceId: string;
  bleState: string;
  recordedAt: string;
  diagnosticRaised: boolean;
};

/** POST /api/ingest/device-status */
export type IngestDeviceStatusResponse = {
  deviceId: string;
  storedEventCount: number;
  firmwareVersion: string;
  firmwareOutdated: boolean;
  lastHeartbeatAt: string;
};

/** GET /api/vehicles/{id}/dtc */
export type DtcListResponse = {
  items: Array<{
    id: string;
    vehicleId: string;
    spn: number;
    fmi: number;
    occurrence: number;
    source: string;
    description: unknown;
    firstSeenAt: string;
    lastSeenAt: string;
    clearedAt: unknown;
  }>;
};

/** GET /api/conversations */
export type MessagingListConversationsResponse = {
  items: Array<{
    id: string;
    type: string;
    lastMessageAt: string;
  }>;
};

/** POST /api/conversations */
export type MessagingCreateConversationResponse = {
  id: string;
  type: string;
};

/** GET /api/conversations/{id}/messages — list item */
export type MessagingListMessagesItem = {
  id: string;
  body: string;
  sentAt: string;
};

/** GET /api/conversations/{id}/messages */
export type MessagingListMessagesResponse = OffsetPage<MessagingListMessagesItem>;

/** POST /api/conversations/{id}/messages */
export type MessagingSendMessageResponse = {
  id: string;
  body: string;
  sentAt: string;
};

/** POST /api/conversations/{id}/read */
export type MessagingMarkReadResponse = {
  conversationId: string;
  lastReadAt: string;
};

/** POST /api/messages/broadcast */
export type MessagingBroadcastResponse = {
  sent: number;
  deliveries: Array<{
    conversationId: string;
    messageId: string;
    driverId: string;
  }>;
};

/** GET /api/devices — list item */
export type DevicesListItem = {
  id: string;
  serial: string;
  model: string;
  bleState: string;
  firmwareOutdated: boolean;
};

/** GET /api/devices */
export type DevicesListResponse = OffsetPage<DevicesListItem>;

/** POST /api/devices */
export type DevicesCreateResponse = {
  id: string;
  serial: string;
  model: string;
  status: string;
  bleState: string;
};

/** GET /api/devices/export */
export type DevicesExportResponse = {
  devices: Array<{
    serial: string;
    model: string;
    bleMac: string;
    firmwareVersion: string;
  }>;
};

/** GET /api/devices/{id} */
export type DevicesGetResponse = {
  id: string;
  serial: string;
  model: string;
  status: string;
  vehicleId: string;
  bleState: string;
  firmwareVersion: string;
  firmwareOutdated: boolean;
  lastHeartbeatAt: string;
};

/** PATCH /api/devices/{id} */
export type DevicesUpdateResponse = {
  id: string;
  serial: string;
  bleMac: string;
  status: string;
};

/** DELETE /api/devices/{id} */
export type DevicesRemoveResponse = {
  id: string;
  status: string;
  vehicleId: unknown;
};

/** GET /api/devices/{id}/diagnostics */
export type DevicesDiagnosticsResponse = {
  signalStrength: string;
  gpsLock: boolean;
  responded: boolean;
};

/** POST /api/devices/import */
export type DevicesImportResponse = {
  imported: number;
  updated: number;
  failed: unknown[];
};

/** PATCH /api/devices/{id}/firmware */
export type DevicesUpdateFirmwareResponse = {
  id: string;
  firmwareVersion: string;
  firmwareOutdated: boolean;
};

/** PATCH /api/devices/{id}/ble-status */
export type DevicesUpdateBleStatusResponse = {
  id: string;
  bleState: string;
  lastHeartbeatAt: string;
};

/** POST /api/devices/{id}/pair */
export type DevicesPairResponse = {
  id: string;
  serial: string;
  status: string;
  vehicleId: string;
};

/** POST /api/devices/{id}/unpair */
export type DevicesUnpairResponse = {
  id: string;
  serial: string;
  status: string;
  vehicleId: unknown;
};

/** GET /api/co-driver-pairings — list item */
export type CoDriverPairingsListItem = {
  id: string;
  primaryDriverId: string;
  coDriverId: string;
  vehicleId: string;
  startedAt: string;
  endedAt: unknown;
};

/** GET /api/co-driver-pairings */
export type CoDriverPairingsListResponse = OffsetPage<CoDriverPairingsListItem>;

/** POST /api/co-driver-pairings */
export type CoDriverPairingsCreateResponse = {
  id: string;
  primaryDriverId: string;
  coDriverId: string;
  vehicleId: string;
  startedAt: string;
  endedAt: unknown;
};

/** POST /api/co-driver-pairings/{id}/end */
export type CoDriverPairingsEndResponse = {
  id: string;
  endedAt: string;
};

/** POST /api/unidentified/{id}/confirm */
export type UnidentifiedConfirmResponse = {
  id: string;
  status: string;
  driverId: string;
  recordOrigin: number;
  eventCount: number;
};

/** GET /api/unidentified/confirmation-requests */
export type UnidentifiedListConfirmationRequestsResponse = {
  items: Array<{
    id: string;
    vehicleId: string;
    status: string;
    assignedDriverId: string;
    assignedById: string;
    confirmationRequestedAt: string;
    startAt: string;
    endAt: string;
    durationSec: number;
    distanceMi: number;
  }>;
};

/** GET /api/unidentified */
export type UnidentifiedListResponse = {
  items: Array<{
    id: string;
    vehicleId: string;
    durationSec: number;
    distanceMi: number;
    status: string;
    fromStoredEvents: boolean;
  }>;
  total: number;
  page: number;
};

/** GET /api/unidentified/{id} */
export type UnidentifiedGetResponse = {
  id: string;
  vehicleId: string;
  status: string;
  durationSec: number;
  distanceMi: number;
  fromStoredEvents: boolean;
  events: Array<{
    id: string;
    eventSequenceId: number;
    recordOrigin: number;
    dutyStatus: string;
    occurredAt: string;
    odometerMiles: number;
  }>;
};

/** POST /api/unidentified/{id}/assign */
export type UnidentifiedAssignResponse = {
  id: string;
  status: string;
  driverId: string;
  assignedById: string;
  assignedAt: string;
  recordOrigin: number;
  eventCount: number;
};

/** POST /api/unidentified/{id}/annotate */
export type UnidentifiedAnnotateResponse = {
  id: string;
  status: string;
  annotation: string;
  annotatedById: string;
};

/** POST /api/unidentified/{id}/reject */
export type UnidentifiedRejectResponse = {
  id: string;
  status: string;
  driverId: unknown;
  recordOrigin: number;
  eventCount: number;
};

/** GET /api/violations — list item */
export type ViolationsListItem = {
  id: string;
  driverId: string;
  dailyLogId: string;
  logDate: string;
  type: string;
  occurredAt: string;
  exceededBySec: number;
  detail: string;
  status: string;
  resolvedAt: unknown;
  resolvedById: unknown;
  resolutionNote: unknown;
  severity: string;
  driverName: string;
  vehicleId: string;
  unitNumber: string;
  event: string;
  locationLabel: string;
  date: string;
};

/** GET /api/violations */
export type ViolationsListResponse = OffsetPage<ViolationsListItem>;

/** POST /api/violations/{id}/resolve */
export type ViolationsResolveResponse = {
  id: string;
  status: string;
  resolvedAt: string;
  resolutionNote: string;
};

/** POST /api/mobile/hos-state */
export type HosStateHosStateSubmitResponse = {
  accepted: boolean;
  engineVersion: string;
  versionMismatch: boolean;
  drift: boolean;
  server: {
    driveRemainingSec: number;
    shiftRemainingSec: number;
    cycleRemainingSec: number;
    breakRemainingSec: number;
  };
  deltasSec: {
    driveRemainingSec: number;
    shiftRemainingSec: number;
    cycleRemainingSec: number;
    breakRemainingSec: number;
  };
};

/** GET /api/dvir — list item */
export type DvirAdminListItem = {
  id: string;
  driverId: string;
  vehicleId: string;
  type: string;
  vehicleCondition: string;
  repairStatus: string;
};

/** GET /api/dvir */
export type DvirAdminListResponse = OffsetPage<DvirAdminListItem>;

/** GET /api/dvir/compliance */
export type DvirAdminComplianceResponse = {
  expected: number;
  submitted: number;
  compliancePct: number;
  missing: Array<{
    vehicleId: string;
    unitNumber: string;
    date: string;
  }>;
};

/** GET /api/dvir/{id} */
export type DvirAdminGetResponse = {
  id: string;
  vehicleId: string;
  defects: Array<{
    id: string;
    part: string;
    severity: string;
    status: string;
  }>;
};

/** POST /api/dvir/{id}/mechanic-signoff */
export type DvirAdminMechanicSignOffResponse = {
  id: string;
  mechanicName: string;
  repairStatus: string;
  mechanicSignedAt: string;
};

/** PATCH /api/dvir/{id}/next-driver-review */
export type DvirAdminNextDriverReviewResponse = {
  id: string;
  nextDriverReviewedAt: string;
};

/** GET /api/defects — list item */
export type DefectsListItem = {
  id: string;
  vehicleId: string;
  severity: string;
  status: string;
  outOfService: boolean;
};

/** GET /api/defects */
export type DefectsListResponse = OffsetPage<DefectsListItem>;

/** GET /api/defects/{id} */
export type DefectsGetResponse = {
  id: string;
  vehicleId: string;
  severity: string;
  status: string;
};

/** PATCH /api/defects/{id}/resolve */
export type DefectsResolveResponse = {
  id: string;
  status: string;
  resolutionType: string;
  resolvedAt: string;
};

/** PATCH /api/defects/{id}/assign */
export type DefectsAssignResponse = {
  id: string;
  assigneeId: string;
};

/** PATCH /api/defects/{id}/work-order */
export type DefectsLinkWorkOrderResponse = {
  id: string;
  workOrderId: string;
};

/** GET /api/work-orders — list item */
export type WorkOrdersListItem = {
  id: string;
  number: string;
  vehicleId: string;
  status: string;
  priority: string;
};

/** GET /api/work-orders */
export type WorkOrdersListResponse = OffsetPage<WorkOrdersListItem>;

/** POST /api/work-orders */
export type WorkOrdersCreateResponse = {
  id: string;
  number: string;
  vehicleId: string;
  status: string;
  priority: string;
};

/** GET /api/work-orders/{id} */
export type WorkOrdersGetResponse = {
  id: string;
  number: string;
  vehicleId: string;
  status: string;
};

/** PATCH /api/work-orders/{id} */
export type WorkOrdersUpdateResponse = {
  id: string;
  status: string;
  costUsd: string;
};

/** POST /api/work-orders/{id}/close */
export type WorkOrdersCloseResponse = {
  id: string;
  status: string;
  closedAt: string;
};

/** POST /api/work-orders/{id}/cancel */
export type WorkOrdersCancelResponse = {
  id: string;
  status: string;
};

/** POST /api/work-orders/{id}/defects/{defectId} */
export type WorkOrdersAttachDefectResponse = {
  id: string;
  status: string;
};

/** GET /api/maintenance-schedules — list item */
export type MaintenanceSchedulesListItem = {
  id: string;
  vehicleId: string;
  name: string;
  intervalMi: number;
  due: {
    state: string;
    nextDueMi: number;
    milesRemaining: number;
  };
};

/** GET /api/maintenance-schedules */
export type MaintenanceSchedulesListResponse = OffsetPage<MaintenanceSchedulesListItem>;

/** POST /api/maintenance-schedules */
export type MaintenanceSchedulesCreateResponse = {
  id: string;
  vehicleId: string;
  name: string;
  intervalDays: number;
};

/** GET /api/maintenance-schedules/{id} */
export type MaintenanceSchedulesGetResponse = {
  id: string;
  vehicleId: string;
  name: string;
  due: {
    state: string;
  };
};

/** PATCH /api/maintenance-schedules/{id} */
export type MaintenanceSchedulesUpdateResponse = {
  id: string;
  enabled: boolean;
};

/** DELETE /api/maintenance-schedules/{id} */
export type MaintenanceSchedulesRemoveResponse = {
  deleted: boolean;
};

/** POST /api/maintenance-schedules/{id}/complete */
export type MaintenanceSchedulesCompleteResponse = {
  id: string;
  lastServiceMi: number;
  nextDueMi: number;
};

/** GET /api/support/tickets — list item */
export type SupportListItem = {
  id: string;
  number: string;
  subject: string;
  status: string;
};

/** GET /api/support/tickets */
export type SupportListResponse = OffsetPage<SupportListItem>;

/** POST /api/support/tickets */
export type SupportCreateResponse = {
  id: string;
  number: string;
  subject: string;
  status: string;
  priority: string;
};

/** GET /api/support/tickets/{id} */
export type SupportGetResponse = {
  id: string;
  number: string;
  subject: string;
  body: string;
  status: string;
  priority: string;
  requesterType: string;
  requesterId: string;
  createdAt: string;
};

/** PATCH /api/support/tickets/{id} */
export type SupportUpdateResponse = {
  id: string;
  number: string;
  status: string;
  priority: string;
  assigneeId: string;
};

/** POST /api/support/chats */
export type SupportCreateChatResponse = {
  conversationId: string;
  messageId: string;
};

/** POST /api/feedback */
export type SupportCreateFeedbackResponse = {
  id: string;
  rating: number;
  message: string;
  source: string;
  createdAt: string;
};

/** POST /api/mobile/feedback */
export type MobileSupportCreateFeedbackResponse = {
  id: string;
  comment: string;
  createdAt: string;
};

/** GET /api/mobile/support/tickets */
export type MobileSupportListOwnTicketsResponse = {
  items: Array<{
    id: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>;
};

/** POST /api/mobile/support/tickets */
export type MobileSupportCreateTicketResponse = {
  id: string;
  number: string;
  subject: string;
  status: string;
  priority: string;
};

/** GET /api/trips — list item */
export type TripsListItem = {
  id: string;
  number: string;
  status: string;
};

/** GET /api/trips */
export type TripsListResponse = OffsetPage<TripsListItem>;

/** POST /api/trips */
export type TripsCreateResponse = {
  id: string;
  number: string;
  status: string;
};

/** GET /api/trips/unassigned-loads */
export type TripsUnassignedResponse = {
  items: Array<{
    id: string;
    number: string;
    status: string;
  }>;
};

/** GET /api/trips/{id} */
export type TripsGetResponse = {
  id: string;
  number: string;
  status: string;
  stops: unknown[];
};

/** PATCH /api/trips/{id} */
export type TripsUpdateResponse = {
  id: string;
  status: string;
};

/** POST /api/trips/{id}/assign */
export type TripsAssignResponse = {
  id: string;
  status: string;
  driverId: string;
};

/** POST /api/trips/auto-assign */
export type TripsAutoAssignResponse = {
  assigned: Array<{
    tripId: string;
    driverId: string;
  }>;
  skipped: number;
};

/** GET /api/safety/events — list item */
export type SafetyListEventsItem = {
  id: string;
  type: string;
  severity: number;
  status: string;
};

/** GET /api/safety/events */
export type SafetyListEventsResponse = OffsetPage<SafetyListEventsItem>;

/** PATCH /api/safety/events/{id} */
export type SafetyUpdateEventResponse = {
  id: string;
  status: string;
};

/** GET /api/safety/scorecard */
export type SafetyScorecardResponse = {
  items: Array<{
    driverId: string;
    score: number;
    harshCount: number;
    rank: number;
    previousScore: number;
    trend: number;
  }>;
  periodStart: string;
  periodEnd: string;
};

/** POST /api/safety/coaching */
export type SafetyCoachResponse = {
  id: string;
  status: string;
  coachedById: string;
};

/** GET /api/geofences */
export type GeofencesListResponse = {
  items: Array<{
    id: string;
    name: string;
    type: string;
    radiusMi: number;
    alertOnEnter: boolean;
  }>;
};

/** POST /api/geofences */
export type GeofencesCreateResponse = {
  id: string;
  name: string;
  type: string;
  radiusMi: number;
};

/** GET /api/geofences/{id} */
export type GeofencesGetResponse = {
  id: string;
  name: string;
  type: string;
};

/** PATCH /api/geofences/{id} */
export type GeofencesUpdateResponse = {
  id: string;
  enabled: boolean;
};

/** DELETE /api/geofences/{id} */
export type GeofencesRemoveResponse = {
  id: string;
  deleted: boolean;
};

/** GET /api/search */
export type SearchSearchResponse = {
  q: string;
  drivers: Array<{
    id: string;
    name: string;
  }>;
  vehicles: unknown[];
};

/** GET /api/live/fleet */
export type LiveFleetFleetResponse = {
  items: Array<{
    vehicleId: string;
    unitNumber: string;
    driverId: string;
    driverName: string;
    driverPhone: string;
    dutyStatus: string;
    speedMph: number;
    headingDeg: number;
    odometerMi: number;
    lat: number;
    lon: number;
    locationLabel: string;
    lastSeenAt: string;
    driveRemainingSec: number;
    shiftEndsAt: string;
    eldSerial: string;
    bleState: string;
  }>;
  generatedAt: string;
};

/** GET /api/dashboard/summary */
export type DashboardSummaryResponse = {
  liveFleet: {
    items: Array<{
      vehicleId: string;
      unitNumber: string;
      dutyStatus: string;
    }>;
    generatedAt: string;
    counts: {
      total: number;
      onDuty: number;
      moving: number;
      idle: number;
      offline: number;
    };
  };
  violations: {
    items: Array<{
      id: string;
      type: string;
      driverName: string;
      unitNumber: string;
    }>;
    total: number;
  };
  unidentified: {
    total: number;
    totalDurationSec: number;
  };
  notifications: {
    unreadCount: number;
  };
  carrier: {
    id: string;
    name: string;
    timezone: string;
  };
  vehicles: {
    active: number;
    total: number;
  };
  generatedAt: string;
};

/** POST /api/reports/generate */
export type ReportsGenerateResponse = {
  reportId: string;
  status: string;
};

/** GET /api/reports — list item */
export type ReportsListItem = {
  id: string;
  type: string;
  status: string;
  requestedAt: string;
};

/** GET /api/reports */
export type ReportsListResponse = OffsetPage<ReportsListItem>;

/** GET /api/reports/schedules */
export type ReportsListSchedulesResponse = {
  items: Array<{
    id: string;
    reportType: string;
    cron: string;
    enabled: boolean;
    nextRunAt: string;
  }>;
};

/** POST /api/reports/schedules */
export type ReportsCreateScheduleResponse = {
  id: string;
  reportType: string;
  cron: string;
  nextRunAt: string;
};

/** PATCH /api/reports/schedules/{id} */
export type ReportsUpdateScheduleResponse = {
  id: string;
  enabled: boolean;
};

/** GET /api/reports/ifta */
export type ReportsIftaResponse = {
  reportId: string;
  status: string;
};

/** GET /api/reports/ifta/jurisdictions */
export type ReportsIftaJurisdictionsResponse = {
  items: Array<{
    code: string;
    name: string;
    country: string;
  }>;
};

/** GET /api/reports/ifta/summary */
export type ReportsIftaSummaryResponse = {
  quarter: string;
  unitCount: number;
  kpis: {
    totalMiles: number;
    taxableMiles: number;
    taxablePct: number;
    fuelGal: number;
    receiptCount: number;
    fleetMpg: number;
    fleetMpgPrev: number;
  };
  rows: Array<{
    jurisdiction: string;
    totalMiles: number;
    taxableMiles: number;
    fuelGal: number;
    mpg: number;
    taxDueUsd: unknown;
  }>;
  totals: {
    totalMiles: number;
    taxableMiles: number;
    fuelGal: number;
    mpg: number;
    taxDueUsd: unknown;
  };
};

/** GET /api/reports/activity */
export type ReportsActivityResponse = {
  reportId: string;
  status: string;
};

/** GET /api/reports/activity/summary — list item */
export type ReportsActivitySummaryItem = {
  driverId: string;
  name: string;
  days: number;
  offSec: number;
  sbSec: number;
  drivingSec: number;
  onSec: number;
  distanceMi: number;
  violations: number;
  certifiedDays: number;
};

/** GET /api/reports/activity/summary */
export type ReportsActivitySummaryResponse = OffsetPage<ReportsActivitySummaryItem>;

/** GET /api/reports/dvir */
export type ReportsDvirResponse = {
  reportId: string;
  status: string;
};

/** GET /api/reports/fmcsa-pack */
export type ReportsFmcsaPackResponse = {
  reportId: string;
  status: string;
};

/** GET /api/reports/{id} */
export type ReportsGetResponse = {
  id: string;
  type: string;
  status: string;
  rowCount: number;
  completedAt: string;
};

/** GET /api/reports/{id}/download */
export type ReportsDownloadResponse = {
  downloadUrl: string;
  expiresAt: string;
  fileName: string;
};

/** Operation → success payload, keyed by `METHOD /api/path`. */
export interface ApiOperations {
  'GET /health/live': HealthLiveResponse;
  'GET /health/ready': HealthReadyResponse;
  'GET /health/deep': HealthDeepResponse;
  'POST /api/auth/login': AuthLoginResponse;
  'POST /api/auth/login/driver': AuthLoginDriverResponse;
  'POST /api/auth/google': AuthGoogleResponse;
  'POST /api/auth/refresh': AuthRefreshResponse;
  'POST /api/auth/logout': AuthLogoutResponse;
  'POST /api/auth/password/forgot': AuthForgotPasswordResponse;
  'POST /api/auth/password/reset': AuthResetPasswordResponse;
  'POST /api/auth/email/verify': AuthVerifyEmailChangeResponse;
  'GET /api/auth/me': AuthMeResponse;
  'GET /api/carrier': CarrierGetResponse;
  'PATCH /api/carrier': CarrierUpdateResponse;
  'GET /api/carrier/transfer-config': CarrierGetTransferConfigResponse;
  'GET /api/attachments/{id}/presign': AttachmentsPresignResponse;
  'GET /api/roles': RolesListResponse;
  'POST /api/roles': RolesCreateResponse;
  'GET /api/roles/{id}': RolesGetResponse;
  'PATCH /api/roles/{id}': RolesUpdateResponse;
  'DELETE /api/roles/{id}': RolesRemoveResponse;
  'GET /api/users': UsersListResponse;
  'POST /api/users': UsersCreateResponse;
  'GET /api/users/{id}': UsersGetResponse;
  'PATCH /api/users/{id}': UsersUpdateResponse;
  'DELETE /api/users/{id}': UsersRemoveResponse;
  'POST /api/users/{id}/resend-invite': UsersResendInviteResponse;
  'GET /api/me/profile': MeProfileResponse;
  'PATCH /api/me/profile': MeUpdateProfileResponse;
  'GET /api/me/sessions': MeSessionsResponse;
  'DELETE /api/me/sessions': MeRevokeAllSessionsResponse;
  'DELETE /api/me/sessions/{id}': MeRevokeSessionResponse;
  'POST /api/me/avatar': MeUploadAvatarResponse;
  'DELETE /api/me/avatar': MeDeleteAvatarResponse;
  'GET /api/me/preferences': MeGetPreferencesResponse;
  'PUT /api/me/preferences': MeUpdatePreferencesResponse;
  'GET /api/audit-log': AuditListResponse;
  'GET /api/api-keys': ApiKeysListResponse;
  'POST /api/api-keys': ApiKeysCreateResponse;
  'PATCH /api/api-keys/{id}/scopes': ApiKeysUpdateScopesResponse;
  'DELETE /api/api-keys/{id}': ApiKeysRevokeResponse;
  'GET /api/drivers': DriversListResponse;
  'POST /api/drivers': DriversCreateResponse;
  'GET /api/drivers/export': DriversExportResponse;
  'GET /api/drivers/roster': DriversRosterResponse;
  'GET /api/drivers/{id}/hos': DriversHosResponse;
  'GET /api/drivers/{id}': DriversGetResponse;
  'PATCH /api/drivers/{id}': DriversUpdateResponse;
  'DELETE /api/drivers/{id}': DriversRemoveResponse;
  'POST /api/drivers/import': DriversImportResponse;
  'POST /api/drivers/{id}/reset-password': DriversResetPasswordResponse;
  'POST /api/drivers/{id}/send-verification': DriversSendVerificationResponse;
  'POST /api/drivers/{id}/verify-email': DriversVerifyEmailResponse;
  'GET /api/drivers/{id}/documents': DriversListDocumentsResponse;
  'POST /api/drivers/{id}/documents': DriversCreateDocumentResponse;
  'DELETE /api/drivers/{id}/documents/{docId}': DriversRemoveDocumentResponse;
  'GET /api/transfers': TransfersListResponse;
  'POST /api/transfers': TransfersCreateResponse;
  'GET /api/transfers/{id}': TransfersGetResponse;
  'GET /api/mobile/transfers': MobileTransfersListResponse;
  'POST /api/mobile/transfers': MobileTransfersCreateResponse;
  'GET /api/vehicles': VehiclesListResponse;
  'POST /api/vehicles': VehiclesCreateResponse;
  'GET /api/vehicles/export': VehiclesExportResponse;
  'GET /api/vehicles/{id}': VehiclesGetResponse;
  'PATCH /api/vehicles/{id}': VehiclesUpdateResponse;
  'DELETE /api/vehicles/{id}': VehiclesRemoveResponse;
  'GET /api/vehicles/{id}/activities': VehiclesActivitiesResponse;
  'GET /api/vehicles/{id}/histories': VehiclesHistoriesResponse;
  'GET /api/vehicles/{id}/telemetry': VehiclesTelemetryResponse;
  'POST /api/vehicles/import': VehiclesImportResponse;
  'PATCH /api/vehicles/bulk-status': VehiclesBulkUpdateStatusResponse;
  'POST /api/vehicles/{id}/calibrate-odometer': VehiclesCalibrateOdometerResponse;
  'POST /api/vehicles/{id}/assign-driver': VehiclesAssignDriverResponse;
  'POST /api/vehicles/{id}/unassign-driver': VehiclesUnassignDriverResponse;
  'GET /api/trailers': TrailersListResponse;
  'POST /api/trailers': TrailersCreateResponse;
  'GET /api/trailers/export': TrailersExportResponse;
  'GET /api/trailers/{id}': TrailersGetResponse;
  'PATCH /api/trailers/{id}': TrailersUpdateResponse;
  'DELETE /api/trailers/{id}': TrailersRemoveResponse;
  'POST /api/trailers/import': TrailersImportResponse;
  'GET /api/vehicle-groups': VehicleGroupsListResponse;
  'POST /api/vehicle-groups': VehicleGroupsCreateResponse;
  'GET /api/vehicle-groups/{id}': VehicleGroupsGetResponse;
  'PATCH /api/vehicle-groups/{id}': VehicleGroupsUpdateResponse;
  'DELETE /api/vehicle-groups/{id}': VehicleGroupsRemoveResponse;
  'PUT /api/vehicle-groups/{id}/vehicles': VehicleGroupsSetMembersResponse;
  'GET /api/alert-rules': AlertRulesListResponse;
  'POST /api/alert-rules': AlertRulesCreateResponse;
  'GET /api/alert-rules/{id}': AlertRulesGetResponse;
  'PATCH /api/alert-rules/{id}': AlertRulesUpdateResponse;
  'DELETE /api/alert-rules/{id}': AlertRulesRemoveResponse;
  'POST /api/alert-rules/{id}/test': AlertRulesTestResponse;
  'GET /api/notifications': NotificationsListResponse;
  'POST /api/notifications/read-all': NotificationsReadAllResponse;
  'POST /api/notifications/{id}/read': NotificationsMarkReadResponse;
  'GET /api/notification-channels': NotificationChannelsGetResponse;
  'PATCH /api/notification-channels': NotificationChannelsUpdateResponse;
  'POST /api/integrations/webhook/test': WebhooksSendTestResponse;
  'GET /api/integrations': IntegrationsListResponse;
  'GET /api/integrations/catalog': IntegrationsCatalogResponse;
  'GET /api/integrations/{provider}': IntegrationsGetResponse;
  'PUT /api/integrations/{provider}': IntegrationsUpsertResponse;
  'DELETE /api/integrations/{provider}': IntegrationsDisconnectResponse;
  'GET /api/mobile/bootstrap': MobileBootstrapGetResponse;
  'POST /api/mobile/sync': MobileSyncSyncResponse;
  'POST /api/mobile/duty-status': MobileDutyStatusChangeResponse;
  'POST /api/mobile/signature': MobileDvirUploadSignatureResponse;
  'POST /api/mobile/dvir': MobileDvirSubmitResponse;
  'GET /api/mobile/available-vehicles': MobileVehicleListResponse;
  'POST /api/mobile/select-vehicle': MobileVehicleSelectResponse;
  'POST /api/mobile/co-driver/switch': MobileCoDriverSwitchResponse;
  'POST /api/mobile/co-driver/leave': MobileCoDriverLeaveResponse;
  'GET /api/mobile/trip': MobileTripGetResponse;
  'PATCH /api/mobile/trip': MobileTripPatchResponse;
  'GET /api/mobile/dvirs': MobileDvirHistoryListResponse;
  'GET /api/mobile/dvirs/{id}': MobileDvirHistoryGetResponse;
  'GET /api/mobile/contacts': MobileContactsListResponse;
  'POST /api/mobile/push-tokens': PushTokensRegisterResponse;
  'DELETE /api/mobile/push-tokens/{token}': PushTokensRemoveResponse;
  'GET /api/mobile/device-health': DeviceHealthGetResponse;
  'GET /api/mobile/conversations': MobileMessagingListConversationsResponse;
  'GET /api/mobile/conversations/{id}/messages': MobileMessagingListMessagesResponse;
  'POST /api/mobile/conversations/{id}/messages': MobileMessagingSendMessageResponse;
  'POST /api/mobile/conversations/{id}/read': MobileMessagingMarkReadResponse;
  'POST /api/logs/edit-requests/{id}/accept': LogsAcceptResponse;
  'POST /api/logs/edit-requests/{id}/reject': LogsRejectResponse;
  'GET /api/logs/{driverId}': LogsGetDayResponse;
  'GET /api/logs/{driverId}/range': LogsGetRangeResponse;
  'GET /api/logs/{driverId}/events': LogsGetEventsResponse;
  'POST /api/logs/{driverId}/events': LogsProposeEventResponse;
  'GET /api/logs/{driverId}/edit-requests': LogsListEditRequestsResponse;
  'POST /api/logs/{driverId}/edit-requests': LogsCreateEditRequestResponse;
  'POST /api/logs/{driverId}/certify': LogsCertifyResponse;
  'POST /api/mobile/log-entries': MobileLogsCreateEntryResponse;
  'POST /api/mobile/certify': MobileLogsCertifyResponse;
  'GET /api/mobile/log-edit-requests': MobileLogsListEditRequestsResponse;
  'GET /api/mobile/logs': MobileLogsGetDayResponse;
  'POST /api/ingest/events': IngestEventsResponse;
  'POST /api/ingest/telemetry': IngestTelemetryResponse;
  'POST /api/ingest/ble-state': IngestBleStateResponse;
  'POST /api/ingest/device-status': IngestDeviceStatusResponse;
  'GET /api/vehicles/{id}/dtc': DtcListResponse;
  'GET /api/conversations': MessagingListConversationsResponse;
  'POST /api/conversations': MessagingCreateConversationResponse;
  'GET /api/conversations/{id}/messages': MessagingListMessagesResponse;
  'POST /api/conversations/{id}/messages': MessagingSendMessageResponse;
  'POST /api/conversations/{id}/read': MessagingMarkReadResponse;
  'POST /api/messages/broadcast': MessagingBroadcastResponse;
  'GET /api/devices': DevicesListResponse;
  'POST /api/devices': DevicesCreateResponse;
  'GET /api/devices/export': DevicesExportResponse;
  'GET /api/devices/{id}': DevicesGetResponse;
  'PATCH /api/devices/{id}': DevicesUpdateResponse;
  'DELETE /api/devices/{id}': DevicesRemoveResponse;
  'GET /api/devices/{id}/diagnostics': DevicesDiagnosticsResponse;
  'POST /api/devices/import': DevicesImportResponse;
  'PATCH /api/devices/{id}/firmware': DevicesUpdateFirmwareResponse;
  'PATCH /api/devices/{id}/ble-status': DevicesUpdateBleStatusResponse;
  'POST /api/devices/{id}/pair': DevicesPairResponse;
  'POST /api/devices/{id}/unpair': DevicesUnpairResponse;
  'GET /api/co-driver-pairings': CoDriverPairingsListResponse;
  'POST /api/co-driver-pairings': CoDriverPairingsCreateResponse;
  'POST /api/co-driver-pairings/{id}/end': CoDriverPairingsEndResponse;
  'POST /api/unidentified/{id}/confirm': UnidentifiedConfirmResponse;
  'GET /api/unidentified/confirmation-requests': UnidentifiedListConfirmationRequestsResponse;
  'GET /api/unidentified': UnidentifiedListResponse;
  'GET /api/unidentified/{id}': UnidentifiedGetResponse;
  'POST /api/unidentified/{id}/assign': UnidentifiedAssignResponse;
  'POST /api/unidentified/{id}/annotate': UnidentifiedAnnotateResponse;
  'POST /api/unidentified/{id}/reject': UnidentifiedRejectResponse;
  'GET /api/violations': ViolationsListResponse;
  'POST /api/violations/{id}/resolve': ViolationsResolveResponse;
  'POST /api/mobile/hos-state': HosStateHosStateSubmitResponse;
  'GET /api/dvir': DvirAdminListResponse;
  'GET /api/dvir/compliance': DvirAdminComplianceResponse;
  'GET /api/dvir/{id}': DvirAdminGetResponse;
  'POST /api/dvir/{id}/mechanic-signoff': DvirAdminMechanicSignOffResponse;
  'PATCH /api/dvir/{id}/next-driver-review': DvirAdminNextDriverReviewResponse;
  'GET /api/defects': DefectsListResponse;
  'GET /api/defects/{id}': DefectsGetResponse;
  'PATCH /api/defects/{id}/resolve': DefectsResolveResponse;
  'PATCH /api/defects/{id}/assign': DefectsAssignResponse;
  'PATCH /api/defects/{id}/work-order': DefectsLinkWorkOrderResponse;
  'GET /api/work-orders': WorkOrdersListResponse;
  'POST /api/work-orders': WorkOrdersCreateResponse;
  'GET /api/work-orders/{id}': WorkOrdersGetResponse;
  'PATCH /api/work-orders/{id}': WorkOrdersUpdateResponse;
  'POST /api/work-orders/{id}/close': WorkOrdersCloseResponse;
  'POST /api/work-orders/{id}/cancel': WorkOrdersCancelResponse;
  'POST /api/work-orders/{id}/defects/{defectId}': WorkOrdersAttachDefectResponse;
  'GET /api/maintenance-schedules': MaintenanceSchedulesListResponse;
  'POST /api/maintenance-schedules': MaintenanceSchedulesCreateResponse;
  'GET /api/maintenance-schedules/{id}': MaintenanceSchedulesGetResponse;
  'PATCH /api/maintenance-schedules/{id}': MaintenanceSchedulesUpdateResponse;
  'DELETE /api/maintenance-schedules/{id}': MaintenanceSchedulesRemoveResponse;
  'POST /api/maintenance-schedules/{id}/complete': MaintenanceSchedulesCompleteResponse;
  'GET /api/support/tickets': SupportListResponse;
  'POST /api/support/tickets': SupportCreateResponse;
  'GET /api/support/tickets/{id}': SupportGetResponse;
  'PATCH /api/support/tickets/{id}': SupportUpdateResponse;
  'POST /api/support/chats': SupportCreateChatResponse;
  'POST /api/feedback': SupportCreateFeedbackResponse;
  'POST /api/mobile/feedback': MobileSupportCreateFeedbackResponse;
  'GET /api/mobile/support/tickets': MobileSupportListOwnTicketsResponse;
  'POST /api/mobile/support/tickets': MobileSupportCreateTicketResponse;
  'GET /api/trips': TripsListResponse;
  'POST /api/trips': TripsCreateResponse;
  'GET /api/trips/unassigned-loads': TripsUnassignedResponse;
  'GET /api/trips/{id}': TripsGetResponse;
  'PATCH /api/trips/{id}': TripsUpdateResponse;
  'POST /api/trips/{id}/assign': TripsAssignResponse;
  'POST /api/trips/auto-assign': TripsAutoAssignResponse;
  'GET /api/safety/events': SafetyListEventsResponse;
  'PATCH /api/safety/events/{id}': SafetyUpdateEventResponse;
  'GET /api/safety/scorecard': SafetyScorecardResponse;
  'POST /api/safety/coaching': SafetyCoachResponse;
  'GET /api/geofences': GeofencesListResponse;
  'POST /api/geofences': GeofencesCreateResponse;
  'GET /api/geofences/{id}': GeofencesGetResponse;
  'PATCH /api/geofences/{id}': GeofencesUpdateResponse;
  'DELETE /api/geofences/{id}': GeofencesRemoveResponse;
  'GET /api/search': SearchSearchResponse;
  'GET /api/live/fleet': LiveFleetFleetResponse;
  'GET /api/dashboard/summary': DashboardSummaryResponse;
  'POST /api/reports/generate': ReportsGenerateResponse;
  'GET /api/reports': ReportsListResponse;
  'GET /api/reports/schedules': ReportsListSchedulesResponse;
  'POST /api/reports/schedules': ReportsCreateScheduleResponse;
  'PATCH /api/reports/schedules/{id}': ReportsUpdateScheduleResponse;
  'GET /api/reports/ifta': ReportsIftaResponse;
  'GET /api/reports/ifta/jurisdictions': ReportsIftaJurisdictionsResponse;
  'GET /api/reports/ifta/summary': ReportsIftaSummaryResponse;
  'GET /api/reports/activity': ReportsActivityResponse;
  'GET /api/reports/activity/summary': ReportsActivitySummaryResponse;
  'GET /api/reports/dvir': ReportsDvirResponse;
  'GET /api/reports/fmcsa-pack': ReportsFmcsaPackResponse;
  'GET /api/reports/{id}': ReportsGetResponse;
  'GET /api/reports/{id}/download': ReportsDownloadResponse;
}
