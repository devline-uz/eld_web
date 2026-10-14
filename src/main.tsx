import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from './app/providers';
import { AppRouter } from './app/router';
import { captureError, initObservability } from '@/shared/observability/sentry';
import { installClientErrorReporting, reportClientError } from '@/shared/observability/clientErrors';
import '@/shared/ui/tokens.css';
import '@/shared/ui/print.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing from index.html');

// §17 — no-op without VITE_SENTRY_DSN; never blocks first paint (the SDK is a lazy chunk).
void initObservability();
// WD-119 — POST /client-errors → Telegram. On in production builds, off in dev/tests unless
// VITE_CLIENT_ERRORS=true.
installClientErrorReporting();

const reportRenderError =
  (level: 'error' | 'fatal') => (error: unknown, info: { componentStack?: string }) => {
    captureError(error, { componentStack: info.componentStack });
    reportClientError(error, { level });
    console.error(error);
  };

createRoot(container, {
  onCaughtError: reportRenderError('error'),
  onUncaughtError: reportRenderError('fatal'),
}).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>,
);
