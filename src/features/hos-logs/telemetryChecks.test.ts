import { describe, expect, it } from 'vitest';
import { RECORD_STATUS, type LogEventView } from '@/shared/api/hosLogs';
import { telemetryFlags } from './telemetryChecks';

const ev = (id: string, at: string, mi: number | null, hours: number | null = null, extra: Partial<LogEventView> = {}) =>
  ({
    id,
    eventDateTime: at,
    totalVehicleMiles: mi,
    totalEngineHours: hours,
    recordStatus: RECORD_STATUS.active,
    vehicleId: 'veh-106',
    ...extra,
  }) as LogEventView;

describe('telemetryFlags (LIVE-015)', () => {
  it('flags a same-second odometer jump and an odometer going down (the QA Driver Oct 13 cases)', () => {
    const flags = telemetryFlags([
      ev('a', '2026-10-13T06:04:09Z', 51_466),
      ev('b', '2026-10-13T06:04:09Z', 53_665),
      ev('c', '2026-10-13T14:22:45Z', 53_728),
      ev('d', '2026-10-13T14:41:10Z', 53_715),
    ]);
    expect(flags.get('b')?.odometer).toMatch(/jumped 2,199 mi/);
    expect(flags.get('d')?.odometer).toMatch(/went down by 13 mi/);
    expect(flags.has('a')).toBe(false);
    expect(flags.has('c')).toBe(false);
  });

  it('flags engine hours going down, tolerating rounding', () => {
    const flags = telemetryFlags([
      ev('a', '2026-10-13T10:00:00Z', null, 1200.4),
      ev('b', '2026-10-13T10:30:00Z', null, 1200.38),
      ev('c', '2026-10-13T11:00:00Z', null, 1200.2),
    ]);
    expect(flags.has('b')).toBe(false);
    expect(flags.get('c')?.engineHours).toMatch(/went down/);
  });

  it('accepts normal driving, compares per unit and ignores retired records', () => {
    const flags = telemetryFlags([
      ev('a', '2026-10-13T10:00:00Z', 1_000),
      ev('b', '2026-10-13T11:00:00Z', 1_060),
      ev('x', '2026-10-13T11:05:00Z', 90_000, null, { vehicleId: 'veh-other' }),
      ev('r', '2026-10-13T11:10:00Z', 5, null, { recordStatus: RECORD_STATUS.superseded }),
      ev('c', '2026-10-13T12:00:00Z', 1_120),
    ]);
    expect(flags.size).toBe(0);
  });
});
