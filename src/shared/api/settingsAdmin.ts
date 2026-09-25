// owner: web-settings-admin — W-17…W-25 + 11.18–11.22. One composition module for every
// Settings/Support entity: carrier, users, roles, devices, alert rules, integrations, api keys,
// audit log, support tickets and feedback.
//
// Contract deviations already recorded in web/backend-gaps.md — trusted here, not re-derived:
//  - `GET /users` and `GET /roles` answer with BARE ARRAYS, not `OffsetPage<T>`.
//  - `GET /audit-log` is CURSOR-paginated (`{ items, nextCursor }`), not offset.
//  - `GET /devices`, `GET /support/tickets` are real `OffsetPage<T>` — server pagination is used.
//  - `POST /support/tickets` and `POST /feedback` require `support:FULL`; VIEWER only has
//    `support:READ` (gap B-12) — the write is attempted anyway (design shows the button for every
//    role) and a `403` is shown inline in the modal rather than replacing the page.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from './client';
import { endpoints } from './endpoints';
import { qk, qkRoot } from './queryKeys';
import { typedCachePolicy } from './queryPolicy';
import type { OffsetPage } from './types';
import type { CarrierRow } from './carrier';
import type { PermissionKey, PermissionLevel } from '@/shared/auth/permissions';

/* ------------------------------------------------------------------ Carrier — W-17 */

export { useCarrier, type CarrierRow, type HosRuleset } from './carrier';
export function useUpdateCarrier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: Partial<CarrierRow>) => client.patch<CarrierRow>(endpoints.carrier.root, dto),
    onSuccess: (data) => qc.setQueryData(qk.carrier, data),
  });
}

/* ------------------------------------------------------------------ Users — W-18, 11.18 */

export type UserStatus = 'INVITED' | 'ACTIVE' | 'DISABLED';

export interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle?: string | null;
  phone?: string | null;
  status: UserStatus;
  lastActiveAt?: string | null;
  invitedByName?: string | null;
  invitedAt?: string | null;
  expiresAt?: string | null;
  homeTerminalName?: string | null;
  role: { id?: string; key: string; name: string };
}

/** `GET /users` answers a bare array (web/backend-gaps.md) — this hook paginates client-side. */
export function useUsersList() {
  const query = useQuery({
    queryKey: qk.users(),
    queryFn: ({ signal }) => client.get<UserRow[]>(endpoints.users.list, { signal }),
    ...typedCachePolicy<UserRow[]>('list'),
  });
  return { ...query, rows: query.data ?? [] };
}

export interface InviteUserPayload {
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  jobTitle?: string;
  phone?: string;
  /** B-85 (shipped) — personal note in the invitation email. */
  message?: string;
  /** B-85 — terminal scope (home terminal names; no Terminal table, backend D-090). */
  terminalIds?: string[];
}

/** `UpdateUserDto` (B-84, shipped). Changing `email` does NOT write it: the response carries
 * `emailVerification.pendingEmail` and the address switches only once the link is confirmed via
 * `POST /auth/email/verify` (backend D-101). */
export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  phone?: string;
  roleId?: string;
  status?: UserStatus;
  email?: string;
  homeTerminalName?: string;
}

export type UpdateUserResult = UserRow & { emailVerification?: { pendingEmail: string; verifyToken?: string } };

export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: InviteUserPayload) =>
      client.post<{ user: UserRow; inviteToken: string }>(endpoints.users.create, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: qkRoot.users }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateUserPayload }) =>
      client.patch<UpdateUserResult>(endpoints.users.update(id), dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: qkRoot.users }),
  });
}

export function useResendInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.post<{ user: UserRow; inviteToken: string; expiresAt: string }>(endpoints.users.resendInvite(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: qkRoot.users }),
  });
}

/* ------------------------------------------------------------------ Roles — W-19, 11.19 */

export interface RoleRow {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  permissions: Record<PermissionKey, PermissionLevel>;
  userCount?: number;
}

/** `GET /roles` answers a bare array too. */
export function useRolesList() {
  const query = useQuery({
    queryKey: qk.roles,
    queryFn: ({ signal }) => client.get<RoleRow[]>(endpoints.roles.list, { signal }),
    ...typedCachePolicy<RoleRow[]>('reference'),
  });
  return { ...query, rows: query.data ?? [] };
}

export interface CreateRolePayload {
  key: string;
  name: string;
  description?: string;
  permissions: Record<string, PermissionLevel>;
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateRolePayload) => client.post<RoleRow>(endpoints.roles.create, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.roles }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<CreateRolePayload> }) =>
      client.patch<RoleRow>(endpoints.roles.update(id), dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.roles }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.delete<{ success: boolean }>(endpoints.roles.remove(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.roles }),
  });
}

