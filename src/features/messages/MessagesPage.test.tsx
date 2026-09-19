// web/tz.md §10 W-16 — three panes, the exact empty-state copy, optimistic send with a `clientId`,
// and `message.new` patching the open thread via `useRoom` (no polling, `staleTime: 0`).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import * as RealtimeProviderModule from '@/shared/realtime/RealtimeProvider';
import MessagesPage from './MessagesPage';

vi.mock('@/shared/auth/usePermission', () => ({ usePermission: () => ({ can: () => true }) }));
vi.mock('@/shared/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'usr_1', fullName: 'Sarah Chen' } }) }));

function fakeSocket() {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  return {
    emit: vi.fn((event: string, ...args: unknown[]) => {
      if (event === 'subscribe') {
        const [, ack] = args as [string, (a: { ok: boolean }) => void];
        ack({ ok: true });
      }
    }),
    on: vi.fn((event: string, listener: (payload: unknown) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
    }),
    off: vi.fn((event: string, listener: (payload: unknown) => void) => {
      listeners.get(event)?.delete(listener);
    }),
    trigger(event: string, payload: unknown) {
      listeners.get(event)?.forEach((l) => l(payload));
    },
  };
}

/** Renders the current router location so the `?driverId=` clean-up can be asserted. */
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPage(socket: ReturnType<typeof fakeSocket> | null = null, initialEntries: string[] = ['/messages']) {
  vi.spyOn(RealtimeProviderModule, 'useRealtime').mockReturnValue({
    getSocket: () => socket as never,
    connected: Boolean(socket),
    isOffline: false,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <StrictMode>
            <MessagesPage />
          </StrictMode>
          <LocationProbe />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
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

const DRIVER = {
  id: 'drv_1',
  username: 'johnsmith',
  firstName: 'John',
  lastName: 'Smith',
  email: 'john.smith@example.com',
  phone: null,
  cdlNumber: 'W8569238',
  cdlState: 'OH',
  status: 'ACTIVE',
  homeTerminalName: 'Columbus, OH',
  homeTerminalTimezone: 'America/New_York',
  fleetManagerId: null,
  assignedVehicleId: 'veh_1',
  allowPersonalConveyance: true,
  allowYardMove: true,
  adverseDrivingEnabled: false,
  shortHaulException: false,
  splitSleeperEnabled: false,
  eldExempt: false,
  eldExemptReason: null,
  appVersion: 'v2.24',
  appPlatform: 'Android',
  registeredAt: '2025-04-18T00:00:00.000Z',
};

const CONVERSATION = {
  id: 'cnv_1',
  type: 'DIRECT',
  title: null,
  lastMessageAt: '2026-09-12T15:39:00.000Z',
  createdById: 'usr_1',
  createdAt: '2026-09-10T09:00:00.000Z',
  participants: [
    { id: 'cp_1', conversationId: 'cnv_1', userId: 'usr_1', driverId: null, lastReadAt: null, mutedUntil: null },
    { id: 'cp_2', conversationId: 'cnv_1', userId: null, driverId: 'drv_1', lastReadAt: null, mutedUntil: null },
  ],
};

function usePopulatedConversations() {
  server.use(
    http.get(url(endpoints.conversations.list), () => ok({ items: [CONVERSATION] })),
    http.get(url(endpoints.drivers.list), () => ok({ items: [DRIVER], page: 1, limit: 500, total: 1, totalPages: 1 })),
    http.get(url(endpoints.conversations.messages(':id')), () =>
      ok({
        items: [
          {
            id: 'msg_1',
            conversationId: 'cnv_1',
            senderUserId: null,
            senderDriverId: 'drv_1',
            body: 'On schedule.',
            attachmentId: null,
            clientId: null,
            sentAt: '2026-09-12T15:00:00.000Z',
            deliveredAt: null,
            readAt: null,
          },
        ],
        page: 1,
        limit: 100,
        total: 1,
        totalPages: 1,
      }),
    ),
  );
}

describe('W-16 Messages', () => {
  it('renders the exact §13.2 empty-state copy when there are no conversations', async () => {
    server.use(
      http.get(url(endpoints.conversations.list), () => ok({ items: [] })),
      http.get(url(endpoints.drivers.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })),
    );

    renderPage();

    expect(await screen.findByText('No conversations yet')).toBeInTheDocument();
    expect(screen.getByText('Start a conversation with a driver or send a broadcast to the fleet.')).toBeInTheDocument();
  });

  it('renders the three panes and opens a conversation on click', async () => {
    usePopulatedConversations();
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Conversations')).toBeInTheDocument();
    await user.click(await screen.findByText('John Smith'));

    expect(await screen.findByText('On schedule.')).toBeInTheDocument();
    // three panes: left list, middle thread, right context (driver name repeated in both)
    expect(screen.getAllByText('John Smith').length).toBeGreaterThanOrEqual(2);
  });

  it('sends a message optimistically with a clientId', async () => {
    usePopulatedConversations();
    let capturedClientId: string | undefined;
    server.use(
      http.post(url(endpoints.conversations.sendMessage(':id')), async ({ request }) => {
        const body = (await request.json()) as { body: string; clientId?: string };
        capturedClientId = body.clientId;
        return ok({
          id: 'msg_2',
          conversationId: 'cnv_1',
          senderUserId: 'usr_1',
          senderDriverId: null,
          body: body.body,
          attachmentId: null,
          clientId: body.clientId ?? null,
          sentAt: new Date().toISOString(),
          deliveredAt: null,
          readAt: null,
        });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText('John Smith'));
    await screen.findByText('On schedule.');

    const composer = screen.getByPlaceholderText('Write a message to John Smith…');
    await user.type(composer, 'Ten-four{Enter}');

    expect(await screen.findByText('Ten-four')).toBeInTheDocument();
    expect(capturedClientId).toBeTruthy();
  });

  it('subscribes to `conversation:{id}` on open and appends a `message.new` push instantly (no polling)', async () => {
    usePopulatedConversations();
    const socket = fakeSocket();
    const user = userEvent.setup();
    renderPage(socket);

    await user.click(await screen.findByText('John Smith'));
    await screen.findByText('On schedule.');

    expect(socket.emit).toHaveBeenCalledWith('subscribe', 'conversation:cnv_1', expect.any(Function));

    socket.trigger('message.new', {
      message: {
        id: 'msg_9',
        conversationId: 'cnv_1',
        senderUserId: null,
        senderDriverId: 'drv_1',
        body: 'Pulling in now.',
        attachmentId: null,
        clientId: null,
        sentAt: new Date().toISOString(),
        deliveredAt: null,
        readAt: null,
      },
    });

    expect(await screen.findByText('Pulling in now.')).toBeInTheDocument();
  });

  it('marks a failed send with a red-border/Retry state, never left looking delivered (WB-116)', async () => {
    usePopulatedConversations();
    let attempts = 0;
    server.use(
      http.post(url(endpoints.conversations.sendMessage(':id')), async ({ request }) => {
        attempts += 1;
        const body = (await request.json()) as { body: string; clientId?: string };
        if (attempts === 1) {
          return HttpResponse.json({ statusCode: 500, code: 'INTERNAL', message: 'Boom' }, { status: 500 });
        }
        return ok({
          id: 'msg_retry',
          conversationId: 'cnv_1',
          senderUserId: 'usr_1',
          senderDriverId: null,
          body: body.body,
          attachmentId: null,
          clientId: body.clientId ?? null,
          sentAt: new Date().toISOString(),
          deliveredAt: null,
          readAt: null,
        });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText('John Smith'));
    await screen.findByText('On schedule.');

    const composer = screen.getByPlaceholderText('Write a message to John Smith…');
    await user.type(composer, 'Delivering late{Enter}');

    // Still in the thread, but flagged failed with a Retry action — never indistinguishable
    // from a delivered message.
    expect(await screen.findByText('Delivering late')).toBeInTheDocument();
    expect(await screen.findByText('Not delivered.')).toBeInTheDocument();
    const retryButton = await screen.findByRole('button', { name: 'Retry' });

    await user.click(retryButton);

    await waitFor(() => expect(screen.queryByText('Not delivered.')).not.toBeInTheDocument());
    expect(attempts).toBe(2);
    expect(screen.getByText('Delivering late')).toBeInTheDocument();
  });

  it('clears the unread dot and the Unread segment count on opening a conversation (WB-117)', async () => {
    usePopulatedConversations();
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('John Smith');
    // CONVERSATION's usr_1 participant has `lastReadAt: null` and a real `lastMessageAt` — unread.
    expect(screen.getByLabelText('Unread')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unread 1' })).toBeInTheDocument();

    await user.click(screen.getByText('John Smith'));
    await screen.findByText('On schedule.');

    await waitFor(() => expect(screen.queryByLabelText('Unread')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Unread 0' })).toBeInTheDocument();
  });

  describe('deep link ?driverId= (WB-139, every "Send message" entry point)', () => {
    const DRIVER_2 = { ...DRIVER, id: 'drv_2', username: 'mariagarcia', firstName: 'Maria', lastName: 'Garcia' };
    const CREATED = {
      id: 'cnv_new',
      type: 'DIRECT',
      title: null,
      lastMessageAt: null,
      createdById: 'usr_1',
      createdAt: '2026-09-12T16:00:00.000Z',
      participants: [
        { id: 'cp_9', conversationId: 'cnv_new', userId: 'usr_1', driverId: null, lastReadAt: null, mutedUntil: null },
        { id: 'cp_10', conversationId: 'cnv_new', userId: null, driverId: 'drv_2', lastReadAt: null, mutedUntil: null },
      ],
    };

    it('opens the existing conversation with that driver, creates nothing and drops the param', async () => {
      usePopulatedConversations();
      let creates = 0;
      server.use(
        http.post(url(endpoints.conversations.create), () => {
          creates += 1;
          return ok(CREATED, 201);
        }),
      );
      renderPage(null, ['/messages?driverId=drv_1']);

      expect(await screen.findByText('On schedule.')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Write a message to John Smith…')).toBeInTheDocument();
      await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/messages$/));
      expect(creates).toBe(0);
    });

    it('starts a new DIRECT conversation exactly once (StrictMode) when none exists, and selects it', async () => {
      let created = false;
      const bodies: unknown[] = [];
      server.use(
        http.get(url(endpoints.conversations.list), () => ok({ items: created ? [CREATED, CONVERSATION] : [CONVERSATION] })),
        http.get(url(endpoints.drivers.list), () => ok({ items: [DRIVER, DRIVER_2], page: 1, limit: 500, total: 2, totalPages: 1 })),
        http.get(url(endpoints.conversations.messages(':id')), () => ok({ items: [], page: 1, limit: 100, total: 0, totalPages: 1 })),
        http.post(url(endpoints.conversations.create), async ({ request }) => {
          bodies.push(await request.json());
          created = true;
          return ok(CREATED, 201);
        }),
      );
      renderPage(null, ['/messages?driverId=drv_2']);

      expect(await screen.findByPlaceholderText('Write a message to Maria Garcia…')).toBeInTheDocument();
      await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/messages$/));
      expect(bodies).toEqual([{ type: 'DIRECT', driverIds: ['drv_2'] }]);
    });

    it('an unknown driverId shows "Driver not found." and creates nothing', async () => {
      usePopulatedConversations();
      let creates = 0;
      server.use(
        http.get(url(endpoints.drivers.detail(':id')), () =>
          HttpResponse.json({ statusCode: 404, code: 'DRIVER_NOT_FOUND', message: 'Driver not found' }, { status: 404 }),
        ),
        http.post(url(endpoints.conversations.create), () => {
          creates += 1;
          return ok(CREATED, 201);
        }),
      );
      renderPage(null, ['/messages?driverId=drv_nope']);

      expect(await screen.findByText('Driver not found.')).toBeInTheDocument();
      await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/messages$/));
      expect(screen.getByText('Select a conversation')).toBeInTheDocument();
      expect(creates).toBe(0);
    });
  });

  it('error: renders <ErrorState> with Retry when the list fails', async () => {
    server.use(
      http.get(url(endpoints.conversations.list), () =>
        HttpResponse.json({ statusCode: 404, code: 'NOT_FOUND', message: 'Not found' }, { status: 404 }),
      ),
    );
    renderPage();
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
