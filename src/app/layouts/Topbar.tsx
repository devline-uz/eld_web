// Topbar — web/tz.md §4.4. 62px, page title + role chip on the left; context filter, global
// search, bell, refresh and avatar on the right. It opens the three Phase 9 overlays:
// 11.26 Account menu (eager, small), 11.27 Notifications panel and 11.28 Command palette (both
// lazy chunks — they load on first use and stay out of the 220 KB initial budget, §16.1).
import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Search } from 'lucide-react';
import { useMatches } from 'react-router-dom';
import { applyNotificationNew, useUnreadNotificationCount } from '@/shared/api/notifications';
import { useAuth } from '@/shared/auth/AuthProvider';
import type { Role } from '@/shared/auth/permissions';
import { usePermission } from '@/shared/auth/usePermission';
import { useReportReadyShell } from '@/shared/realtime/reportReady';
import { useRealtimeEvent } from '@/shared/realtime/useRealtimeEvent';
import { useToast } from '@/shared/ui/Toast';
import { buildPaletteConfig } from '../paletteCommands';
import { AccountTriggerButton, BellButton } from './TopbarTriggers';

// Every overlay is its own lazy chunk (§16.1 initial ≤ 220 KB, WD-059).
const loadCommandPalette = () => import('@/features/search/CommandPalette');
const loadNotificationsPopover = () => import('./NotificationsPopover');
const loadAccountMenu = () => import('./AccountMenu');
const CommandPalette = lazy(loadCommandPalette);
const NotificationsPopover = lazy(loadNotificationsPopover);
const AccountMenu = lazy(loadAccountMenu);
const KeyboardShortcutsModal = lazy(() =>
  import('./KeyboardShortcutsModal').then((module) => ({ default: module.KeyboardShortcutsModal })),
);

const APP_NAME = 'OneBook ELD';

/** The two always-visible overlays are fetched right after first paint, not on first click. */
export const OVERLAY_PRELOAD_DELAY_MS = 1_000;

/** `?` must not fire while the user is typing. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export interface RouteHandle {
  title: string;
  subtitle?: string;
  /** W-02 Live Fleet — renders edge-to-edge, no page padding (web/tz.md §10). */
  fullBleed?: boolean;
}

/**
 * The page header lives in the top bar only (WB — duplicate page titles): every design image
 * under `roles and screens/` draws the title + subtitle in the 62px top bar and starts the content
 * area with the tabs / filters / actions row. Screens never render their own `<h1>`; a screen
 * whose title or subtitle depends on data (counts, a driver name, a breadcrumb) pushes it here
 * with `usePageHeader` / `useDynamicSubtitle`. `handle.title` / `handle.subtitle` stay the
 * defaults while nothing is pushed (and before the screen's data arrives).
 *
 * Two contexts on purpose: screens only subscribe to the stable setters, so pushing a new
 * subtitle node never re-renders the screen that pushed it (a ReactNode breadcrumb would loop).
 */
interface PageHeaderValue {
  title: string | null;
  subtitle: ReactNode | null;
}
interface PageHeaderSetters {
  setTitle: (value: string | null) => void;
  setSubtitle: (value: ReactNode | null) => void;
}
const PageHeaderValueContext = createContext<PageHeaderValue | null>(null);
const PageHeaderSettersContext = createContext<PageHeaderSetters | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  const [subtitle, setSubtitle] = useState<ReactNode | null>(null);
  const setters = useMemo(() => ({ setTitle, setSubtitle }), []);
  const value = useMemo(() => ({ title, subtitle }), [title, subtitle]);
  return (
    <PageHeaderSettersContext.Provider value={setters}>
      <PageHeaderValueContext.Provider value={value}>{children}</PageHeaderValueContext.Provider>
    </PageHeaderSettersContext.Provider>
  );
}

/** Call from a screen with the live top-bar title; it clears itself on unmount. */
export function usePageTitle(value: string | null): void {
  const ctx = useContext(PageHeaderSettersContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setTitle(value);
    return () => ctx.setTitle(null);
  }, [ctx, value]);
}

/** Call from a screen with the live subtitle (text or a breadcrumb node); clears on unmount. */
export function useDynamicSubtitle(value: ReactNode | null): void {
  const ctx = useContext(PageHeaderSettersContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setSubtitle(value);
    return () => ctx.setSubtitle(null);
  }, [ctx, value]);
}

/** Title + subtitle in one call — what a screen uses instead of rendering its own `<h1>`. */
export function usePageHeader({ title, subtitle }: { title?: string | null; subtitle?: ReactNode | null }): void {
  usePageTitle(title ?? null);
  useDynamicSubtitle(subtitle ?? null);
}

const ROLE_CHIP: Record<Exclude<Role, 'ADMIN'>, { label: string; className: string }> = {
  FLEET_MANAGER: { label: 'Fleet manager', className: 'bg-primary-soft text-primary' },
  DISPATCHER: { label: 'Dispatcher', className: 'bg-success-soft text-success' },
  VIEWER: { label: 'Read-only · Viewer', className: 'bg-neutral-soft text-text-secondary' },
};

