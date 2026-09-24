// Contract: every path in endpoints.ts exists in backend/docs/openapi.json, except the gaps
// recorded in web/backend-gaps.md. A new invented URL fails here immediately.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { openapi } from './openapi';

/** Recorded in web/backend-gaps.md. Every former gap (B-4, B-5, B-7, B-8, B-9, B-10, B-11, B-56 and
 * the telemetry read path) shipped in backend Phase 13 (2026-09-24) and was removed; a new entry
 * needs a B-NN id in backend-gaps.md. */
const KNOWN_GAPS = new Set<string>([]);

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
