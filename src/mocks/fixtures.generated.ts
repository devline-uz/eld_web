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
    "tokenType": "Bearer"
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
  'GET /api/auth/me': {
    "id": "usr_1",
    "type": "user",
    "role": "ADMIN",
    "permissions": {}
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
      "ip": "10.14.2.88",
      "userAgent": "Chrome/140 macOS",
      "createdAt": "2026-09-11T08:12:00.000Z",
      "lastUsedAt": "2026-09-11T15:39:00.000Z",
      "current": true
    }
  ],
  'DELETE /api/me/sessions/{id}': {
    "success": true
  },
  'GET /api/audit-log': {
    "items": [
      {
        "id": "42",
        "actorType": "USER",
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
  'POST /api/vehicles/import': {
    "imported": 2,
    "updated": 0,
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
        "checksumValid": true
      }
    ]
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
  'POST /api/unidentified/{id}/confirm': {
    "id": "seg_1",
    "status": "ASSIGNED",
    "driverId": "drv_1",
    "recordOrigin": 1,
    "eventCount": 4
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
    "outOfService": false,
    "applied": true
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
    "resolvedAt": "2026-09-11T15:41:00.000Z"
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
  'POST /api/feedback': {
    "id": "fbk_1",
    "rating": 5,
    "message": "The 8-day recap view is exactly what we needed.",
    "source": "WEB",
    "createdAt": "2026-09-11T15:41:00.000Z"
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
  'POST /api/integrations/webhook/test': {
    "id": "whd_1",
    "status": "QUEUED",
    "attempts": 0
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
        "rank": 1
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
  'GET /api/notifications': {
    "items": [
      {
        "id": "ntf_1",
        "type": "hos_violation",
        "title": "HOS violation",
        "body": "Driving limit exceeded.",
        "readAt": null
      }
    ],
    "page": 1,
    "limit": 25,
    "total": 1,
    "totalPages": 1
  },
  'POST /api/notifications/read-all': {
    "updated": 3
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
  'GET /api/reports/activity': {
    "reportId": "rpt_3",
    "status": "QUEUED"
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
