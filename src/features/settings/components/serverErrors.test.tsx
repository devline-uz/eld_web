// owner: web-settings-admin — no Settings form fails silently. A 400/422 lands on the field it is
// about, anything the form has no field for is spelled out (labelled) in a banner/toast instead of
// the bare "Check the highlighted fields and try again.", and the DTO limits are checked before
// sending.
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
import type { DeviceRow, RoleRow, UserRow } from '@/shared/api/settingsAdmin';
import { CreateRoleModal } from './CreateRoleModal';
import { EditUserModal } from './EditUserModal';
import { NewAlertRuleModal } from './NewAlertRuleModal';
import { CreateApiKeyModal } from './CreateApiKeyModal';
import { RegisterDeviceModal } from './RegisterDeviceModal';
import { WebhookConfigModal } from './WebhookConfigModal';
import { UpdateFirmwareModal } from './UpdateFirmwareModal';

vi.mock('@/shared/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'me', email: 'me@example.com', roleKey: 'SUPER_ADMIN' } }),
}));

const GENERIC = 'Check the highlighted fields and try again.';

function renderModal(children: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>,
  );
}

function issues(...list: Array<[string, string]>) {
  return { issues: list.map(([path, message]) => ({ path: path.split('.'), code: 'custom', message })) };
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

describe('CreateRoleModal', () => {
  it('puts a 422 on the name under the field and spells out the rest in the banner', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(url(endpoints.roles.create), () =>
        fail(422, 'VALIDATION_FAILED', 'Validation failed', issues(['name', 'Name is taken'], ['permissions', 'Unknown permission key'])),
      ),
    );
    renderModal(<CreateRoleModal templates={[]} onClose={() => {}} />);
    await user.type(screen.getByPlaceholderText('Compliance auditor'), 'Auditor');
    await user.click(screen.getByRole('button', { name: 'Create role' }));

    expect(await screen.findByText('Name is taken')).toBeInTheDocument();
    expect(screen.getAllByText('Permissions: Unknown permission key.').length).toBeGreaterThan(0);
    expect(screen.queryByText(GENERIC)).not.toBeInTheDocument();
  });

  it('derives a key the DTO accepts from a name that starts with a digit or runs long', async () => {
    const user = userEvent.setup();
    const keys: string[] = [];
    server.use(
      http.post(url(endpoints.roles.create), async ({ request }) => {
        keys.push(((await request.json()) as { key: string }).key);
        return ok({ id: 'rol_new' }, 201);
      }),
    );
    renderModal(<CreateRoleModal templates={[]} onClose={() => {}} />);
    await user.type(screen.getByPlaceholderText('Compliance auditor'), '1st shift');
    await user.click(screen.getByRole('button', { name: 'Create role' }));
    await waitFor(() => expect(keys).toEqual(['ROLE_1ST_SHIFT']));
  });

  it('refuses a role name over 80 characters before sending', async () => {
    const user = userEvent.setup();
    let posts = 0;
    server.use(
      http.post(url(endpoints.roles.create), () => {
        posts += 1;
        return ok({ id: 'rol_new' }, 201);
      }),
    );
    renderModal(<CreateRoleModal templates={[]} onClose={() => {}} />);
    await user.click(screen.getByPlaceholderText('Compliance auditor'));
    await user.paste('R'.repeat(81));
    await user.click(screen.getByRole('button', { name: 'Create role' }));
    expect(await screen.findByText('Role name must be 80 characters or fewer.')).toBeInTheDocument();
    expect(posts).toBe(0);
  });
});

const USER: UserRow = {
  id: 'usr_5',
  email: 'jo@example.com',
  firstName: 'Jo',
  lastName: 'Park',
  status: 'ACTIVE',
  role: { id: 'rol_disp', key: 'DISPATCHER', name: 'Dispatcher' },
};
const ROLES: RoleRow[] = [
  { id: 'rol_disp', key: 'DISPATCHER', name: 'Dispatcher', isSystem: true, permissions: { ...NO_PERMISSIONS } },
  { id: 'rol_fm', key: 'FLEET_MANAGER', name: 'Fleet manager', isSystem: true, permissions: { ...NO_PERMISSIONS } },
];

describe('EditUserModal', () => {
  it('maps every profile issue onto its field and labels an unplaced one', async () => {
    const user = userEvent.setup();
    server.use(
      http.patch(url(endpoints.users.update('usr_5')), () =>
        fail(422, 'VALIDATION_FAILED', 'Validation failed', issues(['jobTitle', 'Too long'], ['roleId', 'Invalid uuid'])),
      ),
    );
    const onClose = vi.fn();
    renderModal(<EditUserModal user={USER} roles={ROLES} mode="profile" activeAdminCount={2} onClose={onClose} />);
    await user.clear(screen.getByDisplayValue('Jo'));
    await user.type(screen.getByRole('textbox', { name: /first name/i }), 'Joanna');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Too long')).toBeInTheDocument();
    expect(screen.getByText('Role: Invalid uuid.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('refuses a home terminal longer than the DTO allows', async () => {
    const user = userEvent.setup();
    renderModal(<EditUserModal user={USER} roles={ROLES} mode="profile" activeAdminCount={2} onClose={() => {}} />);
    await user.click(screen.getByRole('textbox', { name: /home terminal/i }));
    await user.paste('T'.repeat(121));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Home terminal must be 120 characters or fewer.')).toBeInTheDocument();
  });
});

describe('NewAlertRuleModal', () => {
  it('puts a 422 on the name and spells out recipients in the banner, no generic toast', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(url(endpoints.alertRules.create), () =>
        fail(422, 'VALIDATION_FAILED', 'Validation failed', issues(['name', 'Name is too long'], ['recipients.roles', 'Required'])),
      ),
    );
    renderModal(<NewAlertRuleModal onClose={() => {}} />);
    await user.type(screen.getByPlaceholderText('Break required soon'), 'Speeding');
    await user.click(screen.getByRole('button', { name: 'Create rule' }));

    expect(await screen.findByText('Name is too long')).toBeInTheDocument();
    expect(screen.getByText('Recipients: Required.')).toBeInTheDocument();
    expect(screen.queryByText(GENERIC)).not.toBeInTheDocument();
  });

  it('keeps the derived key within the DTO limit of 100', async () => {
    const user = userEvent.setup();
    let key = '';
    server.use(
      http.post(url(endpoints.alertRules.create), async ({ request }) => {
        key = ((await request.json()) as { key: string }).key;
        return ok({ id: 'rule_1' }, 201);
      }),
    );
    renderModal(<NewAlertRuleModal onClose={() => {}} />);
    await user.click(screen.getByPlaceholderText('Break required soon'));
    await user.paste('a'.repeat(150));
    await user.click(screen.getByRole('button', { name: 'Create rule' }));
    await waitFor(() => expect(key).toHaveLength(100));
  });
});

