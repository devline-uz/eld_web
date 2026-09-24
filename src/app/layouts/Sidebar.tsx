// Sidebar chrome — web/tz.md §4.1 brand block, §4.2 navigation, §4.3 organisation card.
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Truck } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/shared/auth/AuthProvider';
import { usePermission } from '@/shared/auth/usePermission';
import { useCarrier } from '@/shared/api/carrier';
import { vehiclesCountQuery } from '@/shared/api/vehicleCounts';
import { cn } from '@/shared/ui/cn';
import { DevlineLogo } from '@/shared/ui/DevlineLogo';
import { NAV_SECTIONS, isNavItemVisible } from '../navigation';
import { createRouteWarmer } from '../routePrefetch';

const ICON = 18;

/**
 * WB-173 — §3 specifies a 64px collapsed sidebar and nothing rendered a control for it. The
 * choice is per browser (not per carrier), so it lives in `localStorage`; a private window or a
 * storage exception just starts expanded.
 */
const COLLAPSE_KEY = 'obk.sidebarCollapsed';

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = () => {
    setCollapsed((prev) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, prev ? '0' : '1');
      } catch {
        /* storage unavailable — the choice simply does not survive a reload */
      }
      return !prev;
    });
  };
  return [collapsed, toggle];
}

function Brand({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <div className={cn('flex items-center gap-3 py-4', collapsed ? 'flex-col px-2' : 'px-3')}>
      <span className="flex size-avatar-lg shrink-0 items-center justify-center rounded-md bg-primary text-text-inverse">
        <Truck size={20} strokeWidth={1.75} aria-hidden="true" />
      </span>
      {!collapsed && (
        <>
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
            className="flex size-6 shrink-0 items-center justify-center text-text-muted disabled:cursor-not-allowed"
          >
            <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </>
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-controls="sidebar-nav"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-bg-subtle hover:text-text"
      >
        {collapsed ? (
          <PanelLeftOpen size={16} strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <PanelLeftClose size={16} strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

function OrganisationCard({ collapsed }: { collapsed: boolean }) {
  const { user } = useAuth();
  // WB-174 — `DOT #1234567 · 69 units` was hardcoded: it showed another carrier's DOT number to
  // every operator. Both halves are read now (`GET /carrier`, cached `reference`, and the same
  // `limit: 1` unit total the Dashboard tiles use); a part that did not load is left out rather
  // than guessed.
  const carrier = useCarrier();
  const units = useQuery(vehiclesCountQuery());
  const name = carrier.data?.name ?? user?.carrierName ?? 'Universal Logistics';
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase();
  const details = [
    carrier.data?.dotNumber ? `DOT #${carrier.data.dotNumber}` : null,
    typeof units.data?.total === 'number' ? `${units.data.total} units` : null,
  ].filter(Boolean) as string[];

  if (collapsed) {
    return (
      <div className="border-t border-border p-2">
        <span
          title={details.length > 0 ? `${name} · ${details.join(' · ')}` : name}
          className="mx-auto flex size-avatar items-center justify-center rounded-full bg-bg-inverse text-badge text-text-inverse"
        >
          {initials}
        </span>
        {/* Vendor signature under the company — only the "D" tile fits the 64px rail. */}
        <DevlineLogo variant="mark" className="mt-2 w-full justify-center" />
      </div>
    );
  }

  return (
    <div className="border-t border-border p-3">
      <div className="flex items-center gap-2">
        <span className="flex size-avatar shrink-0 items-center justify-center rounded-full bg-bg-inverse text-badge text-text-inverse">
          {initials}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-label font-semibold text-text">{name}</span>
          {details.length > 0 && (
            <span className="block truncate text-caption text-text-muted tabular">{details.join(' · ')}</span>
          )}
        </span>
      </div>
      {/* Vendor signature sits under the company name (brand screenshot 2026-09-23). */}
      <DevlineLogo className="mt-3 w-full justify-center" />
    </div>
  );
}

export function Sidebar() {
  const { user } = useAuth();
  const { can } = usePermission();
  const role = user?.role ?? null;
  // WD-073 — hover/focus intent warms the route chunk and its primary list query (debounced, so
  // sweeping the pointer down the sidebar fires only the link it settles on).
  const queryClient = useQueryClient();
  const warmer = useMemo(() => createRouteWarmer(queryClient), [queryClient]);
  useEffect(() => () => warmer.cancel(), [warmer]);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-border bg-bg-sidebar xl:h-full',
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
      )}
    >
      <Brand collapsed={collapsed} onToggle={toggleCollapsed} />
      <nav
        id="sidebar-nav"
        aria-label="Main"
        className={cn('flex-1 overflow-y-auto overscroll-contain pb-4 xl:min-h-0', collapsed ? 'px-2' : 'px-3')}
      >
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter((item) => isNavItemVisible(item, can, role));
          if (items.length === 0) return null;
          return (
            <div key={section.title ?? 'top'} className="mb-1">
              {section.title && !collapsed ? (
                <p className="px-3 pt-4 pb-1 text-nav-section text-text-muted">{section.title}</p>
              ) : null}
              <ul className="flex flex-col gap-1">
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end ?? false}
                      onMouseEnter={() => warmer.schedule(item.to)}
                      onFocus={() => warmer.schedule(item.to)}
                      onMouseLeave={warmer.cancel}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          'flex h-nav-item items-center rounded-md text-nav',
                          collapsed ? 'justify-center px-0' : 'gap-3 px-3',
                          isActive ? 'bg-bg-nav-active text-primary' : 'text-text-secondary hover:bg-bg-subtle',
                        )
                      }
                    >
                      <item.icon size={ICON} strokeWidth={1.75} aria-hidden="true" />
                      {/* Collapsed: the icon alone is visible, the label stays in the
                          accessibility tree so the link keeps its name (§3 64px state). */}
                      <span className={collapsed ? 'sr-only' : 'flex-1 truncate'}>{item.label}</span>
                      {/* owner: the feature that owns the counter feeds `item.badge` its value. */}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
      <OrganisationCard collapsed={collapsed} />
    </aside>
  );
}
