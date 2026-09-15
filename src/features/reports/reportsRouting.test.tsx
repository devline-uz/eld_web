// Route layer for W-12…W-15: `/reports/fmcsa` is not registered for DISPATCHER/VIEWER, and WB-002 —
// DISPATCHER's only report screen is Activity, matching tests/fixtures/rbacScreens.ts.
import { describe, expect, it, vi } from 'vitest';
import type * as AuthProviderModule from '@/shared/auth/AuthProvider';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, type RouteObject } from 'react-router-dom';
import type { Role } from '@/shared/auth/permissions';
import { RBAC_SCREENS } from '../../../tests/fixtures/rbacScreens';
import { ROLE_PERMISSIONS } from '../../../tests/fixtures/rolePermissions';
import { ReportsIndexRedirect, buildRoutes } from '@/app/router';

const mocks = vi.hoisted(() => ({ role: 'DISPATCHER' as string }));
vi.mock('@/shared/auth/AuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthProviderModule>();
  const { buildMockAuthContext } = await import('../../../tests/fixtures/mockAuth');
  return { ...actual, useAuth: () => buildMockAuthContext(mocks.role as Role) };
});

function find(routes: RouteObject[], path: string): RouteObject | undefined {
  for (const route of routes) {
    if (route.path === path) return route;
    const nested = route.children ? find(route.children, path) : undefined;
    if (nested) return nested;
  }
  return undefined;
}

const ROLES: Role[] = ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER', 'VIEWER'];
const REPORT_SCREENS = RBAC_SCREENS.filter((s) => s.route.startsWith('/reports/'));

describe('reports routes by role', () => {
  it.each(ROLES)('%s: every report route is registered exactly as the screenshots say', (role) => {
    const routes = buildRoutes(ROLE_PERMISSIONS[role], role);
    const forbiddenType = (find(routes, '403')!.element as ReactElement).type;
    for (const screen of REPORT_SCREENS) {
      const route = find(routes, screen.route.slice(1));
      expect(route, screen.route).toBeDefined();
      const blocked = (route!.element as ReactElement).type === forbiddenType;
      expect(blocked, `${role} ${screen.route}`).toBe(!screen.visibleForRole[role]);
    }
  });

  it('keeps the design titles on the Activity and DVIR report routes', () => {
    const routes = buildRoutes(ROLE_PERMISSIONS.ADMIN, 'ADMIN');
    expect(find(routes, 'reports/activity')!.handle).toEqual({ title: 'Reports · Activity report' });
    expect(find(routes, 'reports/dvir')!.handle).toEqual({ title: 'Reports · DVIR report' });
  });
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

describe('/reports index redirect (WB-002)', () => {
  it.each([
    ['ADMIN', '/reports/ifta'],
    ['DISPATCHER', '/reports/activity'],
    ['VIEWER', '/reports/ifta'],
    ['FLEET_MANAGER', '/reports/ifta'],
  ])('%s lands on %s', (role, target) => {
    mocks.role = role;
    render(
      <MemoryRouter initialEntries={['/reports']}>
        <Routes>
          <Route path="/reports" element={<ReportsIndexRedirect />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('location')).toHaveTextContent(target);
  });
});
