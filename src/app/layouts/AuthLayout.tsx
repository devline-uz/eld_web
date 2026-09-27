// AuthLayout — web/tz.md §10 W-00. Split brand panel (--bg-inverse) on the left, card on the right.
// 📐 web/roles and screens/sheets, modals, drawers, menus/Sign in — split brand panel with SSO.jpg
// owner: web-auth-rbac fills the right-hand card (Google-only in prod, Q-1).
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Truck } from 'lucide-react';
import { RouteFallback } from './RouteFallback';

export function AuthLayout() {
  return (
    <div className="grid min-h-screen grid-cols-2">
      <aside aria-label="OneBook ELD" className="flex flex-col bg-bg-inverse p-8">
        <div className="flex items-center gap-3 text-text-inverse">
          <span className="flex size-avatar-lg items-center justify-center rounded-md bg-primary">
            <Truck size={20} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-brand">OneBook ELD</span>
            <span className="block text-card-sub text-text-muted">Fleet Manager</span>
          </span>
        </div>

        {/* W-00 left panel — product copy only, deliberately static: a signed-out visitor never
            sees carrier numbers (§10 W-00). */}
        <div className="my-auto max-w-xl">
          <p className="text-4xl leading-tight font-semibold text-text-inverse">
            Every log, every unit, every inspection — audit ready.
          </p>
          <p className="mt-4 text-base leading-relaxed text-text-muted">
            FMCSA-registered ELD with real-time HOS, DVIR, IFTA and DOT data transfer for carriers
            of any size.
          </p>
        </div>
      </aside>
      <main className="flex items-center justify-center bg-bg-app p-8">
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
