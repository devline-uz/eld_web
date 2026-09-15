// The contract harness (web/tz.md §18): every endpoint the app calls is validated against
// backend/docs/openapi.json. If the backend schema changes, these tests must fail — that is
// their job. Never loosen a matcher to make one pass; fix the client or record a gap.
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

interface OpenApiDoc {
  paths: Record<string, Record<string, OpenApiOperation>>;
}
interface OpenApiOperation {
  operationId?: string;
  responses?: Record<
    string,
    { content?: { 'application/json'?: { schema?: { example?: unknown } } } }
  >;
}

const SPEC_PATH = fileURLToPath(new URL('../../../backend/docs/openapi.json', import.meta.url));
export const openapi: OpenApiDoc = JSON.parse(readFileSync(SPEC_PATH, 'utf8'));

/** `GET /api/vehicles` → the operation object, or null when the backend does not have it. */
export function operation(method: string, path: string): OpenApiOperation | null {
  return openapi.paths[path]?.[method.toLowerCase()] ?? null;
}

/** The success payload the backend documents — the single source of truth for a mock. */
export function documentedExample(method: string, path: string): unknown {
  const op = operation(method, path);
  if (!op) throw new Error(`${method} ${path} is not in backend/docs/openapi.json`);
  const status = Object.keys(op.responses ?? {}).find((s) => s.startsWith('2'));
  const example = status
    ? op.responses?.[status]?.content?.['application/json']?.schema?.example
    : undefined;
  if (example === undefined) throw new Error(`${method} ${path} documents no success example`);
  return example;
}

type Shape = 'null' | 'array' | 'object' | 'string' | 'number' | 'boolean' | 'undefined';

const shapeOf = (value: unknown): Shape => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value as Shape;
};

/**
 * Structural comparison against the documented example.
 *
 * The backend document carries examples rather than `components.schemas`, so the contract is
 * "every documented key is present with the documented JSON type". Extra keys are allowed (the
 * backend may add fields); a missing or retyped key is a failure. A documented `null` accepts any
 * value, since the example cannot express the nullable type.
 */
export function diffAgainstExample(example: unknown, actual: unknown, path = '$'): string[] {
  const problems: string[] = [];
  const expected = shapeOf(example);
  if (expected === 'null') return problems;

  const got = shapeOf(actual);
  if (expected !== got) {
    problems.push(`${path}: expected ${expected}, got ${got}`);
    return problems;
  }

  if (expected === 'array') {
    const [first] = example as unknown[];
    if (first === undefined) return problems;
    for (const [i, item] of (actual as unknown[]).entries()) {
      problems.push(...diffAgainstExample(first, item, `${path}[${i}]`));
    }
    return problems;
  }

  if (expected === 'object') {
    for (const [key, value] of Object.entries(example as Record<string, unknown>)) {
      const actualValue = (actual as Record<string, unknown>)[key];
      if (actualValue === undefined) {
        problems.push(`${path}.${key}: missing (documented as ${shapeOf(value)})`);
        continue;
      }
      problems.push(...diffAgainstExample(value, actualValue, `${path}.${key}`));
    }
  }

  return problems;
}

/** Throws with every mismatch listed, so a drifted schema is readable in one run. */
export function assertMatchesOpenApi(method: string, path: string, actual: unknown): void {
  const problems = diffAgainstExample(documentedExample(method, path), actual);
  if (problems.length > 0) {
    throw new Error(
      `${method} ${path} does not match backend/docs/openapi.json:\n  ${problems.join('\n  ')}`,
    );
  }
}
