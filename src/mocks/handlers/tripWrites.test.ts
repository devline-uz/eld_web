// `PATCH` / `DELETE /trips/:id` in `dev:mock` — the backend contract for W-11 Edit / Delete trip:
// hard delete (204), 404 unknown, 409 `TRIP_IN_PROGRESS`; 409 `TRIP_NOT_EDITABLE` for field edits
// of a DELIVERED / CANCELLED trip.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { findMockTrip, resetMockTrips } from './tripsMessagingGaps';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => resetMockTrips());
afterAll(() => server.close());

const del = (id: string) => fetch(url(endpoints.trips.remove(id)), { method: 'DELETE' });
const patch = (id: string, dto: Record<string, unknown>) =>
  fetch(url(endpoints.trips.update(id)), { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(dto) });
const listNumbers = async () =>
  ((await (await fetch(url(`${endpoints.trips.list}?limit=200`))).json()) as { data: { items: { id: string }[] } }).data.items.map((t) => t.id);

describe('DELETE /trips/:id (mock)', () => {
  it('hard-deletes an ASSIGNED trip with 204 and drops it from GET /trips', async () => {
    const res = await del('trp_1006');
    expect(res.status).toBe(204);
    expect(findMockTrip('trp_1006')).toBeUndefined();
    expect(await listNumbers()).not.toContain('trp_1006');
  });

  it('deletes an unassigned load too', async () => {
    expect((await del('trp_2001')).status).toBe(204);
    expect(findMockTrip('trp_2001')).toBeUndefined();
  });

  it('refuses an IN_PROGRESS trip with 409 TRIP_IN_PROGRESS', async () => {
    const res = await del('trp_1001');
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe('TRIP_IN_PROGRESS');
    expect(findMockTrip('trp_1001')).toBeDefined();
  });

  it('answers 404 for an unknown or already-deleted trip', async () => {
    expect((await del('trp_nope')).status).toBe(404);
    await del('trp_1006');
    expect((await del('trp_1006')).status).toBe(404);
  });
});

describe('PATCH /trips/:id (mock)', () => {
  it('applies a field edit to a live trip', async () => {
    const res = await patch('trp_1006', { customer: 'Globex' });
    expect(res.status).toBe(200);
    expect(findMockTrip('trp_1006')?.customer).toBe('Globex');
  });

  it('refuses a field edit of a DELIVERED trip with 409 TRIP_NOT_EDITABLE', async () => {
    const res = await patch('trp_1004', { notes: 'late fee' });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe('TRIP_NOT_EDITABLE');
  });
});
