// `VITE_DEMO_FALLBACK` — the single demo-data switch. Production must never show demo rows.
import { describe, expect, it } from 'vitest';
import * as dvirApi from '@/shared/api/dvir';
import * as lookupsApi from '@/shared/api/lookups';
import * as reportsApi from '@/shared/api/reports';
import * as vehiclesApi from '@/shared/api/vehicles';
import * as dvirDemo from '@/features/dvir/mock/useDvirMock';
import * as iftaDemo from '@/features/reports/mock/useIftaMock';
import { DEMO_FALLBACK_ENABLED, DEMO_FALLBACK_MODE, resolveMockMode, shouldUseDemoRows } from './mockMode';

const PROD = { PROD: true, DEV: false, MODE: 'production' };
const DEV = { PROD: false, DEV: true, MODE: 'development' };
const TEST = { PROD: false, DEV: true, MODE: 'test' };

describe('resolveMockMode', () => {
  it.each([undefined, '', 'fallback', 'true', '1', 'always', 'ALWAYS'])('is always off in a production build (%s)', (value) => {
    expect(resolveMockMode(value, PROD)).toBe('off');
  });

  it('defaults to fallback in vite dev and off under vitest', () => {
    expect(resolveMockMode(undefined, DEV)).toBe('fallback');
    expect(resolveMockMode('', DEV)).toBe('fallback');
    expect(resolveMockMode(undefined, TEST)).toBe('off');
  });

  it.each([
    ['off', 'off'],
    ['false', 'off'],
    ['0', 'off'],
    ['fallback', 'fallback'],
    ['true', 'fallback'],
    ['1', 'fallback'],
    [' Always ', 'always'],
  ] as const)('honours an explicit %s outside production', (value, expected) => {
    expect(resolveMockMode(value, DEV)).toBe(expected);
    expect(resolveMockMode(value, TEST)).toBe(expected);
  });
});

describe('flag off (the vitest default, like every production build)', () => {
  it('resolves to off', () => {
    expect(DEMO_FALLBACK_MODE).toBe('off');
    expect(DEMO_FALLBACK_ENABLED).toBe(false);
  });

  it('the IFTA page hooks are the real API hooks — no demo wrapper in between', () => {
    expect(iftaDemo.useIftaSummary).toBe(reportsApi.useIftaSummary);
    expect(iftaDemo.useIftaJurisdictions).toBe(reportsApi.useIftaJurisdictions);
    expect(iftaDemo.useVehicleGroups).toBe(vehiclesApi.useVehicleGroups);
  });

  it('the DVIR page hooks are the real API hooks — no demo wrapper in between', () => {
    expect(dvirDemo.useRecentDvirs).toBe(dvirApi.useRecentDvirs);
    expect(dvirDemo.useOpenDefects).toBe(dvirApi.useOpenDefects);
    expect(dvirDemo.useWorkOrdersList).toBe(dvirApi.useWorkOrdersList);
    expect(dvirDemo.useSchedulesList).toBe(dvirApi.useSchedulesList);
    expect(dvirDemo.useDueSchedules).toBe(dvirApi.useDueSchedules);
    expect(dvirDemo.useVehiclesLookup).toBe(lookupsApi.useVehiclesLookup);
    expect(dvirDemo.useDvir).toBe(dvirApi.useDvir);
  });
});

describe('shouldUseDemoRows (CODE-086 — errors are never masked by demo rows)', () => {
  const idle = { isLoading: false, isError: false };
  it('off: never', () => expect(shouldUseDemoRows(idle, 0, 'off')).toBe(false));
  it('always: even over real rows or an error', () => {
    expect(shouldUseDemoRows(idle, 5, 'always')).toBe(true);
    expect(shouldUseDemoRows({ isLoading: false, isError: true }, 0, 'always')).toBe(true);
  });
  it('fallback: only an empty successful answer', () => {
    expect(shouldUseDemoRows(idle, 0, 'fallback')).toBe(true);
    expect(shouldUseDemoRows(idle, 3, 'fallback')).toBe(false);
    expect(shouldUseDemoRows({ isLoading: true, isError: false }, 0, 'fallback')).toBe(false);
    expect(shouldUseDemoRows({ isLoading: false, isError: true }, 0, 'fallback')).toBe(false);
  });
});
