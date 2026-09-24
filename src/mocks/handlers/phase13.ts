// owner: web-api-client — MSW for every endpoint backend Phase 13 added (2026-09-24,
// ../backend_tasks.md). Each handler answers the payload `backend/docs/openapi.json` documents
// (`fixture(...)`), merged with what the request sent so dev:mock round-trips feel real; the
// contract suite (tests/contract/phase13.contract.test.ts) holds every one of them to the document.
//
// Registered FIRST in `handlers/index.ts`: `/vehicles/bulk-status`, `/dvir/compliance` and
// `/integrations/catalog` are static paths that the `:id` / `:provider` handlers would otherwise
// capture (MSW is first-match-wins — WB-016).
import { http, HttpResponse } from 'msw';
import { endpoints } from '@/shared/api/endpoints';
import { fixture } from '../fixtures.generated';
import { fail, ok, url } from '../envelope';
import { DRIVERS, VEHICLES, mockId } from './mockState';

type Json = Record<string, unknown>;

async function body(request: Request): Promise<Json> {
  return ((await request.json().catch(() => ({}))) ?? {}) as Json;
}

const doc = (operation: string): Json => fixture<Json>(operation);

/* ------------------------------------------------------------------ small mutable state */

let preferences: Json = doc('GET /api/me/preferences');
let channels: Json = doc('GET /api/notification-channels');
const driverDocuments = new Map<string, Json[]>();

/** Test hook — `resetMockState()` callers can also reset these. */
export function resetPhase13State(): void {
  preferences = doc('GET /api/me/preferences');
  channels = doc('GET /api/notification-channels');
  driverDocuments.clear();
}