describe('CreateApiKeyModal', () => {
  it('asks for a scope instead of sending a request the DTO rejects', async () => {
    const user = userEvent.setup();
    let posts = 0;
    server.use(
      http.post(url(endpoints.apiKeys.create), () => {
        posts += 1;
        return ok({ plaintextKey: 'obk_x' }, 201);
      }),
    );
    renderModal(<CreateApiKeyModal onClose={() => {}} />);
    await user.type(screen.getByPlaceholderText('McLeod TMS'), 'TMS');
    await user.click(screen.getByRole('checkbox', { name: 'reports:read' }));
    await user.click(screen.getByRole('button', { name: 'Create key' }));

    expect(await screen.findByText('Choose at least one scope.')).toBeInTheDocument();
    expect(posts).toBe(0);
  });

  it('puts a 422 on the name under the field', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(url(endpoints.apiKeys.create), () =>
        fail(422, 'VALIDATION_FAILED', 'Validation failed', issues(['name', 'Name already used'])),
      ),
    );
    renderModal(<CreateApiKeyModal onClose={() => {}} />);
    await user.type(screen.getByPlaceholderText('McLeod TMS'), 'TMS');
    await user.click(screen.getByRole('button', { name: 'Create key' }));
    expect(await screen.findByText('Name already used')).toBeInTheDocument();
    expect(screen.queryByText(GENERIC)).not.toBeInTheDocument();
  });
});

describe('RegisterDeviceModal', () => {
  it('says the policy settings did not stick when the follow-up PATCH fails', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(url(endpoints.devices.create), () =>
        ok({ id: 'dev_9', serial: 'PT30_2B7F', model: 'PT30', status: 'UNASSIGNED', bleState: 'DISCONNECTED', autoFirmware: false, shareDiagnostics: false }, 201),
      ),
      http.patch(url(endpoints.devices.update('dev_9')), () => fail(500, 'INTERNAL_ERROR', 'Boom')),
    );
    renderModal(<RegisterDeviceModal onClose={() => {}} />);
    await user.click(screen.getAllByRole('switch')[0]!);
    await user.type(screen.getByPlaceholderText('PT30_1C4F'), 'PT30_2B7F');
    await user.click(screen.getByRole('button', { name: 'Register device' }));

    expect(
      await screen.findByText('Device PT30_2B7F registered, but its firmware and diagnostics settings were not saved'),
    ).toBeInTheDocument();
  });

  it('puts a 422 on the serial under the field', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(url(endpoints.devices.create), () =>
        fail(422, 'VALIDATION_FAILED', 'Validation failed', issues(['serial', 'Serial has an invalid format'])),
      ),
    );
    renderModal(<RegisterDeviceModal onClose={() => {}} />);
    await user.type(screen.getByPlaceholderText('PT30_1C4F'), 'PT30_2B7F');
    await user.click(screen.getByRole('button', { name: 'Register device' }));
    expect(await screen.findByText('Serial has an invalid format')).toBeInTheDocument();
  });
});

describe('WebhookConfigModal', () => {
  it('labels a 422 issue it has no field for instead of a bare message', async () => {
    const user = userEvent.setup();
    server.use(
      http.put(url(endpoints.integrations.update('webhook')), () =>
        fail(422, 'VALIDATION_FAILED', 'Validation failed', issues(['enabled', 'Expected boolean'])),
      ),
    );
    renderModal(<WebhookConfigModal mode="connect" name="Webhook" onClose={() => {}} />);
    await user.type(screen.getByPlaceholderText('e.g. https://example.com/hooks/onebook'), 'https://example.com/hook');
    await user.click(screen.getByRole('button', { name: 'Generate' }));
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    expect(await screen.findByText('Enabled: Expected boolean.')).toBeInTheDocument();
  });
});

describe('UpdateFirmwareModal', () => {
  it('spells out a 422 instead of the generic copy', async () => {
    const user = userEvent.setup();
    const device = { id: 'dev_1', serial: 'PT30_1', model: 'PT30', firmwareVersion: 'L112' } as DeviceRow;
    server.use(
      http.patch(url(endpoints.devices.firmware('dev_1')), () =>
        fail(422, 'VALIDATION_FAILED', 'Validation failed', issues(['firmware', 'String must contain at most 20 character(s)'])),
      ),
    );
    renderModal(<UpdateFirmwareModal device={device} onClose={() => {}} />);
    await user.type(screen.getByRole('textbox', { name: 'Target version' }), 'L113');
    await user.click(screen.getByRole('button', { name: 'Update firmware' }));
    expect(
      await screen.findByText('Target version: String must contain at most 20 character(s).'),
    ).toBeInTheDocument();
  });
});
