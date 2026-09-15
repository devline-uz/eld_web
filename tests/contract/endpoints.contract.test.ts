// Contract: every path in endpoints.ts exists in backend/docs/openapi.json, except the gaps
// recorded in web/backend-gaps.md. A new invented URL fails here immediately.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { openapi } from './openapi';

/** Recorded in web/backend-gaps.md — still-missing B-NN ids plus the vehicle telemetry read path.
 * B-1, B-2, B-3, B-6 and B-46 (IFTA summary) shipped 2026-09-14 and are no longer listed. */
const KNOWN_GAPS = new Set([
  '/api/vehicles/{}/histories',
  '/api/vehicles/{}/activities',
  '/api/vehicles/{}/telemetry',
  '/api/co-driver-pairings',
  '/api/devices/{}/diagnostics',
  '/api/alert-rules/{}/test',
  '/api/search',
  '/api/notifications/{}/read',
  '/api/me/preferences',
]);

const SOURCE = readFileSync(
  fileURLToPath(new URL('../../src/shared/api/endpoints.ts', import.meta.url)),
  'utf8',
);

const normalise = (path: string) => path.replace(/\$\{[^}]+\}/g, '{}');

/** Every path literal and template in endpoints.ts, ignoring the header comment block. */
function endpointPaths(): string[] {
  const body = SOURCE.slice(SOURCE.indexOf('export const endpoints'));
  const found = new Set<string>();
  for (const match of body.matchAll(/['`](\/[^'`]*)['`]/g)) {
    found.add(`/api${normalise(match[1]!)}`);
  }
  return [...found];
}

const documented = new Set(Object.keys(openapi.paths).map((p) => p.replace(/\{[^}]+\}/g, '{}')));

describe('endpoints.ts ↔ openapi.json', () => {
  it('exports at least one path per resource the panel uses', () => {
    expect(endpointPaths().length).toBeGreaterThan(100);
  });

  it('every path either exists on the backend or is a recorded gap', () => {
    const unknown = endpointPaths().filter((p) => !documented.has(p) && !KNOWN_GAPS.has(p));
    expect(unknown).toEqual([]);
  });

  it('every recorded gap is really missing — remove it from the list once it ships', () => {
    const shipped = [...KNOWN_GAPS].filter((p) => documented.has(p));
    expect(shipped).toEqual([]);
  });

  it('never hardcodes a version segment: the prefix comes from VITE_API_BASE_URL', () => {
    expect(SOURCE).not.toMatch(/['`]\/v\d/);
    expect(endpointPaths().every((p) => !p.startsWith('/api/v1'))).toBe(true);
  });
});
