// Navigation tree — web/tz.md §4.2 (sidebar) and §4.6 (Settings / My account sub-nav).
// The design wins over the backend permission matrix: Dispatcher has NO `DVIR & Maintenance`
// and NO `Safety` item even though the backend grants READ, and a direct URL there renders /403.
import {
  Bell,
  Building2,
  CircleHelp,
  Clock,
  Cpu,
  FileText,
  KeyRound,
  Link2,
  LayoutGrid,
  MapPin,
  MessageSquare,
  Route,
  Settings as SettingsIcon,
  ShieldCheck,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { PermissionKey, Role } from '@/shared/auth/permissions';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** `undefined` = always visible (Settings: every role has at least Support). */
  perm?: PermissionKey;
  /** Deliberate design omissions that outrank the backend matrix (§4.2). */
  hiddenForRoles?: Role[];
  /** Counter pill; the value is supplied by the owning feature, never hard-coded here. */
  badge?: 'danger' | 'primary';
  /** Sibling routes that keep this item highlighted (Trailers lives under Vehicles, §4.2 sidebar is fixed). */
  alsoActive?: string[];
  /** `/` must match exactly, everything else matches its subtree. */
  end?: boolean;
}

export interface NavSection {
  /** `null` = the two items above the first section header. */
  title: string | null;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: null,
    items: [
      { label: 'Dashboard', to: '/', icon: LayoutGrid, perm: 'dashboard', end: true },
      { label: 'Live Fleet', to: '/live-fleet', icon: MapPin, perm: 'liveFleet' },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { label: 'Vehicles', to: '/vehicles', icon: Truck, perm: 'vehicles', alsoActive: ['/trailers'] },
      { label: 'Drivers', to: '/drivers', icon: Users, perm: 'drivers' },
      { label: 'Dispatch & Trips', to: '/trips', icon: Route, perm: 'trips' },
    ],
  },
  {
    title: 'COMPLIANCE',
    items: [
      { label: 'HOS Logs', to: '/hos-logs', icon: Clock, perm: 'hos' },
      {
        label: 'DVIR & Maintenance',
        to: '/dvir',
        icon: Wrench,
        perm: 'dvir',
        hiddenForRoles: ['DISPATCHER'],
      },
      {
        label: 'Safety',
        to: '/safety',
        icon: ShieldCheck,
        perm: 'safety',
        hiddenForRoles: ['DISPATCHER'],
        badge: 'danger',
      },
    ],
  },
  {
    title: 'INSIGHTS',
    items: [
      { label: 'Reports', to: '/reports', icon: FileText, perm: 'reports' },
      {
        label: 'Messages',
        to: '/messages',
        icon: MessageSquare,
        perm: 'messaging',
        badge: 'primary',
      },
      { label: 'Settings', to: '/settings', icon: SettingsIcon },
    ],
  },
];

export interface SubNavItem {
  label: string;
  to: string;
  perm?: PermissionKey;
  /** Deliberate design omissions that outrank the backend matrix (§4.2/§12.1). */
  hiddenForRoles?: Role[];
  /** Sub-nav leading icon, as drawn in `Settings — *.jpg` (WB-QA-S-03). */
  icon?: LucideIcon;
}

/** §4.6 — order matters: `/settings` redirects to the first permitted entry. */
export const SETTINGS_NAV: SubNavItem[] = [
  { label: 'Company profile', to: '/settings/company', icon: Building2, perm: 'carrierSettings' },
  { label: 'Users', to: '/settings/users', icon: Users, perm: 'users' },
  { label: 'Roles & permissions', to: '/settings/roles', icon: KeyRound, perm: 'roles' },
  {
    label: 'ELD devices',
    to: '/settings/devices',
    icon: Cpu,
    perm: 'devices',
    // web/roles and screens/dispatcher/ has no "Settings — ELD devices" screenshot even
    // though the backend grants `devices: READ` to DISPATCHER — the design wins (web/bugs.md).
    hiddenForRoles: ['DISPATCHER'],
  },
  { label: 'Alert rules', to: '/settings/alerts', icon: Bell, perm: 'alertRules' },
  { label: 'Integrations', to: '/settings/integrations', icon: Link2, perm: 'integrations' },
  { label: 'Audit log', to: '/settings/audit', icon: Clock, perm: 'auditLog' },
  { label: 'Support', to: '/settings/support', icon: CircleHelp, perm: 'support' },
];

/** §4.6 — one long page with scroll anchors, not four pages. */
export const ACCOUNT_NAV: SubNavItem[] = [
  { label: 'My profile', to: '/account#profile' },
  { label: 'Security & sign-in', to: '/account#security' },
  { label: 'Notifications', to: '/account#notifications' },
  { label: 'Language & region', to: '/account#language' },
  { label: 'Active sessions', to: '/account#sessions' },
];

export type PermissionCheck = (key: PermissionKey, level?: 'READ' | 'FULL') => boolean;

export function isNavItemVisible(
  item: NavItem | SubNavItem,
  can: PermissionCheck,
  role: Role | null,
) {
  const hiddenForRoles = 'hiddenForRoles' in item ? item.hiddenForRoles : undefined;
  if (role && hiddenForRoles?.includes(role)) return false;
  return item.perm ? can(item.perm) : true;
}

/** ADMIN → company · FM → devices · DISPATCHER/VIEWER → support. */
export function firstPermittedSettingsRoute(
  can: PermissionCheck,
  role: Role | null = null,
): string | null {
  return SETTINGS_NAV.find((item) => isNavItemVisible(item, can, role))?.to ?? null;
}