/** A 1×1 PDF placeholder — `GET /dvir/:id/pdf` is binary on the real API. */
const PDF_BYTES = new TextEncoder().encode('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

export const phase13Handlers = [
  /* -------------------------------------------------- static paths first (WB-016) */
  http.patch(url(endpoints.vehicles.bulkStatus), async ({ request }) => {
    const dto = await body(request);
    const ids = Array.isArray(dto.ids) ? (dto.ids as string[]) : [];
    const known = new Set(VEHICLES.map((v) => v.id));
    const updated = ids.filter((id) => known.has(id));
    for (const v of VEHICLES) if (updated.includes(v.id) && typeof dto.status === 'string') v.status = dto.status;
    return ok({
      updated,
      failed: ids.filter((id) => !known.has(id)).map((id) => ({ id, error: 'Vehicle not found.' })),
    });
  }),
  http.get(url(endpoints.dvir.compliance), () => ok(doc('GET /api/dvir/compliance'))),
  http.get(url(endpoints.integrations.catalog), () => ok(fixture('GET /api/integrations/catalog'))),
  http.get(url(endpoints.carrier.transferConfig), () => ok(doc('GET /api/carrier/transfer-config'))),

  /* -------------------------------------------------- DVIR / defects / attachments */
  http.get(url(endpoints.dvir.pdf(':id')), () =>
    new HttpResponse(PDF_BYTES, { headers: { 'Content-Type': 'application/pdf' } }),
  ),
  http.patch(url(endpoints.defects.assign(':id')), async ({ params, request }) => {
    const dto = await body(request);
    return ok({ id: String(params.id), assigneeId: (dto.assigneeId as string | null) ?? null });
  }),
  http.get(url(endpoints.attachments.presign(':id')), () =>
    ok({ ...doc('GET /api/attachments/{id}/presign'), expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() }),
  ),

  /* -------------------------------------------------- drivers */
  http.post(url(endpoints.drivers.resetPassword(':id')), ({ params }) => {
    const driver = DRIVERS.find((d) => d.id === params.id);
    return ok({ emailedTo: driver ? driver.email : doc('POST /api/drivers/{id}/reset-password').emailedTo });
  }),
  http.post(url(endpoints.drivers.sendVerification(':id')), ({ params }) => {
    const driver = DRIVERS.find((d) => d.id === params.id);
    if (driver && !driver.email) return fail(422, 'VALIDATION_FAILED', 'The driver has no email address.');
    return ok({ emailedTo: driver?.email ?? doc('POST /api/drivers/{id}/send-verification').emailedTo });
  }),
  http.post(url(endpoints.drivers.verifyEmail(':id')), ({ params }) => {
    const driver = DRIVERS.find((d) => d.id === params.id);
    return ok({
      ...doc('POST /api/drivers/{id}/verify-email'),
      id: String(params.id),
      ...(driver?.email ? { email: driver.email } : {}),
      emailVerifiedAt: new Date().toISOString(),
    });
  }),
  http.get(url(endpoints.drivers.documents(':id')), ({ params }) => ok(driverDocuments.get(String(params.id)) ?? [])),
  http.post(url(endpoints.drivers.documents(':id')), async ({ params, request }) => {
    const dto = await body(request);
    const row: Json = {
      ...doc('POST /api/drivers/{id}/documents'),
      id: mockId('doc'),
      type: dto.type,
      fileName: dto.fileName,
      expiresAt: (dto.expiresAt as string | undefined) ?? null,
      uploadedAt: new Date().toISOString(),
    };
    const { uploadUrl: _uploadUrl, ...listed } = row;
    driverDocuments.set(String(params.id), [...(driverDocuments.get(String(params.id)) ?? []), listed]);
    return ok(row, 201);
  }),
  http.delete(url(endpoints.drivers.document(':id', ':docId')), ({ params }) => {
    const id = String(params.id);
    driverDocuments.set(id, (driverDocuments.get(id) ?? []).filter((d) => d.id !== params.docId));
    return ok(doc('DELETE /api/drivers/{id}/documents/{docId}'));
  }),

  /* -------------------------------------------------- co-driver pairings (B-7) */
  http.post(url(endpoints.coDriverPairings.create), async ({ request }) => {
    const dto = await body(request);
    return ok(
      { ...doc('POST /api/co-driver-pairings'), ...dto, id: mockId('pair'), startedAt: (dto.startedAt as string) ?? new Date().toISOString(), endedAt: null },
      201,
    );
  }),
  http.post(url(endpoints.coDriverPairings.end(':id')), ({ params }) =>
    ok({ id: String(params.id), endedAt: new Date().toISOString() }, 201),
  ),

  /* -------------------------------------------------- devices (B-88) */
  http.patch(url(endpoints.devices.update(':id')), async ({ params, request }) =>
    ok({ ...doc('PATCH /api/devices/{id}'), ...(await body(request)), id: String(params.id) }),
  ),

  /* -------------------------------------------------- RODS (B-72) */
  http.post(url(endpoints.logs.proposeEvent(':driverId')), async ({ params, request }) => {
    const dto = await body(request);
    return ok(
      {
        ...doc('POST /api/logs/{driverId}/events'),
        id: mockId('edt'),
        driverId: String(params.driverId),
        proposedStatus: dto.status,
        proposedSpecial: (dto.proposedSpecial as string | undefined) ?? 'NONE',
        eventDateTime: dto.eventDateTime,
        endDateTime: (dto.endDateTime as string | undefined) ?? null,
        annotation: dto.annotation,
        notifyDriver: Boolean(dto.notifyDriver),
        recordStatus: 3,
        applied: false,
      },
      201,
    );
  }),

  /* -------------------------------------------------- messaging / support / notifications */
  http.post(url(endpoints.conversations.read(':id')), ({ params }) =>
    ok({ conversationId: String(params.id), lastReadAt: new Date().toISOString() }),
  ),
  http.post(url(endpoints.support.chats), () =>
    ok({ conversationId: mockId('cnv'), messageId: mockId('msg') }, 201),
  ),
  http.get(url(endpoints.notificationChannels.root), () => ok(channels)),
  http.patch(url(endpoints.notificationChannels.root), async ({ request }) => {
    const dto = await body(request);
    channels = {
      email: { ...(channels.email as Json), ...((dto.email as Json | undefined) ?? {}) },
      webhook: { ...(channels.webhook as Json), ...((dto.webhook as Json | undefined) ?? {}) },
    };
    return ok(channels);
  }),

  /* -------------------------------------------------- me (B-11, B-50, B-51) and B-84 */
  http.get(url(endpoints.me.preferences), () => ok(preferences)),
  http.put(url(endpoints.me.preferences), async ({ request }) => {
    preferences = await body(request);
    return ok(preferences);
  }),
  http.post(url(endpoints.me.avatar), () => ok(doc('POST /api/me/avatar'))),
  http.delete(url(endpoints.me.avatar), () => ok(doc('DELETE /api/me/avatar'))),
  http.delete(url(endpoints.me.sessions), () => ok(doc('DELETE /api/me/sessions'))),
  http.post(url(endpoints.auth.emailVerify), () => ok(doc('POST /api/auth/email/verify'))),
];
