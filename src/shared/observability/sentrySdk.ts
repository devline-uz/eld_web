// The only surface of `@sentry/browser` the app uses. `sentry.ts` dynamic-imports *this* file, not
// the package: a dynamic import of the package namespace keeps every export (Replay, Feedback,
// tracing…) and blew the lazy chunk to 146 KB gzip; named re-exports let Rollup tree-shake it.
export { init, captureException } from '@sentry/browser';
