// Sidebar chrome — web/tz.md §4.1 brand block, §4.2 navigation, §4.3 organisation card.
import { ChevronDown, Truck } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthProvider';
import { usePermission } from '@/shared/auth/usePermission';
import { NAV_SECTIONS, isNavItemVisible } from '../navigation';

const ICON = 18;

function Brand() {
  return (
    <div className="flex items-center gap-3 px-3 py-4">
      <span className="flex size-avatar-lg shrink-0 items-center justify-center rounded-md bg-primary text-text-inverse">
        <Truck size={20} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-brand text-text">OneBook ELD</span>
        {/* Product line, identical for every role — never the user's role. */}
        <span className="block truncate text-card-sub text-text-muted">Fleet Manager</span>
      </span>
      <button
        type="button"
        disabled
        aria-label="Switch organisation — available in v2"
        title="Switch organisation — v2"
        className="shrink-0 text-text-muted disabled:cursor-not-allowed"
      >
        <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}

function OrganisationCard() {
  const { user } = useAuth();
  return (
    <div className="border-t border-border p-3">
      <div className="flex items-center gap-2">
        <span className="flex size-avatar shrink-0 items-center justify-center rounded-full bg-bg-inverse text-badge text-text-inverse">
          UL
        </span>
        <span className="min-w-0">
          <span className="block truncate text-label font-semibold text-text">
            {user?.carrierName ?? 'Universal Logistics'}
          </span>
          {/* owner: web-settings-admin — DOT number and unit count come from GET /carrier. */}
          <span className="block truncate text-caption text-text-muted tabular">
            DOT #1234567 · 69 units
          </span>
        </span>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { user } = useAuth();
  const { can } = usePermission();
  const role = user?.role ?? null;

  return (
    <aside className="flex w-sidebar shrink-0 flex-col border-r border-border bg-bg-sidebar xl:h-full">
      <Brand />
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4 xl:min-h-0">
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter((item) => isNavItemVisible(item, can, role));
          if (items.length === 0) return null;
          return (
            <div key={section.title ?? 'top'} className="mb-1">
              {section.title ? (
                <p className="px-3 pt-4 pb-1 text-nav-section text-text-muted">{section.title}</p>
              ) : null}
              <ul className="flex flex-col gap-1">
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end ?? false}
                      className={({ isActive }) =>
                        [
                          'flex h-nav-item items-center gap-3 rounded-md px-3 text-nav',
                          isActive
                            ? 'bg-bg-nav-active text-primary'
                            : 'text-text-secondary hover:bg-bg-subtle',
                        ].join(' ')
                      }
                    >
                      <item.icon size={ICON} strokeWidth={1.75} aria-hidden="true" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {/* owner: the feature that owns the counter feeds `item.badge` its value. */}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
      <OrganisationCard />
    </aside>
  );
}