/* ------------------------------------------------------------------ Devices — W-20, 11.20 */

export type DeviceModel = 'PT30' | 'PT40';
export type DeviceStatus = 'UNASSIGNED' | 'ASSIGNED' | 'FAULTY' | 'RETIRED';
export type BleState = 'CONNECTED' | 'OUT_OF_RANGE' | 'DISCONNECTED';

export interface DeviceRow {
  id: string;
  serial: string;
  model: DeviceModel;
  status: DeviceStatus;
  vehicleId: string | null;
  bleState: BleState;
  firmwareVersion: string | null;
  firmwareOutdated: boolean;
  lastHeartbeatAt: string | null;
  storedEventsCount?: number;
  /** B-88 (shipped 2026-09-24). */
  autoFirmware?: boolean;
  shareDiagnostics?: boolean;
}

export interface DeviceListParams {
  [key: string]: string | number | undefined;
  page?: number;
  limit?: number;
  q?: string;
  status?: DeviceStatus;
  bleState?: BleState;
  /** B-35 (shipped) — devices paired to one unit. */
  vehicleId?: string;
}

export function useDevicesList(params: DeviceListParams = {}) {
  return useQuery({
    queryKey: qk.devices(params),
    queryFn: ({ signal }) => client.get<OffsetPage<DeviceRow>>(endpoints.devices.list, { params, signal }),
    ...typedCachePolicy<OffsetPage<DeviceRow>>('list'),
  });
}

export interface RegisterDevicePayload {
  serial: string;
  model: DeviceModel;
  firmware?: string;
}

export function useCreateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: RegisterDevicePayload) => client.post<DeviceRow>(endpoints.devices.create, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: qkRoot.devices }),
  });
}

export function usePairDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, vehicleId }: { id: string; vehicleId: string }) =>
      client.post<DeviceRow>(endpoints.devices.pair(id), { vehicleId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qkRoot.devices }),
  });
}

export function useUnpairDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.post<DeviceRow>(endpoints.devices.unpair(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: qkRoot.devices }),
  });
}

export function useUpdateFirmware() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, firmware }: { id: string; firmware: string }) =>
      client.patch<DeviceRow>(endpoints.devices.firmware(id), { firmware }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qkRoot.devices }),
  });
}

export function useRemoveDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.delete<DeviceRow>(endpoints.devices.remove(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: qkRoot.devices }),
  });
}

/** B-8 (shipped 2026-09-24) — `GET /devices/:id/diagnostics`: derived from the device's latest
 * recorded status, not a live round-trip (label the result accordingly). */
export interface DeviceDiagnostics {
  signalStrength: 'good' | 'fair' | 'poor';
  gpsLock: boolean;
  responded: boolean;
}
export function useDeviceDiagnostics() {
  return useMutation({
    mutationFn: (id: string) => client.get<DeviceDiagnostics>(endpoints.devices.diagnostics(id)),
  });
}

/* ------------------------------------------------------------------ Alert rules — W-21, 11.21 */

/** Q-2 — SMS is never offered; the enum keeps the shape the backend rejects, for the tooltip only. */
export type AlertChannel = 'IN_APP' | 'EMAIL' | 'WEBHOOK';
export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface AlertRuleCondition {
  event: string;
  params?: Record<string, unknown>;
}

export interface AlertRuleRecipients {
  roles?: string[];
  userIds?: string[];
  subjectDriver?: boolean;
}

export interface AlertRuleRow {
  id: string;
  key: string;
  name: string;
  severity: AlertSeverity;
  conditions: AlertRuleCondition[];
  channels: AlertChannel[];
  recipients: AlertRuleRecipients;
  throttle?: { perDriverPerDay?: number; cooldownMin?: number };
  quietHours?: { from: string; to: string; timezone: string };
  enabled: boolean;
  isSystem?: boolean;
  /** B-86 (shipped) — ISO until which delivery is muted; null = not muted. */
  mutedUntil?: string | null;
}

export function useAlertRulesList() {
  const query = useQuery({
    queryKey: qk.alertRules(),
    queryFn: ({ signal }) => client.get<{ items: AlertRuleRow[] } | AlertRuleRow[]>(endpoints.alertRules.list, { signal }),
    ...typedCachePolicy<{ items: AlertRuleRow[] } | AlertRuleRow[]>('list'),
  });
  const data = query.data;
  const rows = Array.isArray(data) ? data : (data?.items ?? []);
  return { ...query, rows };
}

