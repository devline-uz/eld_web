import {
  BATCH_MAX,
  BATCH_WINDOW_MS,
  DEDUP_WINDOW_MS,
  LIMITS,
  RATE_MAX,
  createReporter,
  deviceSummary,
  errorParts,
  firstFrame,
  installClientErrorReporting,
  isClientErrorReportingEnabled,
  isFromExtension,
  reportClientError,
  routePattern,
  shouldIgnore,
  truncate,
  urlWithoutQuery,
  type ClientErrorReport,
  type ReporterDeps,
} from './clientErrors';
import { FILTERED } from './scrub';

const ENDPOINT = 'https://eldapi.example/api/client-errors';
const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfMSIsImVtYWlsIjoibWlrZSJ9.c2lnbmF0dXJlLXZhbHVl';
const V8_STACK = 'TypeError: x is undefined\n    at Row (https://eldadmin.example/assets/index-abc.js:10:5)\n    at div';
const FRAME = '    at Row (https://eldadmin.example/assets/index-abc123.js:10:5)\n';
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

function errorWith(message: string, stack?: string, name = 'Error'): Error {
  const e = new Error(message);
  e.name = name;
  e.stack = stack;
  return e;
}

function setup(overrides: Partial<ReporterDeps> = {}) {
  let t = 1_700_000_000_000;
  const timers: Array<() => void> = [];
  const fetch = vi.fn((_url: string, _init: RequestInit) => Promise.resolve({ status: 202 }));
  const deps: ReporterDeps = {
    endpoint: ENDPOINT,
    fetch,
    now: () => t,
    location: { href: 'https://eldadmin.example/drivers/42?tab=hos#x', pathname: '/drivers/42' },
    userAgent: CHROME_UA,
    appVersion: 'preview-20261014',
    release: 'r1',
    setTimer: (fn) => {
      timers.push(fn);
      return timers.length;
    },
    clearTimer: vi.fn(),
    ...overrides,
  };
  const reporter = createReporter(deps);
  const sent = (): ClientErrorReport[][] =>
    fetch.mock.calls.map(([, init]) => (JSON.parse(init.body as string) as { errors: ClientErrorReport[] }).errors);
  return {
    reporter,
    fetch,
    deps,
    sent,
    timers,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe('pure helpers', () => {
  it('truncate cuts with an ellipsis only when over the limit', () => {
    expect(truncate('abc', 3)).toBe('abc');
    expect(truncate('abcd', 3)).toBe('ab…');
  });

  it('errorParts handles strings, errors, error-likes, primitives and unprintable objects', () => {
    expect(errorParts('boom')).toEqual({ name: '', message: 'boom' });
    expect(errorParts(errorWith('m', 'S'))).toEqual({ name: 'Error', message: 'm', stack: 'S' });
    expect(errorParts({ name: 1, message: 'm', stack: '' })).toEqual({ name: '', message: 'm', stack: undefined });
    expect(errorParts({ code: 1 })).toEqual({ name: '', message: '[object Object]', stack: undefined });
    expect(errorParts(42)).toEqual({ name: '', message: '42' });
    expect(errorParts(Object.create(null)).message).toBe('Unserializable error');
  });

  it('isFromExtension needs every URL to be an extension URL', () => {
    expect(isFromExtension('Error\n at f (chrome-extension://abc/content.js:1:1)')).toBe(true);
    expect(isFromExtension(undefined, 'moz-extension://x/a.js')).toBe(true);
    expect(isFromExtension('at f (chrome-extension://abc/c.js:1:1)\n at g (https://eldadmin.example/a.js:1:1)')).toBe(
      false,
    );
    expect(isFromExtension('no urls here')).toBe(false);
    expect(isFromExtension(undefined)).toBe(false);
  });

  it('firstFrame finds the V8 or Gecko frame', () => {
    expect(firstFrame(undefined)).toBe('');
    expect(firstFrame(V8_STACK)).toBe('at Row (https://eldadmin.example/assets/index-abc.js:10:5)');
    expect(firstFrame('Row@https://eldadmin.example/a.js:1:2\n')).toBe('Row@https://eldadmin.example/a.js:1:2');
    expect(firstFrame('just a message')).toBe('');
  });

  it('routePattern maps param values and id-looking segments', () => {
    expect(routePattern('/drivers/drv_abc/logs', { driverId: 'drv_abc', '*': 'logs', other: undefined })).toBe(
      '/drivers/:driverId/logs',
    );
    expect(routePattern('/vehicles/123')).toBe('/vehicles/:id');
    expect(routePattern('/units/0b9f2a1e-1c2d-4e5f-8a9b-0c1d2e3f4a5b/history')).toBe('/units/:id/history');
    expect(routePattern('/trips/cm1abcdefghijklmnopqrstu')).toBe('/trips/:id');
    expect(routePattern('/a%20b/name')).toBe('/a%20b/name');
    expect(routePattern('/bad/%E0%A4%A')).toBe('/bad/%E0%A4%A');
    expect(routePattern('')).toBe('/');
    expect(routePattern(`/${'x.'.repeat(150)}`).length).toBe(LIMITS.route);
  });

  it('deviceSummary reports browser + major version + OS', () => {
    expect(deviceSummary(CHROME_UA)).toBe('Chrome 129 / Windows');
    expect(deviceSummary(`${CHROME_UA} Edg/129.0`)).toBe('Edge 129 / Windows');
    expect(deviceSummary('Mozilla/5.0 (X11; Linux x86_64) Chrome/120 OPR/105.0')).toBe('Opera 105 / Linux');
    expect(deviceSummary('Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:131.0) Gecko/20100101 Firefox/131.0')).toBe(
      'Firefox 131 / macOS',
    );
    expect(
      deviceSummary(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari 17 / iOS');
    expect(deviceSummary('Mozilla/5.0 (Linux; Android 14) Chrome/129.0')).toBe('Chrome 129 / Android');
    expect(deviceSummary('Mozilla/5.0 (X11; CrOS x86_64) Chrome/129.0')).toBe('Chrome 129 / ChromeOS');
    expect(deviceSummary('curl/8')).toBe('Unknown browser / Unknown OS');
  });

  it('urlWithoutQuery drops query and hash', () => {
    expect(urlWithoutQuery('https://a.example/x?token=1#y')).toBe('https://a.example/x');
    expect(urlWithoutQuery('https://a.example/x#y')).toBe('https://a.example/x');
    expect(urlWithoutQuery('https://a.example/x')).toBe('https://a.example/x');
  });
});

describe('capture filters', () => {
  const ignored = (error: unknown, filename?: string) => shouldIgnore(error, errorParts(error), filename);

  it.each(['ApiError', 'NetworkError', 'AbortError', 'CancelledError', 'RefreshCancelledError', 'TimeoutError'])(
    'ignores %s (API responses, network, cancellations)',
    (name) => {
      expect(ignored(errorWith('Request failed', V8_STACK, name))).toBe(true);
    },
  );

  it.each([
    'ResizeObserver loop completed with undelivered notifications.',
    'ResizeObserver loop limit exceeded',
    'CancelledError',
    'The user aborted a request.',
    'signal is aborted without reason',
    'Failed to fetch',
    'TypeError: Failed to fetch',
    'NetworkError when attempting to fetch resource.',
    'Load failed',
  ])('ignores noise message %j', (message) => {
    expect(ignored(errorWith(message, V8_STACK))).toBe(true);
  });

  it('ignores route responses, empty errors, opaque script errors and extension-only stacks', () => {
    expect(ignored({ status: 404, statusText: 'Not Found', internal: true, data: '' })).toBe(true);
    expect(ignored({ status: 404 })).toBe(false);
    expect(ignored('')).toBe(true);
    expect(ignored('Script error.')).toBe(true);
    expect(ignored(errorWith('boom', 'Error: boom\n at x (chrome-extension://abc/inject.js:1:1)'))).toBe(true);
    expect(ignored('boom', 'safari-web-extension://abc/c.js')).toBe(true);
  });

  it('keeps real client bugs, including failed lazy chunks', () => {
    expect(ignored(errorWith("Cannot read properties of undefined (reading 'id')", V8_STACK, 'TypeError'))).toBe(false);
    expect(
      ignored(errorWith('Failed to fetch dynamically imported module: https://eldadmin.example/assets/HosLogs-x.js', V8_STACK, 'TypeError')),
    ).toBe(false);
    expect(ignored(errorWith('Script error.', V8_STACK))).toBe(false);
    expect(ignored(null)).toBe(false);
  });
});

describe('createReporter', () => {
  it('builds a scrubbed, truncated report with context and posts it after the batch window', () => {
    const { reporter, timers, sent, fetch } = setup({ getToken: () => 'tok' });
    const long = `user mike@universal-logistics.example sent ${JWT} ${'x'.repeat(2000)}`;
    expect(reporter.report(errorWith(long, `${V8_STACK}\n${FRAME.repeat(150)}`, 'TypeError'), { level: 'fatal' })).toBe(
      true,
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(timers).toHaveLength(1);
    timers[0]!();
    const [[report]] = sent() as [[ClientErrorReport]];
    expect(report.source).toBe('admin');
    expect(report.level).toBe('fatal');
    expect(report.message.startsWith(`TypeError: user [email] sent ${FILTERED}`)).toBe(true);
    // Cut before scrubbing (bounds the scrubber), so the masked text may come out shorter.
    expect(report.message.length).toBeLessThanOrEqual(LIMITS.message);
    expect(report.message.endsWith('…')).toBe(true);
    expect(report.stack).toHaveLength(LIMITS.stack);
    expect(report.url).toBe('https://eldadmin.example/drivers/42');
    expect(report.route).toBe('/drivers/:id');
    expect(report.appVersion).toBe('preview-20261014');
    expect(report.release).toBe('r1');
    expect(report.platform).toBe('web');
    expect(report.device).toBe('Chrome 129 / Windows');
    expect(report.occurredAt).toBe(new Date(1_700_000_000_000).toISOString());
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(ENDPOINT);
    expect(init).toMatchObject({ method: 'POST', keepalive: true, credentials: 'omit' });
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer tok' });
  });

  it('omits optional context it does not have and never sends a token it does not have', () => {
    const { reporter, sent, fetch } = setup({
      location: undefined,
      userAgent: undefined,
      appVersion: undefined,
      release: undefined,
      getToken: () => null,
    });
    reporter.report('plain string');
    reporter.report(errorWith('Error: prefixed already', undefined, 'Error'), { route: '/x/:id' });
    reporter.flush();
    expect(sent()[0]).toEqual([
      { source: 'admin', level: 'error', message: 'plain string', platform: 'web', occurredAt: expect.any(String) },
      {
        source: 'admin',
        level: 'error',
        message: 'Error: prefixed already',
        route: '/x/:id',
        platform: 'web',
        occurredAt: expect.any(String),
      },
    ]);
    expect(fetch.mock.calls[0]![1].headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('does not queue filtered errors', () => {
    const { reporter } = setup();
    expect(reporter.report(errorWith('Request failed', V8_STACK, 'ApiError'))).toBe(false);
    expect(reporter.pending()).toBe(0);
  });

  it('dedups the same message + first frame for 60 s', () => {
    const { reporter, advance } = setup();
    expect(reporter.report(errorWith('boom', V8_STACK))).toBe(true);
    expect(reporter.report(errorWith('boom', V8_STACK))).toBe(false);
    expect(reporter.report(errorWith('boom', 'Error: boom\n at other (https://e.example/b.js:1:1)'))).toBe(true);
    advance(DEDUP_WINDOW_MS);
    expect(reporter.report(errorWith('boom', V8_STACK))).toBe(true);
    expect(reporter.pending()).toBe(3);
  });

  it('prunes expired dedup keys once the table is large, keeping fresh ones', () => {
    const { reporter, advance } = setup();
    for (let i = 0; i < 199; i += 1) reporter.report(`old ${i}`);
    advance(30_000);
    reporter.report('fresh');
    advance(31_000);
    expect(reporter.report('new one')).toBe(true);
    expect(reporter.report('fresh')).toBe(false);
    expect(reporter.report('old 1')).toBe(true);
  });

  it('caps a tab at 20 reports per minute', () => {
    const { reporter, advance, sent } = setup();
    for (let i = 0; i < RATE_MAX + 5; i += 1) reporter.report(`e${i}`);
    reporter.flush();
    expect(sent().flat()).toHaveLength(RATE_MAX);
    expect(reporter.report('later')).toBe(false);
    advance(60_000);
    expect(reporter.report('later')).toBe(true);
  });

  it('batches: one timer per window, an immediate flush at 10, at most 10 per request', () => {
    const { reporter, timers, sent } = setup();
    for (let i = 0; i < BATCH_MAX - 1; i += 1) reporter.report(`e${i}`);
    expect(timers).toHaveLength(1);
    expect(sent()).toHaveLength(0);
    reporter.report('e9');
    expect(sent()).toEqual([expect.any(Array)]);
    expect(sent()[0]).toHaveLength(BATCH_MAX);
    reporter.report('e10');
    expect(timers).toHaveLength(2);
    expect(BATCH_WINDOW_MS).toBe(2_000);
  });

  it('splits a batch whose body would exceed the keepalive limit', () => {
    const { reporter, sent } = setup();
    for (let i = 0; i < 9; i += 1) reporter.report(errorWith(`big ${i}`, `${V8_STACK}${i}\n${FRAME.repeat(130)}`));
    reporter.flush();
    expect(sent().length).toBeGreaterThan(1);
    expect(sent().flat()).toHaveLength(9);
    for (const batch of sent()) expect(JSON.stringify({ errors: batch }).length).toBeLessThanOrEqual(60_000);
  });

  it('uses sendBeacon on pagehide and falls back to keepalive fetch when it refuses or throws', () => {
    const beacon = vi.fn(() => true);
    const a = setup({ sendBeacon: beacon });
    a.reporter.report('one');
    a.reporter.flush(true);
    expect(beacon).toHaveBeenCalledWith(ENDPOINT, expect.any(Blob));
    expect(a.fetch).not.toHaveBeenCalled();

    const b = setup({ sendBeacon: () => false });
    b.reporter.report('two');
    b.reporter.flush(true);
    expect(b.fetch).toHaveBeenCalledTimes(1);

    const c = setup({
      sendBeacon: () => {
        throw new TypeError('beacon refused');
      },
    });
    c.reporter.report('three');
    c.reporter.flush(true);
    expect(c.fetch).toHaveBeenCalledTimes(1);

    const d = setup({ sendBeacon: undefined });
    d.reporter.report('four');
    d.reporter.flush(true);
    expect(d.fetch).toHaveBeenCalledTimes(1);
  });

  it('is silent on every failure: rejected fetch, throwing fetch, no fetch, throwing clock or timer', async () => {
    const rejecting = setup({ fetch: vi.fn(() => Promise.reject(new Error('401'))) });
    rejecting.reporter.report('a');
    expect(() => rejecting.reporter.flush()).not.toThrow();
    await Promise.resolve();

    const throwing = setup({
      fetch: vi.fn(() => {
        throw new TypeError('blocked');
      }),
    });
    throwing.reporter.report('b');
    expect(() => throwing.reporter.flush()).not.toThrow();

    const none = setup({ fetch: undefined });
    none.reporter.report('c');
    none.reporter.flush();
    expect(none.reporter.pending()).toBe(0);

    const clock = setup({
      now: () => {
        throw new Error('clock');
      },
    });
    expect(clock.reporter.report('d')).toBe(false);

    const timer = setup({
      clearTimer: () => {
        throw new Error('timer');
      },
    });
    timer.reporter.report('e');
    expect(() => timer.reporter.flush()).not.toThrow();
    expect(timer.reporter.pending()).toBe(0);
  });

  it('dispose drops the queue and the timer; real timers work by default', () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn(() => Promise.resolve());
      const reporter = createReporter({ endpoint: ENDPOINT, fetch });
      reporter.report('x');
      vi.advanceTimersByTime(BATCH_WINDOW_MS);
      expect(fetch).toHaveBeenCalledTimes(1);
      reporter.report('y');
      reporter.dispose();
      reporter.dispose();
      vi.advanceTimersByTime(BATCH_WINDOW_MS);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(reporter.pending()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('isClientErrorReportingEnabled', () => {
  it('is off in tests and dev, on in production, overridable by VITE_CLIENT_ERRORS', () => {
    expect(isClientErrorReportingEnabled({ MODE: 'test', DEV: false, VITE_CLIENT_ERRORS: 'true' })).toBe(false);
    expect(isClientErrorReportingEnabled({ MODE: 'development', DEV: true })).toBe(false);
    expect(isClientErrorReportingEnabled({ MODE: 'development', DEV: true, VITE_CLIENT_ERRORS: 'true' })).toBe(true);
    expect(isClientErrorReportingEnabled({ MODE: 'production', DEV: false })).toBe(true);
    expect(isClientErrorReportingEnabled({ MODE: 'production', DEV: false, VITE_CLIENT_ERRORS: 'false' })).toBe(false);
  });
});

describe('installClientErrorReporting', () => {
  function fakeWindow(withBeacon = true) {
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState });
    const fetch = vi.fn((_url: string, _init: RequestInit) => Promise.resolve());
    const sendBeacon = vi.fn(() => true);
    const target = Object.assign(new EventTarget(), {
      document: doc,
      fetch,
      location: { href: 'https://eldadmin.example/hos-logs?d=1', pathname: '/hos-logs' },
      navigator: { userAgent: CHROME_UA, ...(withBeacon ? { sendBeacon } : {}) },
    });
    return { target: target as unknown as Window, doc, fetch, sendBeacon, raw: target };
  }

  function errorEvent(init: { error?: unknown; message?: string; filename?: string }): Event {
    return Object.assign(new Event('error'), { error: init.error, message: init.message ?? '', filename: init.filename ?? '' });
  }

  it('is a no-op in unit tests by default and when disabled', () => {
    const uninstall = installClientErrorReporting();
    expect(uninstall()).toBeUndefined();
    expect(installClientErrorReporting({ enabled: false })()).toBeUndefined();
    expect(() => reportClientError(new Error('nobody listening'))).not.toThrow();
  });

  it('captures window errors, rejections and chunk preload failures; flushes by beacon on pagehide', () => {
    const w = fakeWindow();
    const uninstall = installClientErrorReporting({ enabled: true, target: w.target });
    expect(installClientErrorReporting({ enabled: true, target: w.target })).not.toBe(uninstall);

    w.raw.dispatchEvent(errorEvent({ error: errorWith('render boom', V8_STACK, 'TypeError') }));
    w.raw.dispatchEvent(errorEvent({ message: 'Uncaught ReferenceError: foo is not defined' }));
    w.raw.dispatchEvent(errorEvent({ message: 'boom', filename: 'chrome-extension://abc/x.js' }));
    w.raw.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: errorWith('async boom', V8_STACK) }));
    w.raw.dispatchEvent(
      Object.assign(new Event('unhandledrejection'), { reason: errorWith('Request failed', V8_STACK, 'ApiError') }),
    );
    w.raw.dispatchEvent(
      Object.assign(new Event('vite:preloadError'), {
        payload: new Error('Failed to fetch dynamically imported module: /assets/Dvir-1.js'),
      }),
    );
    w.raw.dispatchEvent(new Event('vite:preloadError'));
    reportClientError(errorWith('boundary boom', V8_STACK), { level: 'fatal', route: '/drivers/:driverId' });

    w.raw.dispatchEvent(new Event('pagehide'));
    expect(w.sendBeacon).toHaveBeenCalledTimes(1);
    const [, blob] = w.sendBeacon.mock.calls[0] as unknown as [string, Blob];
    expect(blob.type).toBe('application/json');
    expect(w.fetch).not.toHaveBeenCalled();
    uninstall();
    uninstall();
  });

  it('sends the queued batch with the beacon payload shape', async () => {
    const w = fakeWindow();
    const uninstall = installClientErrorReporting({ enabled: true, target: w.target });
    w.raw.dispatchEvent(errorEvent({ error: errorWith('one', V8_STACK) }));
    w.raw.dispatchEvent(new Event('pagehide'));
    const [url, blob] = w.sendBeacon.mock.calls[0] as unknown as [string, Blob];
    expect(url.endsWith('/client-errors')).toBe(true);
    const body = JSON.parse(await blob.text()) as { errors: ClientErrorReport[] };
    expect(body.errors).toEqual([
      expect.objectContaining({
        source: 'admin',
        level: 'error',
        message: 'one',
        url: 'https://eldadmin.example/hos-logs',
        route: '/hos-logs',
        device: 'Chrome 129 / Windows',
      }),
    ]);
    uninstall();
  });

  it('flushes with fetch on visibility hidden when no beacon exists; ignores visible; uninstall detaches', () => {
    const w = fakeWindow(false);
    const uninstall = installClientErrorReporting({ enabled: true, target: w.target });
    w.raw.dispatchEvent(errorEvent({ error: errorWith('first', V8_STACK) }));
    w.doc.dispatchEvent(new Event('visibilitychange'));
    expect(w.fetch).not.toHaveBeenCalled();
    w.doc.visibilityState = 'hidden';
    w.doc.dispatchEvent(new Event('visibilitychange'));
    expect(w.fetch).toHaveBeenCalledTimes(1);
    uninstall();
    w.raw.dispatchEvent(errorEvent({ error: errorWith('after', V8_STACK) }));
    w.raw.dispatchEvent(new Event('pagehide'));
    expect(w.fetch).toHaveBeenCalledTimes(1);
  });

  it('defaults to the real window', () => {
    const uninstall = installClientErrorReporting({ enabled: true, fetch: vi.fn(() => Promise.resolve()) });
    expect(typeof uninstall).toBe('function');
    uninstall();
  });
});
