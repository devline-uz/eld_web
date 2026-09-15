// owner: web-design-system — Phase 10 visual pass (web/tz.md §18). Captures every screen this
// role can reach at 1280×800 into tests/visual/screenshots/<role>/<slug>.png for hand comparison
// against `web/roles and screens/**` and, for FLEET_MANAGER, as Playwright `toHaveScreenshot`
// baselines. Not one of the 16 mandatory E2E scenarios — run separately, single worker
// (flock /tmp/eld-web-e2e.lock), never in the same run as the RBAC/axe specs it shares fixtures
// with.
import { test, expect, type Page } from '@playwright/test';
import { authStatePath, keepAuthStateFresh, type DemoRole } from '../e2e/support/auth';

interface ScreenDef {
  slug: string;
  path: string;
  /** Roles that CANNOT reach this screen even though the permission map says READ/FULL. */
  exclude?: DemoRole[];
  /** true = follow the first row link from the previous list screen instead of a fixed path. */
  viaFirstRow?: 'vehicles' | 'drivers';
}

// Order matches the 26 admin-panel design files (web/tz.md §9 route table).
const SCREENS: ScreenDef[] = [
  { slug: '01-dashboard', path: '/' },
  { slug: '02-live-fleet', path: '/live-fleet' },
  { slug: '03-vehicles', path: '/vehicles' },
  { slug: '04-vehicle-profile', path: '/vehicles', viaFirstRow: 'vehicles' },
  { slug: '06-drivers', path: '/drivers' },
  { slug: '07-driver-profile', path: '/drivers', viaFirstRow: 'drivers' },
  { slug: '08-trips', path: '/trips', exclude: ['VIEWER'] },
  { slug: '09-hos-logs', path: '/hos-logs' },
  { slug: '10-dvir', path: '/dvir', exclude: ['DISPATCHER'] },
  { slug: '11-safety', path: '/safety', exclude: ['DISPATCHER'] },
  { slug: '12-reports-ifta', path: '/reports/ifta', exclude: ['DISPATCHER'] },
  { slug: '13-reports-activity', path: '/reports/activity' },
  { slug: '14-reports-dvir', path: '/reports/dvir', exclude: ['DISPATCHER'] },
  { slug: '15-reports-fmcsa', path: '/reports/fmcsa', exclude: ['DISPATCHER', 'VIEWER'] },
  { slug: '16-messages', path: '/messages', exclude: ['VIEWER'] },
  { slug: '17-settings-company', path: '/settings/company', exclude: ['FLEET_MANAGER', 'DISPATCHER', 'VIEWER'] },
  { slug: '18-settings-users', path: '/settings/users', exclude: ['FLEET_MANAGER', 'DISPATCHER', 'VIEWER'] },
  { slug: '19-settings-roles', path: '/settings/roles', exclude: ['FLEET_MANAGER', 'DISPATCHER', 'VIEWER'] },
  { slug: '20-settings-devices', path: '/settings/devices', exclude: ['DISPATCHER', 'VIEWER'] },
  { slug: '21-settings-alerts', path: '/settings/alerts', exclude: ['DISPATCHER', 'VIEWER'] },
  { slug: '22-settings-integrations', path: '/settings/integrations', exclude: ['FLEET_MANAGER', 'DISPATCHER', 'VIEWER'] },
  { slug: '23-settings-audit', path: '/settings/audit', exclude: ['FLEET_MANAGER', 'DISPATCHER', 'VIEWER'] },
  { slug: '24-settings-support', path: '/settings/support' },
  { slug: '25-settings-feedback', path: '/settings/support/feedback' },
  { slug: '26-account', path: '/account' },
];

const ROLES: DemoRole[] = ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER', 'VIEWER'];

async function goAndSettle(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(300);
}

for (const role of ROLES) {
  test.describe(`visual capture — ${role}`, () => {
    test.use({ storageState: authStatePath(role), viewport: { width: 1280, height: 800 } });
    keepAuthStateFresh(role);

    for (const screen of SCREENS) {
      if (screen.exclude?.includes(role)) continue;
      test(`${screen.slug}`, async ({ page }) => {
        if (screen.viaFirstRow) {
          await goAndSettle(page, screen.path);
          const row = page.locator('table tbody tr').first();
          if ((await row.count()) === 0) {
            test.skip(true, 'no rows to drill into');
            return;
          }
          // DataTable rows navigate via an onClick handler, not an <a> (shared/ui/DataTable.tsx)
          const before = page.url();
          await row.click();
          await page.waitForURL((u) => u.toString() !== before, { timeout: 10_000 }).catch(() => {});
          await page.waitForLoadState('networkidle').catch(() => {});
          await page.waitForTimeout(300);
        } else {
          await goAndSettle(page, screen.path);
        }
        await page.mouse.move(0, 0);
        await expect(page.locator('body')).toBeVisible();
        await page.screenshot({
          path: `tests/visual/screenshots/${role}/${screen.slug}.png`,
          fullPage: false,
        });
      });
    }
  });
}
