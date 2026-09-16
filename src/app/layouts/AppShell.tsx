// AppShell — web/tz.md §4. Sidebar (212px) + topbar (62px) + page container.
// The page container has NO max-width; below 1280px the page scrolls horizontally (§4.5).
import { Suspense } from 'react';
import { Outlet, useMatches } from 'react-router-dom';
import { RouteFallback } from './RouteFallback';
import { Sidebar } from './Sidebar';
import { DynamicSubtitleProvider, type RouteHandle } from './Topbar';
import { Topbar } from './Topbar';

/** W-02 Live Fleet is the one screen that runs edge-to-edge, no page padding (web/tz.md §10). */
function useFullBleed(): boolean {
  const matches = useMatches();
  return matches.some((m) => (m.handle as RouteHandle | undefined)?.fullBleed);
}

export function AppShell() {
  const fullBleed = useFullBleed();
  return (
    <div className="flex min-h-screen bg-bg-app xl:h-screen xl:overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:rounded-md focus:bg-bg-surface focus:p-2"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col xl:min-h-0">
        <DynamicSubtitleProvider>
          <Topbar />
          <main
            id="main-content"
            className={
              fullBleed
                ? 'flex-1 overflow-hidden xl:min-h-0'
                : 'flex-1 p-page xl:min-h-0 xl:overflow-y-auto'
            }
          >
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </main>
        </DynamicSubtitleProvider>
      </div>
    </div>
  );
}
