// Run through deploy/verify-csp.sh, which builds dist and starts the private nginx first.
import { defineConfig, devices } from '@playwright/test';

const port = process.env.CSP_PORT ?? '18443';

export default defineConfig({
  testDir: '.',
  testMatch: 'csp.spec.ts',
  reporter: [['list']],
  retries: 0,
  workers: 1,
  timeout: 90_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'https://eldadmin.stackyard.uz',
    viewport: { width: 1280, height: 800 },
    // The private nginx uses a throw-away self-signed certificate.
    ignoreHTTPSErrors: true,
    launchOptions: {
      args: [`--host-resolver-rules=MAP eldadmin.stackyard.uz 127.0.0.1:${port}`],
    },
  },
});
