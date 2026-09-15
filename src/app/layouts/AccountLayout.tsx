// AccountLayout — web/tz.md §4.6. `/account` is ONE long page; the 204px items are scroll
// anchors into its cards (`/account#security`), not separate pages.
import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { ACCOUNT_NAV } from '../navigation';
import { RouteFallback } from './RouteFallback';

export function AccountLayout() {
  return (
    <div className="flex gap-card-gap">
      <nav aria-label="My account" className="w-subnav shrink-0">
        <p className="px-3 pb-2 text-nav-section text-text-muted">MY ACCOUNT</p>
        <ul className="flex flex-col gap-1">
          {ACCOUNT_NAV.map((item) => (
            <li key={item.to}>
              <a
                href={item.to.slice(item.to.indexOf('#'))}
                className="flex h-nav-item items-center rounded-md px-3 text-nav text-text-secondary hover:bg-bg-subtle"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t border-border pt-3">
          <NavLink
            to="/settings"
            className="flex h-nav-item items-center gap-1 rounded-md px-3 text-nav text-text-secondary hover:bg-bg-subtle"
          >
            <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
            Organisation settings
          </NavLink>
        </div>
      </nav>
      <div className="min-w-0 flex-1">
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
