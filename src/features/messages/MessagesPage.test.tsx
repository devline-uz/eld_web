// web/tz.md §10 W-16 — three panes, the exact empty-state copy, optimistic send with a `clientId`,
// and `message.new` patching the open thread via `useRoom` (no polling, `staleTime: 0`).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
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

function renderPage(socket: ReturnType<typeof fakeSocket> | null = null) {
  vi.spyOn(RealtimeProviderModule, 'useRealtime').mockReturnValue({
    getSocket: () => socket as never,
    connected: Boolean(socket),
    isOffline: false,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <MessagesPage />
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
