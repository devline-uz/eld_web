// The one switch for the screen-level demo-data fallbacks (DVIR & Maintenance, Safety, IFTA):
// `VITE_DEMO_FALLBACK` in `eld_web/.env`.
//   (unset)    `vite dev` → fallback (demo rows only while the API answers an empty list); vitest → off
//   `fallback` demo rows while the API answers an EMPTY list (also `true` / `1`). A failed or
//              forbidden (403) request shows the real ErrorState — never masked (CODE-086).
//   `always`   ignore the API and always show the demo rows
//   `off`      never show demo rows (also `false` / `0`)
// PRODUCTION BUILDS ARE ALWAYS `off`, whatever the env says: `import.meta.env.PROD` is inlined as
// `true` by `vite build`, so `DEMO_FALLBACK_MODE` folds to the literal `'off'`, every
// `DEMO_FALLBACK_ENABLED ? demo : real` branch collapses to the real hook, and the demo-data
// modules are tree-shaken out of the bundle. With the switch off a screen shows its own
// ErrorState (+ Retry) on a failed request and its EmptyState on an empty answer.
export type MockMode = 'off' | 'fallback' | 'always';

interface BuildEnv {
  PROD: boolean;
  DEV: boolean;
  MODE: string;
}

/** Pure resolver — exported for unit tests; the app reads `DEMO_FALLBACK_MODE`. */
export function resolveMockMode(value: unknown, env: BuildEnv = import.meta.env): MockMode {
  if (env.PROD) return 'off';
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'off' || raw === 'false' || raw === '0') return 'off';
  if (raw === 'always') return 'always';
  if (raw === 'fallback' || raw === 'true' || raw === '1') return 'fallback';
  // Unset: on in `vite dev`, off under vitest so page tests see their real empty/error states.
  return env.DEV && env.MODE !== 'test' ? 'fallback' : 'off';
}

// The `import.meta.env.PROD ?` guard must stay inline (not only inside `resolveMockMode`) so the
// production build can constant-fold it and drop the demo modules.
export const DEMO_FALLBACK_MODE: MockMode = import.meta.env.PROD
  ? 'off'
  : resolveMockMode(import.meta.env.VITE_DEMO_FALLBACK);

/** `false` in every production build (a compile-time constant there). */
export const DEMO_FALLBACK_ENABLED: boolean = DEMO_FALLBACK_MODE !== 'off';

/**
 * CODE-086 — one rule for every demo-fallback screen: `always` shows demo rows, `fallback`
 * only once the real request has SUCCEEDED with no rows. An error (incl. 401/403) is never
 * hidden behind demo data — the screen shows its own ErrorState / ForbiddenState.
 */
export function shouldUseDemoRows(
  real: { isLoading: boolean; isError: boolean },
  realCount: number,
  mode: MockMode = DEMO_FALLBACK_MODE,
): boolean {
  if (mode === 'off') return false;
  if (mode === 'always') return true;
  if (real.isLoading || real.isError) return false;
  return realCount === 0;
}
