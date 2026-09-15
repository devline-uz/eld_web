import { describe, expect, it } from 'vitest';
import { hasPermission, ROLE_PERMISSIONS, type Role } from '@/shared/auth/permissions';
import { buildPaletteConfig } from './paletteCommands';

const configFor = (role: Role) =>
  buildPaletteConfig((key, level) => hasPermission(ROLE_PERMISSIONS[role], key, level), role);

const labels = (items: Array<{ label: string }>) => items.map((item) => item.label);

describe('buildPaletteConfig (11.28 — permission-less entries are absent)', () => {
  it('ADMIN gets every page and all three static actions', () => {
    const config = configFor('ADMIN');
    expect(labels(config.pages)).toEqual(
      expect.arrayContaining(['Dashboard', 'DVIR & Maintenance', 'Safety', 'Settings · Users', 'Settings · Audit log', 'My account']),
    );
    expect(labels(config.actions)).toEqual(['Request a log edit', 'Send FMCSA pack to inspector', 'Add a vehicle']);
    expect(config.canSearchDrivers && config.canSearchVehicles && config.canOpenHosLogs).toBe(true);
  });

  it('DISPATCHER has no DVIR, Safety or ELD devices page and cannot deep-link there', () => {
    const config = configFor('DISPATCHER');
    const pages = labels(config.pages);
    expect(pages).not.toContain('DVIR & Maintenance');
    expect(pages).not.toContain('Safety');
    expect(pages).not.toContain('Settings · ELD devices');
    expect(pages).not.toContain('Settings · Users');
    expect(pages).toContain('Settings · Support');
    expect(config.isPathAllowed('/dvir')).toBe(false);
    expect(config.isPathAllowed('/safety?tab=1')).toBe(false);
    expect(config.isPathAllowed('/settings/devices')).toBe(false);
    expect(config.isPathAllowed('/trips')).toBe(true);
  });

  it('VIEWER has no write actions and no Trips/Messages pages', () => {
    const config = configFor('VIEWER');
    expect(config.actions).toEqual([]);
    expect(labels(config.pages)).not.toContain('Dispatch & Trips');
    expect(labels(config.pages)).not.toContain('Messages');
    expect(config.isPathAllowed('/messages')).toBe(false);
  });

  it('FLEET_MANAGER cannot request a log edit only if hosEdit is not FULL', () => {
    const config = configFor('FLEET_MANAGER');
    const expected = ROLE_PERMISSIONS.FLEET_MANAGER.hosEdit === 'FULL';
    expect(labels(config.actions).includes('Request a log edit')).toBe(expected);
  });

  it('paths outside the navigation tree are allowed; the dashboard matches exactly', () => {
    const config = configFor('VIEWER');
    expect(config.isPathAllowed('/account#security')).toBe(true);
    expect(config.isPathAllowed('/')).toBe(true);
    expect(config.isPathAllowed('')).toBe(true);
  });
});