function RoleChip({ role }: { role: Role | null }) {
  // ADMIN shows no chip at all (§4.4).
  if (!role || role === 'ADMIN') return null;
  const chip = ROLE_CHIP[role];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-badge ${chip.className}`}
    >
      <span aria-hidden="true">●</span>
      {chip.label}
    </span>
  );
}

/**
 * The screen's one `<h1>` (+ subtitle and role chip), resolved from what the mounted screen pushed
 * through `usePageHeader`, falling back to the route handle. Also mirrors the title into
 * `document.title`. Exported so screen tests can render the real heading without the whole top bar.
 */
export function PageHeading({
  fallbackTitle = APP_NAME,
  fallbackSubtitle,
  role = null,
}: {
  fallbackTitle?: string;
  fallbackSubtitle?: string;
  role?: Role | null;
}) {
  const dynamic = useContext(PageHeaderValueContext);
  const title = dynamic?.title ?? fallbackTitle;
  const subtitle = dynamic?.subtitle ?? fallbackSubtitle;

  // The one sensible document title per screen (a11y): the same text as the <h1>.
  useEffect(() => {
    document.title = title === APP_NAME ? APP_NAME : `${title} · ${APP_NAME}`;
  }, [title]);

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <h1 className="truncate text-page-title text-text">{title}</h1>
        <RoleChip role={role} />
      </div>
      {subtitle ? <div className="truncate text-page-sub text-text-muted">{subtitle}</div> : null}
    </div>
  );
}

function usePageMeta(): RouteHandle {
  const matches = useMatches();
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const handle = matches[i]?.handle as RouteHandle | undefined;
    if (handle?.title) return handle;
  }
  return { title: APP_NAME };
}

export function Topbar() {
  const { user, isAuthenticated } = useAuth();
  const { can } = usePermission();
  const { title: staticTitle, subtitle: staticSubtitle } = usePageMeta();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isFetching = useIsFetching() > 0;
  const role = user?.role ?? null;

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const palette = useMemo(() => buildPaletteConfig(can, role), [can, role]);
  const unread = useUnreadNotificationCount(isAuthenticated);

  // §7.3 `notification.new` on the auto-joined `user:{id}` room: patch the panel cache, bell dot,
  // and a toast only for CRITICAL.
  useRealtimeEvent('notification.new', ({ notification }) => {
    applyNotificationNew(queryClient, notification);
    if (notification.severity === 'CRITICAL') {
      toast({ kind: 'error', title: notification.title, description: notification.body });
    }
  });

  // §7.3 `report.ready` (worker → Redis bridge → `user:{id}`): invalidate reports everywhere,
  // toast outside `/reports/*` (the report screens announce their own, WD-094).
  useReportReadyShell();

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadNotificationsPopover();
      void loadAccountMenu();
    }, OVERLAY_PRELOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // ⌘K / Ctrl+K toggles the palette from anywhere (§11.28); `?` opens Keyboard shortcuts.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (event.key === '?' && !event.metaKey && !event.ctrlKey && !isTypingTarget(event.target)) {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <header className="flex h-topbar shrink-0 items-center gap-4 border-b border-border bg-bg-surface px-page">
      <PageHeading fallbackTitle={staticTitle} fallbackSubtitle={staticSubtitle} role={role} />

      {/* 1. Context filter — screens that have one render it into this slot (§4.4). */}
      <div id="topbar-context-filter" className="flex items-center gap-2" />

      {/* 2. Global search — opens the command palette (11.28), as does ⌘K. */}
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        onPointerEnter={() => void loadCommandPalette()}
        onFocus={() => void loadCommandPalette()}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        className="hidden h-btn w-search items-center gap-2 rounded-md border border-border bg-bg-app px-3 text-body text-text-muted xl:flex"
      >
        <Search size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
        <span className="truncate">Search vehicles, drivers…</span>
      </button>

      {/* 3. Notifications (11.27) */}
      <Suspense
        fallback={
          <BellButton unread={unread} aria-haspopup="dialog" aria-expanded={false} onClick={() => setNotificationsOpen(true)} />
        }
      >
        <NotificationsPopover
          open={notificationsOpen}
          onOpenChange={setNotificationsOpen}
          unread={unread}
          isPathAllowed={palette.isPathAllowed}
        />
      </Suspense>

      {/* 4. Refresh — invalidates every query on the current screen. */}
      <button
        type="button"
        aria-label="Refresh"
        onClick={() => void queryClient.invalidateQueries()}
        className="flex size-btn items-center justify-center rounded-md border border-border text-text-secondary hover:bg-bg-subtle"
      >
        <RefreshCw
          size={16}
          strokeWidth={1.75}
          aria-hidden="true"
          className={isFetching ? 'animate-spin' : undefined}
        />
      </button>

      {/* 5. Avatar → account menu (11.26) */}
      <Suspense
        fallback={
          <AccountTriggerButton
            name={user?.fullName ?? 'OneBook user'}
            avatarUrl={user?.avatarUrl ?? null}
            aria-haspopup="menu"
            aria-expanded={false}
            onClick={() => setAccountOpen(true)}
          />
        }
      >
        <AccountMenu open={accountOpen} onOpenChange={setAccountOpen} onOpenShortcuts={() => setShortcutsOpen(true)} />
      </Suspense>

      {paletteOpen ? (
        <Suspense fallback={null}>
          <CommandPalette
            open
            onOpenChange={setPaletteOpen}
            pages={palette.pages}
            actions={palette.actions}
            canSearchDrivers={palette.canSearchDrivers}
            canSearchVehicles={palette.canSearchVehicles}
            canOpenHosLogs={palette.canOpenHosLogs}
          />
        </Suspense>
      ) : null}
      {shortcutsOpen ? (
        <Suspense fallback={null}>
          <KeyboardShortcutsModal open onClose={() => setShortcutsOpen(false)} />
        </Suspense>
      ) : null}
    </header>
  );
}
