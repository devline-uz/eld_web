// Router — every route in web/tz.md §9, one React.lazy boundary per feature (§16.3 rule 1).
//
// Guard order is fixed: isAuthenticated → can(perm).
// A NONE permission means the feature module is NEVER imported: the path resolves to the
// Forbidden screen without the route chunk ever being fetched (see web/decisions.md WD-003).
import { lazy, useMemo } from 'react';
import { createBrowserRouter, Navigate, RouterProvider, type RouteObject } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthProvider';
import {
  hasPermission,
  type PermissionKey,
  type PermissionMap,
  type Role,
} from '@/shared/auth/permissions';
import { RequireAuth } from './guards';
import { AccountLayout } from './layouts/AccountLayout';
import { AppShell } from './layouts/AppShell';
import { AuthLayout } from './layouts/AuthLayout';
import { SettingsLayout } from './layouts/SettingsLayout';
import type { RouteHandle } from './layouts/Topbar';
import { SETTINGS_NAV, firstPermittedSettingsRoute } from './navigation';

/* ---- lazy features (one chunk per feature) ------------------------------------------- */
const SignInPage = lazy(() => import('@/features/auth/SignInPage'));
const ForbiddenPage = lazy(() => import('@/features/auth/ForbiddenPage'));
const NotFoundPage = lazy(() => import('@/features/auth/NotFoundPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const LiveFleetPage = lazy(() => import('@/features/live-fleet/LiveFleetPage'));
const VehiclesPage = lazy(() => import('@/features/vehicles/VehiclesPage'));
const UnitProfilePage = lazy(() => import('@/features/vehicles/UnitProfilePage'));
const UnitHistoriesPage = lazy(() => import('@/features/vehicles/UnitHistoriesPage'));
const DriversPage = lazy(() => import('@/features/drivers/DriversPage'));
const DriverProfilePage = lazy(() => import('@/features/drivers/DriverProfilePage'));
const TripsPage = lazy(() => import('@/features/trips/TripsPage'));
const HosLogsPage = lazy(() => import('@/features/hos-logs/HosLogsPage'));
const DvirPage = lazy(() => import('@/features/dvir/DvirPage'));
const SafetyPage = lazy(() => import('@/features/safety/SafetyPage'));
const IftaReportPage = lazy(() => import('@/features/reports/IftaReportPage'));
const ActivityReportPage = lazy(() => import('@/features/reports/ActivityReportPage'));
const DvirReportPage = lazy(() => import('@/features/reports/DvirReportPage'));
const FmcsaPackPage = lazy(() => import('@/features/reports/FmcsaPackPage'));
const MessagesPage = lazy(() => import('@/features/messages/MessagesPage'));
const CompanyProfilePage = lazy(() => import('@/features/settings/CompanyProfilePage'));
const UsersPage = lazy(() => import('@/features/settings/UsersPage'));
const RolesPage = lazy(() => import('@/features/settings/RolesPage'));
const DevicesPage = lazy(() => import('@/features/settings/DevicesPage'));
const AlertRulesPage = lazy(() => import('@/features/settings/AlertRulesPage'));
const IntegrationsPage = lazy(() => import('@/features/settings/IntegrationsPage'));
const AuditLogPage = lazy(() => import('@/features/settings/AuditLogPage'));
const SupportPage = lazy(() => import('@/features/support/SupportPage'));
const FeedbackPage = lazy(() => import('@/features/support/FeedbackPage'));
const AccountPage = lazy(() => import('@/features/account/AccountPage'));

/* ---- route table (§9) ------------------------------------------------------------------ */
interface GuardedRoute {
  path?: string;
  index?: boolean;
  element: RouteObject['element'];
  perm?: PermissionKey;
  level?: 'READ' | 'FULL';
  /** Design omissions that outrank the backend matrix: Dispatcher gets /403 on DVIR + Safety. */
  blockedRoles?: Role[];
  handle?: RouteHandle;
}

const SHELL_ROUTES: GuardedRoute[] = [
  {
    index: true,
    element: <DashboardPage />,
    perm: 'dashboard',
    handle: { title: 'Fleet Dashboard' },
  },
  {
    path: 'live-fleet',
    element: <LiveFleetPage />,
    perm: 'liveFleet',
    handle: { title: 'Live Fleet', fullBleed: true },
  },
  { path: 'vehicles', element: <VehiclesPage />, perm: 'vehicles', handle: { title: 'Vehicles' } },
  {
    path: 'vehicles/:id',
    element: <UnitProfilePage />,
    perm: 'vehicles',
    handle: { title: 'Unit profile' },
  },
  {
    path: 'vehicles/:id/histories',
    element: <UnitHistoriesPage />,
    perm: 'vehicles',
    handle: { title: 'Unit histories' },
  },
  { path: 'drivers', element: <DriversPage />, perm: 'drivers', handle: { title: 'Drivers' } },
  {
    path: 'drivers/:id',
    element: <DriverProfilePage />,
    perm: 'drivers',
    handle: { title: 'Driver profile' },
  },
  { path: 'trips', element: <TripsPage />, perm: 'trips', handle: { title: 'Dispatch & Trips' } },
  { path: 'hos-logs', element: <HosLogsPage />, perm: 'hos', handle: { title: 'HOS Logs' } },
  {
    path: 'dvir',
    element: <DvirPage />,
    perm: 'dvir',
    blockedRoles: ['DISPATCHER'],
    handle: { title: 'DVIR & Maintenance' },
  },
  {
    path: 'safety',
    element: <SafetyPage />,
    perm: 'safety',
    blockedRoles: ['DISPATCHER'],
    handle: { title: 'Safety' },
  },
  { path: 'reports', element: <ReportsIndexRedirect />, perm: 'reports' },
  {
    path: 'reports/ifta',
    element: <IftaReportPage />,
    perm: 'reports',
    // web/bugs.md WB-002 — the screenshots give DISPATCHER the Activity report only; `reports` =
    // READ still covers /reports/activity, so IFTA is blocked by role like DVIR/Safety above.
    blockedRoles: ['DISPATCHER'],
    handle: { title: 'Reports · IFTA' },
  },
  {
    path: 'reports/activity',
    element: <ActivityReportPage />,
    perm: 'reports',
    handle: { title: 'Reports · Activity report' },
  },
  {
    path: 'reports/dvir',
    element: <DvirReportPage />,
    perm: 'reports',
    blockedRoles: ['DISPATCHER'],
    handle: { title: 'Reports · DVIR report' },
  },
  {
    path: 'reports/fmcsa',
    element: <FmcsaPackPage />,
    perm: 'reportsTransfer',
    handle: { title: 'Reports · FMCSA / DOT audit pack' },
  },
  { path: 'messages', element: <MessagesPage />, perm: 'messaging', handle: { title: 'Messages' } },
  { path: '403', element: <ForbiddenPage />, handle: { title: 'Access denied' } },
];

const SETTINGS_ROUTES: GuardedRoute[] = [
  {
    path: 'company',
    element: <CompanyProfilePage />,
    perm: 'carrierSettings',
    handle: { title: 'Company profile' },
  },
  { path: 'users', element: <UsersPage />, perm: 'users', handle: { title: 'Users' } },
  {
    path: 'roles',
    element: <RolesPage />,
    perm: 'roles',
    handle: { title: 'Roles & permissions' },
  },
  {
    path: 'devices',
    element: <DevicesPage />,
    perm: 'devices',
    // Design-vs-backend gap: `devices` = READ for DISPATCHER, but no dispatcher screenshot
    // exists for this screen (web/bugs.md) — a direct URL 403s, matching the DVIR/Safety
    // pattern above.
    blockedRoles: ['DISPATCHER'],
    handle: { title: 'ELD devices' },
  },
  {
    path: 'alerts',
    element: <AlertRulesPage />,
    perm: 'alertRules',
    handle: { title: 'Alert rules' },
  },
  {
    path: 'integrations',
    element: <IntegrationsPage />,
    perm: 'integrations',
    handle: { title: 'Integrations' },
  },
  { path: 'audit', element: <AuditLogPage />, perm: 'auditLog', handle: { title: 'Audit log' } },
  { path: 'support', element: <SupportPage />, perm: 'support', handle: { title: 'Support' } },
  {
    path: 'support/feedback',
    element: <FeedbackPage />,
    perm: 'support',
    handle: { title: 'Feedback' },
  },
];

/** `/reports` → IFTA, except DISPATCHER, whose only report screen is Activity (WB-002). */
export function ReportsIndexRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?.role === 'DISPATCHER' ? '/reports/activity' : '/reports/ifta'} replace />;
}

