/**
 * Generates src/shared/api/types.ts from backend/docs/openapi.json.
 *
 * The backend document is produced by @nestjs/swagger without DTO decorators, so it carries no
 * `components.schemas` — every operation documents its success payload as a JSON `example`.
 * We therefore infer the TypeScript shape structurally from those examples. Re-run with
 * `node scripts/generate-api-types.mjs` whenever the backend regenerates its OpenAPI document.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

const SPEC = fileURLToPath(new URL('../../backend/docs/openapi.json', import.meta.url));
const OUT = fileURLToPath(new URL('../src/shared/api/types.ts', import.meta.url));

const spec = JSON.parse(readFileSync(SPEC, 'utf8'));
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const PAGE_KEYS = ['items', 'page', 'limit', 'total', 'totalPages'];

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const ident = (k) => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k));

function inferType(value, indent) {
  if (value === null) return 'unknown';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'unknown[]';
    const inner = inferType(value[0], indent);
    return inner.includes('\n') || inner.includes('|') ? `Array<${inner}>` : `${inner}[]`;
  }
  switch (typeof value) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return inferObject(value, indent);
  }
}

function inferObject(obj, indent) {
  const keys = Object.keys(obj);
  if (keys.length === 0) return 'Record<string, unknown>';
  const pad = ' '.repeat(indent + 2);
  const body = keys
    .map((k) => `${pad}${ident(k)}: ${inferType(obj[k], indent + 2)};`)
    .join('\n');
  return `{\n${body}\n${' '.repeat(indent)}}`;
}

function typeName(operationId) {
  return operationId
    .split(/Controller_|_/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

const blocks = [];
const index = [];
const seen = new Set();

for (const [path, ops] of Object.entries(spec.paths)) {
  for (const method of METHODS) {
    const op = ops[method];
    if (!op) continue;
    const success = Object.keys(op.responses ?? {}).find((s) => s.startsWith('2'));
    if (!success) continue;
    const example = op.responses[success]?.content?.['application/json']?.schema?.example;
    if (example === undefined) continue;

    let name = typeName(op.operationId ?? `${method}${path}`);
    while (seen.has(name)) name += 'Alt';
    seen.add(name);

    const ref = `${method.toUpperCase()} ${path}`;
    if (isPlain(example) && PAGE_KEYS.every((k) => k in example) && Array.isArray(example.items)) {
      const item = example.items[0];
      const itemName = `${name}Item`;
      blocks.push(
        `/** ${ref} — list item */\nexport type ${itemName} = ${inferType(item ?? null, 0)};`,
      );
      blocks.push(`/** ${ref} */\nexport type ${name}Response = OffsetPage<${itemName}>;`);
    } else {
      blocks.push(`/** ${ref} */\nexport type ${name}Response = ${inferType(example, 0)};`);
    }
    index.push(`  '${ref}': ${name}Response;`);
  }
}

const header = `// GENERATED FILE — do not edit by hand.
// Source: backend/docs/openapi.json (${Object.keys(spec.paths).length} paths, ${index.length} typed operations).
// Regenerate: npm run gen:types   (scripts/generate-api-types.mjs)
//
// The backend documents payloads as OpenAPI examples, so these shapes are inferred structurally.
// The contract suite (tests/contract) is what proves a live response still matches the document.

/** Success envelope produced by the backend TransformInterceptor (web/tz.md §6.1). */
export interface ApiEnvelope<T> {
  data: T;
  traceId: string;
  timestamp: string;
}

/** Error envelope produced by AllExceptionsFilter (web/tz.md §6.1). */
export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  traceId: string;
  timestamp: string;
}

/** Offset pagination envelope — \`?page&limit&sort=field:asc|desc&q=\`, limit max 200. */
export interface OffsetPage<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Query parameters accepted by every list endpoint (ListQueryDto). */
export interface ListQuery {
  page?: number;
  limit?: number;
  sort?: string;
  q?: string;
  [key: string]: unknown;
}
`;

const footer = `\n/** Operation → success payload, keyed by \`METHOD /api/path\`. */\nexport interface ApiOperations {\n${index.join('\n')}\n}\n`;

writeFileSync(OUT, `${header}\n${blocks.join('\n\n')}\n${footer}`);
console.log(`types.ts: ${index.length} operations`);
