// owner: web-settings-admin — W-18…W-22 action copy and disabled-control reasons.
//
// tz.md §13.3 (and therefore `shared/ui/copy.ts`) has no entry for most Settings writes (edit a
// user, revoke an invitation, pair a device, queue firmware, edit API-key scopes…). WD-079 (as WD-081): rather
// than each call site inventing a sentence, the wording lives here in one keyed table, named and
// shaped exactly like `TOAST_COPY` so it can move into §13.3 unchanged when the table is extended.
//
// Every `B-NN` below is a backend gap recorded in web/backend-gaps.md ("Stage 2 — Settings/Support",
// B-84…B-89); WD-080 records how these ids replaced the earlier invented ones.
import type { ToastCopy } from '@/shared/ui/copy';

const plural = (count: number, singular: string): string => `${singular}${count === 1 ? '' : 's'}`;

export const SETTINGS_TOAST = {
  /* ---------------------------------------------------------------- W-18 users */
  userUpdated: (name: string): ToastCopy => ({ title: `${name} updated` }),
  roleChanged: (name: string, roleName: string): ToastCopy => ({
    title: 'Role updated',
    description: `${name} is now ${roleName}. The new permissions apply on their next page load.`,
  }),
  userDisabled: { title: 'User disabled' } satisfies ToastCopy,
  userEnabled: { title: 'User enabled' } satisfies ToastCopy,
  invitationResent: (email: string): ToastCopy => ({
    title: 'Invitation resent',
    description: `A new invite was sent to ${email}.`,
  }),
  invitationsResent: (count: number): ToastCopy => ({
    title: `${count} ${plural(count, 'invitation')} resent`,
  }),
  invitationsResendFailed: (failed: number, total: number): ToastCopy => ({
    title: `${failed} of ${total} ${plural(total, 'invitation')} could not be resent`,
    description: 'Those invitations are unchanged. Try again.',
  }),
  invitationRevoked: (email: string): ToastCopy => ({
    title: 'Invitation revoked',
    description: `${email} can no longer use the invite link.`,
  }),

  /* ---------------------------------------------------------------- W-19 roles */
  permissionsReset: { title: 'Permissions reset to defaults' } satisfies ToastCopy,
  permissionsResetFailed: (failed: number, total: number): ToastCopy => ({
    title: `${failed} of ${total} ${plural(total, 'role')} could not be reset`,
    description: 'Those roles are unchanged. Try again.',
  }),

  /* ---------------------------------------------------------------- W-20 devices */
  devicePaired: (serial: string, unitNumber: string): ToastCopy => ({
    title: `Device ${serial} paired`,
    description: `It records hours of service for ${unitNumber} from the next driver connection.`,
  }),
  deviceUnpaired: (serial: string): ToastCopy => ({
    title: `Device ${serial} unpaired`,
    description: 'It stays in the inventory and can be paired to another unit.',
  }),
  firmwareQueued: (version: string, serial: string): ToastCopy => ({
    title: `Firmware ${version} queued for ${serial}`,
    description: 'It installs over Bluetooth the next time the device is in range with the engine off.',
  }),
  deviceRetired: (serial: string): ToastCopy => ({ title: `Device ${serial} retired` }),
  devicesExportFailed: {
    title: 'The device export did not download',
    description: 'Nothing was exported. Try again in a moment.',
  } satisfies ToastCopy,

  /* ---------------------------------------------------------------- W-21 alert rules */
  alertRuleCreated: { title: 'Alert rule created' } satisfies ToastCopy,
  alertRuleUpdated: { title: 'Alert rule updated' } satisfies ToastCopy,
  alertRuleDuplicated: { title: 'Alert rule duplicated' } satisfies ToastCopy,
  alertRuleDeleted: (name: string): ToastCopy => ({ title: `Rule ${name} deleted` }),

  /* ---------------------------------------------------------------- W-22 integrations & keys */
  integrationConnected: (name: string): ToastCopy => ({ title: `${name} connected` }),
  integrationDisconnected: (name: string): ToastCopy => ({ title: `${name} disconnected` }),
  /** WB-251 — `Configure` on the connected Custom webhook. */
  webhookUpdated: { title: 'Custom webhook updated', description: 'New events are sent to the saved endpoint.' } satisfies ToastCopy,
  webhookTestQueued: {
    title: 'Test event queued',
    description: 'A signed test.ping event is on its way to your endpoint.',
  } satisfies ToastCopy,
  apiKeyScopesUpdated: (name: string): ToastCopy => ({
    title: `Scopes updated for ${name}`,
    description: 'The change applies to the next request made with this key.',
  }),
  apiKeyRevoked: (name: string): ToastCopy => ({
    title: `API key ${name} revoked`,
    description: 'Requests made with it are refused from now on.',
  }),
} as const;

