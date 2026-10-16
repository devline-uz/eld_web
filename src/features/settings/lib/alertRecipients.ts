// owner: web-settings-admin — alert-rule recipient roles, shared by the New/Edit rule modal (the
// Recipients checkboxes) and the Alert rules list (the line under each rule's status).
//
// F3-01 — `recipients.roles` holds role KEYS: the alert worker matches `role.key IN roles`
// (`eld_backend/src/workers/alert.processor.ts`). The modal used to send display labels
// ("Fleet managers"), which match no user, so those rules notified nobody.
import { ROLE_LABEL } from '@/shared/auth/permissions';

/** The roles the Recipients field offers, in display order. */
export const RECIPIENT_ROLE_OPTIONS = [
  { key: 'ADMIN', label: 'Admins' },
  { key: 'FLEET_MANAGER', label: 'Fleet managers' },
  { key: 'DISPATCHER', label: 'Dispatchers' },
] as const;

/** A new rule notifies fleet managers unless the user picks otherwise. */
export const DEFAULT_RECIPIENT_ROLES: readonly string[] = ['FLEET_MANAGER'];

/**
 * Labels the web sent before F3-01, mapped to the role key they meant. There is no "assigned
 * fleet manager" resolver and no safety role, so both fall back to the fleet managers.
 */
const LEGACY_LABEL_TO_KEY: Record<string, string> = {
  'Fleet managers': 'FLEET_MANAGER',
  Dispatchers: 'DISPATCHER',
  'Assigned fleet manager': 'FLEET_MANAGER',
  'Safety team': 'FLEET_MANAGER',
};

/** Stored roles (keys or legacy labels) → unique role keys, in their stored order. */
export function normalizeRecipientRoles(roles: readonly string[] | undefined): string[] {
  const out: string[] = [];
  for (const role of roles ?? []) {
    const key = LEGACY_LABEL_TO_KEY[role] ?? role;
    if (!out.includes(key)) out.push(key);
  }
  return out;
}

const OPTION_LABEL = new Map<string, string>(RECIPIENT_ROLE_OPTIONS.map((o) => [o.key, o.label]));

/** A role key → its human label; an unknown (custom) role key is shown as-is. */
export function recipientRoleLabel(key: string): string {
  return OPTION_LABEL.get(key) ?? (ROLE_LABEL as Record<string, string>)[key] ?? key;
}

/** `['FLEET_MANAGER', 'Dispatchers']` → "Fleet managers, Dispatchers". */
export function describeRecipientRoles(roles: readonly string[] | undefined): string {
  return normalizeRecipientRoles(roles).map(recipientRoleLabel).join(', ');
}
