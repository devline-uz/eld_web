// web/tz.md §9, §12.2 — `buildRoutes` is the one place that decides whether a perm-gated screen's
// real element or `<ForbiddenPage>` is registered for a route (web/decisions.md WD-003: a NONE
// permission means the feature chunk is never even imported). Every per-screen "forbidden" state
// that doesn't also render its own defensive `<ForbiddenState>` (see
// src/features/vehicles/UnitProfilePage.tsx, DriverProfilePage.tsx for the two that do) relies on
// this one mechanism — tracked as the generic "forbidden" cell in web/tests/STATES-AUDIT.md.
import { describe, expect, it } from 'vitest';
import { buildRoutes } from './router';
import { NO_PERMISSIONS, type PermissionMap } from '@/shared/auth/permissions';

// buildRoutes nests the shell two levels deep: /sign-in, then RequireAuth → the `/` AppShell
// whose children are SHELL_ROUTES.
function findRoute(routes: ReturnType<typeof buildRoutes>, path: string) {
  const shellRoutes = routes[1]?.children?.[0]?.children ?? [];
  const route = shellRoutes.find((r) => 'path' in r && r.path === path) as
    | { element?: unknown }
    | undefined;
  if (!route) throw new Error(`route ${path} not found under the shell`);
  return route;
}

describe('buildRoutes — permission-less route swaps in <ForbiddenPage> (§9, §12.2)', () => {
  it('a NONE permission renders a different element than FULL for the same path', () => {
    const full: PermissionMap = { ...NO_PERMISSIONS, vehicles: 'FULL' };
    const none: PermissionMap = { ...NO_PERMISSIONS, vehicles: 'NONE' };

    const allowedRoutes = buildRoutes(full, 'ADMIN');
    const blockedRoutes = buildRoutes(none, 'ADMIN');

    const allowedElement = findRoute(allowedRoutes, 'vehicles').element as { type: unknown };
    const blockedElement = findRoute(blockedRoutes, 'vehicles').element as { type: unknown };

    expect(blockedElement.type).not.toBe(allowedElement.type);
  });

  it('the same ForbiddenPage component backs every NONE-gated screen, not a one-off per screen', () => {
    const none: PermissionMap = { ...NO_PERMISSIONS };
    const routes = buildRoutes(none, 'ADMIN');

    const vehiclesEl = findRoute(routes, 'vehicles').element as { type: unknown };
    const driversEl = findRoute(routes, 'drivers').element as { type: unknown };
    const tripsEl = findRoute(routes, 'trips').element as { type: unknown };

    expect(driversEl.type).toBe(vehiclesEl.type);
    expect(tripsEl.type).toBe(vehiclesEl.type);
  });

  it('READ is enough for a READ-gated route; only FULL satisfies a FULL-gated one', () => {
    const readOnly: PermissionMap = { ...NO_PERMISSIONS, vehicles: 'READ' };
    const routes = buildRoutes(readOnly, 'VIEWER');
    const full: PermissionMap = { ...NO_PERMISSIONS, vehicles: 'FULL' };
    const fullRoutes = buildRoutes(full, 'ADMIN');

    expect((findRoute(routes, 'vehicles').element as { type: unknown }).type).toBe(
      (findRoute(fullRoutes, 'vehicles').element as { type: unknown }).type,
    );
  });

  it('§12.1 design omission — Dispatcher gets <ForbiddenPage> on DVIR even though the backend grants READ', () => {
    const dispatcherPerms: PermissionMap = { ...NO_PERMISSIONS, dvir: 'READ' };
    const dispatcherRoutes = buildRoutes(dispatcherPerms, 'DISPATCHER');
    const fmRoutes = buildRoutes(dispatcherPerms, 'FLEET_MANAGER');

    expect((findRoute(dispatcherRoutes, 'dvir').element as { type: unknown }).type).not.toBe(
      (findRoute(fmRoutes, 'dvir').element as { type: unknown }).type,
    );
  });
});
