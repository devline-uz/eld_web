// Sidebar chrome — web/tz.md §4.1 brand block, §4.2 navigation, §4.3 organisation card.
import { useEffect, useMemo, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, Truck, X } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/shared/auth/AuthProvider';
import { usePermission } from '@/shared/auth/usePermission';
import { useCarrier } from '@/shared/api/carrier';
import { MOBILE_NAV_QUERY, useMediaQuery } from '@/shared/hooks';
import { vehiclesCountQuery } from '@/shared/api/vehicleCounts';
import { cn } from '@/shared/ui/cn';
import { DevlineLogo } from '@/shared/ui/DevlineLogo';
import { BRAND_NAME, BRAND_SUBTITLE } from '../brand';
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

function Brand({
  collapsed,
  onToggle,
  onClose,
}: {
  collapsed: boolean;
  onToggle: () => void;
  /** Set while the sidebar is the < lg off-canvas drawer: the rail toggle becomes a close button. */
  onClose?: () => void;
}) {
  // Expanded: 212px rail − 24px padding − 40px logo − 2×8px gaps − 24px toggle (32px drawer close)
  // leaves ~100–108px, enough for the full brand line. The old disabled "Switch organisation" chevron
  // (already in the account menu as a v2 item) plus 12px gaps squeezed it to ~64px: "OneB…".
  return (
    <div className={cn('flex items-center py-4', collapsed ? 'flex-col gap-3 px-2' : 'gap-2 px-3')}>
      <span className="flex size-avatar-lg shrink-0 items-center justify-center rounded-md bg-primary text-text-inverse">
        <Truck size={20} strokeWidth={1.75} aria-hidden="true" />
      </span>
      {!collapsed && (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-brand text-text">{BRAND_NAME}</span>
          {/* Product line, identical for every role — never the user's role (same as AuthLayout). */}
          <span className="block truncate text-card-sub text-text-muted">{BRAND_SUBTITLE}</span>
        </span>
      )}
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
          title="Close navigation"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-bg-subtle hover:text-text"
        >
          <X size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      ) : (
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
      )}
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
  const name = carrier.data?.name ?? user?.carrierName ?? '';
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

export interface SidebarProps {
  /** < lg only: whether the off-canvas drawer is open (ignored on desktop). */
  mobileOpen?: boolean;
  /** < lg only: close the off-canvas drawer (backdrop, Esc, X, or navigating). */
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps = {}) {
  const { user } = useAuth();
  const { can } = usePermission();
  const { pathname } = useLocation();
  const role = user?.role ?? null;
  // WD-073 — hover/focus intent warms the route chunk and its primary list query (debounced, so
  // sweeping the pointer down the sidebar fires only the link it settles on).
  const queryClient = useQueryClient();
  const warmer = useMemo(() => createRouteWarmer(queryClient, (key) => can(key)), [queryClient, can]);
  useEffect(() => () => warmer.cancel(), [warmer]);
  const [storedCollapsed, toggleCollapsed] = useSidebarCollapsed();
  // Below `lg` the sidebar is an off-canvas drawer opened from the topbar's menu button; the
  // 64px rail only exists on desktop, so the drawer always renders expanded.
  const isMobile = useMediaQuery(MOBILE_NAV_QUERY);
  const collapsed = storedCollapsed && !isMobile;
  const drawerHidden = isMobile && !mobileOpen;

  // Navigating from the drawer closes it.
  useEffect(() => {
    onMobileClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a route change should close it
  }, [pathname]);

  useEffect(() => {
    if (!isMobile || !mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onMobileClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMobile, mobileOpen, onMobileClose]);

  return (
    <>
    {isMobile && mobileOpen ? (
      <div aria-hidden="true" onClick={onMobileClose} className="fixed inset-0 z-40 bg-bg-overlay lg:hidden" />
    ) : null}
    <aside
      id="app-sidebar"
      inert={drawerHidden}
      className={cn(
        'flex shrink-0 flex-col border-r border-border bg-bg-sidebar xl:h-full',
        // < lg: fixed off-canvas drawer; ≥ lg: the in-flow sidebar column.
        'fixed inset-y-0 left-0 z-50 max-w-[85vw] transition-transform duration-200 lg:static lg:z-auto lg:max-w-none lg:translate-x-0 lg:transition-none',
        mobileOpen ? 'translate-x-0 shadow-modal lg:shadow-none' : '-translate-x-full',
        // `collapsed` is always false below lg, so the drawer is the full 212px.
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
      )}
    >
      <Brand collapsed={collapsed} onToggle={toggleCollapsed} onClose={isMobile ? onMobileClose : undefined} />
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
                          isActive || item.alsoActive?.some((p) => pathname === p || pathname.startsWith(`${p}/`))
                            ? 'bg-bg-nav-active text-primary' : 'text-text-secondary hover:bg-bg-subtle',
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
    </>
  );
}
