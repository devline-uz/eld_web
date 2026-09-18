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
import type { PermissionKey, PermissionLevel } from '@/shared/auth/permissions';

/* ------------------------------------------------------------------ Carrier — W-17 */

export type HosRuleset =
  | 'US_70_8_PROPERTY'
  | 'US_60_7_PROPERTY'
  | 'US_70_8_PASSENGER'
  | 'US_60_7_PASSENGER';

export interface CarrierRow {
  id: string;
  name: string;
  dotNumber: string;
  mcNumber?: string | null;
  ein?: string | null;
  timezone: string;
  hosRuleset?: HosRuleset;
  distanceUnit?: 'MILES' | 'KILOMETERS';
  cycleRestart?: boolean;
  unassignedThresholdMin?: number;
  dvirRetentionMonths?: number;
  allowPersonalConveyance?: boolean;
  allowYardMove?: boolean;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
  complianceEmail?: string | null;
  eldIdentifier?: string | null;
  eldRegistrationId?: string | null;
  erodsMode: 'TEST' | 'PRODUCTION';
}

export function useCarrier() {
  return useQuery({
    queryKey: qk.carrier,
    queryFn: ({ signal }) => client.get<CarrierRow>(endpoints.carrier.root, { signal }),
    ...typedCachePolicy<CarrierRow>('reference'),
  });
}

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
}

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
    mutationFn: ({ id, dto }: { id: string; dto: Partial<{ roleId: string; status: UserStatus; firstName: string; lastName: string }> }) =>
      client.patch<UserRow>(endpoints.users.update(id), dto),
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
}

export interface DeviceListParams {
  [key: string]: string | number | undefined;
  page?: number;
  limit?: number;
  q?: string;
  status?: DeviceStatus;
  bleState?: BleState;
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

/** ⛔ GAP B-8 — `GET /devices/:id/diagnostics` does not exist; served by MSW only
 * (`src/mocks/handlers/settingsGaps.ts`). Against the live API this 404s and the caller must
 * hide `Test connection` rather than pretend the call succeeded. */
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
    mutationFn: ({ id, dto }: { id: string; dto: Partial<CreateAlertRulePayload> }) =>
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

/** ⛔ GAP B-9 — `POST /alert-rules/:id/test` does not exist; served by MSW only. */
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
  actorName?: string | null;
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

export interface CreateTicketPayload {
  subject: string;
  body: string;
  category?: string;
  priority: TicketPriority;
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
