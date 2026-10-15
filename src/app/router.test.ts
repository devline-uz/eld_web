// web/tz.md §9, §12.2 — `buildRoutes` is the one place that decides whether a perm-gated screen's
// real element or `<ForbiddenPage>` is registered for a route (web/decisions.md WD-003: a NONE
// permission means the feature chunk is never even imported). Every per-screen "forbidden" state
// that doesn't also render its own defensive `<ForbiddenState>` (see
// src/features/vehicles/UnitProfilePage.tsx, DriverProfilePage.tsx for the two that do) relies on
// this one mechanism — tracked as the generic "forbidden" cell in web/tests/STATES-AUDIT.md.
import { describe, expect, it } from 'vitest';
import { matchRoutes } from 'react-router-dom';
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

  it('CODE-085 — DVIR / Safety / ELD devices are gated by permission, not by role key', () => {
    // A DISPATCHER that is granted `dvir` (e.g. an edited role) now reaches the screen, and a custom
    // role without it gets <ForbiddenPage> — the same rule for every role.
    const withDvir = buildRoutes({ ...NO_PERMISSIONS, dvir: 'READ' }, 'DISPATCHER');
    const withoutDvir = buildRoutes({ ...NO_PERMISSIONS }, 'DISPATCHER');
    expect((findRoute(withDvir, 'dvir').element as { type: unknown }).type).not.toBe(
      (findRoute(withoutDvir, 'dvir').element as { type: unknown }).type,
    );
  });

  it('CODE-085 — the DVIR report also needs `dvir`; IFTA stays blocked for DISPATCHER by role', () => {
    const reportsOnly = buildRoutes({ ...NO_PERMISSIONS, reports: 'READ' }, 'FLEET_MANAGER');
    const reportsAndDvir = buildRoutes({ ...NO_PERMISSIONS, reports: 'READ', dvir: 'READ' }, 'FLEET_MANAGER');
    expect((findRoute(reportsOnly, 'reports/dvir').element as { type: unknown }).type).not.toBe(
      (findRoute(reportsAndDvir, 'reports/dvir').element as { type: unknown }).type,
    );
    const dispatcher = buildRoutes({ ...NO_PERMISSIONS, reports: 'READ' }, 'DISPATCHER');
    expect((findRoute(dispatcher, 'reports/ifta').element as { type: unknown }).type).not.toBe(
      (findRoute(reportsOnly, 'reports/ifta').element as { type: unknown }).type,
    );
  });
});

describe('buildRoutes — FE-005 every screen has an errorElement inside the shell', () => {
  it('each shell child route and the shell itself carry an errorElement', () => {
    const routes = buildRoutes({ ...NO_PERMISSIONS, vehicles: 'FULL' }, 'ADMIN');
    const shell = routes[1]!.children![0]!;
    expect(shell.errorElement).toBeTruthy();
    for (const child of shell.children ?? []) expect(child.errorElement).toBeTruthy();
  });
});

describe('buildRoutes — public email-link landings (no session needed)', () => {
  it.each(['/account/email/confirm', '/account/email/cancel', '/driver-email/verify', '/driver-email/confirm'])(
    '%s resolves to the public AuthLayout branch, not the RequireAuth shell',
    (path) => {
      const routes = buildRoutes(NO_PERMISSIONS, null);
      const matches = matchRoutes(routes, path) ?? [];
      expect(matches.length).toBeGreaterThan(0);
      // The first match is the top-level branch: the RequireAuth shell is routes[1].
      expect(matches[0]!.route).not.toBe(routes[1]);
      expect(matches.at(-1)!.pathname).toBe(path);
    },
  );
});
