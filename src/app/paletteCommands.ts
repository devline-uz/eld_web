// 11.28 Command palette — the local command list, built from the same navigation tree as the
// sidebar so a permission-less page or action is ABSENT from the palette, never disabled
// (web/tz.md §11.28 "Amallar ruxsatga qarab filtrlanadi", §12).
import { Pencil, Plus, Send, Settings as SettingsIcon, UserCircle } from 'lucide-react';
import type { PaletteCommand } from '@/features/search/types';
import type { Role } from '@/shared/auth/permissions';
import {
  NAV_SECTIONS,
  SETTINGS_NAV,
  isNavItemVisible,
  type NavItem,
  type PermissionCheck,
  type SubNavItem,
} from './navigation';

export interface PaletteConfig {
  pages: PaletteCommand[];
  actions: PaletteCommand[];
  canSearchDrivers: boolean;
  canSearchVehicles: boolean;
  canOpenHosLogs: boolean;
  /** Is this in-app path reachable for the user? Same rules as the sidebar (§4.2). */
  isPathAllowed: (path: string) => boolean;
}

const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((section) => section.items);
const GUARDED: Array<NavItem | SubNavItem> = [...SETTINGS_NAV, ...NAV_ITEMS];

function matches(item: NavItem | SubNavItem, path: string): boolean {
  if (item.to === '/') return path === '/';
  return path === item.to || path.startsWith(`${item.to}/`);
}

export function buildPaletteConfig(can: PermissionCheck, role: Role | null): PaletteConfig {
  const visible = (item: NavItem | SubNavItem) => isNavItemVisible(item, can, role);

  const isPathAllowed = (raw: string) => {
    const path = raw.split(/[?#]/)[0] || '/';
    // Most specific entry wins: `/settings/users` is checked before `/settings`.
    const guard = GUARDED.filter((item) => matches(item, path)).sort(
      (a, b) => b.to.length - a.to.length,
    )[0];
    return guard ? visible(guard) : true;
  };

  const pages: PaletteCommand[] = [
    ...NAV_ITEMS.filter(visible).map((item) => ({
      id: `page:${item.to}`,
      label: item.label,
      to: item.to,
      icon: item.icon,
    })),
    ...SETTINGS_NAV.filter(visible).map((item) => ({
      id: `page:${item.to}`,
      label: `Settings · ${item.label}`,
      to: item.to,
      icon: SettingsIcon,
    })),
    { id: 'page:/account', label: 'My account', to: '/account', icon: UserCircle },
  ];

  const canOpenHosLogs = isPathAllowed('/hos-logs');
  const actions: PaletteCommand[] = [];
  if (canOpenHosLogs && can('hosEdit', 'FULL')) {
    actions.push({ id: 'action:log-edit', label: 'Request a log edit', to: '/hos-logs', icon: Pencil });
  }
  if (isPathAllowed('/reports/fmcsa') && can('reportsTransfer', 'FULL')) {
    actions.push({
      id: 'action:fmcsa-pack',
      label: 'Send FMCSA pack to inspector',
      to: '/reports/fmcsa',
      icon: Send,
    });
  }
  if (isPathAllowed('/vehicles') && can('vehicles', 'FULL')) {
    actions.push({ id: 'action:add-vehicle', label: 'Add a vehicle', to: '/vehicles', icon: Plus });
  }

  return {
    pages,
    actions,
    canSearchDrivers: isPathAllowed('/drivers'),
    canSearchVehicles: isPathAllowed('/vehicles'),
    canOpenHosLogs,
    isPathAllowed,
  };
}