/** Reasons shown next to controls this feature deliberately disables (never a dead control). */
export const SETTINGS_REASON = {
  /** B-85 — `POST /users` has no terminal-scope field. */
  inviteTerminal: 'Not available yet — the invite API has no terminal field. New users see every terminal.',
  /** B-85 — `POST /users` has no personal-message field. */
  inviteMessage: 'Not available yet — the invite API sends the standard invitation email only.',
  /** B-84 — `PATCH /users/:id` takes firstName/lastName/roleId/status only. */
  editUserFixedFields:
    'Work email, job title, phone and terminal access cannot be changed here yet — the user-update API does not accept them.',
  /** B-86 — no `mutedUntil` on the rule. */
  timedMute: 'Timed mute is not available yet — use the switch to mute this rule.',
  /** B-87 — no organisation-level channel resource. */
  orgChannels: 'Organisation-wide channel defaults are not available yet — choose the channels on each rule.',
  /** Not a backend gap — the web panel has no camera/QR reader; the mobile app has one. */
  scanner: 'Not available in the web panel — type the serial printed on the device label.',
  scannerTooltip: 'Scanning is only available in the mobile app',
  /** B-88 — `POST /devices` takes serial/model/firmware only. */
  autoFirmware: 'Not available yet — firmware is pushed per device from the device row menu',
  autoFirmwareTooltip: 'The register-device API has no firmware-policy field',
  diagnosticsOptIn: 'Not available yet — the register-device API has no diagnostics opt-in',
  diagnosticsOptInTooltip: 'The register-device API has no diagnostics field',
  /** B-89 — no marketplace/catalogue endpoint or URL. */
  marketplace: 'The integration marketplace is not available yet.',
} as const;

/**
 * WB-232 — the status line on each Integrations card. Built only from `GET /integrations`
 * (`status`, `lastSyncAt`); the old per-card figures ("69 devices syncing", "1,842 receipts this
 * quarter", …) were invented and are gone.
 */
export const INTEGRATION_STATUS = {
  lastSync: (relative: string) => `Last sync · ${relative}`,
  connectedNoSync: 'Connected · no sync yet',
  /** WB-251 — a webhook row connected before the fix, with no endpoint URL: nothing is delivered. */
  webhookNoEndpoint: 'Connected · no endpoint set',
  notConnected: 'Not connected',
} as const;

/** WB-251 — the Custom webhook modal (connect / configure). */
export const WEBHOOK_COPY = {
  connectTitle: 'Connect Custom webhook',
  configureTitle: 'Configure Custom webhook',
  subtitle: 'OneBook POSTs JSON events to this endpoint, signed with your secret.',
  urlLabel: 'Endpoint URL',
  urlPlaceholder: 'e.g. https://example.com/hooks/onebook',
  urlHint: 'Use https:// so events are encrypted in transit.',
  secretLabel: 'Signing secret',
  secretHint: 'Each delivery carries an X-OneBook-Signature header signed with this secret. Copy it to your endpoint before saving.',
  secretEditHint:
    'The saved secret is never shown. Saving replaces the whole webhook configuration, so enter the current secret again or generate a new one and update your endpoint.',
  generate: 'Generate',
  connectSubmit: 'Connect',
  configureSubmit: 'Save changes',
} as const;

/** Roles & permissions (W-21) and Create a role (11.19). */
export const ROLE_COPY = {
  /** B-95 (shipped 2026-09-24) — `dataTransfer` is its own 23rd permission key; the pack export
   * checkbox (`reportsTransfer`) and the data-transfer checkbox (`dataTransfer`) are separate. */
  fmcsaPackCheckbox: 'Can export FMCSA / DOT pack',
  dataTransferCheckbox: 'Can send data transfers to an inspector',
  transferMatrixRow: 'Export FMCSA / DOT pack',
  dataTransferMatrixRow: 'Send data transfers to an inspector',
} as const;

/**
 * W-23 Audit log — B-64: action, date range and search are applied in the browser, so older
 * cursor pages are fetched automatically (capped) while one of them is active.
 */
export const AUDIT_SEARCH_COPY = {
  searching: (n: number) => `Searching older entries… ${n} entries searched so far.`,
  capReached: (n: number) =>
    `Searched the ${n} most recent entries (the automatic search limit) — action, date and search filters do not cover older entries yet. Use Load more to include them.`,
  stopped: (n: number) =>
    `Search stopped after ${n} entries — action, date and search filters do not cover older entries. Use Load more to include them.`,
  partial: (n: number) =>
    `Action, date and search filters apply to the ${n} entries loaded so far — use Load more to include older entries.`,
  rangeCovered: (n: number) => `Searched every entry in the selected date range (${n} loaded).`,
} as const;
