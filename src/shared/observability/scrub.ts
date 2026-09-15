// owner: web-architect — Sentry PII / secret scrubber (web/tz.md §17, web/decisions.md WD-057).
//
// Pure functions, no SDK import: `sentry.ts` wires them into `beforeSend` / `beforeBreadcrumb`.
// Two layers, both applied to every string and every object key anywhere in an event:
//   1. key-based  — a value under a sensitive key (`accessToken`, `cdlNumber`, `lat`, `cookie`…)
//                   is replaced whole, whatever its type;
//   2. value-based — free text (messages, URLs, stack frames, console args) is pattern-scrubbed
//                   for JWTs, bearer credentials, query-string secrets, presigned URLs, emails,
//                   phone numbers, VINs, CDL numbers and coordinate pairs.
// Over-scrubbing is acceptable; leaking a driver's licence number or position is not.

export const FILTERED = '[Filtered]';
const MAX_DEPTH = 12;

/** Whole words inside a key (camelCase / snake_case / kebab-case split) that mark it sensitive. */
const SENSITIVE_WORDS = new Set([
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'jwt',
  'bearer',
  'authorization',
  'cookie',
  'cookies',
  'session',
  'apikey',
  'signature',
  'sig',
  'credential',
  'credentials',
  'pin',
  'email',
  'phone',
  'mobile',
  'license',
  'licence',
  'cdl',
  'vin',
  'lat',
  'lng',
  'lon',
  'latitude',
  'longitude',
  'coords',
  'coordinates',
  'gps',
  'location',
  'position',
  'dsn',
]);
/** Sensitive only as adjacent word pairs (`x-api-key`, `secretKey`, `AWSAccessKeyId`). */
const SENSITIVE_JOINED = ['apikey', 'accesskey', 'secretkey', 'privatekey', 'idtoken'];
/** Query-string names that carry a secret even though the word alone is too generic as a key. */
const SENSITIVE_QUERY_NAMES = new Set(['key', 'code', 'state', 'oobcode', 'access_token', 'id_token']);

