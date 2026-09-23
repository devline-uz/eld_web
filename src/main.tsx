import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from './app/providers';
import { AppRouter } from './app/router';
import { captureError, initObservability } from '@/shared/observability/sentry';
import '@/shared/ui/tokens.css';
import '@/shared/ui/print.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing from index.html');

// §17 — no-op without VITE_SENTRY_DSN; never blocks first paint (the SDK is a lazy chunk).
void initObservability();

const reportRenderError = (error: unknown, info: { componentStack?: string }) => {
  captureError(error, { componentStack: info.componentStack });
  console.error(error);
};

createRoot(container, {
  onCaughtError: reportRenderError,
  onUncaughtError: reportRenderError,
}).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>,
);
