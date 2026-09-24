// Backend Phase 13 (2026-09-24, ../backend_tasks.md) — every endpoint it added or changed, called
// through the real client against the default MSW handler, and the unwrapped payload validated
// against backend/docs/openapi.json. Request bodies are checked against the documented
// `requestBody` schema too (required keys present, no undocumented keys), so a renamed DTO field —
// like B-68's `status` → `resolutionType` — fails here, not in production.
import { describe, expect, it } from 'vitest';
import { client } from '../../src/shared/api/client';
import { endpoints } from '../../src/shared/api/endpoints';
import type { ResolveDefectPayload } from '../../src/shared/api/dvir';
import type { ProposeEventPayload, CreateEditRequestPayload } from '../../src/shared/api/hosLogs';
import type { CreateTripPayload, UpdateTripPayload, AssignTripPayload } from '../../src/shared/api/trips';
import type { GeofencePayload } from '../../src/shared/api/geofences';
import type { CreateWorkOrderPayload } from '../../src/shared/api/dvir';
import type { InviteUserPayload, UpdateUserPayload, CreateTicketPayload, UpdateDevicePayload } from '../../src/shared/api/settingsAdmin';
import type { UpdateMyProfilePayload, MyPreferences } from '../../src/shared/api/me';
import { assertMatchesOpenApi, openapi, operation } from './openapi';

/* ------------------------------------------------------------------ request-body contract */

interface Schema {
  $ref?: string;
  type?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  enum?: unknown[];
  anyOf?: Schema[];
  oneOf?: Schema[];
}

const components = (openapi as unknown as { components?: { schemas?: Record<string, Schema> } }).components?.schemas ?? {};
const deref = (s: Schema | undefined): Schema | undefined => (s?.$ref ? deref(components[s.$ref.split('/').pop()!]) : s);

function requestSchema(method: string, path: string): Schema {
  const op = operation(method, path) as { requestBody?: { content?: Record<string, { schema?: Schema }> } } | null;
  const schema = deref(op?.requestBody?.content?.['application/json']?.schema);
  if (!schema?.properties) throw new Error(`${method} ${path} documents no JSON request body`);
  return schema;
}

/** Every key the client sends is documented (recursively for objects), every required key is sent,
 * and every enum value sent is one the DTO allows. */
function bodyProblems(schema: Schema | undefined, value: unknown, at = '$'): string[] {
  const s = deref(schema);
  if (!s || value === null || value === undefined) return [];
  const variants = s.anyOf ?? s.oneOf;
  if (variants) {
    const all = variants.map((v) => bodyProblems(v, value, at));
    return all.some((p) => p.length === 0) ? [] : all[0]!;
  }
  if (s.enum && !s.enum.includes(value)) return [`${at}: ${JSON.stringify(value)} is not one of ${JSON.stringify(s.enum)}`];
  if (Array.isArray(value)) return value.flatMap((v, i) => bodyProblems(s.items, v, `${at}[${i}]`));
  if (typeof value === 'object' && s.properties) {
    const problems: string[] = [];
    for (const key of s.required ?? []) if (!(key in (value as object))) problems.push(`${at}.${key}: required by the DTO, not sent`);
    for (const [key, v] of Object.entries(value as object)) {
      if (!(key in s.properties)) problems.push(`${at}.${key}: not a documented DTO field`);
      else problems.push(...bodyProblems(s.properties[key], v, `${at}.${key}`));
    }
    return problems;
  }
  return [];
}

function assertBodyMatches(method: string, path: string, body: unknown): void {
  expect(bodyProblems(requestSchema(method, path), body)).toEqual([]);
}

/* ------------------------------------------------------------------ response contract */

/**
 * Documented drift, recorded in web/backend-gaps.md ("Contract deviations", 2026-09-24): the
 * telemetry route returns the raw Prisma `TelemetryPoint`, whose `Decimal(9,6)` lat/lon serialise
 * as STRINGS (verified live on :3002), while the openapi example shows numbers. The mock follows
 * the live API; this is the only place the difference is tolerated, and only for a string that
 * parses as a finite number — anything else still fails.
 */
