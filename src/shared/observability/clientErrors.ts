// owner: web-api-client — client-side error reporting to `POST /client-errors` (web/decisions.md WD-119).
//
// Every uncaught browser error, unhandled rejection, route-boundary error, React render error and
// failed lazy chunk is posted to the backend, which forwards it to the Telegram "admin panel errors"
// topic. Independent of Sentry: no SDK, no DSN, a few hundred bytes in the entry chunk.
//
// Rules (all enforced here, all unit-tested in clientErrors.test.ts):
//   • filtered out — API 4xx/5xx (`ApiError`, the backend reports its own 5xx), network failures,
//     aborts/cancellations, stacks that only touch browser-extension URLs, ResizeObserver loop noise,
//     opaque cross-origin `Script error.`;
//   • every string goes through `scrub.ts` (tokens, emails, VINs, phones, coordinates) and is cut to
//     the backend DTO limits;
//   • dedup: same message + first stack frame once per 60 s; at most 20 reports per minute per tab;
//   • batched: ~2 s window, at most 10 per request; `sendBeacon` on pagehide, `fetch` + `keepalive`
//     otherwise;
//   • never throws and never recurses — every failure inside the reporter is swallowed.
import { API_BASE_URL, endpoints } from '@/shared/api/endpoints';
import { getAccessToken } from '@/shared/api/client';
import { scrubString } from './scrub';

export type ClientErrorLevel = 'error' | 'fatal';

/** One element of `POST /client-errors { errors: [...] }` — field limits mirror the backend DTO. */
export interface ClientErrorReport {
  source: 'admin';
  level: ClientErrorLevel;
  message: string;
  stack?: string;
  url?: string;
  route?: string;
  appVersion?: string;
  platform?: 'web';
  device?: string;
  release?: string;
  occurredAt: string;
}

export const LIMITS = {
  message: 1000,
  stack: 8000,
  url: 500,
  route: 200,
  appVersion: 40,
  device: 80,
  release: 80,
} as const;

export const BATCH_MAX = 10;
export const BATCH_WINDOW_MS = 2_000;
export const DEDUP_WINDOW_MS = 60_000;
export const RATE_MAX = 20;
export const RATE_WINDOW_MS = 60_000;
/** `fetch(..., { keepalive })` and `sendBeacon` cap the body at 64 KiB; stay well under it. */
export const MAX_PAYLOAD_BYTES = 60_000;

/* ------------------------------------------------------------------ pure helpers */

export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * Cut, scrub, cut again. The first cut bounds the scrubber's input: its patterns are super-linear on
 * long unbroken word runs (an 8 000-char run costs ~150 ms), so an unbounded message must never reach it.
 */
function clean(value: string, max: number): string {
  return truncate(scrubString(truncate(value, max)), max);
}

interface ErrorParts {
  name: string;
  message: string;
  stack?: string;
}

/** Name, message and stack of anything that can be thrown — never throws itself. */
export function errorParts(error: unknown): ErrorParts {
  if (typeof error === 'string') return { name: '', message: error };
  if (error && typeof error === 'object') {
    const e = error as { name?: unknown; message?: unknown; stack?: unknown };
    const name = typeof e.name === 'string' ? e.name : '';
    const message = typeof e.message === 'string' ? e.message : safeString(error);
    const stack = typeof e.stack === 'string' && e.stack ? e.stack : undefined;
    return { name, message, stack };
  }
  return { name: '', message: safeString(error) };
}

function safeString(value: unknown): string {
  try {
    return String(value);
  } catch {
    return 'Unserializable error';
  }
}

/** Errors that describe a request outcome or a cancellation, not a client bug. */
const IGNORED_NAMES = new Set([
  'ApiError',
  'NetworkError',
  'AbortError',
  'CancelledError',
  'RefreshCancelledError',
  'TimeoutError',
]);

const IGNORED_MESSAGES = [
  /ResizeObserver loop/i,
  // TanStack Query's `CancelledError` keeps `name === 'Error'`.
  /^CancelledError$/,
  /^(?:AbortError\b|The (?:user|operation) (?:was )?aborted|signal is aborted without reason)/i,
  /^(?:TypeError: )?(?:Failed to fetch|NetworkError when attempting to fetch resource\.?|Load failed|Network request failed)$/i,
];