export interface CreateAlertRulePayload {
  key: string;
  name: string;
  severity: AlertSeverity;
  conditions: AlertRuleCondition[];
  /** Q-2 — `SMS` is never a member of this array; zod narrows it to the allowed set. */
  channels: AlertChannel[];
  recipients: AlertRuleRecipients;
  throttle?: { perDriverPerDay?: number; cooldownMin?: number };
  quietHours?: { from: string; to: string; timezone: string };
  enabled: boolean;
}

export function useCreateAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateAlertRulePayload) => client.post<AlertRuleRow>(endpoints.alertRules.create, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: qkRoot.alertRules }),
  });
}

export function useUpdateAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    /** `mutedUntil` (B-86): ISO to mute, `null` to unmute. */
    mutationFn: ({ id, dto }: { id: string; dto: Partial<CreateAlertRulePayload> & { mutedUntil?: string | null } }) =>
      client.patch<AlertRuleRow>(endpoints.alertRules.update(id), dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: qkRoot.alertRules }),
  });
}

export function useDeleteAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.delete<{ success: boolean }>(endpoints.alertRules.remove(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: qkRoot.alertRules }),
  });
}

/** B-9 (shipped 2026-09-24) — sends a test through the rule's own channels to the caller; a
 * disabled rule answers `{ triggered: false }`. */
export function useTestAlertRule() {
  return useMutation({
    mutationFn: (id: string) => client.post<{ triggered: boolean }>(endpoints.alertRules.test(id)),
  });
}

/* ------------------------------------------------------------------ Integrations & API keys — W-22 */

export type IntegrationProvider = 'mcleod' | 'wex' | 'comdata' | 'quickbooks' | 'slack' | 'webhook';
export type IntegrationStatus = 'CONNECTED' | 'DISCONNECTED';

export interface IntegrationRow {
  id: string;
  provider: IntegrationProvider;
  enabled: boolean;
  status: IntegrationStatus;
  lastSyncAt?: string | null;
  config?: Record<string, unknown>;
}

export function useIntegrationsList() {
  const query = useQuery({
    queryKey: qk.integrations,
    queryFn: ({ signal }) => client.get<IntegrationRow[]>(endpoints.integrations.list, { signal }),
    ...typedCachePolicy<IntegrationRow[]>('reference'),
  });
  return { ...query, rows: query.data ?? [] };
}

export function useUpsertIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, dto }: { provider: string; dto: { enabled: boolean; config?: Record<string, unknown> } }) =>
      client.put<IntegrationRow>(endpoints.integrations.update(provider), dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.integrations }),
  });
}

/**
 * WB-251 — the generic `webhook` provider's config, exactly as `WebhooksService` / the webhook
 * worker read it: `config.url` (where deliveries are POSTed) and `config.secret` (HMAC key for
 * `X-OneBook-Signature`). `PUT /integrations/webhook` replaces the whole config and `GET` returns
 * the secret redacted (`[REDACTED]`), so the secret must be sent again on every save.
 */
export interface WebhookIntegrationConfig {
  url: string;
  secret: string;
}

/** The stored endpoint URL of a `webhook` integration row, if any (the secret is never readable). */
export function webhookUrlOf(row: IntegrationRow | undefined): string {
  const value = row?.config?.url;
  return typeof value === 'string' ? value : '';
}

/** `POST /integrations/webhook/test` — queues a signed test event (`WebhooksSendTestResponse`). */
export function useSendWebhookTest() {
  return useMutation({
    mutationFn: () =>
      client.post<{ id: string; status: string; attempts: number }>(endpoints.integrations.testWebhook, {
        eventType: 'test.ping',
      }),
  });
}

export function useDisconnectIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) => client.delete<IntegrationRow>(endpoints.integrations.remove(provider)),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.integrations }),
  });
}

export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt?: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

export function useApiKeysList() {
  const query = useQuery({
    queryKey: qk.apiKeys,
    queryFn: ({ signal }) => client.get<ApiKeyRow[]>(endpoints.apiKeys.list, { signal }),
    ...typedCachePolicy<ApiKeyRow[]>('reference'),
  });
  return { ...query, rows: query.data ?? [] };
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { name: string; scopes: string[]; expiresAt?: string }) =>
      client.post<{ apiKey: ApiKeyRow; plaintextKey: string }>(endpoints.apiKeys.create, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.apiKeys }),
  });
}

export function useUpdateApiKeyScopes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, scopes }: { id: string; scopes: string[] }) =>
      client.patch<ApiKeyRow>(endpoints.apiKeys.scopes(id), { scopes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.apiKeys }),
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.delete<{ success: boolean }>(endpoints.apiKeys.remove(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.apiKeys }),
  });
}

/* ------------------------------------------------------------------ Audit log — W-23 */

