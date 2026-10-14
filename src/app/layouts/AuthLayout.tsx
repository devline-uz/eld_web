// AuthLayout — web/tz.md §10 W-00. Split brand panel (--bg-inverse) on the left, card on the right.
// 📐 web/roles and screens/sheets, modals, drawers, menus/Sign in — split brand panel with SSO.jpg
// owner: web-auth-rbac fills the right-hand card (Google-only in prod, Q-1).
//
// Shared by every public page — staff sign-in and the driver email links (`/driver-email/*`, opened
// by drivers from their mailbox) — so the brand panel names the product only, never a panel role
// such as "Fleet Manager", and its copy speaks to carriers and drivers alike.
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Truck } from 'lucide-react';
import { BRAND_NAME, BRAND_SUBTITLE } from '../brand';
import { RouteFallback } from './RouteFallback';

export const AUTH_BRAND_NAME = BRAND_NAME;
export const AUTH_BRAND_SUBTITLE = BRAND_SUBTITLE;

export interface AuthLayoutProps {
  /** The line under the brand name; a route may set its own (defaults to the product line). */
  subtitle?: string;
}

export function AuthLayout({ subtitle = AUTH_BRAND_SUBTITLE }: AuthLayoutProps = {}) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <aside aria-label={AUTH_BRAND_NAME} className="flex flex-col bg-bg-inverse p-6 lg:p-8">
        <div className="flex items-center gap-3 text-text-inverse">
          <span className="flex size-avatar-lg items-center justify-center rounded-md bg-primary">
            <Truck size={20} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-brand">{AUTH_BRAND_NAME}</span>
            <span className="block text-card-sub text-text-muted">{subtitle}</span>
          </span>
        </div>

        {/* W-00 left panel — product copy only, deliberately static: a signed-out visitor never
            sees carrier numbers (§10 W-00). Worded for carriers and their drivers alike. */}
        <div className="my-auto hidden max-w-xl lg:block">
          <p className="text-4xl leading-tight font-semibold text-text-inverse">
            Every log, every unit, every inspection — audit ready.
          </p>
          <p className="mt-4 text-base leading-relaxed text-text-muted">
            FMCSA-registered ELD with real-time HOS, DVIR, IFTA and DOT data transfer for carriers and
            their drivers.
          </p>
        </div>
      </aside>
      <main className="flex items-center justify-center bg-bg-app p-4 sm:p-8">
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
