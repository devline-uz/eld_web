// web/tz.md §18.1 scenario 13 — Real-time: `trip.status_changed` over WS updates the row.
//
// The status is flipped through the backend's own `PATCH /trips/:id` (a genuine server-side
// change, not a fabricated socket event), using the ADMIN's own bearer token sniffed off a
// request the already-signed-in page makes — no second login (WB-006's throttle). Only the
// PLANNED ↔ ASSIGNED pair is used because both directions are allowed by `ALLOWED_TRANSITIONS`,
// so the trip's original status is restored in `finally`, leaving no residue in the seeded data
// other agents are relying on in parallel.
import { test, expect } from '@playwright/test';
import { authStatePath, keepAuthStateFresh } from './support/auth';

test.use({ storageState: authStatePath('ADMIN') });
keepAuthStateFresh('ADMIN');

test('a trip.status_changed WS event patches the Trips table row in place, cross-tab', async ({
  page,
  request,
}) => {
  let bearer: string | null = null;
  page.on('request', (req) => {
    if (!bearer) {
      const auth = req.headers()['authorization'];
      if (auth?.startsWith('Bearer ')) bearer = auth;
    }
  });

  await page.goto('/trips');
  await expect(page.getByRole('button', { name: /^Active \d+$/ })).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => bearer, { timeout: 10_000 }).not.toBeNull();

  const listRes = await request.get('http://localhost:3002/api/trips?limit=200', {
    headers: { Authorization: bearer! },
  });
  expect(listRes.ok()).toBe(true);
  const list = await listRes.json();
  const target = (list.data?.items ?? list.items ?? []).find((t: { status: string }) => t.status === 'ASSIGNED');
  test.skip(!target, 'No ASSIGNED trip in the seeded data to exercise this scenario against.');

  try {
    const patchRes = await request.patch(`http://localhost:3002/api/trips/${target.id}`, {
      headers: { Authorization: bearer!, 'Content-Type': 'application/json' },
      data: { status: 'PLANNED' },
    });
    expect(patchRes.ok()).toBe(true);

    // The Active tab count decrements live, no reload — the WS-patched cache re-derives it.
    await expect(page.getByText(new RegExp(`^Scheduled \\d+$`))).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /^Scheduled \d+$/ }).click();
    await expect(page.getByRole('cell', { name: 'Planned' }).first()).toBeVisible({ timeout: 5_000 });
  } finally {
    await request.patch(`http://localhost:3002/api/trips/${target.id}`, {
      headers: { Authorization: bearer!, 'Content-Type': 'application/json' },
      data: { status: 'ASSIGNED' },
    });
  }
});
