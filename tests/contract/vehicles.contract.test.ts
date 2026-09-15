// ⭐ The pattern every other agent copies: call the endpoint through the real client, against the
// MSW handler, and validate the unwrapped payload against backend/docs/openapi.json.
import { describe, expect, it } from 'vitest';
import { client } from '../../src/shared/api/client';
import { endpoints } from '../../src/shared/api/endpoints';
import { ApiError } from '../../src/shared/api/errors';
import type { OffsetPage, VehiclesListItem } from '../../src/shared/api/types';
import { server } from '../../src/mocks/server';
import { fail, url } from '../../src/mocks/envelope';
import { http } from 'msw';
import { assertMatchesOpenApi, diffAgainstExample, documentedExample } from './openapi';

describe('GET /api/vehicles', () => {
  it('returns the documented OffsetPage payload after the envelope is unwrapped', async () => {
    const page = await client.get<OffsetPage<VehiclesListItem>>(endpoints.vehicles.list, {
      params: { page: 1, limit: 25 },
    });

    assertMatchesOpenApi('GET', '/api/vehicles', page);
    expect(page.items[0]?.unitNumber).toBe('#101');
    expect(page.totalPages).toBe(1);
  });

  it('fails when the response drops a documented field — the suite exists to catch drift', () => {
    const drifted = { ...(documentedExample('GET', '/api/vehicles') as object), items: [{}] };
    expect(diffAgainstExample(documentedExample('GET', '/api/vehicles'), drifted)).toContain(
      '$.items[0].id: missing (documented as string)',
    );
  });

  it('surfaces a plain 403 as a ForbiddenState error with no toast (§6.2 rule 5)', async () => {
    server.use(
      http.get(url(endpoints.vehicles.list), () =>
        fail(403, 'FORBIDDEN', 'Insufficient permissions for this action.'),
      ),
    );

    await expect(client.get(endpoints.vehicles.list)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });

    const error = await client.get(endpoints.vehicles.list).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).isForbidden).toBe(true);
  });
});

describe('GET /api/logs/{driverId}', () => {
  it('matches the documented RODS day payload, timezone included', async () => {
    const day = await client.get(endpoints.logs.day('drv_1'), { params: { date: '2026-09-10' } });
    assertMatchesOpenApi('GET', '/api/logs/{driverId}', day);
    expect((day as { timezone: string }).timezone).toBe('America/New_York');
  });
});
