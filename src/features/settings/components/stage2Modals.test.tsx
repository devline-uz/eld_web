// owner: web-settings-admin — stage-2 modals that replaced dead row-menu items (W-18 Edit user /
// Change role, W-20 Pair to unit / Update firmware, W-22 Edit scopes). Each is tested for the
// three shared-modal rules: a failure is shown (never a fake success), a double click sends one
// request, and a dirty form confirms before closing.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, fail, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import { NO_PERMISSIONS } from '@/shared/auth/permissions';
import type { ApiKeyRow, DeviceRow, RoleRow, UserRow } from '@/shared/api/settingsAdmin';
import { EditUserModal } from './EditUserModal';
import { PairDeviceModal } from './PairDeviceModal';
import { UpdateFirmwareModal } from './UpdateFirmwareModal';
import { EditApiKeyScopesModal } from './EditApiKeyScopesModal';

function renderModal(children: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>,
  );
}

/** Holds a request open until `release()` so a second click lands while the first is pending. */
function gated() {
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  return { gate, release: () => release() };
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
});
afterAll(() => server.close());
beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
});

/* ------------------------------------------------------------------ EditUserModal */

const role = (id: string, key: string, name: string): RoleRow => ({
  id,
  key,
  name,
  isSystem: true,
  permissions: { ...NO_PERMISSIONS },
});
const ROLES = [role('rol_admin', 'ADMIN', 'Admin'), role('rol_fm', 'FLEET_MANAGER', 'Fleet manager'), role('rol_disp', 'DISPATCHER', 'Dispatcher')];
const USER: UserRow = {
  id: 'usr_5',
  email: 'jo@example.com',
  firstName: 'Jo',
  lastName: 'Park',
  status: 'ACTIVE',
  role: { id: 'rol_disp', key: 'DISPATCHER', name: 'Dispatcher' },
};

