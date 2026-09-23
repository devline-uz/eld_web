// W-17…W-25 — every Settings and Support endpoint the app calls. Before this file only
// `GET /carrier` and `GET /roles` had handlers (in `auth.ts`, answering the thin openapi
// examples): Company profile's Save 404'd through to `localhost:3002`, the permission matrix was
// empty because the single ADMIN role carried `permissions: {}` and no `id` (also the React
// "unique key" warning), Users had one row so the last-admin guard was unreachable, and Alert
// rules / Integrations / API keys / Audit log / Support had no handler at all (mock-layer audit, 2026-09-23).
//
// Registered ahead of `authHandlers`, so the two richer reads win (MSW is first-match-wins).
import { http } from 'msw';
import { endpoints } from '@/shared/api/endpoints';
import type { AlertRuleRow, ApiKeyRow, IntegrationRow, RoleRow, TicketRow, UserRow } from '@/shared/api/settingsAdmin';
import { fail, ok, serverPage, url } from '../envelope';
import {
  ALERT_RULES,
  API_KEYS,
  AUDIT,
  CARRIER,
  INTEGRATIONS,
  ROLES,
  TICKETS,
  USERS,
  mockId,
} from './mockState';

async function body(request: Request): Promise<Record<string, unknown>> {
  return ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
}

const NOT_FOUND = (what: string) => fail(404, 'NOT_FOUND', `${what} was not found.`);

function roleById(id: string): RoleRow | undefined {
  return ROLES.find((r) => r.id === id || r.key === id);
}

