// web/tz.md §6.3 — the factory is the only source of query keys.
import { describe, expect, it } from 'vitest';
import { qk, qkRoot } from './queryKeys';

describe('qk factory', () => {
  it('produces the §6.3 shapes', () => {
    expect(qk.me).toEqual(['me']);
    expect(qk.carrier).toEqual(['carrier']);
    expect(qk.sessions).toEqual(['me', 'sessions']);
    expect(qk.roles).toEqual(['roles']);
    expect(qk.vehicles()).toEqual(['vehicles', {}]);
    expect(qk.vehicles({ page: 2 })).toEqual(['vehicles', { page: 2 }]);
    expect(qk.vehicle('veh_1')).toEqual(['vehicles', 'veh_1']);
    expect(qk.vehicleTelemetry('veh_1')).toEqual(['vehicles', 'veh_1', 'telemetry']);
    expect(qk.vehicleDtc('veh_1')).toEqual(['vehicles', 'veh_1', 'dtc']);
    expect(qk.logDay('drv_1', '2026-09-10')).toEqual(['logs', 'drv_1', 'day', '2026-09-10']);
    expect(qk.logRange('drv_1', '2026-09-01', '2026-09-08')).toEqual([
      'logs',
      'drv_1',
      'range',
      '2026-09-01',
      '2026-09-08',
    ]);
    expect(qk.logEvents('drv_1', '2026-09-10')).toEqual(['logs', 'drv_1', 'events', '2026-09-10']);
    expect(qk.editRequests('drv_1')).toEqual(['logs', 'drv_1', 'edit-requests', 'ALL']);
    expect(qk.editRequests('drv_1', 'PENDING')).toEqual([
      'logs',
      'drv_1',
      'edit-requests',
      'PENDING',
    ]);
    expect(qk.messages('cnv_1', { page: 1 })).toEqual([
      'conversations',
      'cnv_1',
      'messages',
      { page: 1 },
    ]);
    expect(qk.audit()).toEqual(['audit-log', {}]);
    expect(qk.tickets()).toEqual(['support', 'tickets', {}]);
    expect(qk.scorecard()).toEqual(['safety', 'scorecard', {}]);
    expect(qk.search('101')).toEqual(['search', '101']);
  });

  it('nests every detail key under its list root so one invalidation clears both', () => {
    expect(qk.vehicle('veh_1')[0]).toBe(qkRoot.vehicles[0]);
    expect(qk.logDay('d', '2026-09-10')[0]).toBe(qkRoot.logs[0]);
    expect(qk.driverRoster()[0]).toBe(qkRoot.drivers[0]);
  });

  it('every factory returns a namespaced array — no key is left unexercised', () => {
    for (const [name, value] of Object.entries(qk)) {
      const key = typeof value === 'function' ? (value as (...a: unknown[]) => readonly unknown[])('id', 'a', 'b') : value;
      expect(Array.isArray(key), name).toBe(true);
      expect(key.length, name).toBeGreaterThan(0);
      expect(typeof key[0], name).toBe('string');
    }
  });

  it('covers every §6.3 key', () => {
    const required = [
      'me', 'carrier', 'vehicles', 'vehicle', 'vehicleTelemetry', 'vehicleDtc', 'drivers',
      'driver', 'logDay', 'logRange', 'logEvents', 'editRequests', 'unidentified', 'dvirs',
      'defects', 'workOrders', 'schedules', 'trips', 'safetyEvents', 'scorecard', 'reports',
      'transfers', 'devices', 'users', 'roles', 'alertRules', 'integrations', 'apiKeys', 'audit',
      'tickets', 'conversations', 'messages', 'notifications', 'sessions',
    ];
    expect(required.filter((key) => !(key in qk))).toEqual([]);
  });
});