/** Auth endpoints (backend `/auth/*`, Firebase identity) — request bodies are dropped whole. */
const AUTH_URL_RE = /(?:\/auth(?:\/|\?|#|$))|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com/i;
/** S3 / MinIO presigned URL — §17 says it is never logged, so its whole query goes. */
const PRESIGNED_RE = /[?&]X-Amz-(?:Signature|Credential|Security-Token)=/i;

const words = (key: string): string[] =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

export function isSensitiveKey(key: string): boolean {
  const parts = words(key);
  if (parts.some((w) => SENSITIVE_WORDS.has(w))) return true;
  const joined = parts.join('');
  return SENSITIVE_JOINED.some((j) => joined.includes(j));
}

export function isAuthUrl(url: unknown): boolean {
  return typeof url === 'string' && AUTH_URL_RE.test(url);
}

const JWT_RE = /\beyJ[\w-]+\.[\w-]+\.[\w-]*/g;
// Scheme words only as written in headers, and a credential-length value — "token was" is prose.
const AUTH_SCHEME_RE = /\b(Bearer|bearer|Basic)\s+[\w\-.~+/]{6,}=*/g;
const PRESIGNED_QUERY_RE = /\?[^\s#"']*X-Amz-(?:Signature|Credential|Security-Token)=[^\s#"']*/gi;
const QUERY_PARAM_RE = /(^|[?&#;])([^=&#?;\s"']+)=([^&#;\s"']*)/g;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
const COORD_PAIR_RE = /-?\d{1,3}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}/g;
const PHONE_E164_RE = /\+\d{10,15}\b/g;
const PHONE_US_RE = /(?<![\w.])(?:\+?1[\s.-])?(?:\(\d{3}\)\s?|\d{3}[\s.-])\d{3}[\s.-]\d{4}(?![\w.])/g;
const VIN_RE = /\b(?=[A-HJ-NPR-Z0-9]{17}\b)(?=[A-HJ-NPR-Z]*\d)(?=\d*[A-HJ-NPR-Z])[A-HJ-NPR-Z0-9]{17}\b/g;
const CDL_TEXT_RE = /\b(CDL|licen[cs]e)(\s*(?:no\.?|number|#)?\s*[:#]?\s*)(?=[A-Z-]*\d)[A-Z0-9-]{4,}/gi;

/** Pattern-scrub one free-text string. Order matters: URLs before emails before numbers. */
export function scrubString(input: string): string {
  return input
    .replace(PRESIGNED_QUERY_RE, `?${FILTERED}`)
    .replace(JWT_RE, FILTERED)
    .replace(AUTH_SCHEME_RE, `$1 ${FILTERED}`)
    .replace(QUERY_PARAM_RE, (match, lead: string, name: string) =>
      isSensitiveKey(name) || SENSITIVE_QUERY_NAMES.has(name.toLowerCase())
        ? `${lead}${name}=${FILTERED}`
        : match,
    )
    .replace(EMAIL_RE, '[email]')
    .replace(COORD_PAIR_RE, '[coords]')
    .replace(PHONE_E164_RE, '[phone]')
    .replace(PHONE_US_RE, '[phone]')
    .replace(VIN_RE, '[vin]')
    .replace(CDL_TEXT_RE, `$1$2${FILTERED}`);
}

/** Deep scrub any JSON-ish value. Never mutates the input; cycles and over-deep trees are cut. */
export function scrubValue(value: unknown, depth = 0, seen: WeakSet<object> = new WeakSet()): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  if (depth >= MAX_DEPTH) return '[Truncated]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1, seen));
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    out[key] = isSensitiveKey(key) ? FILTERED : scrubValue(child, depth + 1, seen);
  }
  return out;
}

/**
 * Structural shape of the parts of a Sentry event/breadcrumb this module treats specially.
 * No index signatures, so the SDK's own `ErrorEvent` / `Breadcrumb` interfaces satisfy them.
 */
interface RequestLike {
  url?: string;
  data?: unknown;
  cookies?: unknown;
}
interface EventLike {
  request?: RequestLike;
  user?: { id?: string | number };
  breadcrumbs?: BreadcrumbLike[];
}
interface BreadcrumbLike {
  category?: string;
  data?: Record<string, unknown>;
}

/** Only these keys survive on a fetch/xhr breadcrumb that hit an auth endpoint. */
const AUTH_CRUMB_KEYS = new Set(['method', 'url', 'status_code']);

export function scrubBreadcrumb<T extends BreadcrumbLike>(crumb: T): T {
  const { data, ...rest } = crumb;
  const out = scrubValue(rest) as BreadcrumbLike;
  if (data !== undefined) {
    let kept: Record<string, unknown> = data;
    if (isAuthUrl(data.url) || PRESIGNED_RE.test(String(data.url))) {
      kept = Object.fromEntries(Object.entries(data).filter(([k]) => AUTH_CRUMB_KEYS.has(k)));
    }
    out.data = scrubValue(kept) as Record<string, unknown>;
  }
  return out as T;
}

export function scrubEvent<T extends EventLike>(event: T): T {
  const { request, user, breadcrumbs, ...rest } = event;
  const out = scrubValue(rest) as EventLike;
  if (request) {
    const { cookies: _cookies, data, ...req } = request;
    const cleaned = scrubValue(req) as RequestLike;
    if (data !== undefined) cleaned.data = isAuthUrl(request.url) ? FILTERED : scrubValue(data);
    out.request = cleaned;
  }
  // The SDK runs with sendDefaultPii: false; anything else on `user` is still dropped here.
  if (user) out.user = user.id === undefined ? {} : { id: user.id };
  if (breadcrumbs) out.breadcrumbs = breadcrumbs.map((crumb) => scrubBreadcrumb(crumb));
  return out as T;
}