export interface AuditEntry {
  id: string;
  createdAt: string;
  actorType: 'USER' | 'SYSTEM' | 'DRIVER';
  actorId?: string | null;
  /** B-62 (shipped) — joined server-side; no client-side user lookup needed. */
  actorName?: string | null;
  actorEmail?: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | string;
  objectType: string;
  objectId?: string | null;
  objectLabel?: string | null;
  details?: string | null;
  before?: unknown;
  after?: unknown;
  traceId?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface AuditListParams {
  [key: string]: string | number | undefined;
  objectType?: string;
  objectId?: string;
  actorId?: string;
  limit?: number;
  cursor?: string;
}

export function useAuditLog(params: AuditListParams = {}) {
  return useQuery({
    queryKey: qk.audit(params),
    queryFn: ({ signal }) => client.get<{ items: AuditEntry[]; nextCursor: string | null }>(endpoints.auditLog.list, { params, signal }),
    ...typedCachePolicy<{ items: AuditEntry[]; nextCursor: string | null }>('slowList'),
  });
}

/* ------------------------------------------------------------------ Support — W-24, 11.22 */

export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface TicketRow {
  id: string;
  number: string;
  subject: string;
  body?: string;
  category?: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  requesterType?: string;
  requesterId?: string;
  requesterName?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface TicketListParams {
  [key: string]: string | number | undefined;
  page?: number;
  limit?: number;
  q?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
}

export function useTicketsList(params: TicketListParams = {}) {
  return useQuery({
    queryKey: qk.tickets(params),
    queryFn: ({ signal }) => client.get<OffsetPage<TicketRow>>(endpoints.support.tickets, { params, signal }),
    ...typedCachePolicy<OffsetPage<TicketRow>>('list'),
  });
}

/** B-91 — the server collects these itself (the client never uploads a diagnostics file). */
export type TicketAttachmentKind = 'DEVICE_DIAGNOSTICS' | 'ELD_EVENTS_24H';

export interface CreateTicketPayload {
  subject: string;
  body: string;
  category?: string;
  priority: TicketPriority;
  /** B-91 — the unit the server-collected attachments are taken from. */
  vehicleId?: string;
  attachments?: Array<{ kind: TicketAttachmentKind }>;
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTicketPayload) => client.post<TicketRow>(endpoints.support.createTicket, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.tickets() }),
  });
}

/* ------------------------------------------------------------------ Feedback — W-25 */

export function useSubmitFeedback() {
  return useMutation({
    mutationFn: (dto: { answers: Record<string, unknown>; comment?: string }) =>
      client.post<{ id: string }>(endpoints.support.feedback, dto),
  });
}

/* ------------------------------------------------------------------ Phase 13 (2026-09-24) */

/** B-88 — `UpdateDeviceDto`. `PATCH /devices/:id`, `devices` FULL. */
export interface UpdateDevicePayload {
  serial?: string;
  bleMacAddress?: string;
  model?: DeviceModel;
  firmware?: string;
  periodicConnectedSec?: number;
  periodicDisconnectedMin?: number;
  autoFirmware?: boolean;
  shareDiagnostics?: boolean;
  status?: DeviceStatus;
}

export function useUpdateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateDevicePayload }) => client.patch<DeviceRow>(endpoints.devices.update(id), dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: qkRoot.devices }),
  });
}

/** B-89 — marketplace catalog; `available: false` rows are listed but cannot be connected. */
export interface IntegrationCatalogEntry {
  provider: string;
  name: string;
  description: string;
  category: string;
  available: boolean;
}

export function useIntegrationsCatalog(enabled = true) {
  return useQuery({
    queryKey: qk.integrationsCatalog,
    queryFn: ({ signal }) => client.get<IntegrationCatalogEntry[]>(endpoints.integrations.catalog, { signal }),
    enabled,
    ...typedCachePolicy<IntegrationCatalogEntry[]>('reference'),
  });
}

/** B-90 — `POST /support/chats`: opens a SUPPORT conversation with the first message. Join the
 * `conversation:{conversationId}` room for replies and read it through `useMessages`. */
export function useStartSupportChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { subject?: string; message: string }) =>
      client.post<{ conversationId: string; messageId: string }>(endpoints.support.chats, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: qkRoot.conversations }),
  });
}

/** `PATCH /support/tickets/:id` — `support` FULL. */
export function useUpdateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: { status?: TicketStatus; priority?: TicketPriority; assignedToId?: string } }) =>
      client.patch<TicketRow>(endpoints.support.updateTicket(id), dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: qkRoot.support }),
  });
}

/** B-84 — the landing page of the email-change link: `POST /auth/email/verify { token }`. */
export function useConfirmEmailChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => client.post<{ success: boolean }>(endpoints.auth.emailVerify, { token }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qkRoot.me });
      void qc.invalidateQueries({ queryKey: qkRoot.users });
    },
  });
}
