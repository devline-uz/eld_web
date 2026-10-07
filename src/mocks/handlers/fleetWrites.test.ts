// `POST /drivers` in `dev:mock` — every unique value answers its own 409, and a unit that already
// has a driver is refused instead of silently taken from that driver.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { DRIVERS, VEHICLES, resetMockState } from './mockState';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => resetMockState());
afterAll(() => server.close());

const create = (dto: Record<string, unknown>) =>
  fetch(url(endpoints.drivers.create), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ firstName: 'New', lastName: 'Driver', username: 'brandnew', email: 'brand.new@example.com', cdlNumber: 'NEW0001', ...dto }),
  });

const phoneDigits = (i: number) => DRIVERS[i]!.phone!.replace(/\D/g, '').slice(-10);

describe('POST /drivers mock', () => {
  it.each([
    ['email', () => ({ email: DRIVERS[0]!.email!.toUpperCase() }), 'EMAIL_TAKEN'],
    ['phone', () => ({ phone: DRIVERS[0]!.phone!.replace(/\s/g, '-') }), 'PHONE_TAKEN'],
    ['cdlNumber', () => ({ cdlNumber: DRIVERS[0]!.cdlNumber.toLowerCase() }), 'CDL_NUMBER_TAKEN'],
  ])('rejects a duplicate %s with a 409 naming the field', async (field, dto, code) => {
    const res = await create(dto());
    const body = (await res.json()) as { code: string; details: Record<string, string> };
    expect(res.status).toBe(409);
    expect(body.code).toBe(code);
    expect(body.details[field]).toBeDefined();
  });

  it.each([
    ['username with spaces', () => ({ username: `  ${DRIVERS[0]!.username} ` }), 'USERNAME_TAKEN', 'username'],
    ['email with case and spaces', () => ({ email: ` ${DRIVERS[0]!.email!.toUpperCase()} ` }), 'EMAIL_TAKEN', 'email'],
    ['phone in another format', () => ({ phone: `+1 (${phoneDigits(0).slice(0, 3)}) ${phoneDigits(0).slice(3, 6)}-${phoneDigits(0).slice(6)}` }), 'PHONE_TAKEN', 'phone'],
    ['licence with dashes and spaces', () => ({ cdlNumber: ` ${DRIVERS[0]!.cdlNumber.toLowerCase().split('').join('-')} ` }), 'CDL_NUMBER_TAKEN', 'cdlNumber'],
  ])('treats a %s as the same value', async (_name, dto, code, field) => {
    const res = await create(dto());
    const body = (await res.json()) as { code: string; details: Record<string, string> };
    expect(res.status).toBe(409);
    expect(body.code).toBe(code);
    expect(body.details[field]).toBeDefined();
  });

  it('answers 404 VEHICLE_NOT_FOUND for an unknown unit and 409 VEHICLE_OUT_OF_SERVICE for a blocked one', async () => {
    const missing = await create({ assignedVehicleId: 'veh_nope' });
    expect(missing.status).toBe(404);
    const body = (await missing.json()) as { code: string; details: Record<string, string> };
    expect(body.code).toBe('VEHICLE_NOT_FOUND');
    expect(body.details.assignedVehicleId).toBe('Select a unit.');
    const taken = new Set(DRIVERS.map((d) => d.assignedVehicleId));
    const free = VEHICLES.find((v) => !taken.has(v.id))!;
    free.status = 'OUT_OF_SERVICE';
    const oos = await create({ assignedVehicleId: free.id });
    expect(oos.status).toBe(409);
    expect(((await oos.json()) as { code: string }).code).toBe('VEHICLE_OUT_OF_SERVICE');
  });

  it('refuses a unit that already has a driver and leaves that driver assigned', async () => {
    const holder = DRIVERS.find((d) => d.assignedVehicleId)!;
    const unitId = holder.assignedVehicleId!;
    const res = await create({ assignedVehicleId: unitId });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe('VEHICLE_ALREADY_ASSIGNED');
    expect(holder.assignedVehicleId).toBe(unitId);
  });

  it('assigns a free unit to the new driver, so the unit reads the driver back', async () => {
    const taken = new Set(DRIVERS.map((d) => d.assignedVehicleId));
    const free = VEHICLES.find((v) => !taken.has(v.id))!;
    const res = await create({ assignedVehicleId: free.id });
    expect(res.status).toBe(201);
    expect(DRIVERS.filter((d) => d.assignedVehicleId === free.id).map((d) => d.username)).toEqual(['brandnew']);
  });
});

