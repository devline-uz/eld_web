// web/tz.md §11.18 — role selection, the 409 conflict message, and the exact invite request body.
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
import { InviteUserModal } from './InviteUserModal';

const ROLES = [
  { id: 'rol_admin', key: 'ADMIN', name: 'Admin', isSystem: true, permissions: {}, userCount: 3 },
  {
    id: 'rol_fm',
    key: 'FLEET_MANAGER',
    name: 'Fleet manager',
    isSystem: true,
    permissions: {},
    userCount: 5,
  },
  {
    id: 'rol_disp',
    key: 'DISPATCHER',
    name: 'Dispatcher',
    isSystem: true,
    permissions: {},
    userCount: 3,
  },
  { id: 'rol_view', key: 'VIEWER', name: 'Viewer', isSystem: true, permissions: {}, userCount: 1 },
] as never;

/** `GET /roles` answers the envelope `{ data: Role[] }` — `client.ts` unwraps it. */
function serveRoles(roles: unknown) {
  server.use(http.get(url(endpoints.roles.list), () => ok(roles)));
}

function renderModal(onClose = vi.fn(), roles: unknown = ROLES) {
  if (roles !== null) serveRoles(roles);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    onClose,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <InviteUserModal onClose={onClose} />
        </ToastProvider>
      </QueryClientProvider>,
    ),
  };
}

