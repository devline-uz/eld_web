// Contract: `/vehicle-groups` (backend D-107) — every call the Vehicle groups screen (WD-116) makes,
// through the real client against MSW, validated against backend/docs/openapi.json.
import { afterEach, describe, expect, it } from 'vitest';
import { client } from '../../src/shared/api/client';
import { endpoints } from '../../src/shared/api/endpoints';
import { ApiError } from '../../src/shared/api/errors';
import type { VehicleGroupDetail, VehicleGroupRow } from '../../src/shared/api/vehicles';
import { resetMockState } from '../../src/mocks/handlers/mockState';
import { resetVehicleGroupsState } from '../../src/mocks/handlers/vehicleGroups';
import { assertMatchesOpenApi } from './openapi';

afterEach(() => {
  resetMockState();
  resetVehicleGroupsState();
});

describe('/api/vehicle-groups', () => {
  it('GET list matches the documented `{ items }` payload', async () => {
    const list = await client.get<{ items: VehicleGroupRow[] }>(endpoints.vehicleGroups.list);
    // `description`/`color` are `.nullable()` in `CreateVehicleGroupDto`; the example can only show
    // the string form, so the shape check runs on the rows that carry both.
    const full = list.items.filter((g) => g.description !== null && g.color !== null);
    expect(full.length).toBeGreaterThan(0);
    assertMatchesOpenApi('GET', '/api/vehicle-groups', { items: full });
    for (const g of list.items) expect(typeof g.vehicleCount).toBe('number');
  });

  it('GET /:id returns the group with its units', async () => {
    const group = await client.get<VehicleGroupDetail>(endpoints.vehicleGroups.detail('vg_1'));
    assertMatchesOpenApi('GET', '/api/vehicle-groups/{id}', group);
    expect(group.vehicles.length).toBe(group.vehicleCount);
  });

  it('POST creates (with vehicleIds) and a duplicate name is a 409', async () => {
    const created = await client.post<VehicleGroupRow>(endpoints.vehicleGroups.create, {
      name: 'Night shift',
      description: 'Overnight lanes',
      color: '#7C3AED',
      vehicleIds: ['veh_3', 'veh_6'],
    });
    assertMatchesOpenApi('POST', '/api/vehicle-groups', created);
    expect(created.vehicleCount).toBe(2);

    const error = await client.post(endpoints.vehicleGroups.create, { name: 'Night shift' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
  });

  it('PATCH renames; renaming onto another group is a 409', async () => {
    const updated = await client.patch<VehicleGroupRow>(endpoints.vehicleGroups.update('vg_1'), { name: 'Midwest' });
    assertMatchesOpenApi('PATCH', '/api/vehicle-groups/{id}', updated);
    expect(updated.name).toBe('Midwest');

    const error = await client.patch(endpoints.vehicleGroups.update('vg_1'), { name: 'Regional' }).catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(409);
  });

  it('PUT /:id/vehicles replaces the membership', async () => {
    const group = await client.put<VehicleGroupRow>(endpoints.vehicleGroups.members('vg_1'), { vehicleIds: ['veh_3'] });
    assertMatchesOpenApi('PUT', '/api/vehicle-groups/{id}/vehicles', group);
    expect(group.vehicleCount).toBe(1);
  });

  it('DELETE answers `{ success: true }` and the group is gone', async () => {
    const result = await client.delete<{ success: boolean }>(endpoints.vehicleGroups.remove('vg_2'));
    assertMatchesOpenApi('DELETE', '/api/vehicle-groups/{id}', result);
    const error = await client.get(endpoints.vehicleGroups.detail('vg_2')).catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(404);
  });
});