/** `/settings` → the first permitted item (ADMIN → company, FM → devices, others → support). */
function SettingsIndexRedirect({
  permissions,
  role,
}: {
  permissions: PermissionMap;
  role: Role | null;
}) {
  const target = firstPermittedSettingsRoute(
    (key, level) => hasPermission(permissions, key, level),
    role,
  );
  return <Navigate to={target ?? '/403'} replace />;
}

function toRouteObject(
  def: GuardedRoute,
  permissions: PermissionMap,
  role: Role | null,
): RouteObject {
  const blocked =
    (def.blockedRoles && role && def.blockedRoles.includes(role)) ||
    (def.perm ? !hasPermission(permissions, def.perm, def.level ?? 'READ') : false);

  // Permission-less route: the lazy feature element is dropped entirely, never imported.
  const element = blocked ? <ForbiddenPage /> : def.element;
  return def.index
    ? { index: true, element, handle: def.handle }
    : { path: def.path, element, handle: def.handle };
}

export function buildRoutes(permissions: PermissionMap, role: Role | null): RouteObject[] {
  return [
    {
      path: '/sign-in',
      element: <AuthLayout />,
      children: [{ index: true, element: <SignInPage /> }],
    },
    {
      element: <RequireAuth />, // 1
      children: [
        {
          path: '/',
          element: <AppShell />,
          children: [
            // 2 — can(perm), applied per route in toRouteObject()
            ...SHELL_ROUTES.map((def) => toRouteObject(def, permissions, role)),
            {
              path: 'settings',
              element: <SettingsLayout />,
              handle: { title: 'Settings' } satisfies RouteHandle,
              children: [
                {
                  index: true,
                  element: <SettingsIndexRedirect permissions={permissions} role={role} />,
                },
                ...SETTINGS_ROUTES.map((def) => toRouteObject(def, permissions, role)),
              ],
            },
            {
              path: 'account',
              element: <AccountLayout />,
              handle: { title: 'My profile' } satisfies RouteHandle,
              children: [{ index: true, element: <AccountPage /> }],
            },
            { path: '*', element: <NotFoundPage />, handle: { title: 'Page not found' } },
          ],
        },
      ],
    },
  ];
}

export function AppRouter() {
  const { permissions, user } = useAuth();
  const role = user?.role ?? null;
  const router = useMemo(
    () => createBrowserRouter(buildRoutes(permissions, role)),
    [permissions, role],
  );
  return <RouterProvider router={router} />;
}

// Re-exported so the Settings sub-nav and its route table can never drift apart.
export { SETTINGS_NAV };
