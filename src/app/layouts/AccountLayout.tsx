// AccountLayout — web/tz.md §4.6. `/account` is ONE long page; the 204px items are scroll
// anchors into its cards (`/account#security`), not separate pages.
import { Suspense } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { ACCOUNT_NAV } from '../navigation';
import { RouteFallback } from './RouteFallback';

/** The hash an `ACCOUNT_NAV` item points at (`/account#security` → `#security`). */
function itemHash(to: string): string {
  return to.slice(to.indexOf('#'));
}

export function AccountLayout() {
  // WB-122 — the current section is the URL hash; a bare `/account` opens on the first card.
  // Plain anchors stay (not `NavLink`): a click on the section you are already on must still
  // scroll natively, and `NavLink` would mark all five active because they share a pathname.
  const { hash } = useLocation();
  const activeHash = ACCOUNT_NAV.some((item) => itemHash(item.to) === hash)
    ? hash
    : itemHash(ACCOUNT_NAV[0]?.to ?? '#');
  return (
    <div className="flex gap-card-gap">
      <nav aria-label="My account" className="w-subnav shrink-0">
        <p className="px-3 pb-2 text-nav-section text-text-muted">MY ACCOUNT</p>
        <ul className="flex flex-col gap-1">
          {ACCOUNT_NAV.map((item) => {
            const isActive = itemHash(item.to) === activeHash;
            return (
              <li key={item.to}>
                <a
                  href={itemHash(item.to)}
                  aria-current={isActive ? 'location' : undefined}
                  className={[
                    'flex h-nav-item items-center rounded-md px-3 text-nav',
                    isActive
                      ? 'bg-bg-nav-active text-primary'
                      : 'text-text-secondary hover:bg-bg-subtle',
                  ].join(' ')}
                >
                  {item.label}
                </a>
              </li>
            );
          })}
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
