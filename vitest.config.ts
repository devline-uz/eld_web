import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// owner: web-qa-a11y — coverage gates (§15.1) and MSW wiring land here.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    // jsdom with Node's native AbortController/AbortSignal (web/bugs.md WB-048, client.ts rule 9).
    environment: './tests/setup/jsdom-native-abort.ts',
    globals: true,
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'tests/{rbac,fixtures}/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: ['**/node_modules/**', 'tests/contract/**', 'tests/e2e/**'],
    // This box runs several agents' suites at once and ICU timezone data is loaded lazily on
    // the first date-fns-tz call in a worker, so a timezone-heavy file can exceed the 5 s
    // default under load. A timed-out file stops executing and its module drops out of the
    // coverage map, which reads as "shared/format is at 86.94%" when nothing is untested
    // (web/decisions.md WD-012). 20 s is still short enough to catch a real hang.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // web/tz.md §18: shared/format and shared/auth/permissions are 100%, everything else
    // >= 80%. `all: false` (the default we keep explicit): only files reached by at least
    // one test are measured. This is deliberate for Phase 1b (web/decisions.md WD-00x) —
    // most `features/*` are still web-architect's placeholder stubs with zero behaviour to
    // test; turning on `all: true` today would fail the aggregate on files no feature agent
    // has started yet, which is not this gate's job. Per-glob thresholds still do exactly
    // what's asked: `shared/format` and `permissions.ts` are absent from the map (and so
    // cannot fail) until their owning agent adds a test file, and from the moment either
    // file is exercised below 100% the run fails — verified in this phase by touching
    // `src/shared/format/index.ts` from a throwaway spec (see tests/README.md).
    coverage: {
      provider: 'v8',
      all: false,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/**/*.d.ts',
        // Generated from backend/docs/openapi.json — regenerate, never hand-test.
        'src/shared/api/types.ts',
        'src/mocks/**',
        // A URL table with no logic; proved against openapi.json by tests/contract.
        'src/shared/api/endpoints.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
        'src/shared/format/**': { statements: 100, branches: 100, functions: 100, lines: 100 },
        // §17 — the Sentry PII scrubber and its wiring (web/decisions.md WD-057).
        'src/shared/observability/**': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/shared/auth/permissions.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
});
