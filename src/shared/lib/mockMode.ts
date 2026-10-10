// Shared resolver for the per-screen demo-data switches (`VITE_DVIR_MOCK`, `VITE_SAFETY_MOCK`,
// `VITE_IFTA_MOCK`).
//   (unset)    on as a fallback in `vite dev`, off in production builds
//   `fallback` on as a fallback in any build (also `true` / `1`)
//   `always`   ignore the API and always show the demo rows
//   `off`      never show demo rows (also `false` / `0`)
// Vitest (`MODE === 'test'`) is always `off`.
export type MockMode = 'off' | 'fallback' | 'always';

/** Pass the raw env value (`import.meta.env.VITE_…_MOCK`) — read statically so Vite can inline it. */
export function resolveMockMode(value: unknown): MockMode {
  if (import.meta.env.MODE === 'test') return 'off';
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'off' || raw === 'false' || raw === '0') return 'off';
  if (raw === 'always') return 'always';
  if (raw === 'fallback' || raw === 'true' || raw === '1') return 'fallback';
  return import.meta.env.DEV ? 'fallback' : 'off';
}
