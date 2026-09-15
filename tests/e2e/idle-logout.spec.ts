// owner: web-auth-rbac — web/tz.md §17: 30 minutes idle → warning modal with a 60 s timer →
// full sign-out (tokens cleared, `POST /auth/logout`, back to /sign-in).
//
// Playwright's fake clock drives the timers, and every `/api/*` call is stubbed in the browser
// (web/decisions.md WD-052): the behaviour under test is purely client-side, and the live API
// throttles logins (5/60 s) and rotates refresh tokens, which would make a 31-minute fast-forward
// flaky and would burn scenario 1's stored sessions. Vite's own modules live under `/src/…`, so
// matching on a pathname that *starts* with `/api/` never touches the app bundle.
import { expect, test, type Page, type Request } from '@playwright/test';

const IDLE_MS = 30 * 60_000;
const WARNING_MS = 60_000;
const RT_KEY = 'obk.rt';

const envelope = (data: unknown) => ({
  data,
  traceId: 'e2e-idle',
  timestamp: new Date().toISOString(),
});

/** A syntactically valid JWT whose `exp` is a day away, so no proactive refresh interferes. */
function fakeJwt(): string {
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 24 * 3600;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'usr_fm', exp })}.signature`;
}

const PERMISSIONS = Object.fromEntries(
  [
    'dashboard', 'liveFleet', 'vehicles', 'drivers', 'hos', 'hosEdit', 'dvir', 'maintenance',
    'safety', 'trips', 'reports', 'reportsTransfer', 'messaging', 'devices', 'alertRules', 'support',
  ].map((key) => [key, 'FULL']),
);

/** Every stubbed call in the running test, attached to the report when a test fails. */
let seen: string[] = [];

async function stubApi(page: Page): Promise<Request[]> {
  const logouts: Request[] = [];
  // The realtime socket would carry the fake token to the real API on :3002, whose rejection
  // (`io server disconnect`) is a legitimate sign-out path in RealtimeProvider. Keep it offline:
  // the WebSocket closes with no server behind it and the polling fallback is aborted, which the
  // provider treats as a plain connection failure and keeps retrying.
  await page.routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.route(
    (url) => url.pathname.startsWith('/socket.io/'),
    (route) => route.abort('connectionrefused'),
  );
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace(/^\/api/, '');
      seen.push(`${request.method()} ${path}`);
      // The API is cross-origin (5173 → 3002): a fulfilled response still needs CORS headers,
      // and the preflight for `Authorization`/`X-Client-Version` must be answered too.
      const cors = {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const json = (status: number, body: unknown) =>
        route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });

      if (path === '/auth/refresh') {
        return json(200, envelope({ accessToken: fakeJwt(), refreshToken: 'rt-rotated', tokenType: 'Bearer' }));
      }
      if (path === '/auth/me') {
        return json(200, envelope({
          id: 'usr_fm', type: 'user', role: 'FLEET_MANAGER', permissions: PERMISSIONS,
        }));
      }
      if (path === '/auth/logout') {
        logouts.push(request);
        return json(200, envelope({ success: true }));
      }
      if (path === '/me/profile') {
        return json(200, envelope({
          id: 'usr_fm', email: 'mike.torres@universal-logistics.example', firstName: 'Mike', lastName: 'Torres',
          jobTitle: 'Fleet Manager', phone: null, authProvider: 'PASSWORD', googleUid: null,
          role: { key: 'FLEET_MANAGER', name: 'Fleet Manager' },
        }));
      }
      if (path === '/me/sessions') return json(200, envelope([]));
      return json(404, { statusCode: 404, code: 'NOT_FOUND', message: 'Stubbed in idle E2E.', traceId: 'e2e-idle' });
    },
  );
  return logouts;
}

/** Signed in as FLEET_MANAGER on /account, with the page clock under test control. */
async function openSignedIn(page: Page): Promise<Request[]> {
  const logouts = await stubApi(page);
  await page.clock.install();
  await page.goto('/account');
  // Cold Vite transforms on a loaded dev box: boot (`refresh → /auth/me`) was measured at ~9 s.
  await expect(page.getByRole('region', { name: 'Profile' })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByLabel(/First name/)).toHaveValue('Mike', { timeout: 30_000 });
  // `clock.install()` lets real time flow into page time, so the seconds spent booting leak into
  // the 30-minute boundary (measured: the warning opened at 29:57). Freeze page time, then re-arm
  // the idle timer from that exact instant with one key press.
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1_000);
  await page.keyboard.press('Shift');
  return logouts;
}

const warning = (page: Page) => page.getByRole('dialog', { name: 'Still there?' });

/** The app's own origin — the refresh token is seeded into its storage before the first load. */
const ORIGIN = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:5173').origin;

test.describe('30-minute idle logout (§17)', () => {
  test.describe.configure({ timeout: 180_000 });
  test.use({
    storageState: {
      cookies: [],
      origins: [{ origin: ORIGIN, localStorage: [{ name: RT_KEY, value: 'rt-seeded' }] }],
    },
  });

  test.beforeEach(() => {
    seen = [];
  });

  // eslint-disable-next-line no-empty-pattern -- Playwright only accepts an object pattern for fixtures
  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await testInfo.attach('stubbed-api-calls', { body: seen.join('\n'), contentType: 'text/plain' });
    }
  });

  test('warns after 30 minutes, then signs out 60 seconds later', async ({ page }) => {
    const logouts = await openSignedIn(page);

    await page.clock.runFor(IDLE_MS - 1_000);
    await expect(warning(page)).toHaveCount(0);

    await page.clock.runFor(2_000);
    await expect(warning(page)).toBeVisible();
    await expect(warning(page)).toContainText('You have been inactive for 30 minutes.');
    await expect(warning(page)).toContainText(/signed out in \d+ seconds/);

    await page.clock.runFor(WARNING_MS);
    await expect(page).toHaveURL(/\/sign-in/);
    // The page clock is still paused from `openSignedIn`; W-00 needs real time to finish loading.
    await page.clock.resume();
    await expect(page.getByText('You were signed out after 30 minutes of inactivity.')).toBeVisible({
      timeout: 60_000,
    });
    expect(await page.evaluate((key) => localStorage.getItem(key), RT_KEY)).toBeNull();
    expect(logouts).toHaveLength(1);
    expect(logouts[0]!.postDataJSON()).toEqual({ refreshToken: 'rt-rotated' });
  });

  test('activity before the 30 minutes are up re-arms the clock', async ({ page }) => {
    await openSignedIn(page);

    await page.clock.runFor(IDLE_MS - 60_000);
    await page.keyboard.press('Shift');
    await page.clock.runFor(IDLE_MS - 60_000);
    await expect(warning(page)).toHaveCount(0);

    // 70 s lands inside the 60 s countdown that starts at 29 min after the key press.
    await page.clock.runFor(70_000);
    await expect(warning(page)).toBeVisible();
  });

  test('`Stay signed in` keeps the session past the 60-second countdown', async ({ page }) => {
    const logouts = await openSignedIn(page);

    await page.clock.runFor(IDLE_MS + 1_000);
    await warning(page).getByRole('button', { name: 'Stay signed in' }).click();
    await expect(warning(page)).toHaveCount(0);

    await page.clock.runFor(WARNING_MS + 5_000);
    await expect(page).toHaveURL(/\/account/);
    expect(await page.evaluate((key) => localStorage.getItem(key), RT_KEY)).not.toBeNull();
    expect(logouts).toHaveLength(0);

    // WB-036 — dismissing the warning arms a fresh 30 minutes, it does not switch the timer off.
    await page.clock.runFor(IDLE_MS - WARNING_MS);
    await expect(warning(page)).toBeVisible();
  });

  test('`Sign out` in the warning ends the session immediately', async ({ page }) => {
    const logouts = await openSignedIn(page);

    await page.clock.runFor(IDLE_MS + 1_000);
    await warning(page).getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    expect(logouts).toHaveLength(1);
  });
});
