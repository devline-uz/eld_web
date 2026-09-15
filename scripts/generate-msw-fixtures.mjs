/**
 * Generates src/mocks/fixtures.generated.ts from backend/docs/openapi.json.
 *
 * Every MSW handler answers with the payload the backend documents for that operation, so a
 * handler can never drift from the contract by hand-editing. Re-run with `npm run gen:fixtures`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

const SPEC = fileURLToPath(new URL('../../backend/docs/openapi.json', import.meta.url));
const OUT = fileURLToPath(new URL('../src/mocks/fixtures.generated.ts', import.meta.url));

const spec = JSON.parse(readFileSync(SPEC, 'utf8'));
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

const entries = [];
for (const [path, ops] of Object.entries(spec.paths)) {
  for (const method of METHODS) {
    const op = ops[method];
    if (!op) continue;
    const status = Object.keys(op.responses ?? {}).find((s) => s.startsWith('2'));
    if (!status) continue;
    const example = op.responses[status]?.content?.['application/json']?.schema?.example;
    if (example === undefined) continue;
    entries.push(
      `  '${method.toUpperCase()} ${path}': ${JSON.stringify(example, null, 2)
        .split('\n')
        .join('\n  ')},`,
    );
  }
}

const out = `// GENERATED FILE — do not edit by hand.
// Source: backend/docs/openapi.json — the documented success payload of every operation.
// Regenerate: npm run gen:fixtures   (scripts/generate-msw-fixtures.mjs)

export const OPENAPI_EXAMPLES: Record<string, unknown> = {
${entries.join('\n')}
};

/** \`fixture('GET /api/vehicles')\` — the payload the backend documents for that operation. */
export function fixture<T = unknown>(operation: string): T {
  const example = OPENAPI_EXAMPLES[operation];
  if (example === undefined) {
    throw new Error(\`No documented example for \${operation} in backend/docs/openapi.json\`);
  }
  return structuredClone(example) as T;
}
`;

writeFileSync(OUT, out);
console.log(`fixtures.generated.ts: ${entries.length} operations`);
