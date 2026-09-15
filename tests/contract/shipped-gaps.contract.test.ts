// B-1, B-2, B-3, B-6 and B-46 (IFTA summary) shipped 2026-09-14. Each call goes through the real
// client against the default MSW handler, and the unwrapped payload is validated against
// backend/docs/openapi.json. Backend `TransformInterceptor` (APP_INTERCEPTOR) wraps every
// non-Buffer/non-string return, including the IFTA summary. `client.ts` must still read the
// same object if a body ever arrives unwrapped (web/decisions.md WD-069).
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { client } from '../../src/shared/api/client';
import { endpoints } from '../../src/shared/api/endpoints';
import type { DriverHosResponse, DriverRosterResponse } from '../../src/shared/api/drivers';
import type { ResolveViolationResult } from '../../src/shared/api/hosLogs';
import type { LiveFleetResponse } from '../../src/shared/api/liveFleet';
import type { IftaSummary } from '../../src/shared/api/reports';
import { server } from '../../src/mocks/server';
import { ok, url } from '../../src/mocks/envelope';
import { assertMatchesOpenApi, documentedExample } from './openapi';

/**
 * openapi.json carries examples, not schemas, so it cannot say "nullable". The examples show the
 * populated case only; these are the fields backend source declares `| null`
 * (`driver-roster.service.ts#DriverRosterEntry`, `live-fleet.mapper.ts#LiveFleetUnit`). Fully
 * populated rows are held to the example; a row with nulls may be null ONLY on these fields.
 */
const NULLABLE = {
  roster: new Set(['unit', 'emailVerified']),
  rosterDriver: new Set(['appVersion', 'email']),
  liveUnit: new Set([
    'driverId', 'driverName', 'driverPhone', 'speedMph', 'headingDeg', 'odometerMi', 'lat', 'lon',
    'locationLabel', 'lastSeenAt', 'driveRemainingSec', 'shiftEndsAt', 'eldSerial', 'bleState',
  ]),
};

const nullKeys = (row: object) =>
  Object.entries(row).filter(([, v]) => v === null).map(([k]) => k);

describe('GET /api/drivers/roster (B-1)', () => {
  it('matches the documented roster page', async () => {
    const page = await client.get<DriverRosterResponse>(endpoints.drivers.roster, {
      params: { page: 1, limit: 25, terminal: 'Columbus, OH', hasOpenViolation: 'true', exempt: 'false' },
    });
    const populated = page.items.filter((e) => e.unit !== null);
    assertMatchesOpenApi('GET', '/api/drivers/roster', { ...page, items: populated });
    expect(populated.length).toBeGreaterThan(0);
    for (const entry of page.items) {
      expect(nullKeys(entry).filter((k) => !NULLABLE.roster.has(k))).toEqual([]);
      expect(nullKeys(entry.driver).filter((k) => !NULLABLE.rosterDriver.has(k))).toEqual([]);
    }
  });
});

describe('GET /api/drivers/{id}/hos (B-2)', () => {
  it('matches the documented clocks, dutyStatus/statusSince/computedAt included', async () => {
    const hos = await client.get<DriverHosResponse>(endpoints.drivers.hos('drv_1'));
    assertMatchesOpenApi('GET', '/api/drivers/{id}/hos', hos);
  });
});

describe('GET /api/live/fleet (B-3)', () => {
  it('matches the documented snapshot; nulls only where the backend declares them', async () => {
    const fleet = await client.get<LiveFleetResponse>(endpoints.live.fleet);
    const populated = fleet.items.filter((u) => nullKeys(u).length === 0);
    assertMatchesOpenApi('GET', '/api/live/fleet', { ...fleet, items: populated });
    expect(populated.length).toBeGreaterThan(0);
    for (const unit of fleet.items) {
      expect(Object.keys(unit).sort()).toEqual(Object.keys(fleet.items[0]!).sort());
      expect(nullKeys(unit).filter((k) => !NULLABLE.liveUnit.has(k))).toEqual([]);
    }
  });
});

describe('GET /api/violations + POST /api/violations/{id}/resolve (B-6)', () => {
  it('list matches the documented offset page, item fields included', async () => {
    const list = await client.get(endpoints.violations.list, { params: { window: '24h' } });
    assertMatchesOpenApi('GET', '/api/violations', list);
  });

  it('resolve matches the documented result', async () => {
    const result = await client.post<ResolveViolationResult>(endpoints.violations.resolve('vio_1'), {
      resolutionNote: 'Adverse weather, dispatcher confirmed',
    });
    assertMatchesOpenApi('POST', '/api/violations/{id}/resolve', result);
    expect(result.status).toBe('RESOLVED');
  });
});

describe('GET /api/reports/ifta/summary (B-46)', () => {
  const example = documentedExample('GET', '/api/reports/ifta/summary') as IftaSummary;

  it('matches the documented summary', async () => {
    const summary = await client.get<IftaSummary>(endpoints.reports.iftaSummary, {
      params: { quarter: '2026-Q3' },
    });
    assertMatchesOpenApi('GET', '/api/reports/ifta/summary', summary);
  });

  it('reads the same IftaSummary whether the body is enveloped (real backend) or not', async () => {
    server.use(http.get(url(endpoints.reports.iftaSummary), () => ok(example)));
    const wrapped = await client.get<IftaSummary>(endpoints.reports.iftaSummary, {
      params: { quarter: '2026-Q3' },
    });

    server.use(http.get(url(endpoints.reports.iftaSummary), () => HttpResponse.json(example)));
    const raw = await client.get<IftaSummary>(endpoints.reports.iftaSummary, {
      params: { quarter: '2026-Q3' },
    });

    expect(wrapped).toEqual(example);
    expect(raw).toEqual(example);
    expect(wrapped).not.toHaveProperty('data');
  });
});
