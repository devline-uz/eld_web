// Production CSP smoke — see deploy/verify-csp.sh. Zero CSP violations across sign-in, Dashboard
// and the Live Fleet map, and a thrown error reaches Sentry already scrubbed.
import { expect, test } from '@playwright/test';
import { DEMO_ACCOUNTS, signInAsDev } from '../tests/e2e/support/auth';

declare global {
  interface Window {
    __cspViolations?: string[];
  }
}

const EMAIL = DEMO_ACCOUNTS.FLEET_MANAGER.email;

// ⛔ GAP B-3 — GET /live/fleet does not exist on the API yet; without rows the map card shows its
// error state and MapLibre never starts. Two rows in the §20 shape make the map (and its blob:
// workers, tiles and glyphs) actually load under the policy.
const LIVE_FLEET = {
  generatedAt: new Date().toISOString(),
  items: [
    {
      vehicleId: 'veh_1',
      unitNumber: '#101',
      driverId: 'drv_1',
      driverName: 'John Smith',
      dutyStatus: 'DRIVING',
      speedMph: 58,
      headingDeg: 90,
      odometerMi: 993589,
      lat: 39.9612,
      lon: -82.9988,
      locationLabel: 'Columbus, OH',
      lastSeenAt: new Date().toISOString(),
      driveRemainingSec: 14400,
      shiftEndsAt: new Date(Date.now() + 6 * 3600e3).toISOString(),
      eldSerial: 'PT30_A86E',
      bleState: 'CONNECTED',
    },
    {
      vehicleId: 'veh_2',
      unitNumber: '#102',
      driverId: 'drv_2',
      driverName: 'Marcus Webb',
      dutyStatus: 'OFF_DUTY',
      speedMph: 0,
      headingDeg: 0,
      odometerMi: 741220,
      lat: 41.4993,
      lon: -81.6944,
      locationLabel: 'Cleveland, OH',
      lastSeenAt: new Date().toISOString(),
      driveRemainingSec: 39600,
      shiftEndsAt: new Date(Date.now() + 10 * 3600e3).toISOString(),
      eldSerial: 'PT30_11B2',
      bleState: 'CONNECTED',
    },
  ],
};

test('no CSP violation on sign-in, Dashboard and Live Fleet; Sentry receives scrubbed events', async ({
  page,
}) => {
  const consoleViolations: string[] = [];
  page.on('console', (m) => {
    if (/Content[- ]Security[- ]Policy|Refused to/i.test(m.text())) consoleViolations.push(m.text());
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      (window.__cspViolations ??= []).push(`${e.violatedDirective} ← ${e.blockedURI}`);
    });
  });

  const requested: string[] = [];
  page.on('request', (r) => requested.push(r.url()));
  const documentHeaders: Record<string, string>[] = [];
  page.on('response', (r) => {
    if (r.request().resourceType() === 'document') documentHeaders.push(r.headers());
  });

  const envelopes: string[] = [];
  await page.route(/\.ingest\.(?:us\.)?sentry\.io\//, async (route) => {
    envelopes.push(route.request().postData() ?? '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route(/eldapi\.stackyard\.uz\/api\/live\/fleet/, async (route) => {
    const real = await route.fetch();
    await route.fulfill({
      response: real,
      status: 200,
      json: { data: LIVE_FLEET, traceId: 'csp-verify', timestamp: new Date().toISOString() },
    });
  });

  // 1. Sign-in (real dev API) → Dashboard.
  await signInAsDev(page, 'FLEET_MANAGER');
  const headers = documentHeaders[0];
  expect(headers['content-security-policy']).toContain("script-src 'self' https://apis.google.com;");
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['content-security-policy']).toContain('worker-src');
  expect(headers['content-security-policy']).not.toContain("'unsafe-eval'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toContain('camera=()');
  await expect(page.getByRole('main')).toBeVisible();
  // Dashboard polls every 30 s, so `networkidle` is not a reliable signal — settle instead.
  await page.waitForTimeout(3_000);

  // 2. Live Fleet via SPA navigation (keeps the violation log of this document).
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Live Fleet' }).click();
  await page.waitForURL('**/live-fleet');
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 30_000 });
  // The style request may finish before a listener is attached; poll the log gathered since load.
  await expect
    .poll(() => requested.some((u) => u.includes('demotiles.maplibre.org')), { timeout: 30_000 })
    .toBe(true);
  await page.waitForTimeout(4_000);
  expect(page.workers().length, 'MapLibre blob: workers started').toBeGreaterThan(0);

  // 3. An uncaught error goes to Sentry (lazy chunk + ingest host allowed) and arrives scrubbed.
  await page.evaluate((email) => {
    setTimeout(() => {
      throw new Error(`csp probe for ${email} at 41.881832, -87.623177`);
    });
  }, EMAIL);
  await expect.poll(() => envelopes.find((e) => e.includes('csp probe')), { timeout: 15_000 }).toBeTruthy();
  const envelope = envelopes.find((e) => e.includes('csp probe')) ?? '';
  expect(envelope).toContain('csp probe for [email] at [coords]');
  expect(envelope).not.toContain(EMAIL);
  expect(envelope).not.toMatch(/eyJ[\w-]+\.[\w-]+\./);

  const domViolations = await page.evaluate(() => window.__cspViolations ?? []);
  expect([...domViolations, ...consoleViolations]).toEqual([]);
});
