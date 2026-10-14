// GENERATED FILE — do not edit by hand.
// Source: backend/docs/openapi.json (222 paths, 276 typed operations).
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
  data: {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    driverId: string;
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/auth/google */
export type AuthGoogleResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
};

/** POST /api/auth/refresh */
export type AuthRefreshResponse = {
  data: {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
  };
  traceId: string;
  timestamp: string;
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

/** POST /api/auth/password/reset-code */
export type AuthRequestPasswordResetCodeResponse = {
  data: {
    success: boolean;
    email: string;
    expiresInSec: number;
    resendAfterSec: number;
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/auth/password/reset-code/confirm */
export type AuthConfirmPasswordResetCodeResponse = {
  data: {
    success: boolean;
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/auth/driver/password/forgot */
export type AuthForgotDriverPasswordResponse = {
  success: boolean;
};

/** POST /api/auth/driver/password/reset */
export type AuthResetDriverPasswordResponse = {
  success: boolean;
};

/** GET /api/auth/me */
export type AuthMeResponse = {
  data: {
    id: string;
    type: string;
    username: string;
    fullName: string;
    email: string;
    homeTerminalTimezone: string;
  };
  traceId: string;
  timestamp: string;
};

/** GET /api/carrier */
export type CarrierGetResponse = {
  id: string;
  name: string;
  dotNumber: string;
  eldIdentifier: string;
  erodsMode: string;
  virtualEldEnabled: boolean;
  virtualEldAvailable: boolean;
  virtualEldUpdatedAt: unknown;
  virtualEldUpdatedById: unknown;
  virtualEldUpdatedBy: unknown;
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
  virtualEldEnabled: boolean;
  virtualEldAvailable: boolean;
  virtualEldUpdatedAt: string;
  virtualEldUpdatedById: string;
  virtualEldUpdatedBy: {
    id: string;
    name: string;
  };
};

/** GET /api/carrier/transfer-config */
export type CarrierGetTransferConfigResponse = {
  timezone: string;
  eldIdentifier: string;
  eldRegistrationId: unknown;
  erodsMode: string;
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
  userCount: number;
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
  emailDelivered: boolean;
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
  email: string;
  pendingEmail: string;
  role: {
    key: string;
    name: string;
  };
  emailVerification: {
    pendingEmail: string;
    emailDelivered: boolean;
  };
};

/** DELETE /api/users/{id} */
export type UsersRemoveResponse = {
  success: boolean;
};

/** POST /api/users/{id}/resend-invite */
export type UsersResendInviteResponse = {
  emailDelivered: boolean;
};

/** POST /api/users/{id}/email-change/resend */
export type UsersResendEmailChangeResponse = {
  pendingEmail: string;
  emailedTo: string;
  emailDelivered: boolean;
};

/** DELETE /api/users/{id}/email-change */
export type UsersCancelEmailChangeResponse = {
  id: string;
  email: string;
  pendingEmail: unknown;
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

/** POST /api/auth/email/verify */
export type UserEmailVerifyResponse = {
  success: boolean;
  email: string;
  alreadyVerified: boolean;
};

/** POST /api/auth/email/cancel */
export type UserEmailCancelResponse = {
  success: boolean;
  result: string;
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
    hosRuleset: string;
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
  isStale: boolean;
  staleSince: unknown;
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
  isStale: boolean;
  staleSince: unknown;
  hosRuleset: string;
};

/** POST /api/drivers/{id}/hos/adverse-driving */
export type DriversInvokeAdverseDrivingResponse = {
  id: string;
  driverId: string;
  date: string;
  annotation: string;
  invokedById: string;
  invokedByType: string;
  createdAt: string;
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
  email: string;
  pendingEmail: string;
  emailVerification: {
    pendingEmail: string;
    emailDelivered: boolean;
  };
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

/** POST /api/drivers/{id}/email-change/resend */
export type DriversResendEmailChangeResponse = {
  pendingEmail: string;
  emailedTo: string;
  emailDelivered: boolean;
};

/** DELETE /api/drivers/{id}/email-change */
export type DriversCancelEmailChangeResponse = {
  id: string;
  email: string;
  pendingEmail: unknown;
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

/** POST /api/auth/driver/email/confirm */
export type DriverEmailConfirmResponse = {
  success: boolean;
  email: string;
};

/** POST /api/auth/driver/email/verify */
export type DriverEmailVerifyResponse = {
  success: boolean;
  email: string;
  alreadyVerified: boolean;
};

/** POST /api/auth/driver/email/cancel */
export type DriverEmailCancelResponse = {
  success: boolean;
  result: string;
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

/** GET /api/trailers — list item */
export type TrailersListItem = {
  id: string;
  number: string;
  vin: string;
  status: string;
  deletedAt: unknown;
};

/** GET /api/trailers */
export type TrailersListResponse = OffsetPage<TrailersListItem>;

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
  vin: string;
  status: string;
  deletedAt: unknown;
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
  channels: Array<{
    channel: string;
    status: string;
  }>;
};

/** GET /api/notifications */
export type NotificationsListResponse = {
  data: {
    items: Array<{
      id: string;
      userId: string;
      driverId: unknown;
      type: string;
      kind: string;
      title: string;
      body: string;
      objectType: string;
      objectId: string;
      category: string;
      severity: string;
      readAt: unknown;
      createdAt: string;
    }>;
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    counts: {
      all: number;
      violations: number;
      maintenance: number;
    };
    unreadCount: number;
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/notifications/read-all */
export type NotificationsReadAllResponse = {
  data: {
    updated: number;
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/notifications/{id}/read */
export type NotificationsMarkReadResponse = {
  data: {
    id: string;
    readAt: string;
  };
  traceId: string;
  timestamp: string;
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

/** GET /api/mobile/app-config */
export type MobileAppConfigAppConfigResponse = {
  data: {
    minSupportedVersion: string;
    latestVersion: string;
    storeUrl: string;
    userManualUrl: unknown;
    privacyPolicyUrl: string;
    termsUrl: unknown;
    minPt30Firmware: unknown;
    recommendedPt30Firmware: unknown;
    updateRequired: boolean;
    updateAvailable: boolean;
    virtualEld: {
      enabled: boolean;
    };
  };
  traceId: string;
  timestamp: string;
};

/** GET /api/mobile/legal/{kind} */
export type MobileAppConfigLegalResponse = {
  data: {
    version: string;
    url: string;
    html: unknown;
  };
  traceId: string;
  timestamp: string;
};

/** GET /api/mobile/bootstrap */
export type MobileBootstrapGetResponse = {
  data: {
    serverTime: string;
    hosEngineVersion: string;
    driver: {
      id: string;
      username: string;
      firstName: string;
      lastName: string;
      cdlNumber: string;
      cdlState: string;
      email: string;
      phone: string;
      exemptDriverStatus: boolean;
      status: string;
      homeTerminalName: string;
      homeTerminalTimezone: string;
      hosRuleset: string;
      exceptions: {
        allowPersonalConveyance: boolean;
        allowYardMove: boolean;
        adverseDrivingEnabled: boolean;
        shortHaulException: boolean;
        splitSleeperEnabled: boolean;
        eldExempt: boolean;
        eldExemptReason: unknown;
      };
      lastSyncAt: string;
    };
    vehicle: {
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
    device: {
      id: string;
      serial: string;
      model: string;
      firmware: string;
      status: string;
      bleState: string;
      bleMacAddress: string;
      pairedAt: string;
      periodicConnectedSec: number;
      periodicDisconnectedMin: number;
    };
    coDriver: unknown;
    availableVehicles: Array<{
      id: string;
      unitNumber: string;
      make: string;
      model: string;
      deviceSerial: unknown;
    }>;
    carrier: {
      name: string;
      dotNumber: string;
      timezone: string;
      hosRuleset: string;
      distanceUnit: string;
      allowPersonalConveyance: boolean;
      allowYardMove: boolean;
      eldIdentifier: string;
      mainOfficeAddress: string;
      eldProvider: string;
      eldRegistrationId: string;
      erodsMode: string;
    };
    hos: {
      computedAt: string;
      timezone: string;
      state: {
        currentStatus: string;
        driveRemainingSec: number;
        shiftRemainingSec: number;
        breakRemainingSec: number;
        cycleRemainingSec: number;
        dailyTotals: {
          off: number;
          sb: number;
          drive: number;
          on: number;
        };
        violations: unknown[];
        statusSince: string;
        nextBreakDueAt: unknown;
        shiftEndsAt: string;
        cycleRecapAt: unknown;
        restartAvailableAt: unknown;
      };
    };
    inspectionPacket: {
      driverId: string;
      timezone: string;
      generatedAt: string;
      days: unknown[];
    };
    syncConfig: {
      batchMaxChanges: number;
      batchMaxBytes: number;
      onlineIntervalSec: number;
      onlineBatchThreshold: number;
      offlineBackoffSec: number[];
      localEventRetentionDays: number;
      localInspectionRetentionDays: number;
      syncBacklogWarnDays: number;
      syncBacklogWarnBytes: number;
    };
    appUpdate: unknown;
    pendingEditRequestCount: number;
    pendingUnidentifiedCount: number;
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/mobile/sync */
export type MobileSyncSyncResponse = {
  data: {
    accepted: string[];
    rejected: Array<{
      clientId: string;
      code: string;
      message: string;
    }>;
    serverChanges: Array<{
      id: string;
      eventType: number;
      eventCode: number;
      eventDateTime: string;
      recordStatus: number;
      recordOrigin: number;
      annotation: unknown;
      supersedesId: unknown;
    }>;
    serverTime: string;
    hosEngineVersion: string;
    nextSyncAfterSec: number;
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/mobile/duty-status */
export type MobileDutyStatusChangeResponse = {
  data: {
    id: string;
    driverId: string;
    status: string;
    specialCondition: string;
    locationName: string;
    startAt: string;
    endAt: unknown;
    recordOrigin: number;
    recordStatus: number;
    applied: boolean;
    recertificationRequired: boolean;
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/mobile/signature */
export type MobileDvirUploadSignatureResponse = {
  data: {
    signatureImageId: string;
    attachmentId: string;
    key: string;
    sha256: string;
    sizeBytes: number;
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/mobile/dvir */
export type MobileDvirSubmitResponse = {
  data: {
    id: string;
    driverId: string;
    vehicleId: string;
    trailerId: unknown;
    trailerNumber: string;
    type: string;
    submittedAt: string;
    vehicleCondition: string;
    defectCount: number;
    photoCount: number;
    outOfService: boolean;
    signatureImageId: string;
    mechanicSignatureImageId: unknown;
    applied: boolean;
  };
  traceId: string;
  timestamp: string;
};

/** GET /api/mobile/available-vehicles */
export type MobileVehicleListResponse = {
  data: Array<{
    id: string;
    unitNumber: string;
    make: string;
    model: string;
    deviceSerial: string;
  }>;
  traceId: string;
  timestamp: string;
};

/** POST /api/mobile/release-vehicle */
export type MobileVehicleReleaseResponse = {
  data: {
    released: boolean;
    vehicleId: string;
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/mobile/select-vehicle */
export type MobileVehicleSelectResponse = {
  data: {
    id: string;
    unitNumber: string;
    vin: string;
    make: string;
    model: string;
    year: number;
    sleeperBerth: boolean;
    status: string;
    odometerMi: number;
    device: {
      id: string;
      serial: string;
      model: string;
    };
  };
  traceId: string;
  timestamp: string;
};

/** GET /api/mobile/co-driver */
export type MobileCoDriverCurrentResponse = {
  data: {
    pairingId: string;
    startedAt: string;
    coDriver: {
      id: string;
      firstName: string;
      lastName: string;
      username: string;
    };
    trip: {
      shippingDocuments: string[];
      trailerNumbers: string[];
    };
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/mobile/co-driver/switch */
export type MobileCoDriverSwitchResponse = {
  data: {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/mobile/co-driver/leave */
export type MobileCoDriverLeaveResponse = {
  data: {
    ended: boolean;
  };
  traceId: string;
  timestamp: string;
};

/** GET /api/mobile/trip */
export type MobileTripGetResponse = {
  data: {
    source: string;
    id: unknown;
    trip: unknown;
    logDate: string;
    shippingDocument: string;
    shippingDocuments: string[];
    trailerId: unknown;
    trailerNumber: string;
    trailerNumbers: string[];
    bobtail: boolean;
    notes: unknown;
    updatedAt: string;
    stops: unknown[];
    documents: unknown[];
  };
  traceId: string;
  timestamp: string;
};

/** PATCH /api/mobile/trip */
export type MobileTripPatchResponse = {
  data: {
    source: string;
    id: string;
    number: string;
    status: string;
    vehicleId: string;
    trailerId: string;
    shippingDocument: string;
    shippingDocuments: string[];
    trailerNumber: string;
    trailerNumbers: string[];
    bobtail: boolean;
    commodity: string;
    weightLbs: number;
    pieces: number;
    plannedStartAt: string;
    plannedEndAt: string;
    startedAt: string;
    completedAt: unknown;
    etaAt: string;
    onTime: boolean;
    notes: string;
    stops: Array<{
      id: string;
      sequence: number;
      type: string;
      name: string;
      address: string;
      latitude: number;
      longitude: number;
      scheduledAt: string;
      arrivedAt: string;
      departedAt: unknown;
      status: string;
      note: unknown;
    }>;
    documents: Array<{
      tripId: string;
      number: string;
      shippingDocument: string;
      commodity: string;
      pieces: number;
      weightLbs: number;
    }>;
  };
  traceId: string;
  timestamp: string;
};

/** GET /api/mobile/trailers */
export type MobileTrailersListResponse = {
  data: Array<{
    id: string;
    number: string;
    plate: unknown;
  }>;
  traceId: string;
  timestamp: string;
};

/** GET /api/mobile/dvirs */
export type MobileDvirHistoryListResponse = {
  data: Array<{
    id: string;
    vehicleId: string;
    type: string;
    submittedAt: string;
    vehicleCondition: string;
    defectCount: number;
    repairStatus: string;
    trailerNumber: string;
    odometerMi: number;
    location: {
      lat: number;
      lon: number;
      name: string;
    };
  }>;
  traceId: string;
  timestamp: string;
};

/** GET /api/mobile/dvirs/{id} */
export type MobileDvirHistoryGetResponse = {
  data: {
    id: string;
    driverId: string;
    vehicleId: string;
    trailerId: unknown;
    type: string;
    submittedAt: string;
    odometerMi: number;
    location: {
      lat: number;
      lon: number;
      name: string;
    };
    trailerNumber: string;
    vehicleCondition: string;
    notes: unknown;
    repairStatus: string;
    driverSignature: {
      key: string;
      url: string;
      hash: string;
    };
    mechanicSignature: unknown;
    nextDriverReviewedAt: unknown;
    defects: Array<{
      id: string;
      part: string;
      category: string;
      severity: string;
      description: string;
      status: string;
      outOfService: boolean;
      resolvedAt: unknown;
      resolutionNote: unknown;
      photos: Array<{
        id: string;
        url: string;
        mimeType: string;
        sizeBytes: number;
      }>;
    }>;
    photos: unknown[];
  };
  traceId: string;
  timestamp: string;
};

/** GET /api/mobile/defect-catalog */
export type MobileCatalogDefectCatalogResponse = {
  data: Array<{
    code: string;
    name: string;
    part: string;
    category: string;
    critical: boolean;
    isPhoto: boolean;
  }>;
  traceId: string;
  timestamp: string;
};

/** GET /api/mobile/saved-signature */
export type MobileCatalogGetResponse = {
  data: {
    signatureImageId: string;
    key: string;
    url: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    updatedAt: string;
  };
  traceId: string;
  timestamp: string;
};

/** PUT /api/mobile/saved-signature */
export type MobileCatalogPutResponse = {
  data: {
    signatureImageId: string;
    key: string;
    url: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    updatedAt: string;
  };
  traceId: string;
  timestamp: string;
};

/** DELETE /api/mobile/saved-signature */
export type MobileCatalogRemoveResponse = {
  data: {
    deleted: boolean;
  };
  traceId: string;
  timestamp: string;
};

/** GET /api/mobile/contacts */
export type MobileContactsListResponse = {
  data: Array<{
    id: string;
    name: string;
    role: string;
    phone: string;
  }>;
  traceId: string;
  timestamp: string;
};

/** POST /api/mobile/push-tokens */
export type PushTokensRegisterResponse = {
  data: {
    id: string;
    driverId: string;
    token: string;
    platform: string;
    deviceLabel: string;
    lastSeenAt: string;
    createdAt: string;
  };
  traceId: string;
  timestamp: string;
};

/** DELETE /api/mobile/push-tokens/{token} */
export type PushTokensRemoveResponse = {
  data: {
    deleted: boolean;
  };
  traceId: string;
  timestamp: string;
};

/** GET /api/mobile/device-health */
export type DeviceHealthGetResponse = {
  data: {
    vehicleId: string;
    device: {
      id: string;
      serial: string;
      firmware: string;
      bleState: string;
      storedEventsCount: number;
      lastDeviceStatusAt: string;
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
      lastComparedAt: string;
      maxDriftSec: number;
      driftAlerted: boolean;
    };
  };
  traceId: string;
  timestamp: string;
};

/** GET /api/mobile/conversations */
export type MobileMessagingListConversationsResponse = {
  data: {
    items: Array<{
      id: string;
      type: string;
      title: string;
      lastMessageAt: string;
      lastMessage: {
        id: string;
        conversationId: string;
        senderUserId: string;
        senderDriverId: unknown;
        body: string;
        attachmentId: unknown;
        clientId: unknown;
        sentAt: string;
        deliveredAt: unknown;
        readAt: unknown;
        senderId: string;
        senderType: string;
        senderName: string;
      };
      unreadCount: number;
      participants: Array<{
        id: string;
        type: string;
        name: string;
      }>;
    }>;
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/mobile/conversations */
export type MobileMessagingStartConversationResponse = {
  data: {
    conversationId: string;
    message: {
      id: string;
      body: string;
      sentAt: string;
      senderId: string;
      senderType: string;
      clientId: string;
    };
  };
  traceId: string;
  timestamp: string;
};

/** GET /api/mobile/conversations/{id}/messages */
export type MobileMessagingListMessagesResponse = {
  data: {
    items: Array<{
      id: string;
      conversationId: string;
      senderUserId: string;
      senderDriverId: unknown;
      body: string;
      attachmentId: unknown;
      clientId: unknown;
      sentAt: string;
      deliveredAt: unknown;
      readAt: unknown;
      senderId: string;
      senderType: string;
      senderName: string;
    }>;
    limit: number;
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/mobile/conversations/{id}/messages */
export type MobileMessagingSendMessageResponse = {
  data: {
    id: string;
    conversationId: string;
    senderUserId: unknown;
    senderDriverId: string;
    body: string;
    attachmentId: unknown;
    clientId: string;
    sentAt: string;
    deliveredAt: unknown;
    readAt: unknown;
    senderId: string;
    senderType: string;
    senderName: string;
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/mobile/conversations/{id}/read */
export type MobileMessagingMarkReadResponse = {
  data: {
    messagesMarked: number;
  };
  traceId: string;
  timestamp: string;
};

/** GET /api/mobile/attachments/{id}/presign */
export type MobileAttachmentsPresignResponse = {
  data: {
    url: string;
    expiresAt: string;
  };
  traceId: string;
  timestamp: string;
};

/** GET /api/mobile/maintenance */
export type MobileMaintenanceListResponse = {
  data: Array<{
    id: string;
    scheduleType: string;
    scheduleName: string;
    frequencyMi: number;
    remainingMi: number;
    status: string;
    at: string;
  }>;
  traceId: string;
  timestamp: string;
};

/** GET /api/mobile/maintenance/{id} */
export type MobileMaintenanceGetResponse = {
  data: {
    id: string;
    scheduleType: string;
    scheduleName: string;
    frequencyMi: number;
    remainingMi: number;
    status: string;
    at: string;
    invoiceNumber: string;
    vendorName: string;
    cost: number;
    notes: string;
    invoiceAttachment: {
      id: string;
      fileName: string;
      mimeType: string;
    };
    submittedAt: string;
    reviewNote: string;
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/mobile/maintenance/{id}/submit */
export type MobileMaintenanceSubmitResponse = {
  data: {
    id: string;
    scheduleType: string;
    scheduleName: string;
    frequencyMi: number;
    remainingMi: number;
    status: string;
    at: string;
    invoiceNumber: string;
    vendorName: string;
    cost: number;
    notes: string;
    invoiceAttachment: {
      id: string;
      fileName: string;
      mimeType: string;
    };
    submittedAt: string;
    reviewNote: unknown;
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/mobile/device/mac */
export type MobileDeviceReportMacResponse = {
  data: {
    deviceId: string;
    macAddress: string;
    outcome: string;
  };
  traceId: string;
  timestamp: string;
};

/** GET /api/mobile/device-config */
export type MobileDeviceConfigConfigResponse = {
  data: {
    serial: string;
    model: string;
    systemVars: {
      PERIODIC_EVENT_GAP: number;
      PERIODIC_EVENT_GAP_NOBLE: number;
      EVENTS_STORED: number;
      DRIVING_ACCL: number;
      DRIVING_BRAKING: number;
      DRIVING_CORNERING: number;
      HSI_MODE: number;
    };
    autoFirmware: boolean;
    shareDiagnostics: boolean;
    configVersion: string;
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/mobile/virtual-devices */
export type MobileVirtualDeviceRegisterResponse = {
  data: {
    id: string;
    serial: string;
    model: string;
    isVirtual: boolean;
    firmware: string;
    vehicleId: string;
    status: string;
    bleState: string;
    bleMacAddress: unknown;
    reportedVin: string;
    pairedAt: string;
    createdAt: string;
    firmwareOutdated: boolean;
    systemVars: {
      PERIODIC_EVENT_GAP: number;
      PERIODIC_EVENT_GAP_NOBLE: number;
      EVENTS_STORED: number;
      DRIVING_ACCL: number;
      DRIVING_BRAKING: number;
      DRIVING_CORNERING: number;
      HSI_MODE: number;
    };
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/logs/edit-requests/{id}/accept */
export type LogsAcceptResponse = {
  data: {
    id: string;
    status: string;
    applied: boolean;
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/logs/edit-requests/{id}/reject */
export type LogsRejectResponse = {
  data: {
    id: string;
    status: string;
    applied: boolean;
  };
  traceId: string;
  timestamp: string;
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
  data: {
    id: string;
    driverId: string;
    status: string;
    specialCondition: string;
    locationName: string;
    startAt: string;
    endAt: unknown;
    recordOrigin: number;
    recordStatus: number;
    applied: boolean;
    recertificationRequired: boolean;
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/mobile/certify */
export type MobileLogsCertifyResponse = {
  data: {
    driverId: string;
    days: Array<{
      date: string;
      certified: boolean;
      certificationCount: number;
      eventCode: number;
      certifiedAt: string;
      certifierType: string;
    }>;
  };
  traceId: string;
  timestamp: string;
};

/** GET /api/mobile/log-edit-requests */
export type MobileLogsListEditRequestsResponse = {
  data: {
    driverId: string;
    items: Array<{
      id: string;
      driverId: string;
      status: string;
      kind: string;
      originalEventId: string;
      proposedStatus: string;
      proposedSpecial: string;
      proposedStart: string;
      proposedEnd: string;
      locationName: string;
      annotation: string;
      requestedById: string;
      requestedAt: string;
      resolvedAt: unknown;
      date: string;
      original: {
        status: string;
        start: string;
        end: string;
        location: string;
      };
      proposedGraph: Array<{
        status: string;
        effective: string;
        special: string;
        startAt: string;
        endAt: string;
        durationSec: number;
      }>;
      requestedBy: {
        id: string;
        name: string;
      };
    }>;
  };
  traceId: string;
  timestamp: string;
};

/** GET /api/mobile/certification-status */
export type MobileLogsCertificationStatusResponse = {
  data: Array<{
    date: string;
    certified: boolean;
    certifiedAt: string;
    certificationCount: number;
    recertificationRequired: boolean;
  }>;
  traceId: string;
  timestamp: string;
};

/** GET /api/mobile/logs */
export type MobileLogsGetDayResponse = {
  data: {
    driverId: string;
    date: string;
    timezone: string;
    summary: {
      date: string;
      timezone: string;
      offDutySec: number;
      sleeperSec: number;
      drivingSec: number;
      onDutySec: number;
      totalDistanceMi: number;
      dayLengthSec: number;
      certified: boolean;
      certifiedAt: unknown;
      certificationCount: number;
      hasViolation: boolean;
      violationCount: number;
      hasUnassigned: boolean;
      hasEdits: boolean;
    };
    graph: Array<{
      status: string;
      effective: string;
      special: string;
      startAt: string;
      endAt: string;
      durationSec: number;
      eventId: string;
      locationDescription: string;
      odometerMi: number;
      engineHours: number;
      annotation: unknown;
      carriedOver: boolean;
    }>;
    events: Array<{
      id: string;
      eventType: number;
      eventCode: number;
      eventSequenceId: number;
      eventDateTime: string;
      recordStatus: number;
      recordOrigin: number;
      status: string;
      locationName: unknown;
      totalVehicleMiles: number;
      totalEngineHours: number;
      annotation: unknown;
      comment: unknown;
      supersedesId: unknown;
      editedById: unknown;
      editorType: unknown;
      editReason: unknown;
      vehicleId: string;
      eventId: string;
      locationDescription: string;
      odometerMi: number;
      engineHours: number;
      specialCondition: unknown;
      malfunctionCode: unknown;
      diagnosticCode: unknown;
    }>;
    trip: {
      shippingDocuments: string[];
      trailerNumbers: string[];
      notes: unknown;
      bobtail: boolean;
      tripIds: string[];
      tripNumbers: string[];
      dayDetails: boolean;
    };
    malfunctionIndicator: boolean;
    diagnosticIndicator: boolean;
    violations: unknown[];
    certification: {
      certified: boolean;
      certifiedAt: unknown;
      certifiedById: unknown;
      certifierType: unknown;
      certificationCount: number;
      signatureUrl: unknown;
      recertificationRequired: boolean;
    };
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/ingest/events */
export type IngestEventsResponse = {
  accepted: number;
  duplicates: number;
  sequenceIds: {
    drv_1: number[];
  };
  warnings: unknown[];
  malfunctions: unknown[];
  diagnostics: unknown[];
  unidentifiedSegmentIds: unknown[];
  confirmationRequests: unknown[];
};

/** POST /api/ingest/telemetry */
export type IngestTelemetryResponse = {
  accepted: number;
  duplicates: number;
  denserThanContract: number;
};

/** POST /api/ingest/device-events */
export type IngestDeviceEventsUploadResponse = {
  received: number;
  stored: number;
  duplicates: number;
  safetyEvents: number;
};

/** POST /api/ingest/ble-state */
export type IngestBleStateResponse = {
  bleState: string;
  connectionType: string;
  disconnectedAlert: boolean;
};

/** POST /api/ingest/device-status */
export type IngestDeviceStatusResponse = {
  storedEventsCount: number;
  backlogAlert: boolean;
  codes: unknown[];
  model: string;
  vinMismatch: boolean;
  systemVars: {
    PERIODIC_EVENT_GAP: number;
    PERIODIC_EVENT_GAP_NOBLE: number;
    EVENTS_STORED: number;
    DRIVING_ACCL: number;
    DRIVING_BRAKING: number;
    DRIVING_CORNERING: number;
    HSI_MODE: number;
  };
  configVersion: string;
};

/** GET /api/vehicles/{id}/dtc */
export type DtcListResponse = {
  items: Array<{
    id: string;
    vehicleId: string;
    spn: number;
    fmi: number;
    code: unknown;
    bus: string;
    milOn: boolean;
    conversionMethod: number;
    active: unknown;
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

/** POST /api/conversations/attachments */
export type MessagingUploadAttachmentResponse = {
  id: string;
  attachmentId: string;
  kind: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number;
};

/** GET /api/conversations/{id}/messages — list item */
export type MessagingListMessagesItem = {
  id: string;
  body: string;
  type: string;
  attachment: unknown;
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

/** POST /api/conversations/{id}/messages/audio */
export type MessagingSendAudioMessageResponse = {
  id: string;
  type: string;
  body: string;
  attachmentId: string;
  sentAt: string;
  attachment: {
    id: string;
    kind: string;
    mimeType: string;
    sizeBytes: number;
    durationMs: number;
  };
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
  isVirtual: boolean;
  bleState: string;
  firmware: string;
  firmwareOutdated: boolean;
  productName: string;
  bleFirmware: string;
  imei: unknown;
  reportedVin: string;
  sdkVersion: string;
  appPlatform: string;
  connectionType: string;
  busType: string;
  lastInfoAt: string;
  periodicConnectedSec: number;
  periodicNoBleSec: number;
  periodicDisconnectedMin: number;
  harshAccelMg: number;
  harshBrakeMg: number;
  harshCornerMg: number;
  systemVars: {
    PERIODIC_EVENT_GAP: number;
    PERIODIC_EVENT_GAP_NOBLE: number;
    EVENTS_STORED: number;
    DRIVING_ACCL: number;
    DRIVING_BRAKING: number;
    DRIVING_CORNERING: number;
    HSI_MODE: number;
  };
  connection: string;
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
    isVirtual: boolean;
    model: string;
    bleMac: string;
    firmwareVersion: string;
  }>;
};

/** GET /api/devices/counts */
export type DevicesCountsResponse = {
  total: number;
  connected: number;
  disconnected: number;
  offlineOver24h: number;
};

/** GET /api/devices/{id} */
export type DevicesGetResponse = {
  id: string;
  serial: string;
  model: string;
  isVirtual: boolean;
  status: string;
  vehicleId: string;
  bleState: string;
  firmware: string;
  firmwareOutdated: boolean;
  lastSeenAt: string;
  productName: string;
  bleFirmware: string;
  imei: unknown;
  reportedVin: string;
  sdkVersion: string;
  appPlatform: string;
  connectionType: string;
  busType: string;
  lastInfoAt: string;
  periodicConnectedSec: number;
  periodicNoBleSec: number;
  periodicDisconnectedMin: number;
  harshAccelMg: number;
  harshBrakeMg: number;
  harshCornerMg: number;
  systemVars: {
    PERIODIC_EVENT_GAP: number;
    PERIODIC_EVENT_GAP_NOBLE: number;
    EVENTS_STORED: number;
    DRIVING_ACCL: number;
    DRIVING_BRAKING: number;
    DRIVING_CORNERING: number;
    HSI_MODE: number;
  };
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
  data: {
    id: string;
    vehicleId: string;
    startAt: string;
    endAt: string;
    durationSec: number;
    distanceMi: number;
    status: string;
    assignedDriverId: string;
    assignedById: string;
    assignedAt: string;
    annotation: string;
    confirmationRequestedAt: unknown;
    fromStoredEvents: boolean;
    eventIds: string[];
  };
  traceId: string;
  timestamp: string;
};

/** GET /api/unidentified/confirmation-requests */
export type UnidentifiedListConfirmationRequestsResponse = {
  data: {
    items: Array<{
      id: string;
      vehicleId: string;
      startAt: string;
      endAt: string;
      durationSec: number;
      distanceMi: number;
      status: string;
      assignedDriverId: string;
      assignedById: string;
      assignedAt: unknown;
      annotation: unknown;
      confirmationRequestedAt: string;
      fromStoredEvents: boolean;
      eventIds: string[];
      startLocation: string;
      endLocation: string;
      unitNumber: string;
      startOdometerMi: number;
      endOdometerMi: number;
    }>;
  };
  traceId: string;
  timestamp: string;
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
  data: {
    id: string;
    vehicleId: string;
    startAt: string;
    endAt: string;
    durationSec: number;
    distanceMi: number;
    status: string;
    assignedDriverId: string;
    assignedById: string;
    assignedAt: string;
    annotation: string;
    confirmationRequestedAt: unknown;
    fromStoredEvents: boolean;
    eventIds: string[];
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/unidentified/{id}/annotate */
export type UnidentifiedAnnotateResponse = {
  data: {
    id: string;
    vehicleId: string;
    startAt: string;
    endAt: string;
    durationSec: number;
    distanceMi: number;
    status: string;
    assignedDriverId: unknown;
    assignedById: unknown;
    assignedAt: unknown;
    annotation: string;
    confirmationRequestedAt: unknown;
    fromStoredEvents: boolean;
    eventIds: string[];
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/unidentified/{id}/reject */
export type UnidentifiedRejectResponse = {
  data: {
    id: string;
    vehicleId: string;
    startAt: string;
    endAt: string;
    durationSec: number;
    distanceMi: number;
    status: string;
    assignedDriverId: unknown;
    assignedById: string;
    assignedAt: string;
    annotation: string;
    confirmationRequestedAt: unknown;
    fromStoredEvents: boolean;
    eventIds: string[];
  };
  traceId: string;
  timestamp: string;
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
  data: {
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
  traceId: string;
  timestamp: string;
};

/** POST /api/mobile/transfers */
export type MobileTransfersCreateResponse = {
  data: {
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
    clientId: string;
    requestedAt: string;
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/mobile/hos-state */
export type HosStateHosStateSubmitResponse = {
  data: {
    hosEngineVersion: string;
    accepted: boolean;
    versionMismatch: boolean;
    updateRequired: boolean;
    compared: boolean;
    drift: boolean;
    maxDriftSec: number;
    fields: unknown[];
    statusMismatch: boolean;
    serverState: {
      currentStatus: string;
      driveRemainingSec: number;
      shiftRemainingSec: number;
      breakRemainingSec: number;
      cycleRemainingSec: number;
      dailyTotals: {
        off: number;
        sb: number;
        drive: number;
        on: number;
      };
      violations: unknown[];
      statusSince: string;
      nextBreakDueAt: string;
      shiftEndsAt: string;
      cycleRecapAt: unknown;
      restartAvailableAt: unknown;
    };
    driftThresholdSec: number;
  };
  traceId: string;
  timestamp: string;
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
  status: string;
  reviewNote: string;
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
  data: {
    id: string;
    driverId: string;
    userId: unknown;
    answers: {
      tenure: string;
      ease: string;
      hosSatisfaction: string;
      recommend: number;
      overallExperience: number;
    };
    comment: string;
    appVersion: string;
    platform: string;
    createdAt: string;
  };
  traceId: string;
  timestamp: string;
};

/** GET /api/mobile/support/tickets */
export type MobileSupportListOwnTicketsResponse = {
  data: {
    items: Array<{
      id: string;
      number: string;
      subject: string;
      body: string;
      category: string;
      priority: string;
      status: string;
      contactMethod: unknown;
      createdAt: string;
      updatedAt: string;
    }>;
  };
  traceId: string;
  timestamp: string;
};

/** POST /api/mobile/support/tickets */
export type MobileSupportCreateTicketResponse = {
  data: {
    id: string;
    number: string;
    subject: string;
    body: string;
    category: string;
    priority: string;
    status: string;
    createdByUserId: unknown;
    createdByDriverId: string;
    assignedToId: unknown;
    contactMethod: string;
    createdAt: string;
    updatedAt: string;
    resolvedAt: unknown;
  };
  traceId: string;
  timestamp: string;
};

/** GET /api/mobile/support/tickets/{id} */
export type MobileSupportGetOwnTicketResponse = {
  data: {
    id: string;
    number: string;
    subject: string;
    body: string;
    category: string;
    priority: string;
    status: string;
    contactMethod: unknown;
    createdAt: string;
    updatedAt: string;
  };
  traceId: string;
  timestamp: string;
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
  periodStart: string;
  periodEnd: string;
  computedAt: string;
  minMiles: number;
  fleet: {
    score: number;
    previousScore: number;
    trend: number;
    scoredDrivers: number;
    unscoredDrivers: number;
    belowThresholdCount: number;
    milesDriven: number;
  };
  items: Array<{
    id: string;
    driverId: string;
    periodStart: string;
    periodEnd: string;
    score: number;
    scored: boolean;
    harshCount: number;
    speedingCount: number;
    seatbeltCount: number;
    milesDriven: number;
    violationCount: number;
    rank: number;
    previousScore: number;
    trend: number;
    computedAt: string;
  }>;
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
    colour: string;
    countAsYardMove: boolean;
    vehicleGroupId: unknown;
    vehicleGroupName: unknown;
  }>;
};

/** POST /api/geofences */
export type GeofencesCreateResponse = {
  id: string;
  name: string;
  type: string;
  radiusMi: number;
  colour: string;
  countAsYardMove: boolean;
  vehicleGroupId: string;
};

/** GET /api/geofences/{id} */
export type GeofencesGetResponse = {
  id: string;
  name: string;
  type: string;
  colour: string;
  countAsYardMove: boolean;
  vehicleGroupId: string;
  vehicleGroupName: string;
};

/** PATCH /api/geofences/{id} */
export type GeofencesUpdateResponse = {
  id: string;
  enabled: boolean;
  vehicleGroupId: unknown;
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
    recordStatus: string;
    connectivity: string;
    isStale: boolean;
    staleSince: unknown;
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
      recordStatus: string;
      connectivity: string;
      isStale: boolean;
      staleSince: unknown;
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
    inactive: number;
    outOfService: number;
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
  'POST /api/auth/password/reset-code': AuthRequestPasswordResetCodeResponse;
  'POST /api/auth/password/reset-code/confirm': AuthConfirmPasswordResetCodeResponse;
  'POST /api/auth/driver/password/forgot': AuthForgotDriverPasswordResponse;
  'POST /api/auth/driver/password/reset': AuthResetDriverPasswordResponse;
  'GET /api/auth/me': AuthMeResponse;
  'GET /api/carrier': CarrierGetResponse;
  'PATCH /api/carrier': CarrierUpdateResponse;
  'GET /api/carrier/transfer-config': CarrierGetTransferConfigResponse;
  'GET /api/audit-log': AuditListResponse;
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
  'POST /api/users/{id}/email-change/resend': UsersResendEmailChangeResponse;
  'DELETE /api/users/{id}/email-change': UsersCancelEmailChangeResponse;
  'GET /api/me/profile': MeProfileResponse;
  'PATCH /api/me/profile': MeUpdateProfileResponse;
  'GET /api/me/sessions': MeSessionsResponse;
  'DELETE /api/me/sessions': MeRevokeAllSessionsResponse;
  'DELETE /api/me/sessions/{id}': MeRevokeSessionResponse;
  'POST /api/me/avatar': MeUploadAvatarResponse;
  'DELETE /api/me/avatar': MeDeleteAvatarResponse;
  'GET /api/me/preferences': MeGetPreferencesResponse;
  'PUT /api/me/preferences': MeUpdatePreferencesResponse;
  'POST /api/auth/email/verify': UserEmailVerifyResponse;
  'POST /api/auth/email/cancel': UserEmailCancelResponse;
  'GET /api/api-keys': ApiKeysListResponse;
  'POST /api/api-keys': ApiKeysCreateResponse;
  'PATCH /api/api-keys/{id}/scopes': ApiKeysUpdateScopesResponse;
  'DELETE /api/api-keys/{id}': ApiKeysRevokeResponse;
  'GET /api/drivers': DriversListResponse;
  'POST /api/drivers': DriversCreateResponse;
  'GET /api/drivers/export': DriversExportResponse;
  'GET /api/drivers/roster': DriversRosterResponse;
  'GET /api/drivers/{id}/hos': DriversHosResponse;
  'POST /api/drivers/{id}/hos/adverse-driving': DriversInvokeAdverseDrivingResponse;
  'GET /api/drivers/{id}': DriversGetResponse;
  'PATCH /api/drivers/{id}': DriversUpdateResponse;
  'DELETE /api/drivers/{id}': DriversRemoveResponse;
  'POST /api/drivers/import': DriversImportResponse;
  'POST /api/drivers/{id}/email-change/resend': DriversResendEmailChangeResponse;
  'DELETE /api/drivers/{id}/email-change': DriversCancelEmailChangeResponse;
  'POST /api/drivers/{id}/reset-password': DriversResetPasswordResponse;
  'POST /api/drivers/{id}/send-verification': DriversSendVerificationResponse;
  'POST /api/drivers/{id}/verify-email': DriversVerifyEmailResponse;
  'GET /api/drivers/{id}/documents': DriversListDocumentsResponse;
  'POST /api/drivers/{id}/documents': DriversCreateDocumentResponse;
  'DELETE /api/drivers/{id}/documents/{docId}': DriversRemoveDocumentResponse;
  'POST /api/auth/driver/email/confirm': DriverEmailConfirmResponse;
  'POST /api/auth/driver/email/verify': DriverEmailVerifyResponse;
  'POST /api/auth/driver/email/cancel': DriverEmailCancelResponse;
  'GET /api/violations': ViolationsListResponse;
  'POST /api/violations/{id}/resolve': ViolationsResolveResponse;
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
  'GET /api/mobile/app-config': MobileAppConfigAppConfigResponse;
  'GET /api/mobile/legal/{kind}': MobileAppConfigLegalResponse;
  'GET /api/mobile/bootstrap': MobileBootstrapGetResponse;
  'POST /api/mobile/sync': MobileSyncSyncResponse;
  'POST /api/mobile/duty-status': MobileDutyStatusChangeResponse;
  'POST /api/mobile/signature': MobileDvirUploadSignatureResponse;
  'POST /api/mobile/dvir': MobileDvirSubmitResponse;
  'GET /api/mobile/available-vehicles': MobileVehicleListResponse;
  'POST /api/mobile/release-vehicle': MobileVehicleReleaseResponse;
  'POST /api/mobile/select-vehicle': MobileVehicleSelectResponse;
  'GET /api/mobile/co-driver': MobileCoDriverCurrentResponse;
  'POST /api/mobile/co-driver/switch': MobileCoDriverSwitchResponse;
  'POST /api/mobile/co-driver/leave': MobileCoDriverLeaveResponse;
  'GET /api/mobile/trip': MobileTripGetResponse;
  'PATCH /api/mobile/trip': MobileTripPatchResponse;
  'GET /api/mobile/trailers': MobileTrailersListResponse;
  'GET /api/mobile/dvirs': MobileDvirHistoryListResponse;
  'GET /api/mobile/dvirs/{id}': MobileDvirHistoryGetResponse;
  'GET /api/mobile/defect-catalog': MobileCatalogDefectCatalogResponse;
  'GET /api/mobile/saved-signature': MobileCatalogGetResponse;
  'PUT /api/mobile/saved-signature': MobileCatalogPutResponse;
  'DELETE /api/mobile/saved-signature': MobileCatalogRemoveResponse;
  'GET /api/mobile/contacts': MobileContactsListResponse;
  'POST /api/mobile/push-tokens': PushTokensRegisterResponse;
  'DELETE /api/mobile/push-tokens/{token}': PushTokensRemoveResponse;
  'GET /api/mobile/device-health': DeviceHealthGetResponse;
  'GET /api/mobile/conversations': MobileMessagingListConversationsResponse;
  'POST /api/mobile/conversations': MobileMessagingStartConversationResponse;
  'GET /api/mobile/conversations/{id}/messages': MobileMessagingListMessagesResponse;
  'POST /api/mobile/conversations/{id}/messages': MobileMessagingSendMessageResponse;
  'POST /api/mobile/conversations/{id}/read': MobileMessagingMarkReadResponse;
  'GET /api/mobile/attachments/{id}/presign': MobileAttachmentsPresignResponse;
  'GET /api/mobile/maintenance': MobileMaintenanceListResponse;
  'GET /api/mobile/maintenance/{id}': MobileMaintenanceGetResponse;
  'POST /api/mobile/maintenance/{id}/submit': MobileMaintenanceSubmitResponse;
  'POST /api/mobile/device/mac': MobileDeviceReportMacResponse;
  'GET /api/mobile/device-config': MobileDeviceConfigConfigResponse;
  'POST /api/mobile/virtual-devices': MobileVirtualDeviceRegisterResponse;
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
  'GET /api/mobile/certification-status': MobileLogsCertificationStatusResponse;
  'GET /api/mobile/logs': MobileLogsGetDayResponse;
  'POST /api/ingest/events': IngestEventsResponse;
  'POST /api/ingest/telemetry': IngestTelemetryResponse;
  'POST /api/ingest/device-events': IngestDeviceEventsUploadResponse;
  'POST /api/ingest/ble-state': IngestBleStateResponse;
  'POST /api/ingest/device-status': IngestDeviceStatusResponse;
  'GET /api/vehicles/{id}/dtc': DtcListResponse;
  'GET /api/conversations': MessagingListConversationsResponse;
  'POST /api/conversations': MessagingCreateConversationResponse;
  'POST /api/conversations/attachments': MessagingUploadAttachmentResponse;
  'GET /api/conversations/{id}/messages': MessagingListMessagesResponse;
  'POST /api/conversations/{id}/messages': MessagingSendMessageResponse;
  'POST /api/conversations/{id}/messages/audio': MessagingSendAudioMessageResponse;
  'POST /api/conversations/{id}/read': MessagingMarkReadResponse;
  'POST /api/messages/broadcast': MessagingBroadcastResponse;
  'GET /api/devices': DevicesListResponse;
  'POST /api/devices': DevicesCreateResponse;
  'GET /api/devices/export': DevicesExportResponse;
  'GET /api/devices/counts': DevicesCountsResponse;
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
  'GET /api/transfers': TransfersListResponse;
  'POST /api/transfers': TransfersCreateResponse;
  'GET /api/transfers/{id}': TransfersGetResponse;
  'GET /api/mobile/transfers': MobileTransfersListResponse;
  'POST /api/mobile/transfers': MobileTransfersCreateResponse;
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
  'GET /api/mobile/support/tickets/{id}': MobileSupportGetOwnTicketResponse;
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