const DECIMAL_STRING_FIELDS: Record<string, string[]> = {
  '/api/vehicles/{id}/telemetry': ['latitude', 'longitude'],
};

function normaliseDecimals(documented: string, data: unknown): unknown {
  const fields = DECIMAL_STRING_FIELDS[documented];
  if (!fields) return data;
  const page = data as { items: Array<Record<string, unknown>> };
  return {
    ...page,
    items: page.items.map((row) => {
      const out = { ...row };
      for (const f of fields) {
        if (typeof out[f] === 'string') {
          const n = Number(out[f]);
          expect(Number.isFinite(n), `${documented} ${f}=${String(out[f])} is not a decimal string`).toBe(true);
          out[f] = n;
        }
      }
      return out;
    }),
  };
}

describe('Phase 13 responses match openapi.json (default MSW handlers)', () => {
  const GETS: Array<[string, string, Record<string, string | number> | undefined]> = [
    ['/api/vehicles/{id}/histories', endpoints.vehicles.histories('veh_1'), { date: '2026-09-24' }],
    ['/api/vehicles/{id}/activities', endpoints.vehicles.activities('veh_1'), undefined],
    ['/api/vehicles/{id}/telemetry', endpoints.vehicles.telemetry('veh_1'), { limit: 1 }],
    ['/api/co-driver-pairings', endpoints.coDriverPairings.list, { vehicleId: 'veh_1', active: 'true' }],
    ['/api/devices/{id}/diagnostics', endpoints.devices.diagnostics('dev_1'), undefined],
    ['/api/dvir/compliance', endpoints.dvir.compliance, { from: '2026-09-01', to: '2026-09-24' }],
    ['/api/attachments/{id}/presign', endpoints.attachments.presign('att_1'), undefined],
    ['/api/notification-channels', endpoints.notificationChannels.root, undefined],
    ['/api/integrations/catalog', endpoints.integrations.catalog, undefined],
    ['/api/me/preferences', endpoints.me.preferences, undefined],
    ['/api/carrier/transfer-config', endpoints.carrier.transferConfig, undefined],
    ['/api/search', endpoints.search.root, { q: 'smith', limit: 5 }],
    ['/api/notifications', endpoints.notifications.list, { category: 'VIOLATIONS', limit: 25 }],
  ];

  it.each(GETS)('GET %s', async (documented, path, params) => {
    const data = await client.get(path, { params });
    assertMatchesOpenApi('GET', documented, normaliseDecimals(documented, data));
  });

  const WRITES: Array<[string, string, string, unknown]> = [
    ['PATCH', '/api/vehicles/bulk-status', endpoints.vehicles.bulkStatus, { ids: ['veh_1'], status: 'INACTIVE' }],
    ['POST', '/api/drivers/{id}/reset-password', endpoints.drivers.resetPassword('drv_1'), undefined],
    ['POST', '/api/drivers/{id}/send-verification', endpoints.drivers.sendVerification('drv_1'), undefined],
    ['POST', '/api/drivers/{id}/verify-email', endpoints.drivers.verifyEmail('drv_1'), { token: 't' }],
    ['POST', '/api/drivers/{id}/documents', endpoints.drivers.documents('drv_1'), { type: 'CDL', fileName: 'cdl.pdf', contentType: 'application/pdf', sizeBytes: 1024 }],
    ['DELETE', '/api/drivers/{id}/documents/{docId}', endpoints.drivers.document('drv_1', 'doc_1'), undefined],
    ['POST', '/api/co-driver-pairings', endpoints.coDriverPairings.create, { primaryDriverId: 'drv_1', coDriverId: 'drv_2', vehicleId: 'veh_1' }],
    ['POST', '/api/co-driver-pairings/{id}/end', endpoints.coDriverPairings.end('pair_1'), undefined],
    ['PATCH', '/api/defects/{id}/resolve', endpoints.defects.resolve('def_1'), { resolutionType: 'NOT_REQUIRED', resolutionNote: 'Within spec' }],
    ['PATCH', '/api/defects/{id}/assign', endpoints.defects.assign('def_1'), { assigneeId: 'usr_2' }],
    ['POST', '/api/logs/{driverId}/events', endpoints.logs.proposeEvent('drv_1'), { status: 'ON', eventDateTime: '2026-09-10T13:00:00.000Z', endDateTime: '2026-09-10T14:30:00.000Z', annotation: 'Pre-trip' }],
    ['POST', '/api/conversations/{id}/read', endpoints.conversations.read('cnv_1'), undefined],
    ['POST', '/api/notifications/{id}/read', endpoints.notificationItem.markRead('ntf_1'), undefined],
    ['PATCH', '/api/notification-channels', endpoints.notificationChannels.root, { webhook: { enabled: false } }],
    ['POST', '/api/alert-rules/{id}/test', endpoints.alertRules.test('alr_1'), undefined],
    ['POST', '/api/support/chats', endpoints.support.chats, { message: 'Help' }],
    ['PATCH', '/api/devices/{id}', endpoints.devices.update('dev_1'), { autoFirmware: true, shareDiagnostics: false }],
    ['PUT', '/api/me/preferences', endpoints.me.preferences, { language: 'en', timezone: 'America/Chicago', dateFormat: 'MMM D, YYYY', distanceUnit: 'MILES' }],
    ['DELETE', '/api/me/avatar', endpoints.me.avatar, undefined],
    ['DELETE', '/api/me/sessions', endpoints.me.sessions, undefined],
    ['POST', '/api/auth/email/verify', endpoints.auth.emailVerify, { token: 't' }],
  ];

  it.each(WRITES)('%s %s', async (method, documented, path, body) => {
    if (body !== undefined) assertBodyMatches(method, documented, body);
    const call = {
      POST: () => client.post(path, body),
      PATCH: () => client.patch(path, body),
      PUT: () => client.put(path, body),
      DELETE: () => client.delete(path),
    }[method]!;
    assertMatchesOpenApi(method, documented, await call());
  });

  it('POST /api/me/avatar (multipart) matches the documented result', async () => {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(8)], { type: 'image/png' }), 'a.png');
    assertMatchesOpenApi('POST', '/api/me/avatar', await client.upload(endpoints.me.avatar, form));
  });

  it('GET /api/dvir/{id}/pdf answers a PDF blob', async () => {
    expect(operation('GET', '/api/dvir/{id}/pdf')).not.toBeNull();
    const blob = await client.blob(endpoints.dvir.pdf('dvir_1'));
    expect(blob.type).toBe('application/pdf');
  });

  it('driver documents: POST returns a presigned uploadUrl and the row appears in GET', async () => {
    const created = await client.post<{ id: string; uploadUrl: string }>(endpoints.drivers.documents('drv_9'), {
      type: 'MEDICAL_CARD', fileName: 'med.pdf', contentType: 'application/pdf', sizeBytes: 10, expiresAt: '2027-01-01T00:00:00.000Z',
    });
    expect(created.uploadUrl).toBeTruthy();
    const list = await client.get<Array<{ id: string; uploadUrl?: string }>>(endpoints.drivers.documents('drv_9'));
    assertMatchesOpenApi('GET', '/api/drivers/{id}/documents', list);
    expect(list.map((d) => d.id)).toContain(created.id);
    expect(list.every((d) => d.uploadUrl === undefined)).toBe(true);
  });
});

