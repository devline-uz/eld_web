// AuthLayout — web/tz.md §10 W-00. Split brand panel (--bg-inverse) on the left, card on the right.
// 📐 web/roles and screens/sheets, modals, drawers, menus/Sign in — split brand panel with SSO.jpg
// owner: web-auth-rbac fills the right-hand card (Google-only in prod, Q-1).
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Truck } from 'lucide-react';
import { RouteFallback } from './RouteFallback';

/** §10 W-00 — static marketing figures, never fetched from the API. */
const SIGN_IN_STATS = [
  { value: '69', label: 'units connected' },
  { value: '58', label: 'active drivers' },
  { value: '99.9%', label: 'ELD uptime' },
] as const;

export function AuthLayout() {
  return (
    <div className="grid min-h-screen grid-cols-2">
      <aside aria-label="OneBook ELD" className="flex flex-col justify-between bg-bg-inverse p-8">
        <div className="flex items-center gap-3 text-text-inverse">
          <span className="flex size-avatar-lg items-center justify-center rounded-md bg-primary">
            <Truck size={20} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-brand">OneBook ELD</span>
            <span className="block text-card-sub text-text-muted">Fleet Manager</span>
          </span>
        </div>

        {/* W-00 left panel — marketing copy, deliberately static: a signed-out visitor never
            sees real carrier numbers (§10 W-00). */}
        <div className="max-w-xl">
          <p className="text-4xl leading-tight font-semibold text-text-inverse">
            Every log, every unit, every inspection — audit ready.
          </p>
          <p className="mt-4 text-base leading-relaxed text-text-muted">
            FMCSA-registered ELD with real-time HOS, DVIR, IFTA and DOT data transfer for carriers
            of any size.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4">
            {SIGN_IN_STATS.map((stat) => (
              <div key={stat.label} className="rounded-md bg-white/6 p-4">
                <p className="tabular text-kpi text-text-inverse">{stat.value}</p>
                <p className="mt-1 text-caption text-text-muted">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <figure className="rounded-md bg-white/6 p-4">
          <blockquote className="text-body text-text-inverse">
            “Roadside inspections went from a scramble to two clicks. eRODS transfer has never
            failed us.”
          </blockquote>
          <figcaption className="mt-3 flex items-center gap-3">
            <span className="flex size-avatar items-center justify-center rounded-full bg-primary text-badge text-text-inverse">
              SC
            </span>
            <span>
              <span className="block text-label text-text-inverse">Sarah Chen</span>
              <span className="block text-caption text-text-muted">
                Safety Director · Universal Logistics
              </span>
            </span>
          </figcaption>
        </figure>
      </aside>
      <main className="flex items-center justify-center bg-bg-app p-8">
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
