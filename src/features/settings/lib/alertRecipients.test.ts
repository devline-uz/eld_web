import { describe, expect, it } from 'vitest';
import {
  describeRecipientRoles,
  normalizeRecipientRoles,
  recipientRoleLabel,
} from './alertRecipients';

describe('alertRecipients (F3-01)', () => {
  it('maps legacy labels to role keys, keeps keys, and de-duplicates', () => {
    expect(
      normalizeRecipientRoles([
        'Fleet managers',
        'FLEET_MANAGER',
        'Dispatchers',
        'Assigned fleet manager',
        'Safety team',
        'SUPER_ADMIN',
        'CUSTOM_ROLE',
      ]),
    ).toEqual(['FLEET_MANAGER', 'DISPATCHER', 'SUPER_ADMIN', 'CUSTOM_ROLE']);
    expect(normalizeRecipientRoles(undefined)).toEqual([]);
  });

  it('labels known keys and passes unknown keys through', () => {
    expect(recipientRoleLabel('ADMIN')).toBe('Admins');
    expect(recipientRoleLabel('SUPER_ADMIN')).toBe('Super Admin');
    expect(recipientRoleLabel('VIEWER')).toBe('Viewer');
    expect(recipientRoleLabel('CUSTOM_ROLE')).toBe('CUSTOM_ROLE');
    expect(describeRecipientRoles(['FLEET_MANAGER', 'Dispatchers'])).toBe(
      'Fleet managers, Dispatchers',
    );
    expect(describeRecipientRoles([])).toBe('');
  });
});
