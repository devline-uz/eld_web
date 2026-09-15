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
    <div className="flex gap-card-gap">
      <nav aria-label="Settings" className="w-subnav shrink-0">
        <p className="px-3 pb-2 text-nav-section text-text-muted">SETTINGS</p>
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  [
                    'flex h-nav-item items-center rounded-md px-3 text-nav',
                    isActive
                      ? 'bg-bg-nav-active text-primary'
                      : 'text-text-secondary hover:bg-bg-subtle',
                  ].join(' ')
                }
              >
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