const patchDriver = (id: string, dto: Record<string, unknown>) =>
  fetch(url(endpoints.drivers.update(id)), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });

describe('PATCH /drivers/:id mock', () => {
  it('rejects another driver\'s email, phone and licence with the *_TAKEN codes', async () => {
    const other = DRIVERS[1]!;
    const email = await patchDriver(DRIVERS[0]!.id, { email: other.email!.toUpperCase() });
    expect(((await email.json()) as { code: string }).code).toBe('EMAIL_TAKEN');
    const phone = await patchDriver(DRIVERS[0]!.id, { phone: other.phone });
    expect(((await phone.json()) as { code: string }).code).toBe('PHONE_TAKEN');
    const cdl = await patchDriver(DRIVERS[0]!.id, { cdlNumber: other.cdlNumber.toLowerCase() });
    expect(((await cdl.json()) as { code: string }).code).toBe('CDL_NUMBER_TAKEN');
  });

  it('saves a driver unchanged (own values are not a conflict) and ignores assignedVehicleId', async () => {
    const d = DRIVERS[0]!;
    const before = d.assignedVehicleId;
    const res = await patchDriver(d.id, { email: d.email, phone: d.phone, cdlNumber: d.cdlNumber, assignedVehicleId: 'veh_nope' });
    expect(res.status).toBe(200);
    expect(d.assignedVehicleId).toBe(before);
  });

  it('a deleted driver\'s values are free to take', async () => {
    const [a, b] = [DRIVERS[0]!, DRIVERS[1]!];
    b.status = 'TERMINATED';
    const res = await patchDriver(a.id, { email: b.email, cdlNumber: b.cdlNumber });
    expect(res.status).toBe(200);
  });
});

// `PATCH /vehicles/:id` — a duplicate unit number / VIN answers its own 409 naming the field, and the
// unit being edited is excluded so saving it unchanged never conflicts with itself (B-97).
const patchVehicle = (id: string, dto: Record<string, unknown>) =>
  fetch(url(endpoints.vehicles.update(id)), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dto),
  });

