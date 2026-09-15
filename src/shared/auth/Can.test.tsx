// owner: web-auth-rbac — §12.2: a control the user may not use is ABSENT from the DOM.
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Can } from './Can';
import { ROLE_PERMISSIONS } from './permissions';
import type { PermissionMap } from './permissions';

const permissions = vi.hoisted(() => ({ current: {} as PermissionMap }));

vi.mock('./AuthProvider', () => ({
  useAuth: () => ({ permissions: permissions.current }),
}));

function renderAs(role: keyof typeof ROLE_PERMISSIONS) {
  permissions.current = ROLE_PERMISSIONS[role];
  return render(
    <>
      <Can perm="hosCertifyOnBehalf" level="FULL">
        <button type="button">Certify all</button>
      </Can>
      <Can perm="vehicles" level="FULL">
        <button type="button">+ Add vehicle</button>
      </Can>
      <Can perm="vehicles">
        <span>Vehicles table</span>
      </Can>
    </>,
  );
}

describe('<Can>', () => {
  it('ADMIN sees Certify all', () => {
    renderAs('ADMIN');
    expect(screen.getByText('Certify all')).toBeInTheDocument();
  });

  it('FLEET_MANAGER never gets Certify all, but keeps the write CTA', () => {
    renderAs('FLEET_MANAGER');
    expect(screen.queryByText('Certify all')).not.toBeInTheDocument();
    expect(screen.getByText('+ Add vehicle')).toBeInTheDocument();
  });

  it('a READ role keeps the table and loses the CTA — removed, not disabled', () => {
    const { container } = renderAs('VIEWER');
    expect(screen.getByText('Vehicles table')).toBeInTheDocument();
    expect(screen.queryByText('+ Add vehicle')).not.toBeInTheDocument();
    expect(container.querySelector('[disabled]')).toBeNull();
  });

  it('DISPATCHER has vehicles READ only', () => {
    renderAs('DISPATCHER');
    expect(screen.queryByText('+ Add vehicle')).not.toBeInTheDocument();
    expect(screen.getByText('Vehicles table')).toBeInTheDocument();
  });
});
