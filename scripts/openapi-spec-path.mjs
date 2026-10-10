/**
 * The one place that knows where the backend OpenAPI spec lives. Used by tests/contract,
 * scripts/generate-api-types.mjs and scripts/generate-msw-fixtures.mjs.
 *
 * Order: $OPENAPI_SPEC_PATH (absolute, or relative to the cwd) → ../eld_backend/docs/openapi.json
 * (this monorepo checkout) → ../backend/docs/openapi.json (a checkout that names the folder
 * `backend`). Throws, naming every path tried, when none exists — never a silent skip.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

export const OPENAPI_SPEC_ENV = 'OPENAPI_SPEC_PATH';

const SIBLING_CANDIDATES = ['../../eld_backend/docs/openapi.json', '../../backend/docs/openapi.json'];

/** @returns {string} absolute path of the backend openapi.json */
export function resolveOpenApiSpecPath() {
  const override = process.env[OPENAPI_SPEC_ENV];
  if (override) {
    const path = resolve(process.cwd(), override);
    if (existsSync(path)) return path;
    throw new Error(`${OPENAPI_SPEC_ENV}=${override} points at ${path}, which does not exist.`);
  }
  const tried = SIBLING_CANDIDATES.map((rel) => fileURLToPath(new URL(rel, import.meta.url)));
  const found = tried.find((path) => existsSync(path));
  if (found) return found;
  throw new Error(
    `Backend openapi.json not found. Tried:\n  ${tried.join('\n  ')}\n` +
      `Check out the backend beside eld_web, or set ${OPENAPI_SPEC_ENV}=/path/to/openapi.json.`,
  );
}