describe('PATCH /vehicles/:id mock', () => {
  it('rejects another unit\'s number (any case, with or without "#") with UNIT_NUMBER_TAKEN', async () => {
    const [self, other] = VEHICLES;
    const res = await patchVehicle(self!.id, { unitNumber: other!.unitNumber.replace(/^#/, '').toLowerCase() });
    const body = (await res.json()) as { code: string; details: Record<string, string> };
    expect(res.status).toBe(409);
    expect(body.code).toBe('UNIT_NUMBER_TAKEN');
    expect(body.details.unitNumber).toBeDefined();
    expect(self!.unitNumber).not.toBe(other!.unitNumber);
  });

  it('rejects another unit\'s VIN (any case) with VIN_TAKEN', async () => {
    const [self, other] = VEHICLES;
    const res = await patchVehicle(self!.id, { vin: other!.vin!.toLowerCase() });
    const body = (await res.json()) as { code: string; details: Record<string, string> };
    expect(res.status).toBe(409);
    expect(body.code).toBe('VIN_TAKEN');
    expect(body.details.vin).toBeDefined();
  });

  it('saves a unit unchanged: its own number and VIN are not a conflict', async () => {
    const self = VEHICLES[0]!;
    const res = await patchVehicle(self.id, { unitNumber: self.unitNumber.replace(/^#/, ''), vin: self.vin, make: 'Volvo' });
    expect(res.status).toBe(200);
    expect(self.make).toBe('Volvo');
  });
});

// Soft delete (tz.md §11.3): the row is kept with `deletedAt` + INACTIVE, and leaves every read.
// A unit only "Set inactive" (bulk bar, B-71) has no `deletedAt` and stays listed.
describe('DELETE /vehicles/:id mock — soft delete', () => {
  type Page = { items: Array<{ id: string; status: string }>; total: number };
  const list = async (query = ''): Promise<Page> =>
    ((await (await fetch(`${url(endpoints.vehicles.list)}${query}`)).json()) as { data: Page }).data;

  it('marks the unit deleted and drops it from the list, the counts, the lookups and the detail', async () => {
    const target = VEHICLES.find((v) => v.status === 'ACTIVE')!;
    const holder = DRIVERS.find((d) => d.assignedVehicleId === target.id);
    const before = { all: (await list('?limit=1')).total, inactive: (await list('?status=INACTIVE&limit=1')).total };

    const res = await fetch(url(endpoints.vehicles.remove(target.id)), { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(target.status).toBe('INACTIVE');
    expect(target.deletedAt).toEqual(expect.any(String));
    expect(VEHICLES).toContain(target);
    if (holder) expect(holder.assignedVehicleId).toBeNull();

    expect((await list('?limit=1')).total).toBe(before.all - 1);
    // Deleted units are INACTIVE server-side, but they are not counted in the Inactive segment.
    expect((await list('?status=INACTIVE&limit=1')).total).toBe(before.inactive);
    expect((await list('?limit=500')).items.map((v) => v.id)).not.toContain(target.id);
    expect((await fetch(url(endpoints.vehicles.detail(target.id)))).status).toBe(404);
    expect((await fetch(url(endpoints.vehicles.remove(target.id)), { method: 'DELETE' })).status).toBe(404);
  });

  it('a unit only set inactive through the bulk bar is still listed under INACTIVE', async () => {
    const [inactive, deleted] = VEHICLES.filter((v) => v.status === 'ACTIVE');
    await fetch(url(endpoints.vehicles.bulkStatus), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: [inactive!.id], status: 'INACTIVE' }),
    });
    await fetch(url(endpoints.vehicles.remove(deleted!.id)), { method: 'DELETE' });

    const ids = (await list('?status=INACTIVE&limit=200')).items.map((v) => v.id);
    expect(ids).toContain(inactive!.id);
    expect(ids).not.toContain(deleted!.id);
    expect(inactive!.deletedAt ?? null).toBeNull();
    expect((await fetch(url(endpoints.vehicles.detail(inactive!.id)))).status).toBe(200);
  });
});

// A deleted record gives its unique values up: a new unit / driver may reuse them without a 409.
describe('unique values of deleted records are free to reuse', () => {
  const createVehicle = (dto: Record<string, unknown>) =>
    fetch(url(endpoints.vehicles.create), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(dto),
    });

  it('POST /vehicles reuses a soft-deleted unit\'s number and VIN', async () => {
    const target = VEHICLES.find((v) => v.status === 'ACTIVE')!;
    const { unitNumber, vin } = target;
    expect((await createVehicle({ unitNumber: unitNumber.replace(/^#/, ''), vin })).status).toBe(409);

    await fetch(url(endpoints.vehicles.remove(target.id)), { method: 'DELETE' });
    const res = await createVehicle({ unitNumber: unitNumber.replace(/^#/, ''), vin });
    expect(res.status).toBe(201);
    // …and once reused, the value is held again by the new live unit.
    expect((await createVehicle({ unitNumber: unitNumber.replace(/^#/, ''), vin: 'OTHERVIN0000000001' })).status).toBe(409);
  });

  it('PATCH /vehicles/:id may take a soft-deleted unit\'s number and VIN', async () => {
    const [self, deleted] = VEHICLES.filter((v) => v.status === 'ACTIVE');
    await fetch(url(endpoints.vehicles.remove(deleted!.id)), { method: 'DELETE' });
    const res = await patchVehicle(self!.id, { unitNumber: deleted!.unitNumber.replace(/^#/, ''), vin: deleted!.vin });
    expect(res.status).toBe(200);
  });

  it('POST /drivers reuses a deleted driver\'s username, email, phone and licence number', async () => {
    const gone = DRIVERS[0]!;
    await fetch(url(endpoints.drivers.remove(gone.id)), { method: 'DELETE' });
    const res = await create({ username: gone.username, email: gone.email, phone: gone.phone, cdlNumber: gone.cdlNumber });
    expect(res.status).toBe(201);
  });
});
