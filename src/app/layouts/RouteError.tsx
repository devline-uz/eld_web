// QA FE-005 — a render crash or a failed lazy chunk (a deploy replaced the hashed files) used to
// fall through to React Router's bare default "Unexpected Application Error!" page with no way
// back. As a route `errorElement` this renders inside the AppShell's <Outlet>, so the sidebar and
// topbar stay usable; `Retry` reloads the screen.
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom';
import { useEffect } from 'react';
import { ErrorState } from '@/shared/ui/states';
import { Button } from '@/shared/ui/Button';
import { captureError } from '@/shared/observability/sentry';

/** Dynamic-import failures across browsers: Chrome, Firefox, Safari. */
function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(
    message,
  );
}

export function RouteError({ fullPage = false }: { fullPage?: boolean }) {
  const error = useRouteError();
  const navigate = useNavigate();

  useEffect(() => {
    console.error('[RouteError]', error);
    captureError(error, { boundary: fullPage ? 'shell' : 'route' });
  }, [error, fullPage]);

  const chunk = isChunkLoadError(error);
  const title = chunk ? 'A new version is available' : 'This page could not be displayed';
  const description = chunk
    ? 'The app was updated while this tab was open. Reload to continue.'
    : isRouteErrorResponse(error)
      ? `${error.status} ${error.statusText}`.trim()
      : 'Something went wrong while showing this page. Your data is safe — try again.';

  return (
    <div
      className={
        fullPage
          ? 'flex min-h-screen flex-col items-center justify-center bg-bg-app p-6'
          : 'flex flex-col items-center rounded-lg border border-border bg-bg-surface pb-6'
      }
    >
      <ErrorState title={title} description={description} onRetry={() => window.location.reload()} />
      <Button variant="link" onClick={() => navigate('/')}>
        Go to dashboard
      </Button>
    </div>
  );
}
