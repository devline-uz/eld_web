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
  'POST /api/auth/email/verify': {
    "success": true
  },
  'GET /api/auth/me': {
    "id": "usr_1",
    "type": "user",
    "role": "ADMIN",
    "permissions": {},
    "fullName": "Sarah Chen",
    "email": "sarah.chen@universal-logistics.com",
    "avatarUrl": null,
    "carrierName": "Universal Logistics Inc.",
    "homeTerminalTimezone": "America/New_York"
  },
  'GET /api/carrier': {
    "id": "carrier",
    "name": "Acme Trucking",
    "dotNumber": "1234567",
    "eldIdentifier": "OBK1",
    "erodsMode": "TEST"
  },
  'PATCH /api/carrier': {
    "id": "carrier",
    "name": "Universal Logistics Inc.",
    "dotNumber": "1234567",
    "timezone": "America/New_York",
    "eldIdentifier": "OBK1",
    "eldRegistrationId": null,
    "erodsMode": "TEST"
  },
  'GET /api/carrier/transfer-config': {
    "timezone": "America/New_York",
    "eldIdentifier": "OBK1",
    "eldRegistrationId": null,
    "erodsMode": "TEST"
  },
  'GET /api/attachments/{id}/presign': {
    "url": "https://minio.internal/onebook/dvir/photo.jpg?X-Amz-Signature=...",
    "expiresAt": "2026-09-24T15:56:00.000Z"
  },
  'GET /api/roles': [
    {
      "key": "ADMIN",
      "isSystem": true,
      "permissions": {}
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
    "inviteToken": "eyJ..."
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
    "role": {
      "key": "DISPATCHER",
      "name": "Dispatcher"
    }
  },
  'DELETE /api/users/{id}': {
    "success": true
  },
  'POST /api/users/{id}/resend-invite': {
    "user": {
      "id": "usr_8",
      "email": "anna.weiss@universal-logistics.com",
      "status": "INVITED"
    },
    "inviteToken": "eyJ...",
    "expiresAt": "2026-09-15T15:41:00.000Z"
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
          "splitSleeperEnabled": false
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
        "emailVerified": null
      }
    ],
    "page": 1,
    "limit": 25,
    "total": 1,
    "totalPages": 1
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
    "computedAt": "2026-09-12T20:00:00.000Z"
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
    "allowPersonalConveyance": false
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
        "rangeStart": "2026-09-03",
        "rangeEnd": "2026-09-10"
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
    "rangeStart": "2026-09-03",
    "rangeEnd": "2026-09-10",
    "warnings": [
      "ERODS_TEST_MODE"
    ],
    "counts": {
      "header": 9,
      "events": 42
    }
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
    "totalPages": 1
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
        "licensePlate": "TRL-9921",
        "licenseState": "OH"
      }
    ]
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
    "licensePlate": "TRL-9922"
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
    "triggered": true
  },
  'GET /api/notifications': {
    "items": [
      {
        "id": "ntf_1",
        "type": "hos_violation",
        "kind": "VIOLATION",
        "title": "HOS violation",
        "body": "An HOS violation was detected.",
        "objectType": "Driver",
        "objectId": "drv_1",
        "category": "VIOLATIONS",
        "severity": "CRITICAL",
        "readAt": null
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
    }
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
  'GET /api/mobile/bootstrap': {
    "serverTime": "2026-09-11T15:41:00.000Z",
    "hosEngineVersion": "1.0.1",
    "driver": {
      "id": "drv_1",
      "firstName": "John",
      "lastName": "Smith",
      "cdlNumber": "W8569238",
      "cdlState": "KY"
    },
    "vehicle": {
      "id": "veh_1",
      "unitNumber": "4821"
    },
    "device": {
      "id": "dev_1",
      "serial": "PT30-001",
      "bleState": "CONNECTED"
    },
    "hos": {
      "state": {
        "currentStatus": "ON",
        "driveRemainingSec": 39600
      }
    },
    "inspectionPacket": {
      "days": []
    },
    "syncConfig": {
      "batchMaxChanges": 500,
      "batchMaxBytes": 1048576
    }
  },
  'POST /api/mobile/sync': {
    "accepted": [
      "uuid1"
    ],
    "rejected": [
      {
        "clientId": "uuid3",
        "code": "DRIVING_TIME_IMMUTABLE"
      }
    ],
    "serverChanges": [],
    "serverTime": "2026-09-11T15:41:00.000Z",
    "hosEngineVersion": "1.0.1",
    "nextSyncAfterSec": 60
  },
  'POST /api/mobile/duty-status': {
    "id": "evt_9101",
    "status": "ON",
    "startAt": "2026-09-11T15:41:00.000Z",
    "recordOrigin": 2,
    "recordStatus": 1,
    "applied": true
  },
  'POST /api/mobile/signature': {
    "signatureImageId": "sig_9c2a",
    "attachmentId": null,
    "key": "signatures/drv_1/sig_9c2a.png",
    "sha256": "a1b2...",
    "sizeBytes": 4821
  },
  'POST /api/mobile/dvir': {
    "id": "dvir_1",
    "vehicleId": "veh_1",
    "type": "PRE_TRIP",
    "vehicleCondition": "DEFECTS_FOUND",
    "defectCount": 1,
    "photoCount": 2,
    "outOfService": false,
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
  'POST /api/mobile/select-vehicle': {
    "id": "veh_1",
    "unitNumber": "104",
    "vin": "1FUJA6CV71LM12345",
    "make": "Freightliner",
    "model": "Cascadia",
    "year": 2021,
    "sleeperBerth": true,
    "status": "ACTIVE",
    "odometerMi": 84213
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
    "id": "trip_1",
    "number": "T-1042",
    "status": "IN_PROGRESS",
    "stops": [],
    "documents": []
  },
  'PATCH /api/mobile/trip': {
    "id": "trip_1",
    "shippingDocument": "BOL-2201",
    "trailerId": "trl_1",
    "notes": "Left the yard early"
  },
  'GET /api/mobile/dvirs': [
    {
      "id": "dvir_1",
      "vehicleId": "veh_1",
      "type": "PRE_TRIP",
      "submittedAt": "2026-09-10T12:00:00.000Z",
      "vehicleCondition": "DEFECTS_FOUND",
      "defectCount": 1,
      "repairStatus": "PENDING"
    }
  ],
  'GET /api/mobile/dvirs/{id}': {
    "id": "dvir_1",
    "vehicleId": "veh_1",
    "defects": [],
    "photos": []
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
    "platform": "IOS",
    "lastSeenAt": "2026-09-21T00:00:00.000Z"
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
      "storedEventsCount": 12
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
      "maxDriftSec": 4,
      "driftAlerted": false
    }
  },
  'GET /api/mobile/conversations': {
    "items": [
      {
        "id": "cnv_1",
        "type": "DIRECT",
        "lastMessage": {
          "id": "msg_1",
          "body": "On schedule."
        },
        "unreadCount": 2
      }
    ]
  },
  'GET /api/mobile/conversations/{id}/messages': {
    "items": [
      {
        "id": "msg_1",
        "body": "On schedule.",
        "sentAt": "2026-09-11T15:00:00.000Z"
      }
    ],
    "limit": 50
  },
  'POST /api/mobile/conversations/{id}/messages': {
    "id": "msg_2",
    "body": "Confirmed.",
    "sentAt": "2026-09-11T15:05:00.000Z"
  },
  'POST /api/mobile/conversations/{id}/read': {
    "messagesMarked": 3
  },
  'POST /api/logs/edit-requests/{id}/accept': {
    "id": "edt_1",
    "status": "ACCEPTED",
    "resolvedAt": "2026-09-11T15:41:00.000Z",
    "activeEventId": "evt_9001",
    "supersededEventId": "evt_8801",
    "recertificationRequired": true
  },
  'POST /api/logs/edit-requests/{id}/reject': {
    "id": "edt_1",
    "status": "REJECTED",
    "resolvedAt": "2026-09-11T15:41:00.000Z",
    "driverComment": "I was off duty, not on duty."
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
        "locationDescription": "0.64 mi N of Florence, KY",
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
    "id": "evt_9100",
    "eventSequenceId": 1043,
    "recordOrigin": 2,
    "recordStatus": 1,
    "dutyStatus": "ON",
    "occurredAt": "2026-09-10T18:26:58.000Z",
    "annotation": "Loading at shipper #4821",
    "recertificationRequired": true
  },
  'POST /api/mobile/certify': {
    "driverId": "drv_1",
    "certified": [
      {
        "date": "2026-09-10",
        "certifiedAt": "2026-09-11T15:41:00.000Z",
        "signatureCount": 1
      }
    ]
  },
  'GET /api/mobile/log-edit-requests': {
    "items": [
      {
        "id": "edt_1",
        "date": "2026-09-10",
        "status": "PENDING",
        "reason": "Driver forgot to switch to On duty while loading at shipper #4821.",
        "proposed": {
          "status": "ON",
          "startAt": "2026-09-10T18:26:58.000Z",
          "endAt": "2026-09-10T19:30:00.000Z"
        }
      }
    ]
  },
  'GET /api/mobile/logs': {
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
  'POST /api/ingest/events': {
    "received": 120,
    "stored": 118,
    "duplicates": 2,
    "unidentified": 0,
    "warnings": [],
    "firstEventSequenceId": 1042,
    "lastEventSequenceId": 1159
  },
  'POST /api/ingest/telemetry': {
    "received": 60,
    "stored": 60,
    "duplicates": 0
  },
  'POST /api/ingest/ble-state': {
    "deviceId": "dev_1",
    "bleState": "OUT_OF_RANGE",
    "recordedAt": "2026-09-11T15:41:00.000Z",
    "diagnosticRaised": false
  },
  'POST /api/ingest/device-status': {
    "deviceId": "dev_1",
    "storedEventCount": 12,
    "firmwareVersion": "L108",
    "firmwareOutdated": false,
    "lastHeartbeatAt": "2026-09-11T15:41:00.000Z"
  },
  'GET /api/vehicles/{id}/dtc': {
    "items": [
      {
        "id": "dtc_1",
        "vehicleId": "veh_1",
        "spn": 100,
        "fmi": 1,
        "occurrence": 3,
        "source": "0",
        "description": null,
        "firstSeenAt": "2026-09-10T12:00:00.000Z",
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
  'GET /api/conversations/{id}/messages': {
    "items": [
      {
        "id": "msg_1",
        "body": "On schedule.",
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
        "bleState": "CONNECTED",
        "firmwareOutdated": false
      }
    ],
    "page": 1,
    "limit": 25,
    "total": 1,
    "totalPages": 1
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
        "model": "PT30",
        "bleMac": "A4:C1:38:12:9F:6E",
        "firmwareVersion": "L108"
      }
    ]
  },
  'GET /api/devices/{id}': {
    "id": "dev_1",
    "serial": "PT30_A86E",
    "model": "PT30",
    "status": "ASSIGNED",
    "vehicleId": "veh_1",
    "bleState": "CONNECTED",
    "firmwareVersion": "L108",
    "firmwareOutdated": false,
    "lastHeartbeatAt": "2026-09-11T15:41:00.000Z"
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
    "id": "seg_1",
    "status": "ASSIGNED",
    "driverId": "drv_1",
    "recordOrigin": 1,
    "eventCount": 4
  },
  'GET /api/unidentified/confirmation-requests': {
    "items": [
      {
        "id": "seg_1",
        "vehicleId": "veh_1",
        "status": "PENDING_CONFIRMATION",
        "assignedDriverId": "drv_1",
        "assignedById": "usr_1",
        "confirmationRequestedAt": "2026-09-11T15:41:00.000Z",
        "startAt": "2026-09-10T12:30:00.000Z",
        "endAt": "2026-09-10T13:00:00.000Z",
        "durationSec": 1800,
        "distanceMi": 21
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
    "id": "seg_1",
    "status": "ASSIGNED",
    "driverId": "drv_1",
    "assignedById": "usr_1",
    "assignedAt": "2026-09-11T15:41:00.000Z",
    "recordOrigin": 1,
    "eventCount": 4
  },
  'POST /api/unidentified/{id}/annotate': {
    "id": "seg_1",
    "status": "ANNOTATED",
    "annotation": "Yard move by shop tech",
    "annotatedById": "usr_1"
  },
  'POST /api/unidentified/{id}/reject': {
    "id": "seg_1",
    "status": "REJECTED",
    "driverId": null,
    "recordOrigin": 4,
    "eventCount": 4
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
  'POST /api/mobile/hos-state': {
    "accepted": true,
    "engineVersion": "1.0.1",
    "versionMismatch": false,
    "drift": false,
    "server": {
      "driveRemainingSec": 0,
      "shiftRemainingSec": 1140,
      "cycleRemainingSec": 46140,
      "breakRemainingSec": 7440
    },
    "deltasSec": {
      "driveRemainingSec": 0,
      "shiftRemainingSec": 0,
      "cycleRemainingSec": 0,
      "breakRemainingSec": 0
    }
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
    "enabled": false
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
    "comment": "Great app!",
    "createdAt": "2026-09-21T00:00:00.000Z"
  },
  'GET /api/mobile/support/tickets': {
    "items": [
      {
        "id": "tck_1",
        "subject": "App crashes on certify",
        "category": "diagnostics",
        "priority": "NORMAL",
        "status": "OPEN",
        "createdAt": "2026-09-21T00:00:00.000Z",
        "updatedAt": "2026-09-21T00:00:00.000Z"
      }
    ]
  },
  'POST /api/mobile/support/tickets': {
    "id": "tck_9",
    "number": "TCK-000009",
    "subject": "App crashes on certify",
    "status": "OPEN",
    "priority": "NORMAL"
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
    "items": [
      {
        "driverId": "drv_1",
        "score": 68,
        "harshCount": 4,
        "rank": 1,
        "previousScore": 74,
        "trend": -6
      }
    ],
    "periodStart": "2026-08-12",
    "periodEnd": "2026-09-11"
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
        "alertOnEnter": true
      }
    ]
  },
  'POST /api/geofences': {
    "id": "gf_2",
    "name": "Cust. dock 4",
    "type": "CIRCLE",
    "radiusMi": 0.5
  },
  'GET /api/geofences/{id}': {
    "id": "gf_1",
    "name": "Columbus Terminal",
    "type": "CIRCLE"
  },
  'PATCH /api/geofences/{id}': {
    "id": "gf_1",
    "enabled": false
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
        "bleState": "CONNECTED"
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
          "dutyStatus": "DRIVING"
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
      "total": 45
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
