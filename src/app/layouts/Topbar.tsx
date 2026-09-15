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
 * A dynamic override for `handle.subtitle`, for the handful of screens whose subtitle depends on
 * fetched data (W-01's carrier name + carrier-timezone date, W-02's "refreshed N seconds ago").
 * `handle.subtitle` stays the default; a mounted screen calling `useDynamicSubtitle` wins.
 */
const DynamicSubtitleContext = createContext<{
  subtitle: string | null;
  setSubtitle: (value: string | null) => void;
} | null>(null);

export function DynamicSubtitleProvider({ children }: { children: ReactNode }) {
  const [subtitle, setSubtitle] = useState<string | null>(null);
  return (
    <DynamicSubtitleContext.Provider value={{ subtitle, setSubtitle }}>
      {children}
    </DynamicSubtitleContext.Provider>
  );
}

/** Call from a screen with the live subtitle string; it clears itself on unmount. */
export function useDynamicSubtitle(value: string | null): void {
  const ctx = useContext(DynamicSubtitleContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setSubtitle(value);
    return () => ctx.setSubtitle(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ctx is a stable provider value
  }, [value]);
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

function usePageMeta(): RouteHandle {
  const matches = useMatches();
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const handle = matches[i]?.handle as RouteHandle | undefined;
    if (handle?.title) return handle;
  }
  return { title: 'OneBook ELD' };
}

export function Topbar() {
  const { user, isAuthenticated } = useAuth();
  const { can } = usePermission();
  const { title, subtitle: staticSubtitle } = usePageMeta();
  const dynamicSubtitle = useContext(DynamicSubtitleContext)?.subtitle ?? null;
  const subtitle = dynamicSubtitle ?? staticSubtitle;
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
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-page-title text-text">{title}</h1>
          <RoleChip role={role} />
        </div>
        {subtitle ? <p className="truncate text-page-sub text-text-muted">{subtitle}</p> : null}
      </div>

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