describe('EditUserModal', () => {
  it('says why a PATCH failed instead of closing', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    server.use(http.patch(url(endpoints.users.update('usr_5')), () => fail(500, 'INTERNAL_ERROR', 'Boom')));
    renderModal(<EditUserModal user={USER} roles={ROLES} mode="profile" activeAdminCount={2} onClose={onClose} />);

    await user.clear(screen.getByDisplayValue('Jo'));
    await user.type(screen.getByRole('textbox', { name: /first name/i }), 'Joanna');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('B-84 (shipped): changing the email shows the re-verification notice instead of closing', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    server.use(
      http.patch(url(endpoints.users.update('usr_5')), () =>
        ok({ ...USER, emailVerification: { pendingEmail: 'jo.park@example.com' } }),
      ),
    );
    renderModal(<EditUserModal user={USER} roles={ROLES} mode="profile" activeAdminCount={2} onClose={onClose} />);

    const email = screen.getByDisplayValue('jo@example.com');
    await user.clear(email);
    await user.type(email, 'jo.park@example.com');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText(/A verification link was sent to jo\.park@example\.com/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('sends exactly one PATCH on a double click and toasts the role change', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    const { gate, release } = gated();
    server.use(
      http.patch(url(endpoints.users.update('usr_5')), async ({ request }) => {
        bodies.push(await request.json());
        await gate;
        return ok({ ...USER, role: { id: 'rol_fm', key: 'FLEET_MANAGER', name: 'Fleet manager' } });
      }),
    );
    renderModal(<EditUserModal user={USER} roles={ROLES} mode="role" activeAdminCount={2} onClose={() => {}} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Role' }), 'rol_fm');
    const save = screen.getByRole('button', { name: 'Save changes' });
    await user.click(save);
    await user.click(save);

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ roleId: 'rol_fm' });
    release();
    expect(await screen.findByText('Jo Park is now Fleet manager. The new permissions apply on their next page load.')).toBeInTheDocument();
  });

  it('closes an unchanged role picker without a request', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    let sent = false;
    server.use(
      http.patch(url(endpoints.users.update('usr_5')), () => {
        sent = true;
        return ok(USER);
      }),
    );
    renderModal(<EditUserModal user={USER} roles={ROLES} mode="role" activeAdminCount={2} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onClose).toHaveBeenCalled();
    expect(sent).toBe(false);
  });

  it('confirms before discarding an edited name', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(<EditUserModal user={USER} roles={ROLES} mode="profile" activeAdminCount={2} onClose={onClose} />);
    await user.type(screen.getByDisplayValue('Park'), 'er');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ PairDeviceModal */

const DEVICE: DeviceRow = {
  id: 'dev_1',
  serial: 'PT30_A86E',
  model: 'PT30',
  status: 'ASSIGNED',
  vehicleId: 'veh_1',
  bleState: 'CONNECTED',
  firmwareVersion: 'L112',
  firmwareOutdated: true,
  lastHeartbeatAt: null,
};

function withVehicles() {
  server.use(
    http.get(url(endpoints.vehicles.list), () =>
      ok({
        items: [
          { id: 'veh_1', unitNumber: '#101', status: 'ACTIVE' },
          { id: 'veh_7', unitNumber: '#107', status: 'ACTIVE' },
        ],
        total: 2,
        page: 1,
        limit: 200,
        totalPages: 1,
      }),
    ),
  );
}

describe('PairDeviceModal', () => {
  it('refuses to re-pair to the unit the device is already on', async () => {
    withVehicles();
    renderModal(<PairDeviceModal device={DEVICE} onClose={() => {}} />);
    await screen.findByRole('option', { name: '#107' });
    expect(screen.getByRole('button', { name: 'Pair device' })).toBeDisabled();
  });

  it('asks for a unit when none is chosen and sends nothing', async () => {
    const user = userEvent.setup();
    let sent = false;
    withVehicles();
    server.use(
      http.post(url(endpoints.devices.pair('dev_1')), () => {
        sent = true;
        return ok(DEVICE);
      }),
    );
    renderModal(<PairDeviceModal device={{ ...DEVICE, vehicleId: null }} onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Pair device' }));
    expect(await screen.findByText('Choose a unit to pair this device with.')).toBeInTheDocument();
    expect(sent).toBe(false);
  });

  it('shows the server refusal and stays open', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    withVehicles();
    server.use(http.post(url(endpoints.devices.pair('dev_1')), () => fail(409, 'DEVICE_IN_USE', 'That unit already has a device.')));
    renderModal(<PairDeviceModal device={DEVICE} onClose={onClose} />);
    await screen.findByRole('option', { name: '#107' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Unit' }), 'veh_7');
    await user.click(screen.getByRole('button', { name: 'Pair device' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/\S/);
    expect(screen.queryByText('Device PT30_A86E paired')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('sends one pair request on a double click and names the unit in the toast', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    const { gate, release } = gated();
    withVehicles();
    server.use(
      http.post(url(endpoints.devices.pair('dev_1')), async ({ request }) => {
        bodies.push(await request.json());
        await gate;
        return ok({ ...DEVICE, vehicleId: 'veh_7' });
      }),
    );
    renderModal(<PairDeviceModal device={DEVICE} onClose={() => {}} />);
    await screen.findByRole('option', { name: '#107' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Unit' }), 'veh_7');
    const pair = screen.getByRole('button', { name: 'Pair device' });
    await user.click(pair);
    await user.click(pair);
    await waitFor(() => expect(bodies).toHaveLength(1));
    release();
    expect(await screen.findByText('Device PT30_A86E paired')).toBeInTheDocument();
    expect(screen.getByText(/for #107 from the next driver connection/)).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ UpdateFirmwareModal */

describe('UpdateFirmwareModal', () => {
  it('shows the server refusal instead of a queued toast', async () => {
    const user = userEvent.setup();
    server.use(http.patch(url(endpoints.devices.firmware('dev_1')), () => fail(422, 'VALIDATION_ERROR', 'Unknown firmware version.')));
    renderModal(<UpdateFirmwareModal device={DEVICE} onClose={() => {}} />);
    await user.type(screen.getByRole('textbox', { name: 'Target version' }), 'L999');
    await user.click(screen.getByRole('button', { name: 'Update firmware' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/\S/);
    expect(screen.queryByText(/queued for/)).not.toBeInTheDocument();
  });

  it('sends one request on a double click, and confirms before discarding a typed version', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    const { gate, release } = gated();
    server.use(
      http.patch(url(endpoints.devices.firmware('dev_1')), async ({ request }) => {
        bodies.push(await request.json());
        await gate;
        return ok({ ...DEVICE, firmwareVersion: 'L113' });
      }),
    );
    const onClose = vi.fn();
    renderModal(<UpdateFirmwareModal device={DEVICE} onClose={onClose} />);
    await user.type(screen.getByRole('textbox', { name: 'Target version' }), 'L113');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));

    const submit = screen.getByRole('button', { name: 'Update firmware' });
    await user.click(submit);
    await user.click(submit);
    await waitFor(() => expect(bodies).toHaveLength(1));
    release();
    expect(await screen.findByText('Firmware L113 queued for PT30_A86E')).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ EditApiKeyScopesModal */

const KEY: ApiKeyRow = {
  id: 'key_1',
  name: 'McLeod TMS',
  prefix: 'obk_ABCD',
  scopes: ['reports:read', 'legacy:scope'],
  lastUsedAt: null,
  expiresAt: null,
  revokedAt: null,
};

describe('EditApiKeyScopesModal', () => {
  it('keeps a scope that is not in the current list instead of silently dropping it', async () => {
    const user = userEvent.setup();
    let body: { scopes?: string[] } | null = null;
    server.use(
      http.patch(url(endpoints.apiKeys.scopes('key_1')), async ({ request }) => {
        body = (await request.json()) as { scopes?: string[] };
        return ok(KEY);
      }),
    );
    renderModal(<EditApiKeyScopesModal apiKey={KEY} onClose={() => {}} />);
    expect(screen.getByText('legacy:scope')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /read vehicles/i }));
    await user.click(screen.getByRole('button', { name: 'Save scopes' }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body!.scopes).toEqual(['reports:read', 'legacy:scope', 'vehicles:read']);
  });

  it('closes an unchanged scope set without a request', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    let sent = false;
    server.use(
      http.patch(url(endpoints.apiKeys.scopes('key_1')), () => {
        sent = true;
        return ok(KEY);
      }),
    );
    renderModal(<EditApiKeyScopesModal apiKey={KEY} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Save scopes' }));
    expect(onClose).toHaveBeenCalled();
    expect(sent).toBe(false);
  });

  it('shows the server refusal and sends one request on a double click', async () => {
    const user = userEvent.setup();
    let calls = 0;
    const { gate, release } = gated();
    server.use(
      http.patch(url(endpoints.apiKeys.scopes('key_1')), async () => {
        calls += 1;
        await gate;
        return fail(403, 'FORBIDDEN', 'You do not have permission to do that.');
      }),
    );
    renderModal(<EditApiKeyScopesModal apiKey={KEY} onClose={() => {}} />);
    await user.click(screen.getByRole('checkbox', { name: /read drivers/i }));
    const save = screen.getByRole('button', { name: 'Save scopes' });
    await user.click(save);
    await user.click(save);
    await waitFor(() => expect(calls).toBe(1));
    release();
    expect(await screen.findByRole('alert')).toHaveTextContent(/\S/);
    expect(screen.queryByText(/Scopes updated/)).not.toBeInTheDocument();
  });
});