/* ------------------------------------------------------------------ request bodies of changed DTOs */

describe('Phase 13 request payload types stay inside the documented DTOs', () => {
  it('PATCH /defects/:id/resolve — B-68/B-70 (resolutionType, never status)', () => {
    const payload: ResolveDefectPayload = {
      resolutionType: 'REPAIRED', resolutionNote: 'Pads', correctedBy: 'J. Mechanic',
      completedAt: '2026-09-24T12:00:00.000Z', laborHours: 1.5, partsCostUsd: 84.2,
    };
    assertBodyMatches('PATCH', '/api/defects/{id}/resolve', payload);
    expect(bodyProblems(requestSchema('PATCH', '/api/defects/{id}/resolve'), { status: 'REPAIRED' })).not.toEqual([]);
  });

  it('POST /logs/:driverId/edit-requests — B-39 proposedSpecial, notifyDriver, name-only location', () => {
    const payload: CreateEditRequestPayload = {
      originalEventId: 'evt_1', proposedStatus: 'ON', proposedSpecial: 'YM', proposedStart: '2026-09-10T18:26:58.000Z',
      location: { name: 'Shipper #4821' }, reason: 'Yard move at shipper', notifyDriver: true,
    };
    assertBodyMatches('POST', '/api/logs/{driverId}/edit-requests', payload);
  });

  it('POST /logs/:driverId/events — B-72', () => {
    const payload: ProposeEventPayload = {
      status: 'OFF', proposedSpecial: 'PC', eventDateTime: '2026-09-10T13:00:00.000Z', endDateTime: '2026-09-10T14:00:00.000Z',
      location: { lat: 39.96, lon: -82.99, name: 'Columbus, OH' }, annotation: 'Personal conveyance', notifyDriver: true,
    };
    assertBodyMatches('POST', '/api/logs/{driverId}/events', payload);
  });

  it('POST /unidentified/:id/assign — B-83 requireDriverConfirmation', () => {
    assertBodyMatches('POST', '/api/unidentified/{id}/assign', { driverId: 'drv_1', annotation: 'Yard', requireDriverConfirmation: true });
  });

  it('trips — B-73/B-74/B-92 create, patch (publish), assign notify', () => {
    const create: CreateTripPayload = {
      number: 'TRP-1', distanceMi: 312.4, rateUsd: 1850, customer: 'Acme', estimatedDriveSec: 21600, draft: true, pieces: 12,
      stops: [{ sequence: 1, type: 'PICKUP', name: 'Acme DC', latitude: 39.9, longitude: -83 }],
    };
    const patch: UpdateTripPayload = { status: 'PLANNED', customer: 'Acme' };
    const assign: AssignTripPayload = { driverId: 'drv_1', notify: false };
    assertBodyMatches('POST', '/api/trips', create);
    assertBodyMatches('PATCH', '/api/trips/{id}', patch);
    assertBodyMatches('POST', '/api/trips/{id}/assign', assign);
    assertBodyMatches('POST', '/api/vehicles/{id}/assign-driver', { driverId: 'drv_1', notify: true });
  });

  it('geofences — B-15 dwell/afterHours, B-93 ADDRESS', () => {
    const payload: GeofencePayload = { name: 'Dock 4', type: 'ADDRESS', address: '1 Main St, Columbus, OH', radiusMi: 0.5, dwellMinutes: 45, afterHoursOnly: true };
    assertBodyMatches('POST', '/api/geofences', payload);
    assertBodyMatches('PATCH', '/api/geofences/{id}', { dwellMinutes: null, afterHoursOnly: false, enabled: true });
  });

  it('work orders — B-42', () => {
    const payload: CreateWorkOrderPayload = {
      vehicleId: 'veh_1', title: 'Brakes', priority: 'HIGH', estimatedLaborHours: 2.5, keepOutOfService: true, notifyDriver: true, blockDispatchAssignment: true,
    };
    assertBodyMatches('POST', '/api/work-orders', payload);
  });

  it('users — B-85 invite message/terminalIds, B-84 PATCH extra fields', () => {
    const invite: InviteUserPayload = { email: 'a@b.co', firstName: 'A', lastName: 'B', roleId: 'role_1', message: 'Welcome', terminalIds: ['Columbus, OH'] };
    const update: UpdateUserPayload = { email: 'new@b.co', jobTitle: 'Dispatcher', phone: '+1555', homeTerminalName: 'Columbus, OH' };
    assertBodyMatches('POST', '/api/users', invite);
    assertBodyMatches('PATCH', '/api/users/{id}', update);
  });

  it('me — B-51 profile jobTitle, B-11 preferences', () => {
    const profile: UpdateMyProfilePayload = { firstName: 'Sarah', jobTitle: 'Ops lead' };
    const prefs: MyPreferences = { language: 'en', distanceUnit: 'MILES', savedViews: {}, tableColumns: {} };
    assertBodyMatches('PATCH', '/api/me/profile', profile);
    assertBodyMatches('PUT', '/api/me/preferences', prefs);
  });

  it('support — B-91 ticket attachments; safety — B-43 driver-level coaching', () => {
    const ticket: CreateTicketPayload = { subject: 'Offline', body: 'Unit 110', priority: 'HIGH', vehicleId: 'veh_1', attachments: [{ kind: 'DEVICE_DIAGNOSTICS' }] };
    assertBodyMatches('POST', '/api/support/tickets', ticket);
    assertBodyMatches('POST', '/api/safety/coaching', { driverId: 'drv_1', note: 'Following distance' });
  });

  it('alert rules — B-86 mutedUntil; devices — B-88; imports — B-69 options', () => {
    assertBodyMatches('PATCH', '/api/alert-rules/{id}', { mutedUntil: '2026-09-25T00:00:00.000Z' });
    const device: UpdateDevicePayload = { autoFirmware: true, shareDiagnostics: true };
    assertBodyMatches('PATCH', '/api/devices/{id}', device);
    assertBodyMatches('POST', '/api/vehicles/import', {
      vehicles: [{ unitNumber: '101', vin: '1FUJA6CV88LW12345' }],
      options: { duplicateStrategy: 'SKIP', defaultTerminal: 'Columbus, OH', pairDevices: true, emailSummary: true },
    });
    assertBodyMatches('POST', '/api/drivers/import', {
      drivers: [{ username: 'a', firstName: 'A', lastName: 'B', cdlNumber: '1', cdlState: 'OH', homeTerminalName: 'Columbus, OH' }],
      options: { duplicateStrategy: 'UPDATE', sendInvitations: true },
    });
  });

  it('reports — B-14 RODS/IDLE_FUEL + PDF, B-48 schedule window', () => {
    assertBodyMatches('POST', '/api/reports/generate', { type: 'RODS', format: 'PDF', params: { from: '2026-09-01', to: '2026-09-08' } });
    assertBodyMatches('POST', '/api/reports/generate', { type: 'IDLE_FUEL', format: 'PDF', params: { from: '2026-09-01', to: '2026-09-08' } });
    assertBodyMatches('POST', '/api/reports/schedules', { reportType: 'IFTA', format: 'PDF', params: { window: 'PREVIOUS_QUARTER' }, cron: '0 6 1 1,4,7,10 *' });
  });

  it('FMCSA pack GET documents vehicleId + include (B-48)', () => {
    const op = operation('GET', '/api/reports/fmcsa-pack') as { parameters?: Array<{ name: string }> };
    expect(op.parameters?.map((p) => p.name)).toEqual(expect.arrayContaining(['vehicleId', 'include']));
  });

  it('GET /dvir documents from/to (B-47); GET /devices documents vehicleId (B-35); GET /notifications documents category (B-57)', () => {
    const names = (path: string) => ((operation('GET', path) as { parameters?: Array<{ name: string }> }).parameters ?? []).map((p) => p.name);
    expect(names('/api/dvir')).toEqual(expect.arrayContaining(['from', 'to']));
    expect(names('/api/devices')).toEqual(expect.arrayContaining(['vehicleId']));
    expect(names('/api/notifications')).toEqual(expect.arrayContaining(['category']));
  });

  it('an undocumented body key is caught (the check is not vacuous)', () => {
    expect(bodyProblems(requestSchema('PATCH', '/api/trips/{id}'), { status: 'DRAFT', invented: 1 })).toEqual([
      '$.invented: not a documented DTO field',
    ]);
  });
});