/** Resolves once the role cards have rendered from the async `GET /roles`. */
async function rolesReady() {
  await screen.findByRole('radio', { name: /Dispatcher/ });
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

describe('InviteUserModal — 11.18', () => {
  it('defaults to Dispatcher selected and Fleet manager selectable', async () => {
    const user = userEvent.setup();
    renderModal();
    await rolesReady();
    expect(screen.getByText('Dispatcher').closest('button')).toHaveClass('border-primary');
    expect(screen.getByText('Fleet manager').closest('button')).not.toHaveClass('border-primary');

    await user.click(screen.getByText('Fleet manager'));
    expect(screen.getByText('Fleet manager').closest('button')).toHaveClass('border-primary');
  });

  it('sends the invite with the selected role id and shows the sent toast', async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    server.use(
      http.post(url(endpoints.users.create), async ({ request }) => {
        body = await request.json();
        return ok({ user: { id: 'usr_9', status: 'INVITED' }, emailDelivered: true }, 201);
      }),
    );

    renderModal();

    await rolesReady();
    await user.click(screen.getByText('Fleet manager'));
    await user.type(screen.getByPlaceholderText('Anna Weiss'), 'Anna Weiss');
    await user.type(
      screen.getByPlaceholderText('anna.weiss@example.com'),
      'anna.weiss@example.com',
    );
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      email: 'anna.weiss@example.com',
      firstName: 'Anna',
      lastName: 'Weiss',
      roleId: 'rol_fm',
    });
    expect(await screen.findByText('Invitation sent')).toBeInTheDocument();
  });

  it('says the email was not sent when the server could not deliver it', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(url(endpoints.users.create), () =>
        ok({ user: { id: 'usr_9', status: 'INVITED' }, emailDelivered: false }, 201),
      ),
    );

    renderModal();

    await rolesReady();
    await user.type(screen.getByPlaceholderText('Anna Weiss'), 'Anna Weiss');
    await user.type(
      screen.getByPlaceholderText('anna.weiss@example.com'),
      'anna.weiss@example.com',
    );
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(await screen.findByText('User invited — email not sent')).toBeInTheDocument();
    expect(screen.queryByText('Invitation sent')).not.toBeInTheDocument();
  });

  it('maps a 409 conflict onto the email field', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(url(endpoints.users.create), () =>
        fail(409, 'CONFLICT', 'A user with this email already exists.'),
      ),
    );

    renderModal();

    await rolesReady();
    await user.type(screen.getByPlaceholderText('Anna Weiss'), 'Anna Weiss');
    await user.type(
      screen.getByPlaceholderText('anna.weiss@example.com'),
      'anna.weiss@example.com',
    );
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(await screen.findByText('A user with this email already exists.')).toBeInTheDocument();
  });

  it('maps a 422 field error onto the matching input', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(url(endpoints.users.create), () =>
        fail(422, 'VALIDATION_FAILED', 'Check the highlighted fields and try again.', {
          fields: { email: 'Enter a valid email address.' },
        }),
      ),
    );

    renderModal();

    await rolesReady();
    await user.type(screen.getByPlaceholderText('Anna Weiss'), 'Anna Weiss');
    await user.type(
      screen.getByPlaceholderText('anna.weiss@example.com'),
      'anna.weiss@example.com',
    );
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
  });

  it('shows a generic error toast and an in-modal banner for a non-conflict failure', async () => {
    const user = userEvent.setup();
    server.use(http.post(url(endpoints.users.create), () => fail(500, 'INTERNAL_ERROR', 'Boom')));

    renderModal();

    await rolesReady();
    await user.type(screen.getByPlaceholderText('Anna Weiss'), 'Anna Weiss');
    await user.type(
      screen.getByPlaceholderText('anna.weiss@example.com'),
      'anna.weiss@example.com',
    );
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    // Visible twice on purpose: the toast (§13.3) and the banner inside the modal (rule 6).
    expect(await screen.findAllByText('Something went wrong on our side. Try again.')).toHaveLength(
      2,
    );
  });

  it('closes through the discard-changes confirmation once the form is dirty', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);
    await rolesReady();
    await user.type(screen.getByPlaceholderText('Anna Weiss'), 'Anna');
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('InviteUserModal — role error, double submit and dirty close', () => {
  // Only ADMIN in the list: ADMIN is never the default, so `roleKey` starts empty and
  // validation rejects the submit.
  const ROLES_WITHOUT_DEFAULT = [
    { id: 'rol_admin', key: 'ADMIN', name: 'Admin', isSystem: true, permissions: {}, userCount: 1 },
  ] as never;

  async function renderWithRoles(roles: typeof ROLES_WITHOUT_DEFAULT) {
    const result = renderModal(vi.fn(), roles);
    await screen.findByRole('radio', { name: /Admin/ });
    return result;
  }

  it('shows the role error under the role group instead of failing silently', async () => {
    const user = userEvent.setup();
    let posted = 0;
    server.use(
      http.post(url(endpoints.users.create), () => {
        posted += 1;
        return ok({}, 201);
      }),
    );

    await renderWithRoles(ROLES_WITHOUT_DEFAULT);
    await user.type(screen.getByPlaceholderText('Anna Weiss'), 'Anna Weiss');
    await user.type(
      screen.getByPlaceholderText('anna.weiss@example.com'),
      'anna.weiss@example.com',
    );
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    const error = await screen.findByText('This field is required.');
    expect(error).toHaveAttribute('id', 'invite-role-error');
    const group = screen.getByRole('radiogroup');
    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(group).toHaveAttribute('aria-describedby', 'invite-role-error');
    expect(posted).toBe(0);
  });

  it('sends exactly one invitation on a double click', async () => {
    const user = userEvent.setup();
    const posts: unknown[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    server.use(
      http.post(url(endpoints.users.create), async ({ request }) => {
        posts.push(await request.json());
        await gate;
        return ok({ user: { id: 'usr_9', status: 'INVITED' }, emailDelivered: true }, 201);
      }),
    );

    renderModal();

    await rolesReady();
    await user.type(screen.getByPlaceholderText('Anna Weiss'), 'Anna Weiss');
    await user.type(
      screen.getByPlaceholderText('anna.weiss@example.com'),
      'anna.weiss@example.com',
    );
    const send = screen.getByRole('button', { name: 'Send invitation' });
    await user.click(send);
    await user.click(send);

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts).toHaveLength(1);
    release();
  });

  it('closes an untouched form with no confirm, and confirms from Cancel once edited', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await rolesReady();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it('routes Cancel through the discard confirm once the form is dirty', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await rolesReady();
    await user.type(screen.getByPlaceholderText('Anna Weiss'), 'Anna');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ stage-2 (B-85) */

describe('InviteUserModal — Terminal access and Message (B-85, shipped)', () => {
  it('sends typed terminalIds (one per line) and a trimmed message', async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    server.use(
      http.post(url(endpoints.users.create), async ({ request }) => {
        body = await request.json();
        return ok({ user: { id: 'usr_1' }, emailDelivered: true }, 201);
      }),
    );
    renderModal();
    await rolesReady();
    await user.type(screen.getByPlaceholderText('Anna Weiss'), 'Anna Weiss');
    await user.type(
      screen.getByPlaceholderText('anna.weiss@example.com'),
      'anna.weiss@example.com',
    );
    await user.type(screen.getByPlaceholderText('One terminal per line'), 'Dayton, OH');
    await user.type(screen.getByRole('textbox', { name: /message/i }), 'Welcome aboard!');
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ terminalIds: ['Dayton, OH'], message: 'Welcome aboard!' });
  });
});

/* ------------------------------------------------------------------ roles loading / missing */

describe('InviteUserModal — role picker states', () => {
  const FILL = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByPlaceholderText('Anna Weiss'), 'Anna Weiss');
    await user.type(
      screen.getByPlaceholderText('anna.weiss@example.com'),
      'anna.weiss@example.com',
    );
  };
  const NO_ROLES =
    'No roles are configured. Create a role under Roles & permissions, then invite the user.';
  // The dev DB shape (onebook_eld_dev, 2026-09-27): ADMIN plus custom roles only.
  const DEV_ROLES = [
    {
      id: 'rol_admin',
      key: 'ADMIN',
      name: 'Admin',
      description: null,
      isSystem: true,
      permissions: {},
    },
    {
      id: 'rol_fmx',
      key: 'FLEET_MENEGER',
      name: 'Fleet meneger',
      description: null,
      isSystem: false,
      permissions: {},
    },
    {
      id: 'rol_qa_aud',
      key: 'QA_AUDITOR',
      name: 'QA Auditor',
      description: 'Mock role for QA — read-only compliance review',
      isSystem: false,
      permissions: {},
    },
    {
      id: 'rol_qa_night',
      key: 'QA_NIGHT_DISPATCH',
      name: 'QA Night Dispatch',
      description: 'Mock role for QA — overnight dispatch desk (edited)',
      isSystem: false,
      permissions: {},
    },
  ];

  it('offers every role from GET /roles with its API name and description, ADMIN last', async () => {
    renderModal(vi.fn(), DEV_ROLES);
    await screen.findByRole('radio', { name: /QA Auditor/ });
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.querySelector('p')?.textContent)).toEqual([
      'Fleet meneger',
      'QA Auditor',
      'QA Night Dispatch',
      'Admin',
    ]);
    expect(screen.getByText('Mock role for QA — read-only compliance review')).toBeInTheDocument();
    // No API description on a built-in key → the fallback copy; a custom key has none.
    expect(
      screen.getByText('Full access, including users, roles and company settings'),
    ).toBeInTheDocument();
    expect(screen.queryByText(NO_ROLES)).not.toBeInTheDocument();
  });

  it('uses the API name over the built-in copy, matching padded/lowercase keys', async () => {
    renderModal(vi.fn(), [
      { id: 'rol_admin', key: 'ADMIN', name: 'Administrators', isSystem: true, permissions: {} },
      { id: 'rol_fm', key: ' fleet_manager ', name: 'Fleet ops', isSystem: true, permissions: {} },
      { id: 'rol_disp', key: 'Dispatcher', name: 'Dispatch desk', isSystem: true, permissions: {} },
    ]);
    const disp = await screen.findByRole('radio', { name: /Dispatch desk/ });
    expect(disp).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Fleet ops')).toBeInTheDocument();
    // Description falls back to ROLE_COPY for the built-in key.
    expect(
      screen.getByText('Full access to vehicles, drivers, HOS and maintenance'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('radio').at(-1)).toHaveTextContent('Administrators');
  });

  it('defaults to the first non-ADMIN role when DISPATCHER is missing', async () => {
    renderModal(vi.fn(), DEV_ROLES);
    const first = await screen.findByRole('radio', { name: /Fleet meneger/ });
    expect(first).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Admin/ })).toHaveAttribute('aria-checked', 'false');
  });

  it('sends the chosen custom role id as roleId', async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    server.use(
      http.post(url(endpoints.users.create), async ({ request }) => {
        body = await request.json();
        return ok({ user: { id: 'usr_9', status: 'INVITED' }, emailDelivered: true }, 201);
      }),
    );
    renderModal(vi.fn(), DEV_ROLES);
    await user.click(await screen.findByRole('radio', { name: /QA Night Dispatch/ }));
    await FILL(user);
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ roleId: 'rol_qa_night' });
  });

  it('shows the empty state only when GET /roles returns no roles, and blocks the submit', async () => {
    const user = userEvent.setup();
    let posted = 0;
    server.use(
      http.post(url(endpoints.users.create), () => {
        posted += 1;
        return ok({}, 201);
      }),
    );
    renderModal(vi.fn(), []);
    expect(await screen.findByText(NO_ROLES)).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();

    await FILL(user);
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));
    await waitFor(() => expect(screen.getByText(NO_ROLES)).toHaveAttribute('role', 'alert'));
    expect(screen.getAllByText(NO_ROLES)).toHaveLength(1);
    expect(screen.queryByText('This field is required.')).not.toBeInTheDocument();
    expect(posted).toBe(0);
  });

  it('shows a skeleton while roles load, then defaults to Dispatcher without dirtying the form', async () => {
    const user = userEvent.setup();
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    server.use(
      http.get(url(endpoints.roles.list), async () => {
        await gate;
        return ok(ROLES);
      }),
    );
    const onClose = vi.fn();
    renderModal(onClose, null);
    expect(screen.getByTestId('invite-role-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();

    release();
    await rolesReady();
    expect(screen.queryByTestId('invite-role-skeleton')).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Dispatcher/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    // The default alone does not make the form dirty: Cancel closes with no confirm.
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it('sends the async-loaded Dispatcher default as roleId', async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    server.use(
      http.post(url(endpoints.users.create), async ({ request }) => {
        body = await request.json();
        return ok({ user: { id: 'usr_9', status: 'INVITED' }, emailDelivered: true }, 201);
      }),
    );
    renderModal();
    await rolesReady();
    await FILL(user);
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ roleId: 'rol_disp' });
  });

  it('a user pick replaces the Dispatcher default', async () => {
    const user = userEvent.setup();
    renderModal();
    await rolesReady();
    await user.click(screen.getByRole('radio', { name: /Viewer/ }));
    expect(screen.getByRole('radio', { name: /Viewer/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Dispatcher/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('shows an inline error with Retry that refetches the roles', async () => {
    const user = userEvent.setup();
    let calls = 0;
    server.use(
      http.get(url(endpoints.roles.list), () => {
        calls += 1;
        // A non-transient status: client.ts retries 5xx GETs itself (1 s, 3 s).
        return calls === 1 ? fail(404, 'NOT_FOUND', 'Not found') : ok(ROLES);
      }),
    );
    renderModal(vi.fn(), null);
    expect(await screen.findByText('Could not load roles.')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await rolesReady();
    expect(calls).toBe(2);
    expect(screen.queryByText('Could not load roles.')).not.toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('maps a 422 on roleId onto the role field', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(url(endpoints.users.create), () =>
        fail(422, 'VALIDATION_FAILED', 'Check the highlighted fields and try again.', {
          fields: { roleId: 'This role cannot be invited.' },
        }),
      ),
    );
    renderModal();
    await rolesReady();
    await FILL(user);
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    const error = await screen.findByText('This role cannot be invited.');
    expect(error).toHaveAttribute('id', 'invite-role-error');
    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-invalid', 'true');
  });
});
