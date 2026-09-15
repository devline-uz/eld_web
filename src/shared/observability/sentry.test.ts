import type * as SentryApiModule from './sentry';
import type { SentryModule } from './sentry';

const sdk = vi.hoisted(() => ({ init: vi.fn(), captureException: vi.fn() }));
vi.mock('@sentry/browser', () => sdk);

type SentryApi = typeof SentryApiModule;
const DSN = 'https://0123456789abcdef@o0.ingest.us.sentry.io/0';

async function freshModule(): Promise<SentryApi> {
  vi.resetModules();
  return import('./sentry');
}

function fakeSdk(): SentryModule & { init: ReturnType<typeof vi.fn>; captureException: ReturnType<typeof vi.fn> } {
  return { init: vi.fn(), captureException: vi.fn() } as never;
}

beforeEach(() => {
  sdk.init.mockReset();
  sdk.captureException.mockReset();
  vi.unstubAllEnvs();
});

describe('initObservability — no DSN', () => {
  it('is a no-op: nothing is loaded, nothing is captured', async () => {
    const { initObservability, captureError } = await freshModule();
    const load = vi.fn();
    vi.stubEnv('VITE_SENTRY_DSN', '');
    expect(await initObservability({ load })).toBe(false);
    expect(await initObservability({ dsn: '   ', load })).toBe(false);
    expect(load).not.toHaveBeenCalled();
    expect(() => captureError(new Error('x'))).not.toThrow();
  });

  it('treats an absent env variable as unset', async () => {
    const { initObservability } = await freshModule();
    delete (import.meta.env as Record<string, unknown>).VITE_SENTRY_DSN;
    expect(await initObservability()).toBe(false);
    expect(sdk.init).not.toHaveBeenCalled();
  });
});

describe('initObservability — with DSN', () => {
  it('lazy-loads the real SDK by default, scrubs in beforeSend / beforeBreadcrumb', async () => {
    const { initObservability, captureError } = await freshModule();
    vi.stubEnv('VITE_SENTRY_DSN', DSN);
    vi.stubEnv('VITE_APP_VERSION', 'abc123');
    expect(await initObservability()).toBe(true);

    const config = sdk.init.mock.calls[0]?.[0];
    expect(config).toMatchObject({
      dsn: DSN,
      release: 'abc123',
      environment: import.meta.env.MODE,
      sendDefaultPii: false,
      tracesSampleRate: 0,
    });
    expect(config.beforeSend({ message: 'a@b.io', user: { id: 'u', email: 'a@b.io' } })).toEqual({
      message: '[email]',
      user: { id: 'u' },
    });
    expect(config.beforeBreadcrumb({ category: 'console', message: 'Bearer abcdef123' })).toEqual({
      category: 'console',
      message: 'Bearer [Filtered]',
    });

    captureError(new Error('with context'), { componentStack: 'in App' });
    captureError(new Error('bare'));
    expect(sdk.captureException).toHaveBeenNthCalledWith(1, expect.any(Error), {
      extra: { componentStack: 'in App' },
    });
    expect(sdk.captureException).toHaveBeenNthCalledWith(2, expect.any(Error), undefined);

    // A second init is ignored.
    expect(await initObservability({ dsn: DSN })).toBe(false);
  });

  it('honours explicit release/environment and replays errors raised while the chunk loads', async () => {
    const { initObservability, captureError } = await freshModule();
    const fake = fakeSdk();
    let resolve!: (m: SentryModule) => void;
    const loading = initObservability({
      dsn: DSN,
      release: 'r1',
      environment: 'preview',
      load: () => new Promise<SentryModule>((r) => (resolve = r)),
    });
    // Concurrent init while loading is ignored; errors are queued, not lost.
    expect(await initObservability({ dsn: DSN })).toBe(false);
    captureError(new Error('early'), { where: 'boot' });
    resolve(fake);
    expect(await loading).toBe(true);
    expect(fake.init).toHaveBeenCalledWith(expect.objectContaining({ release: 'r1', environment: 'preview' }));
    expect(fake.captureException).toHaveBeenCalledWith(expect.any(Error), { extra: { where: 'boot' } });
  });

  it('never throws when the SDK chunk fails to load, and stays a no-op afterwards', async () => {
    const { initObservability, captureError } = await freshModule();
    expect(await initObservability({ dsn: DSN, load: () => Promise.reject(new Error('chunk 404')) })).toBe(false);
    expect(() => captureError(new Error('after'))).not.toThrow();
    expect(sdk.captureException).not.toHaveBeenCalled();
  });
});
