// owner: web-api-client — MSW for `/vehicle-groups` (backend D-107, 2026-09-25). Membership lives
// on `mockState.VEHICLES[].groupId`, so `GET /vehicles?groupId=` and the group counts agree.
import { http } from 'msw';
import { endpoints } from '@/shared/api/endpoints';
import type { VehicleGroupRow } from '@/shared/api/vehicles';
import { fail, ok, url } from '../envelope';
import { VEHICLES, mockId } from './mockState';

type Json = Record<string, unknown>;

const SEED: Omit<VehicleGroupRow, 'vehicleCount'>[] = [
  { id: 'vg_1', name: 'Midwest linehaul', description: 'OH / IN / KY lanes', color: '#2F6FED', createdAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-09-01T09:00:00.000Z' },
  { id: 'vg_2', name: 'Regional', description: null, color: '#16A34A', createdAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-09-01T09:00:00.000Z' },
];

let groups = SEED.map((g) => ({ ...g }));

/** Test hook — restores the two seeded groups. */
export function resetVehicleGroupsState(): void {
  groups = SEED.map((g) => ({ ...g }));
}

const view = (g: (typeof groups)[number]): VehicleGroupRow => ({
  ...g,
  vehicleCount: VEHICLES.filter((v) => v.groupId === g.id).length,
});

async function body(request: Request): Promise<Json> {
  return ((await request.json().catch(() => ({}))) ?? {}) as Json;
}

function setMembers(groupId: string, ids: string[]): void {
  for (const v of VEHICLES) {
    if (ids.includes(v.id)) v.groupId = groupId;
    else if (v.groupId === groupId) v.groupId = null;
  }
}

const notFound = () => fail(404, 'VEHICLE_GROUP_NOT_FOUND', 'Vehicle group not found.');

export const vehicleGroupHandlers = [
  http.get(url(endpoints.vehicleGroups.list), () => ok({ items: [...groups].sort((a, b) => a.name.localeCompare(b.name)).map(view) })),
  http.post(url(endpoints.vehicleGroups.create), async ({ request }) => {
    const dto = await body(request);
    const name = String(dto.name ?? '').trim();
    if (groups.some((g) => g.name === name)) return fail(409, 'CONFLICT', `Vehicle group "${name}" already exists.`);
    const now = new Date().toISOString();
    const group = {
      id: mockId('vg'),
      name,
      description: (dto.description as string | null | undefined) ?? null,
      color: (dto.color as string | null | undefined) ?? null,
      createdAt: now,
      updatedAt: now,
    };
    groups.push(group);
    if (Array.isArray(dto.vehicleIds)) setMembers(group.id, dto.vehicleIds as string[]);
    return ok(view(group), 201);
  }),
  http.put(url(endpoints.vehicleGroups.members(':id')), async ({ params, request }) => {
    const group = groups.find((g) => g.id === params.id);
    if (!group) return notFound();
    const dto = await body(request);
    setMembers(group.id, Array.isArray(dto.vehicleIds) ? (dto.vehicleIds as string[]) : []);
    return ok(view(group));
  }),
  http.get(url(endpoints.vehicleGroups.detail(':id')), ({ params }) => {
    const group = groups.find((g) => g.id === params.id);
    if (!group) return notFound();
    const vehicles = VEHICLES.filter((v) => v.groupId === group.id).map(({ id, unitNumber, vin, make, model, status }) => ({
      id, unitNumber, vin, make, model, status,
    }));
    return ok({ ...view(group), vehicles });
  }),
  http.patch(url(endpoints.vehicleGroups.update(':id')), async ({ params, request }) => {
    const group = groups.find((g) => g.id === params.id);
    if (!group) return notFound();
    Object.assign(group, await body(request), { updatedAt: new Date().toISOString() });
    return ok(view(group));
  }),
  http.delete(url(endpoints.vehicleGroups.remove(':id')), ({ params }) => {
    const group = groups.find((g) => g.id === params.id);
    if (!group) return notFound();
    setMembers(group.id, []);
    groups = groups.filter((g) => g.id !== group.id);
    return ok({ success: true });
  }),
];
