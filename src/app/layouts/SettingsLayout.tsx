// SettingsLayout — web/tz.md §4.6. 204px secondary nav on the page background, cards on the right.
import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthProvider';
import { usePermission } from '@/shared/auth/usePermission';
import { SETTINGS_NAV, isNavItemVisible } from '../navigation';
import { RouteFallback } from './RouteFallback';

export function SettingsLayout() {
  const { can } = usePermission();
  const { user } = useAuth();
  const role = user?.role ?? null;
  const items = SETTINGS_NAV.filter((item) => isNavItemVisible(item, can, role));

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-card-gap">
      <nav aria-label="Settings" className="w-full min-w-0 shrink-0 lg:w-subnav">
        <p className="px-3 pb-2 text-nav-section text-text-muted">SETTINGS</p>
        <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
          {items.map((item) => (
            <li key={item.to} className="shrink-0">
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  [
                    'flex h-nav-item items-center gap-3 whitespace-nowrap rounded-md px-3 text-nav',
                    isActive
                      ? 'bg-bg-nav-active text-primary'
                      : 'text-text-secondary hover:bg-bg-subtle',
                  ].join(' ')
                }
              >
                {item.icon && <item.icon size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />}
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1">
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
