// QA fix — the W-16 `+ New` driver list offers ACTIVE drivers only (`GET /drivers?status=ACTIVE`).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { resetAuthBridge, setAccessToken, setAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import { NewConversationModal } from './NewConversationModal';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
});
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
});
afterAll(() => server.close());

describe('NewConversationModal — driver list', () => {
  it('requests and shows ACTIVE drivers only', async () => {
    const statuses: (string | null)[] = [];
    server.use(
      http.get(url(endpoints.drivers.list), ({ request }) => {
        const status = new URL(request.url).searchParams.get('status');
        statuses.push(status);
        const all = [
          { id: 'drv_1', username: 'jsmith', firstName: 'John', lastName: 'Smith', status: 'ACTIVE', homeTerminalName: 'Columbus, OH' },
          { id: 'drv_2', username: 'otimer', firstName: 'Old', lastName: 'Timer', status: 'INACTIVE', homeTerminalName: 'Columbus, OH' },
        ];
        const items = status ? all.filter((d) => d.status === status) : all;
        return ok({ items, page: 1, limit: 50, total: items.length, totalPages: 1 });
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <NewConversationModal onClose={vi.fn()} onCreated={vi.fn()} />
        </ToastProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/John Smith/)).toBeInTheDocument();
    expect(screen.queryByText(/Old Timer/)).not.toBeInTheDocument();
    expect(statuses.every((s) => s === 'ACTIVE')).toBe(true);
  });
});

// "Group" tab — a named GROUP conversation with ≥ 2 drivers (`POST /conversations` `{ type: 'GROUP' }`).
describe('NewConversationModal — Group tab', () => {
  const GROUP_DRIVERS = [
    { id: 'drv_1', username: 'jsmith', firstName: 'John', lastName: 'Smith', status: 'ACTIVE', homeTerminalName: 'Columbus, OH' },
    { id: 'drv_2', username: 'mgarcia', firstName: 'Maria', lastName: 'Garcia', status: 'ACTIVE', homeTerminalName: 'Columbus, OH' },
    { id: 'drv_3', username: 'blee', firstName: 'Bruce', lastName: 'Lee', status: 'ACTIVE', homeTerminalName: 'Columbus, OH' },
  ];

  function useGroupDrivers() {
    server.use(
      http.get(url(endpoints.drivers.list), () =>
        ok({ items: GROUP_DRIVERS, page: 1, limit: 50, total: GROUP_DRIVERS.length, totalPages: 1 }),
      ),
    );
  }

  function renderModal() {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <NewConversationModal onClose={onClose} onCreated={onCreated} />
        </ToastProvider>
      </QueryClientProvider>,
    );
    return { onClose, onCreated };
  }

  async function openGroupTab(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Group' }));
    await screen.findByText('John Smith');
  }

  const nameInput = () => screen.getByRole('textbox', { name: /Group name/ });
  const createButton = () => screen.getByRole('button', { name: 'Create group' });
  const driverButton = (name: string) => screen.getByRole('button', { name: new RegExp(`${name}$`) });

  it('renders the group name input, the selection hint and the driver list', async () => {
    useGroupDrivers();
    const user = userEvent.setup();
    renderModal();

    expect(screen.queryByRole('textbox', { name: /Group name/ })).not.toBeInTheDocument();
    await openGroupTab(user);

    expect(screen.getByRole('button', { name: 'Group' })).toHaveAttribute('aria-pressed', 'true');
    expect(nameInput()).toBeInTheDocument();
    expect(nameInput()).toHaveAttribute('maxLength', '200');
    expect(screen.getByText('0 selected · pick at least 2 drivers')).toBeInTheDocument();
    expect(driverButton('John Smith')).toBeInTheDocument();
    expect(driverButton('Maria Garcia')).toBeInTheDocument();
    expect(driverButton('Bruce Lee')).toBeInTheDocument();
    expect(createButton()).toBeDisabled();
  });

  it('keeps Create disabled without a name or with fewer than 2 drivers, enables it with both', async () => {
    useGroupDrivers();
    const user = userEvent.setup();
    renderModal();
    await openGroupTab(user);

    // Two drivers, no name.
    await user.click(driverButton('John Smith'));
    await user.click(driverButton('Maria Garcia'));
    expect(screen.getByText('2 selected · pick at least 2 drivers')).toBeInTheDocument();
    expect(createButton()).toBeDisabled();

    // Name + two drivers.
    await user.type(nameInput(), 'Night shift');
    expect(createButton()).toBeEnabled();

    // Name + only one driver.
    await user.click(driverButton('Maria Garcia'));
    expect(driverButton('Maria Garcia')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('1 selected · pick at least 2 drivers')).toBeInTheDocument();
    expect(createButton()).toBeDisabled();
  });

  it('treats a whitespace-only name as empty and shows the required error on blur', async () => {
    useGroupDrivers();
    const user = userEvent.setup();
    renderModal();
    await openGroupTab(user);

    await user.click(driverButton('John Smith'));
    await user.click(driverButton('Maria Garcia'));

    // No error before the field has been touched.
    expect(screen.queryByText('Group name is required.')).not.toBeInTheDocument();
    await user.type(nameInput(), '   ');
    expect(screen.queryByText('Group name is required.')).not.toBeInTheDocument();
    await user.tab();

    expect(await screen.findByText('Group name is required.')).toBeInTheDocument();
    expect(nameInput()).toHaveAttribute('aria-invalid', 'true');
    expect(createButton()).toBeDisabled();

    await user.type(nameInput(), 'Night shift');
    expect(screen.queryByText('Group name is required.')).not.toBeInTheDocument();
    expect(nameInput()).toHaveAttribute('aria-invalid', 'false');
    expect(createButton()).toBeEnabled();
  });

  it('submits { type: GROUP, trimmed title, driverIds }, calls onCreated(id, GROUP) and toasts', async () => {
    useGroupDrivers();
    const bodies: unknown[] = [];
    server.use(
      http.post(url(endpoints.conversations.create), async ({ request }) => {
        bodies.push(await request.json());
        return ok(
          {
            id: 'cnv_grp',
            type: 'GROUP',
            title: 'Night shift',
            lastMessageAt: null,
            createdById: 'usr_1',
            createdAt: '2026-09-12T16:00:00.000Z',
            participants: [],
          },
          201,
        );
      }),
    );
    const user = userEvent.setup();
    const { onClose, onCreated } = renderModal();
    await openGroupTab(user);

    await user.type(nameInput(), '  Night shift  ');
    await user.click(driverButton('John Smith'));
    await user.click(driverButton('Bruce Lee'));
    await user.click(createButton());

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('cnv_grp', 'GROUP'));
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
    expect(bodies).toEqual([{ type: 'GROUP', title: 'Night shift', driverIds: ['drv_1', 'drv_3'] }]);
    expect(await screen.findByText('Group created')).toBeInTheDocument();
  });

  it('shows an error toast and does not call onCreated when the create fails', async () => {
    useGroupDrivers();
    let posts = 0;
    server.use(
      http.post(url(endpoints.conversations.create), () => {
        posts += 1;
        return HttpResponse.json({ statusCode: 422, code: 'VALIDATION_FAILED', message: 'Invalid' }, { status: 422 });
      }),
    );
    const user = userEvent.setup();
    const { onClose, onCreated } = renderModal();
    await openGroupTab(user);

    await user.type(nameInput(), 'Night shift');
    await user.click(driverButton('John Smith'));
    await user.click(driverButton('Maria Garcia'));
    await user.click(createButton());

    // The toast region sits outside the dialog (Radix aria-hides it), so match by text + role attr.
    const toast = await screen.findByText('Check the highlighted fields and try again.');
    expect(toast.closest('[role="alert"]')).not.toBeNull();
    expect(posts).toBe(1);
    expect(onCreated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText('Group created')).not.toBeInTheDocument();
    // The form stays open with the user's input intact.
    expect(nameInput()).toHaveValue('Night shift');
  });

  it('a typed group name makes the form dirty: Cancel raises the discard confirm', async () => {
    useGroupDrivers();
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await openGroupTab(user);

    await user.type(nameInput(), 'Night shift');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(await screen.findByDisplayValue('Night shift')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a whitespace-only group name is not dirty: Cancel closes straight away', async () => {
    useGroupDrivers();
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await openGroupTab(user);

    await user.type(nameInput(), '   ');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
  });
});
