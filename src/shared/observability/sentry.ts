// owner: web-architect — error reporting (web/tz.md §17, web/decisions.md WD-057).
//
// `@sentry/browser` is never in the entry bundle: it is dynamic-imported, and only when
// VITE_SENTRY_DSN is non-empty. With no DSN nothing is imported, nothing is sent, and
// `captureError` is a no-op. Every event and breadcrumb passes through `scrub.ts` first.
import type * as SentryBrowser from '@sentry/browser';
import { scrubBreadcrumb, scrubEvent } from './scrub';

export type SentryModule = Pick<typeof SentryBrowser, 'init' | 'captureException'>;

export interface ObservabilityOptions {
  dsn?: string;
  release?: string;
  environment?: string;
  /** Test seam — defaults to the lazy `@sentry/browser` chunk. */
  load?: () => Promise<SentryModule>;
}

type Queued = [error: unknown, context: Record<string, unknown> | undefined];

let client: SentryModule | null = null;
/** Non-null while the SDK chunk is loading: errors raised during start-up are replayed. */
let pending: Queued[] | null = null;

export async function initObservability(options: ObservabilityOptions = {}): Promise<boolean> {
  const dsn = (options.dsn ?? import.meta.env.VITE_SENTRY_DSN ?? '').trim();
  if (!dsn || client || pending) return false;
  const queue: Queued[] = [];
  pending = queue;
  try {
    const load = options.load ?? (() => import('./sentrySdk'));
    const sentry = await load();
    sentry.init({
      dsn,
      release: options.release ?? import.meta.env.VITE_APP_VERSION,
      environment: options.environment ?? import.meta.env.MODE,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      beforeSend: (event) => scrubEvent(event),
      beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
    });
    client = sentry;
    pending = null;
    for (const [error, context] of queue) captureError(error, context);
    return true;
  } catch {
    // Reporting must never take the app down; a failed chunk load just means no reporting.
    pending = null;
    return false;
  }
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (client) client.captureException(error, context ? { extra: context } : undefined);
  else pending?.push([error, context]);
}
