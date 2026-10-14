// GENERATED FILE — do not edit by hand.
// Source: backend/docs/openapi.json — the documented success payload of every operation.
// Regenerate: npm run gen:fixtures   (scripts/generate-msw-fixtures.mjs)

export const OPENAPI_EXAMPLES: Record<string, unknown> = {
  'GET /health/live': {
    "status": "ok"
  },
  'GET /health/ready': {
    "status": "ok",
    "info": {
      "database": {
        "status": "up"
      }
    },
    "details": {
      "database": {
        "status": "up"
      }
    }
  },
  'GET /health/deep': {
    "status": "ok",
    "checks": {
      "database": {
        "status": "up",
        "latencyMs": 3
      },
      "redis": {
        "status": "up",
        "latencyMs": 1
      },
      "storage": {
        "status": "up",
        "latencyMs": 12
      }
    }
  },
  'POST /api/auth/login': {
    "accessToken": "eyJ...",
    "refreshToken": "a1b2...",
    "tokenType": "Bearer"
  },
  'POST /api/auth/login/driver': {
    "accessToken": "eyJ...",
    "refreshToken": "a1b2...",
    "tokenType": "Bearer",
    "driverId": "drv_1"
  },
  'POST /api/auth/google': {
    "accessToken": "eyJ...",
    "refreshToken": "a1b2...",
    "tokenType": "Bearer"
  },
  'POST /api/auth/refresh': {
    "accessToken": "eyJ...",
    "refreshToken": "a1b2...",
    "tokenType": "Bearer"
  },
  'POST /api/auth/logout': {
    "success": true
  },
  'POST /api/auth/password/forgot': {
    "success": true
  },
  'POST /api/auth/password/reset': {
    "success": true
  },
  'POST /api/auth/password/reset-code': {
    "success": true,
    "email": "sarah.chen@universal-logistics.example",
    "expiresInSec": 900,
    "resendAfterSec": 60
  },
  'POST /api/auth/password/reset-code/confirm': {
    "success": true
  },
  'POST /api/auth/driver/password/forgot': {
    "success": true
  },
  'POST /api/auth/driver/password/reset': {
    "success": true
  },
  'GET /api/auth/me': {
    "id": "drv_1",
    "type": "driver",
    "username": "johnsmith",
    "fullName": "John Smith",
    "email": "john@example.com",
    "homeTerminalTimezone": "America/New_York"
  },
  'GET /api/carrier': {
    "id": "carrier",
    "name": "Acme Trucking",
    "dotNumber": "1234567",
    "eldIdentifier": "OBK001",
    "erodsMode": "TEST",
    "virtualEldEnabled": false,
    "virtualEldAvailable": true,
    "virtualEldUpdatedAt": null,
    "virtualEldUpdatedById": null,
    "virtualEldUpdatedBy": null
  },
  'PATCH /api/carrier': {
    "id": "carrier",
    "name": "Universal Logistics Inc.",
    "dotNumber": "1234567",
    "timezone": "America/New_York",
    "eldIdentifier": "OBK001",
    "eldRegistrationId": null,
    "erodsMode": "TEST",
    "virtualEldEnabled": true,
    "virtualEldAvailable": true,
    "virtualEldUpdatedAt": "2026-10-12T09:00:00.000Z",
    "virtualEldUpdatedById": "usr_1",
    "virtualEldUpdatedBy": {
      "id": "usr_1",
      "name": "Jane Admin"
    }
  },
  'GET /api/carrier/transfer-config': {
    "timezone": "America/New_York",
    "eldIdentifier": "OBK001",
    "eldRegistrationId": null,
    "erodsMode": "TEST"
  },
  'GET /api/audit-log': {
    "items": [
      {
        "id": "42",
        "actorType": "USER",
        "actorName": "Sarah Chen",
        "actorEmail": "sarah.chen@universal-logistics.com",
        "action": "UPDATE",
        "objectType": "Role",
        "objectId": "role_1"
      }
    ],
    "nextCursor": null
  },
  'GET /api/attachments/{id}/presign': {
    "url": "https://minio.internal/onebook/dvir/photo.jpg?X-Amz-Signature=...",
    "expiresAt": "2026-09-24T15:56:00.000Z"
  },
  'GET /api/roles': [
    {
      "key": "ADMIN",
      "isSystem": true,
      "permissions": {},
      "userCount": 1
    }
  ],
  'POST /api/roles': {
    "id": "rol_9",
    "key": "SAFETY_REVIEWER",
    "name": "Safety reviewer",
    "isSystem": false,
    "permissions": {
      "logs": "READ",
      "safety": "FULL"
    }
  },
  'GET /api/roles/{id}': {
    "id": "rol_1",
    "key": "DISPATCHER",
    "name": "Dispatcher",
    "isSystem": true,
    "permissions": {
      "vehicles": "READ",
      "drivers": "READ",
      "logs": "READ",
      "reportsTransfer": "NONE"
    }
  },
  'PATCH /api/roles/{id}': {
    "id": "rol_9",
    "key": "SAFETY_REVIEWER",
    "name": "Safety reviewer",
    "isSystem": false,
    "permissions": {
      "logs": "READ",
      "safety": "READ"
    }
  },
  'DELETE /api/roles/{id}': {
    "success": true
  },
  'GET /api/users': [
    {
      "id": "usr_1",
      "email": "sarah.chen@universal-logistics.com",
      "firstName": "Sarah",
      "lastName": "Chen",
      "status": "ACTIVE",
      "role": {
        "key": "ADMIN",
        "name": "Administrator"
      },
      "lastActiveAt": "2026-09-11T15:39:00.000Z"
    }
  ],
  'POST /api/users': {
    "user": {
      "id": "usr_1",
      "status": "INVITED"
    },
    "emailDelivered": true
  },
  'GET /api/users/{id}': {
    "id": "usr_1",
    "email": "sarah.chen@universal-logistics.com",
    "firstName": "Sarah",
    "lastName": "Chen",
    "status": "ACTIVE",
    "role": {
      "key": "ADMIN",
      "name": "Administrator"
    }
  },
  'PATCH /api/users/{id}': {
    "id": "usr_3",
    "firstName": "Dana",
    "lastName": "Ford",
    "status": "ACTIVE",
    "email": "dana.ford@example.com",
    "pendingEmail": "dana@new.example.com",
    "role": {
      "key": "DISPATCHER",
      "name": "Dispatcher"
    },
    "emailVerification": {
      "pendingEmail": "dana@new.example.com",
      "emailDelivered": true
    }
  },
  'DELETE /api/users/{id}': {
    "success": true
  },
  'POST /api/users/{id}/resend-invite': {
    "emailDelivered": true
  },
  'POST /api/users/{id}/email-change/resend': {
    "pendingEmail": "new@example.com",
    "emailedTo": "new@example.com",
    "emailDelivered": true
  },
  'DELETE /api/users/{id}/email-change': {
    "id": "usr_3",
    "email": "dana.ford@example.com",
    "pendingEmail": null
  },
  'GET /api/me/profile': {
    "id": "usr_1",
    "email": "sarah.chen@universal-logistics.com",
    "firstName": "Sarah",
    "lastName": "Chen",
    "phone": "+13347654888",
    "role": {
      "key": "ADMIN",
      "name": "Administrator"
    }
  },
  'PATCH /api/me/profile': {
    "id": "usr_1",
    "firstName": "Sarah",
    "lastName": "Chen",
    "phone": "+13347654999"
  },
  'GET /api/me/sessions': [
    {
      "id": "ses_1",
      "deviceLabel": null,
      "ip": "10.14.2.88",
      "userAgent": "Chrome/140 macOS",
      "location": null,
      "lastSeenAt": "2026-09-11T15:39:00.000Z",
      "current": true
    }
  ],
  'DELETE /api/me/sessions': {
    "revoked": 3
  },
  'DELETE /api/me/sessions/{id}': {
    "success": true
  },
  'POST /api/me/avatar': {
    "id": "usr_1",
    "avatarUrl": "https://minio.local/onebook-eld/avatars/usr_1/..."
  },
  'DELETE /api/me/avatar': {
    "id": "usr_1",
    "avatarUrl": null
  },
  'GET /api/me/preferences': {
    "language": "en",
    "timezone": "America/Chicago",
    "dateFormat": "MMM D, YYYY",
    "distanceUnit": "MILES",
    "savedViews": {},
    "tableColumns": {}
  },
  'PUT /api/me/preferences': {
    "language": "en",
    "timezone": "America/Chicago",
    "dateFormat": "MMM D, YYYY",
    "distanceUnit": "MILES"
  },
  'POST /api/auth/email/verify': {
    "success": true,
    "email": "new@example.com",
    "alreadyVerified": false
  },
  'POST /api/auth/email/cancel': {
    "success": true,
    "result": "CANCELLED"
  },
  'GET /api/api-keys': [
    {
      "id": "key_1",
      "name": "McLeod TMS",
      "prefix": "obk_ABCD",
      "scopes": [
        "logs:read",
        "vehicles:read"
      ],
      "lastUsedAt": "2026-09-11T14:02:00.000Z",
      "expiresAt": null,
      "revokedAt": null
    }
  ],
  'POST /api/api-keys': {
    "apiKey": {
      "id": "key_1",
      "prefix": "obk_ABCD"
    },
    "plaintextKey": "obk_...(shown once)"
  },
  'PATCH /api/api-keys/{id}/scopes': {
    "id": "key_1",
    "prefix": "obk_ABCD",
    "scopes": [
      "logs:read"
    ]
  },
  'DELETE /api/api-keys/{id}': {
    "success": true
  },
  'GET /api/drivers': {
    "items": [
      {
        "id": "drv_1",
        "username": "jsmith",
        "cdlNumber": "D1234567"
      }
    ],
    "page": 1,
    "limit": 25,
    "total": 1,
    "totalPages": 1
  },
  'POST /api/drivers': {
    "id": "drv_9",
    "username": "awebb",
    "status": "ACTIVE",
    "homeTerminalTimezone": "America/New_York"
  },
  'GET /api/drivers/export': {
    "drivers": [
      {
        "username": "jsmith",
        "firstName": "John",
        "lastName": "Smith",
        "cdlNumber": "W8569238",
        "cdlState": "OH",
        "homeTerminalTimezone": "America/New_York",
        "hosRuleset": "US_70_8_PROPERTY"
      }
    ]
  },
  'GET /api/drivers/roster': {
    "items": [
      {
        "driver": {
          "id": "drv_1",
          "username": "jsmith",
          "firstName": "John",
          "lastName": "Smith",
          "homeTerminalName": "Columbus, OH",
          "appVersion": "v2.24",
          "email": "john@example.com",
          "eldExempt": false,
          "allowPersonalConveyance": true,
          "allowYardMove": true,
          "shortHaulException": false,
          "splitSleeperEnabled": false,
          "hosRuleset": "US_70_8_PROPERTY"
        },
        "dutyStatus": "DRIVING",
        "unit": {
          "id": "veh_1",
          "unitNumber": "101"
        },
        "hos": {
          "driveRemainingSec": 16200,
          "shiftRemainingSec": 20400,
          "cycleRemainingSec": 252000
        },
        "openViolations": 0,
        "emailVerified": null,
        "isStale": false,
        "staleSince": null
      }
    ],
    "page": 1,
    "limit": 25,
    "total": 1,
    "totalPages": 1,
    "summary": {
      "total": 57,
      "withActiveViolations": 3
    }
  },
  'GET /api/drivers/{id}/hos': {
    "driveRemainingSec": 16200,
    "shiftRemainingSec": 20400,
    "cycleRemainingSec": 180000,
    "breakInSec": 7440,
    "onDutySince": "2026-09-12T14:26:00.000Z",
    "cycleLimitSec": 252000,
    "shiftLimitSec": 50400,
    "driveLimitSec": 39600,
    "breakLimitSec": 28800,
    "dutyStatus": "DRIVING",
    "statusSince": "2026-09-12T18:00:00.000Z",
    "computedAt": "2026-09-12T20:00:00.000Z",
    "isStale": false,
    "staleSince": null,
    "hosRuleset": "US_70_8_PROPERTY"
  },
  'POST /api/drivers/{id}/hos/adverse-driving': {
    "id": "adv_1",
    "driverId": "drv_1",
    "date": "2026-09-12",
    "annotation": "Unforeseen snow closure on I-80, dispatcher confirmed",
    "invokedById": "usr_1",
    "invokedByType": "user",
    "createdAt": "2026-09-12T18:00:00.000Z"
  },
  'GET /api/drivers/{id}': {
    "id": "drv_1",
    "username": "jsmith",
    "firstName": "John",
    "lastName": "Smith",
    "status": "ACTIVE",
    "cdlNumber": "W8569238",
    "cdlState": "OH",
    "homeTerminalTimezone": "America/New_York",
    "assignedVehicleId": "veh_1",
    "allowPersonalConveyance": true,
    "allowYardMove": true
  },
  'PATCH /api/drivers/{id}': {
    "id": "drv_1",
    "username": "jsmith",
    "status": "ACTIVE",
    "email": "old@example.com",
    "pendingEmail": "new@example.com",
    "emailVerification": {
      "pendingEmail": "new@example.com",
      "emailDelivered": true
    }
  },
  'DELETE /api/drivers/{id}': {
    "id": "drv_1",
    "status": "TERMINATED",
    "assignedVehicleId": null
  },
  'POST /api/drivers/import': {
    "imported": 3,
    "updated": 1,
    "failed": []
  },
  'POST /api/drivers/{id}/email-change/resend': {
    "pendingEmail": "new@example.com",
    "emailedTo": "new@example.com",
    "emailDelivered": true
  },
  'DELETE /api/drivers/{id}/email-change': {
    "id": "drv_1",
    "email": "old@example.com",
    "pendingEmail": null
  },
  'POST /api/drivers/{id}/reset-password': {
    "emailedTo": "jsmith@example.com"
  },
  'POST /api/drivers/{id}/send-verification': {
    "emailedTo": "jsmith@example.com"
  },
  'POST /api/drivers/{id}/verify-email': {
    "id": "drv_1",
    "email": "jsmith@example.com",
    "emailVerifiedAt": "2026-09-24T00:00:00.000Z"
  },
  'GET /api/drivers/{id}/documents': [
    {
      "id": "doc_1",
      "type": "CDL",
      "fileName": "cdl-front.jpg",
      "expiresAt": "2028-01-01T00:00:00.000Z",
      "uploadedAt": "2026-09-24T00:00:00.000Z",
      "url": "https://minio/..."
    }
  ],
  'POST /api/drivers/{id}/documents': {
    "id": "doc_1",
    "type": "CDL",
    "fileName": "cdl-front.jpg",
    "expiresAt": null,
    "uploadedAt": "2026-09-24T00:00:00.000Z",
    "url": "https://minio/...",
    "uploadUrl": "https://minio/... (PUT)"
  },
  'DELETE /api/drivers/{id}/documents/{docId}': {
    "deleted": true
  },
  'POST /api/auth/driver/email/confirm': {
    "success": true,
    "email": "new@example.com"
  },
  'POST /api/auth/driver/email/verify': {
    "success": true,
    "email": "jsmith@example.com",
    "alreadyVerified": false
  },
  'POST /api/auth/driver/email/cancel': {
    "success": true,
    "result": "CANCELLED"
  },
  'GET /api/violations': {
    "items": [
      {
        "id": "vio_1",
        "driverId": "drv_1",
        "dailyLogId": "dl_1",
        "logDate": "2026-09-14",
        "type": "DRIVING_11",
        "occurredAt": "2026-09-14T14:26:00.000Z",
        "exceededBySec": 1560,
        "detail": "Driving 11h26m",
        "status": "OPEN",
        "resolvedAt": null,
        "resolvedById": null,
        "resolutionNote": null,
        "severity": "VIOLATION",
        "driverName": "John Smith",
        "vehicleId": "veh_1",
        "unitNumber": "101",
        "event": "11-hour driving limit exceeded",
        "locationLabel": "1.04 mi W of Harrisburg, OH",
        "date": "2026-09-14"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 25,
    "totalPages": 1
  },
  'POST /api/violations/{id}/resolve': {
    "id": "vio_1",
    "status": "RESOLVED",
    "resolvedAt": "2026-09-14T15:41:00.000Z",
    "resolutionNote": "Adverse weather, dispatcher confirmed"
  },
  'GET /api/vehicles': {
    "items": [
      {
        "id": "veh_1",
        "unitNumber": "#101",
        "vin": "1FUJA6CV88LW12345",
        "status": "ACTIVE"
      }
    ],
    "page": 1,
    "limit": 25,
    "total": 1,
    "totalPages": 1,
    "statusCounts": {
      "ACTIVE": 40,
      "INACTIVE": 3,
      "OUT_OF_SERVICE": 2,
      "total": 45
    }
  },
  'POST /api/vehicles': {
    "id": "veh_9",
    "unitNumber": "126",
    "vin": "1FUJHHDR5NLNN4410",
    "status": "ACTIVE",
    "odometerMiles": 221449
  },
  'GET /api/vehicles/export': {
    "vehicles": [
      {
        "unitNumber": "101",
        "vin": "1FUJGLDR8LLLL1234",
        "make": "Freightliner",
        "model": "Cascadia",
        "year": 2021,
        "fuelType": "DIESEL",
        "odometerMiles": 993107
      }
    ]
  },
  'GET /api/vehicles/{id}': {
    "id": "veh_1",
    "unitNumber": "101",
    "vin": "1FUJGLDR8LLLL1234",
    "make": "Freightliner",
    "model": "Cascadia",
    "year": 2021,
    "status": "ACTIVE",
    "odometerMiles": 993107,
    "odometerOffsetMiles": 12,
    "assignedDriverId": "drv_1"
  },
  'PATCH /api/vehicles/{id}': {
    "id": "veh_1",
    "unitNumber": "101",
    "status": "ACTIVE",
    "licensePlate": "PQR-4821",
    "licenseState": "OH"
  },
  'DELETE /api/vehicles/{id}': {
    "id": "veh_1",
    "status": "INACTIVE",
    "assignedDriverId": null
  },
  'GET /api/vehicles/{id}/activities': {
    "items": [
      {
        "id": "dvir_1",
        "occurredAt": "2026-09-24T13:00:00.000Z",
        "activity": "DVIR_PRE_TRIP",
        "driverName": "John Smith",
        "source": "DVIR",
        "details": "SATISFACTORY"
      }
    ]
  },
  'GET /api/vehicles/{id}/histories': {
    "date": "2026-09-24",
    "distanceMi": 312.4,
    "driveSegments": 3,
    "driveTimeSec": 21600,
    "avgSpeedMph": 52,
    "stopCount": 2,
    "stopTimeSec": 5400,
    "idleTimeSec": 900,
    "idleFuelWastedGal": 0.6,
    "firstMovementAt": "2026-09-24T11:00:00.000Z",
    "lastMovementAt": "2026-09-24T23:00:00.000Z",
    "engineOnSec": 22500,
    "engineOffSec": 5400,
    "longestDrive": {
      "label": "40.7128, -74.0060",
      "durationSec": 10800
    },
    "longestStop": {
      "label": "39.9612, -82.9988",
      "durationSec": 3600
    },
    "maxSpeedMph": 68,
    "maxSpeedAt": "2026-09-24T15:00:00.000Z",
    "segments": []
  },
  'GET /api/vehicles/{id}/telemetry': {
    "items": [
      {
        "time": "2026-09-24T15:00:00.000Z",
        "vehicleId": "veh_1",
        "speedMph": 62,
        "latitude": 40.7128,
        "longitude": -74.006
      }
    ]
  },
  'POST /api/vehicles/import': {
    "imported": 2,
    "updated": 0,
    "skipped": 0,
    "failed": []
  },
  'PATCH /api/vehicles/bulk-status': {
    "updated": [
      "veh_1",
      "veh_2"
    ],
    "failed": []
  },
  'POST /api/vehicles/{id}/calibrate-odometer': {
    "id": "veh_1",
    "odometerOffsetMiles": 12,
    "dashOdometerMiles": 993119,
    "deviceOdometerMiles": 993107
  },
  'POST /api/vehicles/{id}/assign-driver': {
    "id": "veh_1",
    "unitNumber": "101",
    "assignedDriverId": "drv_1"
  },
  'POST /api/vehicles/{id}/unassign-driver': {
    "id": "veh_1",
    "unitNumber": "101",
    "assignedDriverId": null
  },
  'GET /api/trailers': {
    "items": [
      {
        "id": "trl_1",
        "number": "T-4471",
        "vin": "1JJV532W7YL123456",
        "status": "ACTIVE",
        "deletedAt": null
      }
    ],
    "page": 1,
    "limit": 25,
    "total": 1,
    "totalPages": 1
  },
  'POST /api/trailers': {
    "id": "trl_9",
    "number": "T-4480",
    "licensePlate": "TRL-1180",
    "licenseState": "OH"
  },
  'GET /api/trailers/export': {
    "trailers": [
      {
        "number": "T-4471",
        "vin": "1JJV532W7YL123456",
        "licensePlate": "TRL-9921",
        "licenseState": "OH"
      }
    ]
  },
  'GET /api/trailers/{id}': {
    "id": "trl_1",
    "number": "T-4471",
    "vin": "1JJV532W7YL123456",
    "licensePlate": "TRL-9921",
    "licenseState": "OH"
  },
  'PATCH /api/trailers/{id}': {
    "id": "trl_1",
    "number": "T-4471",
    "vin": "1JJV532W7YL123456",
    "status": "ACTIVE",
    "deletedAt": null
  },
  'DELETE /api/trailers/{id}': {
    "success": true
  },
  'POST /api/trailers/import': {
    "imported": 2,
    "updated": 0,
    "failed": []
  },
  'GET /api/vehicle-groups': {
    "items": [
      {
        "id": "vg_1",
        "name": "Midwest linehaul",
        "description": "OH/IN/KY lanes",
        "color": "#2F6FED",
        "vehicleCount": 14,
        "createdAt": "2026-09-25T09:00:00.000Z",
        "updatedAt": "2026-09-25T09:00:00.000Z"
      }
    ]
  },
  'POST /api/vehicle-groups': {
    "id": "vg_1",
    "name": "Midwest linehaul",
    "description": "OH/IN/KY lanes",
    "color": "#2F6FED",
    "vehicleCount": 14,
    "createdAt": "2026-09-25T09:00:00.000Z",
    "updatedAt": "2026-09-25T09:00:00.000Z"
  },
  'GET /api/vehicle-groups/{id}': {
    "id": "vg_1",
    "name": "Midwest linehaul",
    "description": "OH/IN/KY lanes",
    "color": "#2F6FED",
    "vehicleCount": 14,
    "createdAt": "2026-09-25T09:00:00.000Z",
    "updatedAt": "2026-09-25T09:00:00.000Z",
    "vehicles": [
      {
        "id": "veh_1",
        "unitNumber": "101",
        "vin": "1FUJGLDR8LLLL1234",
        "make": "Freightliner",
        "model": "Cascadia",
        "status": "ACTIVE"
      }
    ]
  },
  'PATCH /api/vehicle-groups/{id}': {
    "id": "vg_1",
    "name": "Midwest linehaul",
    "description": "OH/IN/KY lanes",
    "color": "#2F6FED",
    "vehicleCount": 14,
    "createdAt": "2026-09-25T09:00:00.000Z",
    "updatedAt": "2026-09-25T09:00:00.000Z"
  },
  'DELETE /api/vehicle-groups/{id}': {
    "success": true
  },
  'PUT /api/vehicle-groups/{id}/vehicles': {
    "id": "vg_1",
    "name": "Midwest linehaul",
    "description": "OH/IN/KY lanes",
    "color": "#2F6FED",
    "vehicleCount": 14,
    "createdAt": "2026-09-25T09:00:00.000Z",
    "updatedAt": "2026-09-25T09:00:00.000Z"
  },
  'GET /api/alert-rules': {
    "items": [
      {
        "id": "alr_1",
        "key": "hos_violation",
        "name": "HOS violation",
        "severity": "CRITICAL",
        "channels": [
          "IN_APP",
          "EMAIL"
        ],
        "enabled": true
      }
    ]
  },
  'POST /api/alert-rules': {
    "id": "alr_2",
    "key": "custom_geofence_exit",
    "channels": [
      "IN_APP"
    ]
  },
  'GET /api/alert-rules/{id}': {
    "id": "alr_1",
    "key": "hos_violation",
    "channels": [
      "IN_APP",
      "EMAIL"
    ]
  },
  'PATCH /api/alert-rules/{id}': {
    "id": "alr_1",
    "enabled": false
  },
  'DELETE /api/alert-rules/{id}': {
    "id": "alr_2",
    "deleted": true
  },
  'POST /api/alert-rules/{id}/test': {
    "triggered": true,
    "channels": [
      {
        "channel": "IN_APP",
        "status": "SENT"
      },
      {
        "channel": "EMAIL",
        "status": "FAILED",
        "reason": "NO_MAIL_TRANSPORT"
      }
    ]
  },
  'GET /api/notifications': {
    "items": [
      {
        "id": "ntf_1",
        "userId": "usr_1",
        "driverId": null,
        "type": "hos_violation",
        "kind": "VIOLATION",
        "title": "HOS violation",
        "body": "An HOS violation was detected.",
        "objectType": "Driver",
        "objectId": "drv_1",
        "category": "VIOLATIONS",
        "severity": "CRITICAL",
        "readAt": null,
        "createdAt": "2026-10-08T15:41:00.000Z"
      }
    ],
    "page": 1,
    "limit": 25,
    "total": 1,
    "totalPages": 1,
    "counts": {
      "all": 12,
      "violations": 5,
      "maintenance": 3
    },
    "unreadCount": 4
  },
  'POST /api/notifications/read-all': {
    "updated": 3
  },
  'POST /api/notifications/{id}/read': {
    "id": "ntf_1",
    "readAt": "2026-09-24T15:41:00.000Z"
  },
  'GET /api/notification-channels': {
    "email": {
      "enabled": true
    },
    "webhook": {
      "enabled": false
    }
  },
  'PATCH /api/notification-channels': {
    "email": {
      "enabled": true
    },
    "webhook": {
      "enabled": false
    }
  },
  'POST /api/integrations/webhook/test': {
    "id": "whd_1",
    "status": "QUEUED",
    "attempts": 0
  },
  'GET /api/integrations': [
    {
      "id": "int_1",
      "provider": "mcleod",
      "enabled": true,
      "status": "CONNECTED",
      "lastSyncAt": "2026-09-11T09:12:00.000Z",
      "config": {
        "baseUrl": "https://tms.example.com",
        "apiToken": "***"
      }
    }
  ],
  'GET /api/integrations/catalog': [
    {
      "provider": "mcleod",
      "name": "McLeod",
      "description": "TMS load and dispatch sync.",
      "category": "TMS",
      "available": true
    },
    {
      "provider": "zapier",
      "name": "Zapier",
      "description": "Automate with 6,000+ apps.",
      "category": "Developer",
      "available": true
    }
  ],
  'GET /api/integrations/{provider}': {
    "id": "int_1",
    "provider": "wex",
    "enabled": true,
    "status": "CONNECTED",
    "config": {
      "accountId": "4821",
      "apiKey": "***"
    }
  },
  'PUT /api/integrations/{provider}': {
    "id": "int_1",
    "provider": "mcleod",
    "enabled": true,
    "status": "CONNECTED"
  },
  'DELETE /api/integrations/{provider}': {
    "id": "int_1",
    "provider": "mcleod",
    "enabled": false,
    "status": "DISCONNECTED"
  },
  'GET /api/mobile/app-config': {
    "minSupportedVersion": "1.0.0",
    "latestVersion": "1.0.3",
    "storeUrl": "https://play.google.com/store/apps/details?id=com.onebook.eld_mobile",
    "userManualUrl": null,
    "privacyPolicyUrl": "https://onebook.example/privacy",
    "termsUrl": null,
    "minPt30Firmware": null,
    "recommendedPt30Firmware": null,
    "updateRequired": false,
    "updateAvailable": true,
    "virtualEld": {
      "enabled": false
    }
  },
  'GET /api/mobile/legal/{kind}': {
    "version": "2026-10",
    "url": "https://onebook.example/privacy",
    "html": null
  },
  'GET /api/mobile/bootstrap': {
    "serverTime": "2026-10-08T15:41:00.000Z",
    "hosEngineVersion": "1.0.3",
    "driver": {
      "id": "drv_1",
      "username": "johnsmith",
      "firstName": "John",
      "lastName": "Smith",
      "cdlNumber": "W8569238",
      "cdlState": "KY",
      "email": "john@example.com",
      "phone": "+15025550100",
      "exemptDriverStatus": false,
      "status": "ACTIVE",
      "homeTerminalName": "Columbus Terminal",
      "homeTerminalTimezone": "America/New_York",
      "hosRuleset": "US_70_8_PROPERTY",
      "exceptions": {
        "allowPersonalConveyance": true,
        "allowYardMove": true,
        "adverseDrivingEnabled": false,
        "shortHaulException": false,
        "splitSleeperEnabled": true,
        "eldExempt": false,
        "eldExemptReason": null
      },
      "lastSyncAt": "2026-10-08T15:30:00.000Z"
    },
    "vehicle": {
      "id": "veh_1",
      "unitNumber": "4821",
      "vin": "1FUJA6CV71LM12345",
      "make": "Freightliner",
      "model": "Cascadia",
      "year": 2021,
      "sleeperBerth": true,
      "status": "ACTIVE",
      "odometerMi": 84213
    },
    "device": {
      "id": "dev_1",
      "serial": "PT30-001",
      "model": "PT30",
      "firmware": "2.4.1",
      "status": "ASSIGNED",
      "bleState": "CONNECTED",
      "bleMacAddress": "A4:C1:38:5E:A8:6E",
      "pairedAt": "2026-09-01T12:00:00.000Z",
      "periodicConnectedSec": 30,
      "periodicDisconnectedMin": 30
    },
    "coDriver": null,
    "availableVehicles": [
      {
        "id": "veh_2",
        "unitNumber": "104",
        "make": "Volvo",
        "model": "VNL",
        "deviceSerial": null
      }
    ],
    "carrier": {
      "name": "Acme Freight",
      "dotNumber": "1234567",
      "timezone": "America/New_York",
      "hosRuleset": "US_70_8_PROPERTY",
      "distanceUnit": "MILES",
      "allowPersonalConveyance": true,
      "allowYardMove": true,
      "eldIdentifier": "OBK001",
      "mainOfficeAddress": "1 Main St, Columbus, OH 43004",
      "eldProvider": "OneBook ELD",
      "eldRegistrationId": "AB12",
      "erodsMode": "TEST"
    },
    "hos": {
      "computedAt": "2026-10-08T15:41:00.000Z",
      "timezone": "America/New_York",
      "state": {
        "currentStatus": "ON",
        "driveRemainingSec": 39600,
        "shiftRemainingSec": 48600,
        "breakRemainingSec": 28800,
        "cycleRemainingSec": 230400,
        "dailyTotals": {
          "off": 50400,
          "sb": 0,
          "drive": 0,
          "on": 1860
        },
        "violations": [],
        "statusSince": "2026-10-08T15:10:00.000Z",
        "nextBreakDueAt": null,
        "shiftEndsAt": "2026-10-09T05:10:00.000Z",
        "cycleRecapAt": null,
        "restartAvailableAt": null
      }
    },
    "inspectionPacket": {
      "driverId": "drv_1",
      "timezone": "America/New_York",
      "generatedAt": "2026-10-08T15:41:00.000Z",
      "days": []
    },
    "syncConfig": {
      "batchMaxChanges": 500,
      "batchMaxBytes": 1048576,
      "onlineIntervalSec": 60,
      "onlineBatchThreshold": 50,
      "offlineBackoffSec": [
        30,
        60,
        300,
        900,
        1800
      ],
      "localEventRetentionDays": 30,
      "localInspectionRetentionDays": 8,
      "syncBacklogWarnDays": 30,
      "syncBacklogWarnBytes": 209715200
    },
    "appUpdate": null,
    "pendingEditRequestCount": 1,
    "pendingUnidentifiedCount": 0
  },
  'POST /api/mobile/sync': {
    "accepted": [
      "uuid1"
    ],
    "rejected": [
      {
        "clientId": "uuid3",
        "code": "DRIVING_TIME_IMMUTABLE",
        "message": "Driving time can never be hand-entered."
      },
      {
        "clientId": "uuid4",
        "code": "SYNC_DELEGATION_NOT_ALLOWED"
      }
    ],
    "serverChanges": [
      {
        "id": "9102",
        "eventType": 1,
        "eventCode": 3,
        "eventDateTime": "2026-09-11T15:00:00.000Z",
        "recordStatus": 1,
        "recordOrigin": 1,
        "annotation": null,
        "supersedesId": null
      }
    ],
    "serverTime": "2026-09-11T15:41:00.000Z",
    "hosEngineVersion": "1.0.3",
    "nextSyncAfterSec": 60
  },
  'POST /api/mobile/duty-status': {
    "id": "9101",
    "driverId": "drv_1",
    "status": "OFF",
    "specialCondition": "PC",
    "locationName": "Columbus, OH",
    "startAt": "2026-09-11T15:41:00.000Z",
    "endAt": null,
    "recordOrigin": 2,
    "recordStatus": 1,
    "applied": true,
    "recertificationRequired": true
  },
  'POST /api/mobile/signature': {
    "signatureImageId": "9c2a0f4e-0000-4000-8000-000000000031",
    "attachmentId": "9c2a0f4e-0000-4000-8000-000000000031",
    "key": "invoices/drv_1/9c2a0f4e-0000-4000-8000-000000000031.pdf",
    "sha256": "a1b2...",
    "sizeBytes": 182044
  },
  'POST /api/mobile/dvir': {
    "id": "dvir_1",
    "driverId": "drv_1",
    "vehicleId": "veh_1",
    "trailerId": null,
    "trailerNumber": "X53-1188",
    "type": "PRE_TRIP",
    "submittedAt": "2026-10-08T12:00:00.000Z",
    "vehicleCondition": "DEFECTS_FOUND",
    "defectCount": 1,
    "photoCount": 2,
    "outOfService": false,
    "signatureImageId": "sig_9c2a",
    "mechanicSignatureImageId": null,
    "applied": true
  },
  'GET /api/mobile/available-vehicles': [
    {
      "id": "veh_1",
      "unitNumber": "104",
      "make": "Freightliner",
      "model": "Cascadia",
      "deviceSerial": "PT30-1004"
    }
  ],
  'POST /api/mobile/release-vehicle': {
    "released": true,
    "vehicleId": "veh_1"
  },
  'POST /api/mobile/select-vehicle': {
    "id": "veh_1",
    "unitNumber": "104",
    "vin": "1FUJA6CV71LM12345",
    "make": "Freightliner",
    "model": "Cascadia",
    "year": 2021,
    "sleeperBerth": true,
    "status": "ACTIVE",
    "odometerMi": 84213,
    "device": {
      "id": "dev_1",
      "serial": "PT30-1004",
      "model": "PT30"
    }
  },
  'GET /api/mobile/co-driver': {
    "pairingId": "pair_1",
    "startedAt": "2026-10-08T08:00:00.000Z",
    "coDriver": {
      "id": "drv_2",
      "firstName": "Jane",
      "lastName": "Doe",
      "username": "jdoe"
    },
    "trip": {
      "shippingDocuments": [
        "BOL-2201"
      ],
      "trailerNumbers": [
        "TR-1"
      ]
    }
  },
  'POST /api/mobile/co-driver/switch': {
    "accessToken": "eyJ...",
    "refreshToken": "a1b2...",
    "tokenType": "Bearer"
  },
  'POST /api/mobile/co-driver/leave': {
    "ended": true
  },
  'GET /api/mobile/trip': {
    "source": "DAY_DETAILS",
    "id": null,
    "trip": null,
    "logDate": "2026-10-08",
    "shippingDocument": "BOL-2201",
    "shippingDocuments": [
      "BOL-2201"
    ],
    "trailerId": null,
    "trailerNumber": "X53-1188",
    "trailerNumbers": [
      "X53-1188"
    ],
    "bobtail": false,
    "notes": null,
    "updatedAt": "2026-10-08T14:02:11.000Z",
    "stops": [],
    "documents": []
  },
  'PATCH /api/mobile/trip': {
    "source": "TRIP",
    "id": "trip_1",
    "number": "T-1042",
    "status": "IN_PROGRESS",
    "vehicleId": "veh_1",
    "trailerId": "trl_1",
    "shippingDocument": "BOL-2201",
    "shippingDocuments": [
      "BOL-2201",
      "BOL-2202"
    ],
    "trailerNumber": "TR-1",
    "trailerNumbers": [
      "TR-1",
      "X53-1188"
    ],
    "bobtail": false,
    "commodity": "Produce",
    "weightLbs": 38000,
    "pieces": 22,
    "plannedStartAt": "2026-10-08T12:00:00.000Z",
    "plannedEndAt": "2026-10-09T02:00:00.000Z",
    "startedAt": "2026-10-08T12:10:00.000Z",
    "completedAt": null,
    "etaAt": "2026-10-09T01:30:00.000Z",
    "onTime": true,
    "notes": "Left the yard early",
    "stops": [
      {
        "id": "stp_1",
        "sequence": 1,
        "type": "PICKUP",
        "name": "Shipper #4821",
        "address": "100 Dock Rd, Columbus, OH",
        "latitude": 39.96,
        "longitude": -82.99,
        "scheduledAt": "2026-10-08T12:00:00.000Z",
        "arrivedAt": "2026-10-08T12:05:00.000Z",
        "departedAt": null,
        "status": "ARRIVED",
        "note": null
      }
    ],
    "documents": [
      {
        "tripId": "trip_1",
        "number": "T-1042",
        "shippingDocument": "BOL-2201",
        "commodity": "Produce",
        "pieces": 22,
        "weightLbs": 38000
      }
    ]
  },
  'GET /api/mobile/trailers': [
    {
      "id": "trl_1",
      "number": "TR-1",
      "plate": null
    }
  ],
  'GET /api/mobile/dvirs': [
    {
      "id": "dvir_1",
      "vehicleId": "veh_1",
      "type": "PRE_TRIP",
      "submittedAt": "2026-09-10T12:00:00.000Z",
      "vehicleCondition": "DEFECTS_FOUND",
      "defectCount": 1,
      "repairStatus": "PENDING",
      "trailerNumber": "X53-1188",
      "odometerMi": 84213,
      "location": {
        "lat": 41.75,
        "lon": -87.98,
        "name": "2mi ESE IL Darien"
      }
    }
  ],
  'GET /api/mobile/dvirs/{id}': {
    "id": "dvir_1",
    "driverId": "drv_1",
    "vehicleId": "veh_1",
    "trailerId": null,
    "type": "PRE_TRIP",
    "submittedAt": "2026-09-10T12:00:00.000Z",
    "odometerMi": 84213,
    "location": {
      "lat": 39.96,
      "lon": -82.99,
      "name": "2mi ESE OH Columbus"
    },
    "trailerNumber": "X53-1188",
    "vehicleCondition": "DEFECTS_FOUND",
    "notes": null,
    "repairStatus": "PENDING",
    "driverSignature": {
      "key": "signatures/drv_1/sig_9c2a.png",
      "url": "https://...",
      "hash": "a1b2..."
    },
    "mechanicSignature": null,
    "nextDriverReviewedAt": null,
    "defects": [
      {
        "id": "def_1",
        "part": "TRUCK",
        "category": "BRAKES_SERVICE",
        "severity": "MAJOR",
        "description": "Air leak at the rear axle",
        "status": "OPEN",
        "outOfService": false,
        "resolvedAt": null,
        "resolutionNote": null,
        "photos": [
          {
            "id": "att_1",
            "url": "https://...",
            "mimeType": "image/jpeg",
            "sizeBytes": 120344
          }
        ]
      }
    ],
    "photos": []
  },
  'GET /api/mobile/defect-catalog': [
    {
      "code": "ACCIDENT_PHOTO",
      "name": "Accident Photo",
      "part": "TRUCK",
      "category": "Accident",
      "critical": false,
      "isPhoto": true
    },
    {
      "code": "BRAKES_SERVICE",
      "name": "Brakes, Service",
      "part": "TRUCK",
      "category": "Brakes",
      "critical": true,
      "isPhoto": false
    }
  ],
  'GET /api/mobile/saved-signature': {
    "signatureImageId": "3f2c...",
    "key": "signatures/drv_1/3f2c.png",
    "url": "https://...",
    "mimeType": "image/png",
    "sizeBytes": 4821,
    "sha256": "a1b2...",
    "updatedAt": "2026-10-08T12:00:00.000Z"
  },
  'PUT /api/mobile/saved-signature': {
    "signatureImageId": "3f2c...",
    "key": "signatures/drv_1/3f2c.png",
    "url": "https://...",
    "mimeType": "image/png",
    "sizeBytes": 4821,
    "sha256": "a1b2...",
    "updatedAt": "2026-10-08T12:00:00.000Z"
  },
  'DELETE /api/mobile/saved-signature': {
    "deleted": true
  },
  'GET /api/mobile/contacts': [
    {
      "id": "usr_1",
      "name": "Mike Torres",
      "role": "FLEET_MANAGER",
      "phone": "+1-555-0100"
    },
    {
      "id": "support",
      "name": "OneBook ELD Support",
      "role": "SUPPORT",
      "phone": null
    }
  ],
  'POST /api/mobile/push-tokens': {
    "id": "pt_1",
    "driverId": "drv_1",
    "token": "fcm-token...",
    "platform": "IOS",
    "deviceLabel": "iPhone 15",
    "lastSeenAt": "2026-09-21T00:00:00.000Z",
    "createdAt": "2026-09-01T00:00:00.000Z"
  },
  'DELETE /api/mobile/push-tokens/{token}': {
    "deleted": true
  },
  'GET /api/mobile/device-health': {
    "vehicleId": "veh_1",
    "device": {
      "id": "dev_1",
      "serial": "PT30-001",
      "firmware": "2.4.1",
      "bleState": "CONNECTED",
      "storedEventsCount": 12,
      "lastDeviceStatusAt": "2026-09-21T00:00:00.000Z"
    },
    "activeCodes": [
      {
        "kind": "malfunction",
        "code": "P"
      }
    ],
    "unidentified": {
      "windowDays": 8,
      "pendingCount": 1,
      "pendingConfirmationRequestIds": [
        "seg_1"
      ]
    },
    "hosDrift": {
      "computedAt": "2026-09-21T00:00:00.000Z",
      "lastComparedAt": "2026-09-21T00:00:05.000Z",
      "maxDriftSec": 4,
      "driftAlerted": false
    }
  },
  'GET /api/mobile/conversations': {
    "items": [
      {
        "id": "cnv_1",
        "type": "DIRECT",
        "title": "Jane Dispatcher",
        "lastMessageAt": "2026-09-11T15:00:00.000Z",
        "lastMessage": {
          "id": "msg_1",
          "conversationId": "cnv_1",
          "senderUserId": "usr_1",
          "senderDriverId": null,
          "body": "On schedule.",
          "attachmentId": null,
          "clientId": null,
          "sentAt": "2026-09-11T15:00:00.000Z",
          "deliveredAt": null,
          "readAt": null,
          "senderId": "usr_1",
          "senderType": "STAFF",
          "senderName": "Jane Dispatcher"
        },
        "unreadCount": 2,
        "participants": [
          {
            "id": "drv_1",
            "type": "DRIVER",
            "name": "John Smith"
          },
          {
            "id": "usr_1",
            "type": "STAFF",
            "name": "Jane Dispatcher"
          }
        ]
      }
    ]
  },
  'POST /api/mobile/conversations': {
    "conversationId": "cnv_1",
    "message": {
      "id": "msg_1",
      "body": "Running 20 min late.",
      "sentAt": "2026-10-08T15:00:00.000Z",
      "senderId": "drv_1",
      "senderType": "DRIVER",
      "clientId": "0b9d6f5e-0000-4000-8000-000000000002"
    }
  },
  'GET /api/mobile/conversations/{id}/messages': {
    "items": [
      {
        "id": "msg_1",
        "conversationId": "cnv_1",
        "senderUserId": "usr_1",
        "senderDriverId": null,
        "body": "On schedule.",
        "attachmentId": null,
        "clientId": null,
        "sentAt": "2026-09-11T15:00:00.000Z",
        "deliveredAt": null,
        "readAt": null,
        "senderId": "usr_1",
        "senderType": "STAFF",
        "senderName": "Jane Dispatcher"
      }
    ],
    "limit": 50
  },
  'POST /api/mobile/conversations/{id}/messages': {
    "id": "msg_2",
    "conversationId": "cnv_1",
    "senderUserId": null,
    "senderDriverId": "drv_1",
    "body": "Confirmed.",
    "attachmentId": null,
    "clientId": "5d2c...",
    "sentAt": "2026-09-11T15:05:00.000Z",
    "deliveredAt": null,
    "readAt": null,
    "senderId": "drv_1",
    "senderType": "DRIVER",
    "senderName": "John Smith"
  },
  'POST /api/mobile/conversations/{id}/read': {
    "messagesMarked": 3
  },
  'GET /api/mobile/attachments/{id}/presign': {
    "url": "https://eldapi.stackyard.uz/onebook-eld/chat/carrier/drv_1/att.m4a?X-Amz-Signature=...",
    "expiresAt": "2026-10-11T15:15:00.000Z"
  },
  'GET /api/mobile/maintenance': [
    {
      "id": "3f2c0a7e-0000-4000-8000-000000000001",
      "scheduleType": "OIL_CHANGE",
      "scheduleName": "Engine oil & filter",
      "frequencyMi": 25000,
      "remainingMi": 1200,
      "status": "OPEN",
      "at": "2026-11-01T00:00:00.000Z"
    }
  ],
  'GET /api/mobile/maintenance/{id}': {
    "id": "3f2c0a7e-0000-4000-8000-000000000001",
    "scheduleType": "OIL_CHANGE",
    "scheduleName": "Engine oil & filter",
    "frequencyMi": 25000,
    "remainingMi": 1200,
    "status": "REJECTED",
    "at": "2026-10-08T12:00:00.000Z",
    "invoiceNumber": "INV-2291",
    "vendorName": "Pilot Truck Care",
    "cost": 412.5,
    "notes": "Changed filters too",
    "invoiceAttachment": {
      "id": "9a1d...",
      "fileName": "invoice-INV-2291.pdf",
      "mimeType": "application/pdf"
    },
    "submittedAt": "2026-10-08T12:00:00.000Z",
    "reviewNote": "Amount does not match the PDF."
  },
  'POST /api/mobile/maintenance/{id}/submit': {
    "id": "3f2c0a7e-0000-4000-8000-000000000001",
    "scheduleType": "OIL_CHANGE",
    "scheduleName": "Engine oil & filter",
    "frequencyMi": 25000,
    "remainingMi": 1200,
    "status": "OPEN",
    "at": "2026-10-08T12:00:00.000Z",
    "invoiceNumber": "INV-2291",
    "vendorName": "Pilot Truck Care",
    "cost": 412.5,
    "notes": "Changed filters too",
    "invoiceAttachment": {
      "id": "9a1d2b3c-0000-4000-8000-000000000009",
      "fileName": "invoice-INV-2291.pdf",
      "mimeType": "application/pdf"
    },
    "submittedAt": "2026-10-08T12:00:00.000Z",
    "reviewNote": null
  },
  'POST /api/mobile/device/mac': {
    "deviceId": "0b6f1c2e-0000-4000-8000-000000000101",
    "macAddress": "A4:C1:38:5E:A8:6E",
    "outcome": "STORED"
  },
  'GET /api/mobile/device-config': {
    "serial": "PT30_A86E",
    "model": "PT30",
    "systemVars": {
      "PERIODIC_EVENT_GAP": 30,
      "PERIODIC_EVENT_GAP_NOBLE": 30,
      "EVENTS_STORED": 1,
      "DRIVING_ACCL": 0,
      "DRIVING_BRAKING": 450,
      "DRIVING_CORNERING": 0,
      "HSI_MODE": 1
    },
    "autoFirmware": true,
    "shareDiagnostics": true,
    "configVersion": "3f9a1c0b7d2e"
  },
  'POST /api/mobile/virtual-devices': {
    "id": "0b6f1c2e-0000-4000-8000-000000000199",
    "serial": "VPT30_A1B2",
    "model": "PT30",
    "isVirtual": true,
    "firmware": "V1.0.0",
    "vehicleId": "0b6f1c2e-0000-4000-8000-000000000201",
    "status": "ASSIGNED",
    "bleState": "DISCONNECTED",
    "bleMacAddress": null,
    "reportedVin": "1FUJGLDR7CLBP8834",
    "pairedAt": "2026-10-12T09:00:00.000Z",
    "createdAt": "2026-10-12T09:00:00.000Z",
    "firmwareOutdated": false,
    "systemVars": {
      "PERIODIC_EVENT_GAP": 30,
      "PERIODIC_EVENT_GAP_NOBLE": 30,
      "EVENTS_STORED": 1,
      "DRIVING_ACCL": 0,
      "DRIVING_BRAKING": 0,
      "DRIVING_CORNERING": 0,
      "HSI_MODE": 1
    }
  },
  'POST /api/logs/edit-requests/{id}/accept': {
    "id": "9120",
    "status": "ACCEPTED",
    "applied": true
  },
  'POST /api/logs/edit-requests/{id}/reject': {
    "id": "9120",
    "status": "REJECTED",
    "applied": false
  },
  'GET /api/logs/{driverId}': {
    "driverId": "drv_1",
    "date": "2026-09-10",
    "timezone": "America/New_York",
    "summary": {
      "drivingSec": 32400,
      "onDutySec": 7200,
      "offDutySec": 39600,
      "sleeperSec": 7200,
      "certified": false
    },
    "graph": [
      {
        "status": "OFF",
        "effective": "OFF",
        "startAt": "2026-09-10T04:00:00.000Z",
        "durationSec": 3600
      }
    ]
  },
  'GET /api/logs/{driverId}/range': {
    "driverId": "drv_1",
    "from": "2026-09-03",
    "to": "2026-09-10",
    "days": [
      {
        "date": "2026-09-10",
        "drivingSec": 32400,
        "onDutySec": 7200,
        "certified": false,
        "violations": 2
      }
    ]
  },
  'GET /api/logs/{driverId}/events': {
    "driverId": "drv_1",
    "date": "2026-09-10",
    "events": [
      {
        "id": "evt_8801",
        "eventType": 1,
        "eventCode": 3,
        "eventSequenceId": 1042,
        "recordStatus": 2,
        "recordOrigin": 1,
        "dutyStatus": "ON",
        "occurredAt": "2026-09-10T18:26:58.000Z",
        "odometerMiles": 993590,
        "latitude": 38.02,
        "longitude": -84.5,
        "locationDescription": "1mi N KY Florence",
        "totalEngineHours": 4321.4,
        "checksumValid": true
      }
    ]
  },
  'POST /api/logs/{driverId}/events': {
    "id": "9001",
    "driverId": "drv_1",
    "status": "PENDING",
    "kind": "INSERT",
    "proposedStatus": "ON",
    "proposedSpecial": "NONE",
    "eventDateTime": "2026-09-10T13:00:00.000Z",
    "endDateTime": "2026-09-10T14:30:00.000Z",
    "annotation": "Pre-trip inspection at the yard",
    "notifyDriver": true,
    "recordStatus": 3,
    "applied": false
  },
  'GET /api/logs/{driverId}/edit-requests': {
    "items": [
      {
        "id": "edt_1",
        "date": "2026-09-10",
        "status": "PENDING",
        "requestedBy": "usr_1",
        "reason": "Wrong duty status",
        "createdAt": "2026-09-11T15:41:00.000Z"
      }
    ]
  },
  'POST /api/logs/{driverId}/edit-requests': {
    "id": "edt_9",
    "driverId": "drv_1",
    "status": "PENDING",
    "date": "2026-09-10",
    "reason": "Driver forgot to switch to On duty while loading at shipper #4821.",
    "proposed": {
      "status": "ON",
      "startAt": "2026-09-10T18:26:58.000Z",
      "endAt": "2026-09-10T19:30:00.000Z"
    },
    "proposedSpecial": "YM",
    "notifyDriver": true,
    "recordStatus": 3,
    "applied": false,
    "createdAt": "2026-09-11T15:41:00.000Z"
  },
  'POST /api/logs/{driverId}/certify': {
    "driverId": "drv_1",
    "certified": [
      {
        "date": "2026-09-10",
        "certifiedAt": "2026-09-11T15:41:00.000Z",
        "certifiedBy": "usr_1",
        "onBehalf": true,
        "signatureCount": 1
      }
    ]
  },
  'POST /api/mobile/log-entries': {
    "id": "9100",
    "driverId": "drv_1",
    "status": "ON",
    "specialCondition": "NONE",
    "locationName": "Columbus, OH",
    "startAt": "2026-09-10T18:26:58.000Z",
    "endAt": null,
    "recordOrigin": 2,
    "recordStatus": 1,
    "applied": true,
    "recertificationRequired": true
  },
  'POST /api/mobile/certify': {
    "driverId": "drv_1",
    "days": [
      {
        "date": "2026-09-10",
        "certified": true,
        "certificationCount": 1,
        "eventCode": 1,
        "certifiedAt": "2026-09-11T15:41:00.000Z",
        "certifierType": "DRIVER"
      }
    ]
  },
  'GET /api/mobile/log-edit-requests': {
    "driverId": "drv_1",
    "items": [
      {
        "id": "9120",
        "driverId": "drv_1",
        "status": "PENDING",
        "kind": "EDIT",
        "originalEventId": "9100",
        "proposedStatus": "ON",
        "proposedSpecial": "NONE",
        "proposedStart": "2026-09-10T18:26:58.000Z",
        "proposedEnd": "2026-09-10T19:30:00.000Z",
        "locationName": "Columbus, OH",
        "annotation": "Forgot to switch to On duty while loading",
        "requestedById": "usr_1",
        "requestedAt": "2026-09-11T14:00:00.000Z",
        "resolvedAt": null,
        "date": "2026-09-10",
        "original": {
          "status": "OFF",
          "start": "2026-09-10T18:26:58.000Z",
          "end": "2026-09-10T19:30:00.000Z",
          "location": "3mi W OH Columbus"
        },
        "proposedGraph": [
          {
            "status": "OFF",
            "effective": "OFF",
            "special": "NONE",
            "startAt": "2026-09-10T04:00:00.000Z",
            "endAt": "2026-09-10T18:26:58.000Z",
            "durationSec": 52018
          },
          {
            "status": "ON",
            "effective": "ON",
            "special": "NONE",
            "startAt": "2026-09-10T18:26:58.000Z",
            "endAt": "2026-09-10T19:30:00.000Z",
            "durationSec": 3782
          },
          {
            "status": "OFF",
            "effective": "OFF",
            "special": "NONE",
            "startAt": "2026-09-10T19:30:00.000Z",
            "endAt": "2026-09-11T04:00:00.000Z",
            "durationSec": 30600
          }
        ],
        "requestedBy": {
          "id": "usr_1",
          "name": "Jane Dispatcher"
        }
      }
    ]
  },
  'GET /api/mobile/certification-status': [
    {
      "date": "2026-10-07",
      "certified": true,
      "certifiedAt": "2026-10-08T01:02:00.000Z",
      "certificationCount": 1,
      "recertificationRequired": false
    },
    {
      "date": "2026-10-08",
      "certified": false,
      "certifiedAt": null,
      "certificationCount": 1,
      "recertificationRequired": true
    }
  ],
  'GET /api/mobile/logs': {
    "driverId": "drv_1",
    "date": "2026-09-10",
    "timezone": "America/New_York",
    "summary": {
      "date": "2026-09-10",
      "timezone": "America/New_York",
      "offDutySec": 39600,
      "sleeperSec": 7200,
      "drivingSec": 32400,
      "onDutySec": 7200,
      "totalDistanceMi": 512,
      "dayLengthSec": 86400,
      "certified": false,
      "certifiedAt": null,
      "certificationCount": 0,
      "hasViolation": false,
      "violationCount": 0,
      "hasUnassigned": false,
      "hasEdits": false
    },
    "graph": [
      {
        "status": "OFF",
        "effective": "OFF",
        "special": "NONE",
        "startAt": "2026-09-10T04:00:00.000Z",
        "endAt": "2026-09-10T05:00:00.000Z",
        "durationSec": 3600,
        "eventId": "9100",
        "locationDescription": "3mi W OH Columbus",
        "odometerMi": 120345,
        "engineHours": 5321.4,
        "annotation": null,
        "carriedOver": true
      }
    ],
    "events": [
      {
        "id": "9101",
        "eventType": 1,
        "eventCode": 3,
        "eventSequenceId": 1043,
        "eventDateTime": "2026-09-10T05:00:00.000Z",
        "recordStatus": 1,
        "recordOrigin": 1,
        "status": "D",
        "locationName": null,
        "totalVehicleMiles": 120345,
        "totalEngineHours": 5321.4,
        "annotation": null,
        "comment": null,
        "supersedesId": null,
        "editedById": null,
        "editorType": null,
        "editReason": null,
        "vehicleId": "veh_1",
        "eventId": "9101",
        "locationDescription": "3mi W OH Columbus",
        "odometerMi": 120345,
        "engineHours": 5321.4,
        "specialCondition": null,
        "malfunctionCode": null,
        "diagnosticCode": null
      }
    ],
    "trip": {
      "shippingDocuments": [
        "BOL-4821"
      ],
      "trailerNumbers": [
        "TR-778"
      ],
      "notes": null,
      "bobtail": false,
      "tripIds": [
        "5b0c…"
      ],
      "tripNumbers": [
        "T-1042"
      ],
      "dayDetails": false
    },
    "malfunctionIndicator": false,
    "diagnosticIndicator": false,
    "violations": [],
    "certification": {
      "certified": false,
      "certifiedAt": null,
      "certifiedById": null,
      "certifierType": null,
      "certificationCount": 0,
      "signatureUrl": null,
      "recertificationRequired": false
    }
  },
  'POST /api/ingest/events': {
    "accepted": 118,
    "duplicates": 2,
    "sequenceIds": {
      "drv_1": [
        1042,
        1043
      ]
    },
    "warnings": [],
    "malfunctions": [],
    "diagnostics": [],
    "unidentifiedSegmentIds": [],
    "confirmationRequests": []
  },
  'POST /api/ingest/telemetry': {
    "accepted": 60,
    "duplicates": 0,
    "denserThanContract": 0
  },
  'POST /api/ingest/device-events': {
    "received": 2,
    "stored": 2,
    "duplicates": 0,
    "safetyEvents": 1
  },
  'POST /api/ingest/ble-state': {
    "bleState": "CONNECTED",
    "connectionType": "USB",
    "disconnectedAlert": false
  },
  'POST /api/ingest/device-status': {
    "storedEventsCount": 12,
    "backlogAlert": false,
    "codes": [],
    "model": "PT40",
    "vinMismatch": false,
    "systemVars": {
      "PERIODIC_EVENT_GAP": 30,
      "PERIODIC_EVENT_GAP_NOBLE": 30,
      "EVENTS_STORED": 1,
      "DRIVING_ACCL": 0,
      "DRIVING_BRAKING": 450,
      "DRIVING_CORNERING": 0,
      "HSI_MODE": 1
    },
    "configVersion": "3f9a1c0b7d2e"
  },
  'GET /api/vehicles/{id}/dtc': {
    "items": [
      {
        "id": "dtc_1",
        "vehicleId": "veh_1",
        "spn": 100,
        "fmi": 1,
        "code": null,
        "bus": "J1939",
        "milOn": true,
        "conversionMethod": 0,
        "active": null,
        "occurrence": 3,
        "source": "0",
        "description": null,
        "firstSeenAt": "2026-09-10T12:00:00.000Z",
        "lastSeenAt": "2026-09-11T08:00:00.000Z",
        "clearedAt": null
      },
      {
        "id": "dtc_2",
        "vehicleId": "veh_1",
        "spn": null,
        "fmi": 3,
        "code": "SID 254",
        "bus": "J1708",
        "milOn": false,
        "conversionMethod": null,
        "active": true,
        "occurrence": 1,
        "source": null,
        "description": null,
        "firstSeenAt": "2026-09-11T08:00:00.000Z",
        "lastSeenAt": "2026-09-11T08:00:00.000Z",
        "clearedAt": null
      },
      {
        "id": "dtc_3",
        "vehicleId": "veh_1",
        "spn": null,
        "fmi": null,
        "code": "P0301",
        "bus": "OBD_II",
        "milOn": true,
        "conversionMethod": null,
        "active": null,
        "occurrence": 1,
        "source": null,
        "description": null,
        "firstSeenAt": "2026-09-11T08:00:00.000Z",
        "lastSeenAt": "2026-09-11T08:00:00.000Z",
        "clearedAt": null
      }
    ]
  },
  'GET /api/conversations': {
    "items": [
      {
        "id": "cnv_1",
        "type": "DIRECT",
        "lastMessageAt": "2026-09-11T15:00:00.000Z"
      }
    ]
  },
  'POST /api/conversations': {
    "id": "cnv_2",
    "type": "DIRECT"
  },
  'POST /api/conversations/attachments': {
    "id": "att_1",
    "attachmentId": "att_1",
    "kind": "CHAT_AUDIO",
    "mimeType": "audio/mp4",
    "sizeBytes": 48211,
    "durationSec": 12
  },
  'GET /api/conversations/{id}/messages': {
    "items": [
      {
        "id": "msg_1",
        "body": "On schedule.",
        "type": "TEXT",
        "attachment": null,
        "sentAt": "2026-09-11T15:00:00.000Z"
      }
    ],
    "page": 1,
    "limit": 50,
    "total": 1,
    "totalPages": 1
  },
  'POST /api/conversations/{id}/messages': {
    "id": "msg_2",
    "body": "Confirmed.",
    "sentAt": "2026-09-11T15:05:00.000Z"
  },
  'POST /api/conversations/{id}/messages/audio': {
    "id": "msg_3",
    "type": "AUDIO",
    "body": "Voice message",
    "attachmentId": "att_9",
    "sentAt": "2026-10-13T10:00:00.000Z",
    "attachment": {
      "id": "att_9",
      "kind": "AUDIO",
      "mimeType": "audio/webm",
      "sizeBytes": 48211,
      "durationMs": 5300
    }
  },
  'POST /api/conversations/{id}/read': {
    "conversationId": "cnv_1",
    "lastReadAt": "2026-09-24T15:05:00.000Z"
  },
  'POST /api/messages/broadcast': {
    "sent": 2,
    "deliveries": [
      {
        "conversationId": "cnv_3",
        "messageId": "msg_3",
        "driverId": "drv_1"
      }
    ]
  },
  'GET /api/devices': {
    "items": [
      {
        "id": "dev_1",
        "serial": "PT30_A86E",
        "model": "PT30",
        "isVirtual": false,
        "bleState": "CONNECTED",
        "firmware": "L108",
        "firmwareOutdated": false,
        "productName": "PT30",
        "bleFirmware": "1.4.2",
        "imei": null,
        "reportedVin": "1FUJGLDR7CLBP8834",
        "sdkVersion": "6.11.1",
        "appPlatform": "ANDROID",
        "connectionType": "BLE",
        "busType": "J1939",
        "lastInfoAt": "2026-10-10T12:00:00.000Z",
        "periodicConnectedSec": 30,
        "periodicNoBleSec": 30,
        "periodicDisconnectedMin": 30,
        "harshAccelMg": 0,
        "harshBrakeMg": 450,
        "harshCornerMg": 0,
        "systemVars": {
          "PERIODIC_EVENT_GAP": 30,
          "PERIODIC_EVENT_GAP_NOBLE": 30,
          "EVENTS_STORED": 1,
          "DRIVING_ACCL": 0,
          "DRIVING_BRAKING": 450,
          "DRIVING_CORNERING": 0,
          "HSI_MODE": 1
        },
        "connection": "CONNECTED"
      }
    ],
    "page": 1,
    "limit": 25,
    "total": 1,
    "totalPages": 1,
    "connectionCounts": {
      "total": 12,
      "connected": 7,
      "disconnected": 5,
      "offlineOver24h": 2
    }
  },
  'POST /api/devices': {
    "id": "dev_9",
    "serial": "PT30_1C4F",
    "model": "PT30",
    "status": "UNASSIGNED",
    "bleState": "DISCONNECTED"
  },
  'GET /api/devices/export': {
    "devices": [
      {
        "serial": "PT30_A86E",
        "isVirtual": false,
        "model": "PT30",
        "bleMac": "A4:C1:38:12:9F:6E",
        "firmwareVersion": "L108"
      }
    ]
  },
  'GET /api/devices/counts': {
    "total": 12,
    "connected": 7,
    "disconnected": 5,
    "offlineOver24h": 2
  },
  'GET /api/devices/{id}': {
    "id": "dev_1",
    "serial": "PT30_A86E",
    "model": "PT30",
    "isVirtual": false,
    "status": "ASSIGNED",
    "vehicleId": "veh_1",
    "bleState": "CONNECTED",
    "firmware": "L108",
    "firmwareOutdated": false,
    "lastSeenAt": "2026-09-11T15:41:00.000Z",
    "productName": "PT30",
    "bleFirmware": "1.4.2",
    "imei": null,
    "reportedVin": "1FUJGLDR7CLBP8834",
    "sdkVersion": "6.11.1",
    "appPlatform": "ANDROID",
    "connectionType": "BLE",
    "busType": "J1939",
    "lastInfoAt": "2026-10-10T12:00:00.000Z",
    "periodicConnectedSec": 30,
    "periodicNoBleSec": 30,
    "periodicDisconnectedMin": 30,
    "harshAccelMg": 0,
    "harshBrakeMg": 450,
    "harshCornerMg": 0,
    "systemVars": {
      "PERIODIC_EVENT_GAP": 30,
      "PERIODIC_EVENT_GAP_NOBLE": 30,
      "EVENTS_STORED": 1,
      "DRIVING_ACCL": 0,
      "DRIVING_BRAKING": 450,
      "DRIVING_CORNERING": 0,
      "HSI_MODE": 1
    }
  },
  'PATCH /api/devices/{id}': {
    "id": "dev_1",
    "serial": "PT30_A86E",
    "bleMac": "A4:C1:38:12:9F:6E",
    "status": "ASSIGNED"
  },
  'DELETE /api/devices/{id}': {
    "id": "dev_1",
    "status": "RETIRED",
    "vehicleId": null
  },
  'GET /api/devices/{id}/diagnostics': {
    "signalStrength": "good",
    "gpsLock": true,
    "responded": true
  },
  'POST /api/devices/import': {
    "imported": 5,
    "updated": 1,
    "failed": []
  },
  'PATCH /api/devices/{id}/firmware': {
    "id": "dev_1",
    "firmwareVersion": "L107",
    "firmwareOutdated": true
  },
  'PATCH /api/devices/{id}/ble-status': {
    "id": "dev_1",
    "bleState": "OUT_OF_RANGE",
    "lastHeartbeatAt": "2026-09-11T15:41:00.000Z"
  },
  'POST /api/devices/{id}/pair': {
    "id": "dev_1",
    "serial": "PT30_A86E",
    "status": "ASSIGNED",
    "vehicleId": "veh_1"
  },
  'POST /api/devices/{id}/unpair': {
    "id": "dev_1",
    "serial": "PT30_A86E",
    "status": "UNASSIGNED",
    "vehicleId": null
  },
  'GET /api/co-driver-pairings': {
    "items": [
      {
        "id": "pair_1",
        "primaryDriverId": "drv_1",
        "coDriverId": "drv_2",
        "vehicleId": "veh_1",
        "startedAt": "2026-09-24T00:00:00.000Z",
        "endedAt": null
      }
    ],
    "page": 1,
    "limit": 25,
    "total": 1,
    "totalPages": 1
  },
  'POST /api/co-driver-pairings': {
    "id": "pair_1",
    "primaryDriverId": "drv_1",
    "coDriverId": "drv_2",
    "vehicleId": "veh_1",
    "startedAt": "2026-09-24T00:00:00.000Z",
    "endedAt": null
  },
  'POST /api/co-driver-pairings/{id}/end': {
    "id": "pair_1",
    "endedAt": "2026-09-24T12:00:00.000Z"
  },
  'POST /api/unidentified/{id}/confirm': {
    "id": "6f1c2a0e-3d1b-4c55-9a51-2f0f6b1d9e10",
    "vehicleId": "b3e0c1d2-8a4f-4f0e-9d7c-1a2b3c4d5e6f",
    "startAt": "2026-09-10T12:30:00.000Z",
    "endAt": "2026-09-10T13:00:00.000Z",
    "durationSec": 1800,
    "distanceMi": 21,
    "status": "ASSIGNED",
    "assignedDriverId": "drv_1",
    "assignedById": "usr_1",
    "assignedAt": "2026-09-11T15:41:00.000Z",
    "annotation": "Unidentified driving assigned to johnsmith",
    "confirmationRequestedAt": null,
    "fromStoredEvents": true,
    "eventIds": [
      "7701",
      "7702"
    ]
  },
  'GET /api/unidentified/confirmation-requests': {
    "items": [
      {
        "id": "6f1c2a0e-3d1b-4c55-9a51-2f0f6b1d9e10",
        "vehicleId": "b3e0c1d2-8a4f-4f0e-9d7c-1a2b3c4d5e6f",
        "startAt": "2026-09-10T12:30:00.000Z",
        "endAt": "2026-09-10T13:00:00.000Z",
        "durationSec": 1800,
        "distanceMi": 21,
        "status": "PENDING_CONFIRMATION",
        "assignedDriverId": "drv_1",
        "assignedById": "usr_1",
        "assignedAt": null,
        "annotation": null,
        "confirmationRequestedAt": "2026-09-11T15:41:00.000Z",
        "fromStoredEvents": true,
        "eventIds": [
          "7701",
          "7702"
        ],
        "startLocation": "3mi W OH Columbus",
        "endLocation": "1mi N OH Hilliard",
        "unitNumber": "4821",
        "startOdometerMi": 120345,
        "endOdometerMi": 120366
      }
    ]
  },
  'GET /api/unidentified': {
    "items": [
      {
        "id": "seg_1",
        "vehicleId": "veh_1",
        "durationSec": 1800,
        "distanceMi": 21,
        "status": "PENDING",
        "fromStoredEvents": true
      }
    ],
    "total": 1,
    "page": 1
  },
  'GET /api/unidentified/{id}': {
    "id": "seg_1",
    "vehicleId": "veh_1",
    "status": "PENDING",
    "durationSec": 1800,
    "distanceMi": 21,
    "fromStoredEvents": true,
    "events": [
      {
        "id": "evt_7701",
        "eventSequenceId": 981,
        "recordOrigin": 1,
        "dutyStatus": "D",
        "occurredAt": "2026-09-10T12:30:00.000Z",
        "odometerMiles": 993218
      }
    ]
  },
  'POST /api/unidentified/{id}/assign': {
    "id": "6f1c2a0e-3d1b-4c55-9a51-2f0f6b1d9e10",
    "vehicleId": "b3e0c1d2-8a4f-4f0e-9d7c-1a2b3c4d5e6f",
    "startAt": "2026-09-10T12:30:00.000Z",
    "endAt": "2026-09-10T13:00:00.000Z",
    "durationSec": 1800,
    "distanceMi": 21,
    "status": "ASSIGNED",
    "assignedDriverId": "drv_1",
    "assignedById": "usr_1",
    "assignedAt": "2026-09-11T15:41:00.000Z",
    "annotation": "Unidentified driving assigned to johnsmith",
    "confirmationRequestedAt": null,
    "fromStoredEvents": true,
    "eventIds": [
      "7701",
      "7702"
    ]
  },
  'POST /api/unidentified/{id}/annotate': {
    "id": "6f1c2a0e-3d1b-4c55-9a51-2f0f6b1d9e10",
    "vehicleId": "b3e0c1d2-8a4f-4f0e-9d7c-1a2b3c4d5e6f",
    "startAt": "2026-09-10T12:30:00.000Z",
    "endAt": "2026-09-10T13:00:00.000Z",
    "durationSec": 1800,
    "distanceMi": 21,
    "status": "ANNOTATED",
    "assignedDriverId": null,
    "assignedById": null,
    "assignedAt": null,
    "annotation": "Yard move by shop tech",
    "confirmationRequestedAt": null,
    "fromStoredEvents": true,
    "eventIds": [
      "7701",
      "7702"
    ]
  },
  'POST /api/unidentified/{id}/reject': {
    "id": "6f1c2a0e-3d1b-4c55-9a51-2f0f6b1d9e10",
    "vehicleId": "b3e0c1d2-8a4f-4f0e-9d7c-1a2b3c4d5e6f",
    "startAt": "2026-09-10T12:30:00.000Z",
    "endAt": "2026-09-10T13:00:00.000Z",
    "durationSec": 1800,
    "distanceMi": 21,
    "status": "REJECTED",
    "assignedDriverId": null,
    "assignedById": "usr_1",
    "assignedAt": "2026-09-11T15:41:00.000Z",
    "annotation": "Not this driver",
    "confirmationRequestedAt": null,
    "fromStoredEvents": true,
    "eventIds": [
      "7701",
      "7702"
    ]
  },
  'GET /api/transfers': {
    "items": [
      {
        "id": "trf_1",
        "sentAt": "2026-09-02T13:14:00.000Z",
        "method": "WEB_SERVICES",
        "comment": "TERMINAL AUDIT 2025-09-02",
        "periodFrom": "2026-07-01",
        "periodTo": "2026-08-31",
        "status": "ACCEPTED",
        "sentById": "usr_1",
        "fileName": "SMITH38018.csv"
      }
    ],
    "page": 1,
    "limit": 25,
    "total": 1,
    "totalPages": 1
  },
  'POST /api/transfers': {
    "transfer": {
      "id": "trf_1",
      "fileName": "SMITH38018.csv",
      "status": "QUEUED",
      "erodsMode": "TEST",
      "fileSizeBytes": 2048
    },
    "warnings": [
      {
        "code": "ERODS_TEST_MODE",
        "level": "warning",
        "message": "eRODS is in TEST mode …"
      }
    ],
    "counts": {
      "header": 9,
      "events": 42
    }
  },
  'GET /api/transfers/{id}': {
    "id": "trf_1",
    "method": "WEB_SERVICES",
    "status": "ACCEPTED",
    "erodsMode": "TEST",
    "comment": "ROADSIDE INSPECTION 2026-09-10",
    "fileName": "SMITH38018.csv",
    "fileSizeBytes": 2048,
    "counts": {
      "header": 9,
      "events": 42
    },
    "sentAt": "2026-09-11T15:41:00.000Z"
  },
  'GET /api/mobile/transfers': {
    "items": [
      {
        "id": "trf_1",
        "method": "WEB_SERVICES",
        "status": "TEST_ONLY",
        "erodsMode": "TEST",
        "referenceId": "ERODS-TEST-26-0910-4821",
        "sentAt": "2026-09-10T15:44:02.000Z",
        "createdAt": "2026-09-10T15:44:00.000Z",
        "fileName": "SMITH38018.csv",
        "outputFileComment": "ROADSIDE INSPECTION 2026-09-10",
        "rangeStart": "2026-09-03T00:00:00.000Z",
        "rangeEnd": "2026-09-10T00:00:00.000Z"
      }
    ],
    "total": 1,
    "limit": 5
  },
  'POST /api/mobile/transfers': {
    "id": "trf_1",
    "method": "WEB_SERVICES",
    "status": "QUEUED",
    "erodsMode": "TEST",
    "referenceId": null,
    "sentAt": null,
    "createdAt": "2026-09-10T15:44:02.000Z",
    "fileName": "SMITH38018.csv",
    "outputFileComment": "ROADSIDE INSPECTION 2026-09-10",
    "rangeStart": "2026-09-03T00:00:00.000Z",
    "rangeEnd": "2026-09-10T00:00:00.000Z",
    "warnings": [
      "ERODS_TEST_MODE"
    ],
    "counts": {
      "header": 9,
      "events": 42
    },
    "clientId": "0b9d6f5e-0000-4000-8000-000000000002",
    "requestedAt": "2026-09-10T15:40:00.000Z"
  },
  'POST /api/mobile/hos-state': {
    "hosEngineVersion": "1.0.3",
    "accepted": true,
    "versionMismatch": false,
    "updateRequired": false,
    "compared": true,
    "drift": false,
    "maxDriftSec": 0,
    "fields": [],
    "statusMismatch": false,
    "serverState": {
      "currentStatus": "D",
      "driveRemainingSec": 3600,
      "shiftRemainingSec": 7200,
      "breakRemainingSec": 1800,
      "cycleRemainingSec": 36000,
      "dailyTotals": {
        "off": 3600,
        "sb": 0,
        "drive": 36000,
        "on": 1800
      },
      "violations": [],
      "statusSince": "2026-10-08T13:00:00.000Z",
      "nextBreakDueAt": "2026-10-08T15:30:00.000Z",
      "shiftEndsAt": "2026-10-08T17:00:00.000Z",
      "cycleRecapAt": null,
      "restartAvailableAt": null
    },
    "driftThresholdSec": 60
  },
  'GET /api/dvir': {
    "items": [
      {
        "id": "dvir_1",
        "driverId": "drv_1",
        "vehicleId": "veh_1",
        "type": "PRE_TRIP",
        "vehicleCondition": "DEFECTS_FOUND",
        "repairStatus": "PENDING"
      }
    ],
    "page": 1,
    "limit": 25,
    "total": 1,
    "totalPages": 1
  },
  'GET /api/dvir/compliance': {
    "expected": 60,
    "submitted": 57,
    "compliancePct": 95,
    "missing": [
      {
        "vehicleId": "veh_1",
        "unitNumber": "110",
        "date": "2026-09-20"
      }
    ]
  },
  'GET /api/dvir/{id}': {
    "id": "dvir_1",
    "vehicleId": "veh_1",
    "defects": [
      {
        "id": "def_1",
        "part": "TRUCK",
        "severity": "CRITICAL",
        "status": "OPEN"
      }
    ]
  },
  'POST /api/dvir/{id}/mechanic-signoff': {
    "id": "dvir_1",
    "mechanicName": "J. Alvarez",
    "repairStatus": "REPAIRED",
    "mechanicSignedAt": "2026-09-11T15:41:00.000Z"
  },
  'PATCH /api/dvir/{id}/next-driver-review': {
    "id": "dvir_1",
    "nextDriverReviewedAt": "2026-09-11T15:41:00.000Z"
  },
  'GET /api/defects': {
    "items": [
      {
        "id": "def_1",
        "vehicleId": "veh_1",
        "severity": "CRITICAL",
        "status": "OPEN",
        "outOfService": true
      }
    ],
    "page": 1,
    "limit": 25,
    "total": 1,
    "totalPages": 1
  },
  'GET /api/defects/{id}': {
    "id": "def_1",
    "vehicleId": "veh_1",
    "severity": "CRITICAL",
    "status": "OPEN"
  },
  'PATCH /api/defects/{id}/resolve': {
    "id": "def_1",
    "status": "REPAIRED",
    "resolutionType": "REPAIRED",
    "resolvedAt": "2026-09-11T15:41:00.000Z"
  },
  'PATCH /api/defects/{id}/assign': {
    "id": "def_1",
    "assigneeId": "usr_2"
  },
  'PATCH /api/defects/{id}/work-order': {
    "id": "def_1",
    "workOrderId": "wo_1"
  },
  'GET /api/work-orders': {
    "items": [
      {
        "id": "wo_1",
        "number": "WO-0001",
        "vehicleId": "veh_1",
        "status": "OPEN",
        "priority": "NORMAL"
      }
    ],
    "page": 1,
    "limit": 25,
    "total": 1,
    "totalPages": 1
  },
  'POST /api/work-orders': {
    "id": "wo_9",
    "number": "WO-0009",
    "vehicleId": "veh_1",
    "status": "OPEN",
    "priority": "NORMAL"
  },
  'GET /api/work-orders/{id}': {
    "id": "wo_1",
    "number": "WO-0001",
    "vehicleId": "veh_1",
    "status": "OPEN"
  },
  'PATCH /api/work-orders/{id}': {
    "id": "wo_1",
    "status": "IN_PROGRESS",
    "costUsd": "420.00"
  },
  'POST /api/work-orders/{id}/close': {
    "id": "wo_1",
    "status": "DONE",
    "closedAt": "2026-09-11T15:41:00.000Z"
  },
  'POST /api/work-orders/{id}/cancel': {
    "id": "wo_1",
    "status": "CANCELLED"
  },
  'POST /api/work-orders/{id}/defects/{defectId}': {
    "id": "wo_1",
    "status": "OPEN"
  },
  'GET /api/maintenance-schedules': {
    "items": [
      {
        "id": "ms_1",
        "vehicleId": "veh_1",
        "name": "Brake service",
        "intervalMi": 25000,
        "due": {
          "state": "DUE_SOON",
          "nextDueMi": 995000,
          "milesRemaining": 300
        }
      }
    ],
    "page": 1,
    "limit": 25,
    "total": 1,
    "totalPages": 1
  },
  'POST /api/maintenance-schedules': {
    "id": "ms_9",
    "vehicleId": "veh_1",
    "name": "DOT annual inspection",
    "intervalDays": 365
  },
  'GET /api/maintenance-schedules/{id}': {
    "id": "ms_1",
    "vehicleId": "veh_1",
    "name": "Brake service",
    "due": {
      "state": "OK"
    }
  },
  'PATCH /api/maintenance-schedules/{id}': {
    "id": "ms_1",
    "enabled": false,
    "status": "REJECTED",
    "reviewNote": "Amount does not match the PDF."
  },
  'DELETE /api/maintenance-schedules/{id}': {
    "deleted": true
  },
  'POST /api/maintenance-schedules/{id}/complete': {
    "id": "ms_1",
    "lastServiceMi": 994700,
    "nextDueMi": 1019700
  },
  'GET /api/support/tickets': {
    "items": [
      {
        "id": "tck_1",
        "number": "TCK-000001",
        "subject": "Device offline",
        "status": "OPEN"
      }
    ],
    "page": 1,
    "limit": 25,
    "total": 1,
    "totalPages": 1
  },
  'POST /api/support/tickets': {
    "id": "tck_9",
    "number": "TCK-000009",
    "subject": "eRODS transfer rejected",
    "status": "OPEN",
    "priority": "NORMAL"
  },
  'GET /api/support/tickets/{id}': {
    "id": "tck_1",
    "number": "TCK-000001",
    "subject": "Device offline",
    "body": "Unit #110 has not reported since Sep 09.",
    "status": "OPEN",
    "priority": "HIGH",
    "requesterType": "USER",
    "requesterId": "usr_1",
    "createdAt": "2026-09-11T15:41:00.000Z"
  },
  'PATCH /api/support/tickets/{id}': {
    "id": "tck_1",
    "number": "TCK-000001",
    "status": "RESOLVED",
    "priority": "HIGH",
    "assigneeId": "usr_2"
  },
  'POST /api/support/chats': {
    "conversationId": "cnv_9",
    "messageId": "msg_1"
  },
  'POST /api/feedback': {
    "id": "fbk_1",
    "rating": 5,
    "message": "The 8-day recap view is exactly what we needed.",
    "source": "WEB",
    "createdAt": "2026-09-11T15:41:00.000Z"
  },
  'POST /api/mobile/feedback': {
    "id": "fbk_1",
    "driverId": "drv_1",
    "userId": null,
    "answers": {
      "tenure": "1-3 years",
      "ease": "Easy",
      "hosSatisfaction": "Satisfied",
      "recommend": 9,
      "overallExperience": 5
    },
    "comment": "Great app!",
    "appVersion": "1.0.3",
    "platform": "android",
    "createdAt": "2026-09-21T00:00:00.000Z"
  },
  'GET /api/mobile/support/tickets': {
    "items": [
      {
        "id": "tck_1",
        "number": "TCK-000001",
        "subject": "App crashes on certify",
        "body": "It closes after tapping Certify.",
        "category": "diagnostics",
        "priority": "NORMAL",
        "status": "OPEN",
        "contactMethod": null,
        "createdAt": "2026-09-21T00:00:00.000Z",
        "updatedAt": "2026-09-21T00:00:00.000Z"
      }
    ]
  },
  'POST /api/mobile/support/tickets': {
    "id": "tck_9",
    "number": "TCK-000009",
    "subject": "App crashes on certify",
    "body": "It closes after tapping Certify.",
    "category": "diagnostics",
    "priority": "NORMAL",
    "status": "OPEN",
    "createdByUserId": null,
    "createdByDriverId": "drv_1",
    "assignedToId": null,
    "contactMethod": "PHONE",
    "createdAt": "2026-10-08T00:00:00.000Z",
    "updatedAt": "2026-10-08T00:00:00.000Z",
    "resolvedAt": null
  },
  'GET /api/mobile/support/tickets/{id}': {
    "id": "tck_9",
    "number": "TCK-000009",
    "subject": "App crashes on certify",
    "body": "It closes after tapping Certify.",
    "category": "diagnostics",
    "priority": "NORMAL",
    "status": "OPEN",
    "contactMethod": null,
    "createdAt": "2026-10-08T00:00:00.000Z",
    "updatedAt": "2026-10-08T00:00:00.000Z"
  },
  'GET /api/trips': {
    "items": [
      {
        "id": "trp_1",
        "number": "TRP-1001",
        "status": "PLANNED"
      }
    ],
    "page": 1,
    "limit": 25,
    "total": 1,
    "totalPages": 1
  },
  'POST /api/trips': {
    "id": "trp_3",
    "number": "TRP-1003",
    "status": "PLANNED"
  },
  'GET /api/trips/unassigned-loads': {
    "items": [
      {
        "id": "trp_2",
        "number": "TRP-1002",
        "status": "PLANNED"
      }
    ]
  },
  'GET /api/trips/{id}': {
    "id": "trp_1",
    "number": "TRP-1001",
    "status": "ASSIGNED",
    "stops": []
  },
  'PATCH /api/trips/{id}': {
    "id": "trp_1",
    "status": "IN_PROGRESS"
  },
  'POST /api/trips/{id}/assign': {
    "id": "trp_2",
    "status": "ASSIGNED",
    "driverId": "drv_1"
  },
  'POST /api/trips/auto-assign': {
    "assigned": [
      {
        "tripId": "trp_2",
        "driverId": "drv_1"
      }
    ],
    "skipped": 0
  },
  'GET /api/safety/events': {
    "items": [
      {
        "id": "sfe_1",
        "type": "HARSH_BRAKING",
        "severity": 3,
        "status": "NEW"
      }
    ],
    "page": 1,
    "limit": 25,
    "total": 1,
    "totalPages": 1
  },
  'PATCH /api/safety/events/{id}': {
    "id": "sfe_1",
    "status": "REVIEWED"
  },
  'GET /api/safety/scorecard': {
    "periodStart": "2026-09-11",
    "periodEnd": "2026-10-10",
    "computedAt": "2026-10-11T10:30:02.000Z",
    "minMiles": 100,
    "fleet": {
      "score": 88,
      "previousScore": 85,
      "trend": 3,
      "scoredDrivers": 12,
      "unscoredDrivers": 2,
      "belowThresholdCount": 1,
      "milesDriven": 48210
    },
    "items": [
      {
        "id": "dsc_1",
        "driverId": "drv_1",
        "periodStart": "2026-09-11",
        "periodEnd": "2026-10-10",
        "score": 96,
        "scored": true,
        "harshCount": 1,
        "speedingCount": 0,
        "seatbeltCount": 0,
        "milesDriven": 5210,
        "violationCount": 0,
        "rank": 1,
        "previousScore": 92,
        "trend": 4,
        "computedAt": "2026-10-11T10:30:02.000Z"
      },
      {
        "id": "dsc_2",
        "driverId": "drv_2",
        "periodStart": "2026-09-11",
        "periodEnd": "2026-10-10",
        "score": null,
        "scored": false,
        "harshCount": 0,
        "speedingCount": 0,
        "seatbeltCount": 0,
        "milesDriven": 42,
        "violationCount": 0,
        "rank": null,
        "previousScore": null,
        "trend": null,
        "computedAt": "2026-10-11T10:30:02.000Z"
      }
    ]
  },
  'POST /api/safety/coaching': {
    "id": "sfe_1",
    "status": "COACHED",
    "coachedById": "usr_1"
  },
  'GET /api/geofences': {
    "items": [
      {
        "id": "gf_1",
        "name": "Columbus Terminal",
        "type": "CIRCLE",
        "radiusMi": 1,
        "alertOnEnter": true,
        "colour": "BLUE",
        "countAsYardMove": false,
        "vehicleGroupId": null,
        "vehicleGroupName": null
      }
    ]
  },
  'POST /api/geofences': {
    "id": "gf_2",
    "name": "Cust. dock 4",
    "type": "CIRCLE",
    "radiusMi": 0.5,
    "colour": "GREEN",
    "countAsYardMove": true,
    "vehicleGroupId": "b1c2d3e4-0000-4000-8000-000000000001"
  },
  'GET /api/geofences/{id}': {
    "id": "gf_1",
    "name": "Columbus Terminal",
    "type": "CIRCLE",
    "colour": "BLUE",
    "countAsYardMove": false,
    "vehicleGroupId": "b1c2d3e4-0000-4000-8000-000000000001",
    "vehicleGroupName": "Northeast"
  },
  'PATCH /api/geofences/{id}': {
    "id": "gf_1",
    "enabled": false,
    "vehicleGroupId": null
  },
  'DELETE /api/geofences/{id}': {
    "id": "gf_1",
    "deleted": true
  },
  'GET /api/search': {
    "q": "smith",
    "drivers": [
      {
        "id": "drv_1",
        "name": "John Smith"
      }
    ],
    "vehicles": []
  },
  'GET /api/live/fleet': {
    "items": [
      {
        "vehicleId": "veh_1",
        "unitNumber": "101",
        "driverId": "drv_1",
        "driverName": "John Smith",
        "driverPhone": "+1 334 765 4888",
        "dutyStatus": "ON_DUTY",
        "speedMph": 0,
        "headingDeg": 274,
        "odometerMi": 993589,
        "lat": 38.99,
        "lon": -84.63,
        "locationLabel": "0.64 mi N of Florence, KY",
        "lastSeenAt": "2026-09-12T15:39:00.000Z",
        "driveRemainingSec": 0,
        "shiftEndsAt": "2026-09-12T15:59:34.000Z",
        "eldSerial": "PT30_A86E",
        "bleState": "CONNECTED",
        "recordStatus": "ACTIVE",
        "connectivity": "ONLINE",
        "isStale": false,
        "staleSince": null
      }
    ],
    "generatedAt": "2026-09-12T15:39:10.000Z"
  },
  'GET /api/dashboard/summary': {
    "liveFleet": {
      "items": [
        {
          "vehicleId": "veh_1",
          "unitNumber": "101",
          "dutyStatus": "DRIVING",
          "recordStatus": "ACTIVE",
          "connectivity": "ONLINE",
          "isStale": false,
          "staleSince": null
        }
      ],
      "generatedAt": "2026-09-16T15:39:10.000Z",
      "counts": {
        "total": 42,
        "onDuty": 30,
        "moving": 18,
        "idle": 5,
        "offline": 2
      }
    },
    "violations": {
      "items": [
        {
          "id": "vio_1",
          "type": "DRIVING_11",
          "driverName": "John Smith",
          "unitNumber": "101"
        }
      ],
      "total": 3
    },
    "unidentified": {
      "total": 2,
      "totalDurationSec": 3600
    },
    "notifications": {
      "unreadCount": 4
    },
    "carrier": {
      "id": "carrier",
      "name": "Universal Logistics Inc.",
      "timezone": "America/New_York"
    },
    "vehicles": {
      "active": 40,
      "total": 45,
      "inactive": 3,
      "outOfService": 2
    },
    "generatedAt": "2026-09-16T15:39:10.000Z"
  },
  'POST /api/reports/generate': {
    "reportId": "rpt_1",
    "status": "QUEUED"
  },
  'GET /api/reports': {
    "items": [
      {
        "id": "rpt_1",
        "type": "IFTA",
        "status": "READY",
        "requestedAt": "2026-09-11T06:00:00.000Z"
      }
    ],
    "page": 1,
    "limit": 25,
    "total": 1,
    "totalPages": 1
  },
  'GET /api/reports/schedules': {
    "items": [
      {
        "id": "sch_1",
        "reportType": "ACTIVITY",
        "cron": "0 6 * * 1",
        "enabled": true,
        "nextRunAt": "2026-09-14T06:00:00.000Z"
      }
    ]
  },
  'POST /api/reports/schedules': {
    "id": "sch_1",
    "reportType": "ACTIVITY",
    "cron": "0 6 * * 1",
    "nextRunAt": "2026-09-14T06:00:00.000Z"
  },
  'PATCH /api/reports/schedules/{id}': {
    "id": "sch_1",
    "enabled": false
  },
  'GET /api/reports/ifta': {
    "reportId": "rpt_2",
    "status": "QUEUED"
  },
  'GET /api/reports/ifta/jurisdictions': {
    "items": [
      {
        "code": "AL",
        "name": "Alabama",
        "country": "US"
      },
      {
        "code": "ON",
        "name": "Ontario",
        "country": "CA"
      }
    ]
  },
  'GET /api/reports/ifta/summary': {
    "quarter": "2026-Q3",
    "unitCount": 12,
    "kpis": {
      "totalMiles": 48213,
      "taxableMiles": 48213,
      "taxablePct": 100,
      "fuelGal": 6021.4,
      "receiptCount": 312,
      "fleetMpg": 8.01,
      "fleetMpgPrev": 7.86
    },
    "rows": [
      {
        "jurisdiction": "CA",
        "totalMiles": 9120,
        "taxableMiles": 9120,
        "fuelGal": 1138.9,
        "mpg": 8.01,
        "taxDueUsd": null
      }
    ],
    "totals": {
      "totalMiles": 48213,
      "taxableMiles": 48213,
      "fuelGal": 6021.4,
      "mpg": 8.01,
      "taxDueUsd": null
    }
  },
  'GET /api/reports/activity': {
    "reportId": "rpt_3",
    "status": "QUEUED"
  },
  'GET /api/reports/activity/summary': {
    "kpis": {
      "drivingSec": 412200,
      "drivingDeltaPct": 4.2,
      "onDutySec": 88200,
      "distanceMi": 18412,
      "violations": 3,
      "violationsDelta": -1
    },
    "items": [
      {
        "driverId": "drv_1",
        "name": "Doe, John",
        "days": 8,
        "offSec": 172800,
        "sbSec": 28800,
        "drivingSec": 39600,
        "onSec": 7200,
        "distanceMi": 512,
        "violations": 0,
        "certifiedDays": 8
      }
    ],
    "page": 1,
    "limit": 25,
    "total": 264,
    "totalPages": 11
  },
  'GET /api/reports/dvir': {
    "reportId": "rpt_4",
    "status": "QUEUED"
  },
  'GET /api/reports/fmcsa-pack': {
    "reportId": "rpt_5",
    "status": "QUEUED"
  },
  'GET /api/reports/{id}': {
    "id": "rpt_1",
    "type": "IFTA",
    "status": "READY",
    "rowCount": 12,
    "completedAt": "2026-09-11T06:01:00.000Z"
  },
  'GET /api/reports/{id}/download': {
    "downloadUrl": "https://minio.local/reports/rpt_1.csv?X-Amz-Signature=...",
    "expiresAt": "2026-09-18T06:01:00.000Z",
    "fileName": "rpt_1.csv"
  },
};

/** `fixture('GET /api/vehicles')` — the payload the backend documents for that operation. */
export function fixture<T = unknown>(operation: string): T {
  const example = OPENAPI_EXAMPLES[operation];
  if (example === undefined) {
    throw new Error(`No documented example for ${operation} in backend/docs/openapi.json`);
  }
  return structuredClone(example) as T;
}