export const settingsAdminHandlers = [
  /* ---------------------------------------------------------------- carrier — W-17 */
  http.get(url(endpoints.carrier.root), () => ok(CARRIER)),
  http.patch(url(endpoints.carrier.root), async ({ request }) => {
    const dto = await body(request);
    if (dto.name !== undefined && !String(dto.name).trim()) {
      return fail(422, 'VALIDATION_ERROR', 'Check the highlighted fields.', {
        name: 'Company name is required.',
      });
    }
    if (dto.dotNumber !== undefined && !/^\d{5,8}$/.test(String(dto.dotNumber))) {
      return fail(422, 'VALIDATION_ERROR', 'Check the highlighted fields.', {
        dotNumber: 'Enter a valid USDOT number.',
      });
    }
    Object.assign(CARRIER, dto);
    return ok(CARRIER);
  }),

  /* ---------------------------------------------------------------- roles — W-19 */
  http.get(url(endpoints.roles.list), () => ok(ROLES)),
  http.get(url(endpoints.roles.detail(':id')), ({ params }) => {
    const role = roleById(String(params.id));
    return role ? ok(role) : NOT_FOUND('Role');
  }),
  http.post(url(endpoints.roles.create), async ({ request }) => {
    const dto = await body(request);
    const created: RoleRow = {
      id: mockId('rol'),
      key: String(dto.key ?? 'CUSTOM_ROLE'),
      name: String(dto.name ?? 'Custom role'),
      description: (dto.description as string) ?? null,
      isSystem: false,
      permissions: (dto.permissions ?? {}) as RoleRow['permissions'],
      userCount: 0,
    };
    ROLES.push(created);
    return ok(created, 201);
  }),
  http.patch(url(endpoints.roles.update(':id')), async ({ params, request }) => {
    const role = roleById(String(params.id));
    if (!role) return NOT_FOUND('Role');
    if (role.key === 'ADMIN') {
      return fail(403, 'ROLE_IMMUTABLE', 'The Admin role cannot be edited.');
    }
    Object.assign(role, await body(request));
    return ok(role);
  }),
  http.delete(url(endpoints.roles.remove(':id')), ({ params }) => {
    const index = ROLES.findIndex((r) => r.id === String(params.id) || r.key === String(params.id));
    if (index === -1) return NOT_FOUND('Role');
    const role = ROLES[index]!;
    if (role.isSystem) {
      return fail(409, 'ROLE_IN_USE', 'A system role cannot be deleted.');
    }
    if ((role.userCount ?? 0) > 0) {
      return fail(409, 'ROLE_IN_USE', 'Reassign the users on this role first.');
    }
    ROLES.splice(index, 1);
    return ok({ success: true });
  }),

  /* ---------------------------------------------------------------- users — W-18 */
  // `GET /users` answers a BARE ARRAY (backend-gaps.md); the hook pages it client-side.
  http.get(url(endpoints.users.list), () => ok(USERS)),
  http.get(url(endpoints.users.detail(':id')), ({ params }) => {
    const user = USERS.find((u) => u.id === String(params.id));
    return user ? ok(user) : NOT_FOUND('User');
  }),
  http.post(url(endpoints.users.create), async ({ request }) => {
    const dto = await body(request);
    const email = String(dto.email ?? '').trim().toLowerCase();
    if (!email) {
      return fail(422, 'VALIDATION_ERROR', 'Check the highlighted fields.', { email: 'Email is required.' });
    }
    if (USERS.some((u) => u.email.toLowerCase() === email)) {
      return fail(409, 'EMAIL_TAKEN', 'A user with this email already exists.', {
        email: 'A user with this email already exists.',
      });
    }
    const role = roleById(String(dto.roleId ?? 'rol_viewer')) ?? ROLES[ROLES.length - 1]!;
    const user: UserRow = {
      id: mockId('usr'),
      email,
      firstName: String(dto.firstName ?? ''),
      lastName: String(dto.lastName ?? ''),
      jobTitle: (dto.jobTitle as string) ?? null,
      phone: (dto.phone as string) ?? null,
      status: 'INVITED',
      lastActiveAt: null,
      invitedByName: 'Sarah Chen',
      invitedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      homeTerminalName: null,
      role: { id: role.id, key: role.key, name: role.name },
    };
    USERS.push(user);
    role.userCount = (role.userCount ?? 0) + 1;
    return ok({ user, inviteToken: 'eyJ...' }, 201);
  }),
  http.patch(url(endpoints.users.update(':id')), async ({ params, request }) => {
    const user = USERS.find((u) => u.id === String(params.id));
    if (!user) return NOT_FOUND('User');
    const dto = await body(request);
    // The last-admin guard the backend enforces (§12) — the screen must show the 409, not a 200.
    const activeAdmins = USERS.filter((u) => u.role.key === 'ADMIN' && u.status === 'ACTIVE');
    const losingAdmin =
      user.role.key === 'ADMIN' &&
      user.status === 'ACTIVE' &&
      ((dto.roleId !== undefined && roleById(String(dto.roleId))?.key !== 'ADMIN') ||
        (dto.status !== undefined && dto.status !== 'ACTIVE'));
    if (losingAdmin && activeAdmins.length <= 1) {
      return fail(409, 'LAST_ADMIN', 'The last administrator cannot be removed or demoted.');
    }
    if (dto.roleId !== undefined) {
      const role = roleById(String(dto.roleId));
      if (role) user.role = { id: role.id, key: role.key, name: role.name };
      delete dto.roleId;
    }
    Object.assign(user, dto);
    return ok(user);
  }),
  http.delete(url(endpoints.users.remove(':id')), ({ params }) => {
    const index = USERS.findIndex((u) => u.id === String(params.id));
    if (index === -1) return NOT_FOUND('User');
    const user = USERS[index]!;
    const activeAdmins = USERS.filter((u) => u.role.key === 'ADMIN' && u.status === 'ACTIVE');
    if (user.role.key === 'ADMIN' && user.status === 'ACTIVE' && activeAdmins.length <= 1) {
      return fail(409, 'LAST_ADMIN', 'The last administrator cannot be removed or demoted.');
    }
    USERS.splice(index, 1);
    return ok({ success: true });
  }),
  http.post(url(endpoints.users.resendInvite(':id')), ({ params }) => {
    const user = USERS.find((u) => u.id === String(params.id));
    if (!user) return NOT_FOUND('User');
    const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    user.invitedAt = new Date().toISOString();
    user.expiresAt = expiresAt;
    return ok({ user, inviteToken: 'eyJ...', expiresAt });
  }),

  /* ---------------------------------------------------------------- alert rules — W-21 */
  http.get(url(endpoints.alertRules.list), () => ok({ items: ALERT_RULES })),
  http.get(url(endpoints.alertRules.detail(':id')), ({ params }) => {
    const rule = ALERT_RULES.find((r) => r.id === String(params.id));
    return rule ? ok(rule) : NOT_FOUND('Alert rule');
  }),
  http.post(url(endpoints.alertRules.create), async ({ request }) => {
    const dto = await body(request);
    const created: AlertRuleRow = {
      id: mockId('alr'),
      key: String(dto.key ?? 'custom_rule'),
      name: String(dto.name ?? 'Custom rule'),
      severity: (dto.severity as AlertRuleRow['severity']) ?? 'INFO',
      conditions: (dto.conditions as AlertRuleRow['conditions']) ?? [],
      channels: (dto.channels as AlertRuleRow['channels']) ?? ['IN_APP'],
      recipients: (dto.recipients as AlertRuleRow['recipients']) ?? {},
      throttle: dto.throttle as AlertRuleRow['throttle'],
      quietHours: dto.quietHours as AlertRuleRow['quietHours'],
      enabled: dto.enabled !== false,
      isSystem: false,
    };
    ALERT_RULES.push(created);
    return ok(created, 201);
  }),
  http.patch(url(endpoints.alertRules.update(':id')), async ({ params, request }) => {
    const rule = ALERT_RULES.find((r) => r.id === String(params.id));
    if (!rule) return NOT_FOUND('Alert rule');
    Object.assign(rule, await body(request));
    return ok(rule);
  }),
  http.delete(url(endpoints.alertRules.remove(':id')), ({ params }) => {
    const index = ALERT_RULES.findIndex((r) => r.id === String(params.id));
    if (index === -1) return NOT_FOUND('Alert rule');
    if (ALERT_RULES[index]!.isSystem) {
      return fail(409, 'RULE_IS_SYSTEM', 'A built-in rule cannot be deleted; disable it instead.');
    }
    ALERT_RULES.splice(index, 1);
    return ok({ success: true });
  }),

  /* ---------------------------------------------------------------- integrations & API keys — W-22 */
  http.get(url(endpoints.integrations.list), () => ok(INTEGRATIONS)),
  http.get(url(endpoints.integrations.detail(':provider')), ({ params }) => {
    const row = INTEGRATIONS.find((i) => i.provider === String(params.provider));
    return row ? ok(row) : NOT_FOUND('Integration');
  }),
  http.put(url(endpoints.integrations.update(':provider')), async ({ params, request }) => {
    const dto = await body(request);
    const provider = String(params.provider) as IntegrationRow['provider'];
    let row = INTEGRATIONS.find((i) => i.provider === provider);
    if (!row) {
      row = { id: mockId('int'), provider, enabled: true, status: 'CONNECTED', lastSyncAt: null, config: {} };
      INTEGRATIONS.push(row);
    }
    row.enabled = dto.enabled !== false;
    row.status = row.enabled ? 'CONNECTED' : 'DISCONNECTED';
    if (dto.config) row.config = dto.config as Record<string, unknown>;
    if (row.enabled) row.lastSyncAt = new Date().toISOString();
    return ok(row);
  }),
  http.delete(url(endpoints.integrations.remove(':provider')), ({ params }) => {
    const row = INTEGRATIONS.find((i) => i.provider === String(params.provider));
    if (!row) return NOT_FOUND('Integration');
    row.enabled = false;
    row.status = 'DISCONNECTED';
    row.lastSyncAt = null;
    return ok(row);
  }),
  http.post(url(endpoints.integrations.testWebhook), () => ok({ id: mockId('whd'), status: 'QUEUED', attempts: 0 }, 201)),

  http.get(url(endpoints.apiKeys.list), () => ok(API_KEYS)),
  http.post(url(endpoints.apiKeys.create), async ({ request }) => {
    const dto = await body(request);
    const apiKey: ApiKeyRow = {
      id: mockId('key'),
      name: String(dto.name ?? 'New key'),
      prefix: `obk_${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      scopes: (dto.scopes as string[]) ?? [],
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      expiresAt: (dto.expiresAt as string) ?? null,
      revokedAt: null,
    };
    API_KEYS.push(apiKey);
    return ok({ apiKey, plaintextKey: `${apiKey.prefix}_live_5f3a91c7d2e84b60` }, 201);
  }),
  http.patch(url(endpoints.apiKeys.scopes(':id')), async ({ params, request }) => {
    const key = API_KEYS.find((k) => k.id === String(params.id));
    if (!key) return NOT_FOUND('API key');
    key.scopes = ((await body(request)).scopes as string[]) ?? key.scopes;
    return ok(key);
  }),
  http.delete(url(endpoints.apiKeys.remove(':id')), ({ params }) => {
    const key = API_KEYS.find((k) => k.id === String(params.id));
    if (!key) return NOT_FOUND('API key');
    key.revokedAt = new Date().toISOString();
    return ok({ success: true });
  }),

  /* ---------------------------------------------------------------- audit log — W-23 */
  // Cursor-paginated (`{ items, nextCursor }`), not offset — backend-gaps.md.
  http.get(url(endpoints.auditLog.list), ({ request }) => {
    const search = new URL(request.url).searchParams;
    const objectType = search.get('objectType');
    const actorId = search.get('actorId');
    const action = search.get('action');
    const limit = Math.min(200, Math.max(1, Number(search.get('limit') ?? 50) || 50));
    const cursor = search.get('cursor');
    const filtered = AUDIT.filter(
      (row) =>
        (!objectType || row.objectType === objectType) &&
        (!actorId || row.actorId === actorId) &&
        (!action || row.action === action),
    );
    const start = cursor ? filtered.findIndex((row) => row.id === cursor) + 1 : 0;
    const items = filtered.slice(start, start + limit);
    const next = filtered[start + limit] ? items[items.length - 1]!.id : null;
    return ok({ items, nextCursor: next });
  }),

  /* ---------------------------------------------------------------- support — W-24, W-25 */
  http.get(url(endpoints.support.tickets), ({ request }) =>
    ok(serverPage<TicketRow>(TICKETS, request, ['subject', 'number', 'category'])),
  ),
  http.get(url(endpoints.support.ticket(':id')), ({ params }) => {
    const ticket = TICKETS.find((t) => t.id === String(params.id));
    return ticket ? ok(ticket) : NOT_FOUND('Ticket');
  }),
  http.post(url(endpoints.support.createTicket), async ({ request }) => {
    const dto = await body(request);
    if (!dto.subject || !dto.body) {
      return fail(422, 'VALIDATION_ERROR', 'Check the highlighted fields.', {
        ...(dto.subject ? {} : { subject: 'Subject is required.' }),
        ...(dto.body ? {} : { body: 'Describe the problem.' }),
      });
    }
    const ticket: TicketRow = {
      id: mockId('tck'),
      number: `TCK-${String(TICKETS.length + 1).padStart(6, '0')}`,
      subject: String(dto.subject),
      body: String(dto.body),
      category: (dto.category as string) ?? null,
      priority: (dto.priority as TicketRow['priority']) ?? 'NORMAL',
      status: 'OPEN',
      requesterType: 'USER',
      requesterId: 'usr_1',
      requesterName: 'Sarah Chen',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    TICKETS.unshift(ticket);
    return ok(ticket, 201);
  }),
  http.patch(url(endpoints.support.updateTicket(':id')), async ({ params, request }) => {
    const ticket = TICKETS.find((t) => t.id === String(params.id));
    if (!ticket) return NOT_FOUND('Ticket');
    Object.assign(ticket, await body(request), { updatedAt: new Date().toISOString() });
    return ok(ticket);
  }),
  http.post(url(endpoints.support.feedback), async ({ request }) => {
    const dto = await body(request);
    return ok(
      {
        id: mockId('fbk'),
        rating: (dto.answers as Record<string, unknown> | undefined)?.rating ?? null,
        message: (dto.comment as string) ?? '',
        source: 'WEB',
        createdAt: new Date().toISOString(),
      },
      201,
    );
  }),
];