const EXTENSION_URL = /^(?:chrome|moz|safari|safari-web|ms-browser)-extension:\/\//i;
const ANY_URL = /[a-z][\w+.-]*:\/\/[^\s)'"]+/gi;

/** True when every URL in the stack (and the event filename) belongs to a browser extension. */
export function isFromExtension(stack: string | undefined, filename?: string): boolean {
  const urls = [...(filename ? [filename] : []), ...((stack ?? '').match(ANY_URL) ?? [])];
  return urls.length > 0 && urls.every((url) => EXTENSION_URL.test(url));
}

/** React Router's `ErrorResponse` (a thrown/returned HTTP-like response), not a code fault. */
function isRouteResponse(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { status?: unknown; statusText?: unknown; internal?: unknown };
  return typeof e.status === 'number' && typeof e.statusText === 'string' && typeof e.internal === 'boolean';
}

export function shouldIgnore(error: unknown, parts: ErrorParts, filename?: string): boolean {
  if (IGNORED_NAMES.has(parts.name) || isRouteResponse(error)) return true;
  if (!parts.message && !parts.stack) return true;
  if (IGNORED_MESSAGES.some((re) => re.test(parts.message))) return true;
  // Opaque cross-origin script error: no message, no stack, nothing actionable.
  if (parts.message === 'Script error.' && !parts.stack) return true;
  return isFromExtension(parts.stack, filename);
}

/** First stack frame (`at fn (url:1:2)` in V8, `fn@url:1:2` in Gecko/WebKit), or ''. */
export function firstFrame(stack: string | undefined): string {
  if (!stack) return '';
  const lines = stack.split('\n').map((line) => line.trim());
  return lines.find((line) => line.startsWith('at ') || line.includes('@')) ?? '';
}

const ID_SEGMENT =
  /^(?:\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|c[a-z0-9]{20,}|[A-Za-z0-9_-]{24,})$/i;

/**
 * Route pattern from a pathname: segments equal to a known param value become `:name`; any other
 * id-looking segment (number, uuid, cuid) becomes `:id`.
 */
export function routePattern(pathname: string, params?: Record<string, string | undefined>): string {
  const byValue = new Map<string, string>();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value && key !== '*') byValue.set(value, key);
  }
  const pattern = pathname
    .split('/')
    .map((segment) => {
      if (!segment) return segment;
      let decoded = segment;
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        // Malformed escape — compare the raw segment.
      }
      const key = byValue.get(decoded);
      if (key) return `:${key}`;
      return ID_SEGMENT.test(decoded) ? ':id' : segment;
    })
    .join('/');
  return truncate(pattern || '/', LIMITS.route);
}

/** `Chrome 129 / Windows` — a short, non-identifying user-agent summary. */
export function deviceSummary(userAgent: string): string {
  const browsers: Array<[RegExp, string]> = [
    [/Edg(?:e|A|iOS)?\/(\d+)/, 'Edge'],
    [/OPR\/(\d+)/, 'Opera'],
    [/(?:Firefox|FxiOS)\/(\d+)/, 'Firefox'],
    [/(?:Chrome|CriOS)\/(\d+)/, 'Chrome'],
    [/Version\/(\d+)[^ ]* (?:Mobile\/\S+ )?Safari/, 'Safari'],
  ];
  const systems: Array<[RegExp, string]> = [
    [/Windows/, 'Windows'],
    [/Android/, 'Android'],
    [/iPhone|iPad|iPod/, 'iOS'],
    [/CrOS/, 'ChromeOS'],
    [/Mac OS X|Macintosh/, 'macOS'],
    [/Linux/, 'Linux'],
  ];
  let browser = 'Unknown browser';
  for (const [re, label] of browsers) {
    const match = re.exec(userAgent);
    if (match) {
      browser = `${label} ${match[1]}`;
      break;
    }
  }
  const os = systems.find(([re]) => re.test(userAgent))?.[1] ?? 'Unknown OS';
  return truncate(`${browser} / ${os}`, LIMITS.device);
}

/** `location.href` with the query string and hash removed. */
export function urlWithoutQuery(href: string): string {
  const cut = href.search(/[?#]/);
  return cut === -1 ? href : href.slice(0, cut);
}

/* ------------------------------------------------------------------ reporter */

export interface ReportOptions {
  level?: ClientErrorLevel;
  /** Route path pattern; derived from `location.pathname` when omitted. */
  route?: string;
  /** `ErrorEvent.filename`, used only by the extension filter. */
  filename?: string;
}

export interface ReporterDeps {
  endpoint: string;
  getToken?: () => string | null;
  fetch?: (url: string, init: RequestInit) => Promise<unknown>;
  sendBeacon?: (url: string, data: Blob) => boolean;
  now?: () => number;
  location?: { href: string; pathname: string };
  userAgent?: string;
  appVersion?: string;
  release?: string;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface Reporter {
  /** Queues the error unless filtered, duplicated or rate-limited. Returns whether it was queued. */
  report: (error: unknown, options?: ReportOptions) => boolean;
  /** Sends everything queued now; `beacon` prefers `navigator.sendBeacon` (page is going away). */
  flush: (beacon?: boolean) => void;
  dispose: () => void;
  /** Test seam. */
  pending: () => number;
}

const noop = () => undefined;

export function createReporter(deps: ReporterDeps): Reporter {
  const now = deps.now ?? Date.now;
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let queue: ClientErrorReport[] = [];
  const seen = new Map<string, number>();
  let sentAt: number[] = [];
  let timer: unknown = null;

  function build(parts: ErrorParts, options: ReportOptions, at: number, message: string): ClientErrorReport {
    const loc = deps.location;
    const report: ClientErrorReport = {
      source: 'admin',
      level: options.level ?? 'error',
      message: clean(message, LIMITS.message),
      platform: 'web',
      occurredAt: new Date(at).toISOString(),
    };
    if (parts.stack) report.stack = clean(parts.stack, LIMITS.stack);
    if (loc) report.url = clean(urlWithoutQuery(loc.href), LIMITS.url);
    const route = options.route ?? (loc ? routePattern(loc.pathname) : undefined);
    if (route) report.route = clean(route, LIMITS.route);
    if (deps.appVersion) report.appVersion = truncate(deps.appVersion, LIMITS.appVersion);
    if (deps.release) report.release = truncate(deps.release, LIMITS.release);
    if (deps.userAgent) report.device = deviceSummary(deps.userAgent);
    return report;
  }

  function report(error: unknown, options: ReportOptions = {}): boolean {
    try {
      const parts = errorParts(error);
      if (shouldIgnore(error, parts, options.filename)) return false;
      const message = parts.name && parts.name !== 'Error' && !parts.message.startsWith(parts.name)
        ? `${parts.name}: ${parts.message}`
        : parts.message;
      const at = now();

      const key = `${message}|${firstFrame(parts.stack)}`;
      const last = seen.get(key);
      if (last !== undefined && at - last < DEDUP_WINDOW_MS) return false;
      if (seen.size >= 200) {
        for (const [k, t] of seen) if (at - t >= DEDUP_WINDOW_MS) seen.delete(k);
      }
      seen.set(key, at);

      sentAt = sentAt.filter((t) => at - t < RATE_WINDOW_MS);
      if (sentAt.length >= RATE_MAX) return false;
      sentAt.push(at);

      queue.push(build(parts, options, at, message));
      if (queue.length >= BATCH_MAX) flush();
      else if (timer === null) timer = setTimer(() => flush(), BATCH_WINDOW_MS);
      return true;
    } catch {
      return false;
    }
  }

  /** Up to BATCH_MAX reports whose JSON body stays under MAX_PAYLOAD_BYTES. */
  function takeBatch(): ClientErrorReport[] {
    const batch = queue.splice(0, BATCH_MAX);
    while (batch.length > 1 && JSON.stringify({ errors: batch }).length > MAX_PAYLOAD_BYTES) {
      queue.unshift(batch.pop() as ClientErrorReport);
    }
    return batch;
  }

  function send(batch: ClientErrorReport[], beacon: boolean): void {
    const body = JSON.stringify({ errors: batch });
    if (beacon && deps.sendBeacon) {
      try {
        if (deps.sendBeacon(deps.endpoint, new Blob([body], { type: 'application/json' }))) return;
      } catch {
        // Some browsers refuse a JSON-typed beacon cross-origin — fall through to keepalive fetch.
      }
    }
    if (!deps.fetch) return;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = deps.getToken?.();
      if (token) headers.Authorization = `Bearer ${token}`;
      void deps
        .fetch(deps.endpoint, { method: 'POST', headers, body, keepalive: true, credentials: 'omit' })
        .then(noop, noop);
    } catch {
      // A synchronous fetch failure is as silent as a rejected one.
    }
  }

  function flush(beacon = false): void {
    try {
      if (timer !== null) {
        clearTimer(timer);
        timer = null;
      }
      while (queue.length > 0) send(takeBatch(), beacon);
    } catch {
      queue = [];
    }
  }

  function dispose(): void {
    if (timer !== null) clearTimer(timer);
    timer = null;
    queue = [];
  }

  return { report, flush, dispose, pending: () => queue.length };
}

/* ------------------------------------------------------------------ window wiring */

interface EnvLike {
  MODE?: string;
  DEV?: boolean;
  VITE_CLIENT_ERRORS?: string;
}

/**
 * Off in unit tests (`MODE === 'test'`) and in the dev server; on in production builds.
 * `VITE_CLIENT_ERRORS=true` turns it on in dev, `=false` turns it off anywhere.
 */
export function isClientErrorReportingEnabled(env: EnvLike): boolean {
  if (env.MODE === 'test') return false;
  if (env.VITE_CLIENT_ERRORS === 'false') return false;
  if (env.VITE_CLIENT_ERRORS === 'true') return true;
  return !env.DEV;
}

let active: Reporter | null = null;

export interface InstallOptions extends Partial<ReporterDeps> {
  enabled?: boolean;
  target?: Window;
}

/** Wires the global listeners once. Returns an uninstall function (a no-op when disabled). */
export function installClientErrorReporting(options: InstallOptions = {}): () => void {
  const enabled = options.enabled ?? isClientErrorReportingEnabled(import.meta.env as EnvLike);
  if (!enabled || active) return noop;
  const target = options.target ?? window;
  const nav = target.navigator;
  const reporter = createReporter({
    endpoint: `${API_BASE_URL}${endpoints.clientErrors}`,
    getToken: getAccessToken,
    fetch: (url, init) => target.fetch(url, init),
    sendBeacon: typeof nav.sendBeacon === 'function' ? (url, data) => nav.sendBeacon(url, data) : undefined,
    location: target.location,
    userAgent: nav.userAgent,
    appVersion: import.meta.env.VITE_APP_VERSION as string | undefined,
    release: import.meta.env.VITE_RELEASE as string | undefined,
    ...options,
  });
  active = reporter;

  const onError = (event: Event) => {
    const e = event as ErrorEvent;
    reporter.report(e.error ?? e.message, { filename: e.filename });
  };
  const onRejection = (event: Event) => {
    reporter.report((event as PromiseRejectionEvent).reason);
  };
  // Vite fires this when a lazy chunk (or its CSS) fails to load.
  const onPreloadError = (event: Event) => {
    reporter.report((event as Event & { payload?: unknown }).payload ?? 'Lazy chunk failed to load');
  };
  const onPageHide = () => reporter.flush(true);
  const onVisibility = () => {
    if (target.document.visibilityState === 'hidden') reporter.flush(true);
  };

  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  target.addEventListener('vite:preloadError', onPreloadError);
  target.addEventListener('pagehide', onPageHide);
  target.document.addEventListener('visibilitychange', onVisibility);

  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
    target.removeEventListener('vite:preloadError', onPreloadError);
    target.removeEventListener('pagehide', onPageHide);
    target.document.removeEventListener('visibilitychange', onVisibility);
    reporter.dispose();
    if (active === reporter) active = null;
  };
}

/** Explicit report from an error boundary. A no-op until `installClientErrorReporting` ran. */
export function reportClientError(error: unknown, options?: ReportOptions): void {
  active?.report(error, options);
}
