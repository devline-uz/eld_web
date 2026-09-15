// owner: web-realtime — connect-once, reconnect invalidation (§7.2 — no resume/seq), sign-out on
// a server-rejected token, and the offline banner/`Reconnected` toast, against a mocked socket.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/shared/ui/Toast';
import { RealtimeProvider, useIsOffline } from './RealtimeProvider';
import { useRoom } from './useRoom';

const signOut = vi.fn();
let isAuthenticated = true;

vi.mock('@/shared/auth/AuthProvider', () => ({
  useAuth: () => ({ isAuthenticated, signOut }),
}));

vi.mock('@/shared/api/client', () => ({
  getAccessToken: () => 'test-access-token',
}));

class FakeSocket {
  auth: unknown;
  listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  connect = vi.fn(() => this);
  disconnect = vi.fn(() => this);
  removeAllListeners = vi.fn();
  emit = vi.fn((event: string, ...args: unknown[]) => {
    if (event === 'subscribe') {
      const ack = args[1] as ((a: { ok: boolean }) => void) | undefined;
      ack?.({ ok: true });
    }
  });
  on(event: string, listener: (...args: unknown[]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return this;
  }
  off(event: string, listener: (...args: unknown[]) => void) {
    this.listeners.get(event)?.delete(listener);
    return this;
  }
  trigger(event: string, ...args: unknown[]) {
    this.listeners.get(event)?.forEach((l) => l(...args));
  }
}

let lastSocket: FakeSocket | null = null;

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => {
    lastSocket = new FakeSocket();
    return lastSocket;
  }),
}));

function Harness() {
  useRoom('fleet');
  const offline = useIsOffline();
  return <div data-testid="offline">{String(offline)}</div>;
}

function renderProvider(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RealtimeProvider>
          <Harness />
        </RealtimeProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('RealtimeProvider', () => {
  beforeEach(() => {
    isAuthenticated = true;
    signOut.mockClear();
    lastSocket = null;
  });

  it('connects once authenticated, handshaking with the token in `auth`', async () => {
    const { io } = await import('socket.io-client');
    const queryClient = new QueryClient();
    renderProvider(queryClient);

    await waitFor(() => expect(lastSocket).not.toBeNull());
    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ auth: { token: 'test-access-token' } }),
    );
  });

  it('invalidates every mounted query on reconnect (no resume/seq substitute)', async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    renderProvider(queryClient);
    await waitFor(() => expect(lastSocket).not.toBeNull());

    act(() => lastSocket!.trigger('connect'));
    expect(invalidateSpy).not.toHaveBeenCalled(); // first connect is not a reconnect

    act(() => lastSocket!.trigger('disconnect', 'transport close'));
    act(() => lastSocket!.trigger('connect'));

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it('treats a server-rejected token as a sign-out path, not a retry', async () => {
    const queryClient = new QueryClient();
    renderProvider(queryClient);
    await waitFor(() => expect(lastSocket).not.toBeNull());

    act(() => lastSocket!.trigger('disconnect', 'io server disconnect'));

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('shows the offline banner once the socket has failed twice and stays down', async () => {
    const queryClient = new QueryClient();
    renderProvider(queryClient);
    await waitFor(() => expect(lastSocket).not.toBeNull());

    expect(screen.getByTestId('offline')).toHaveTextContent('false');

    act(() => lastSocket!.trigger('connect_error'));
    expect(screen.getByTestId('offline')).toHaveTextContent('false');

    act(() => lastSocket!.trigger('connect_error'));
    expect(screen.getByTestId('offline')).toHaveTextContent('true');
    expect(screen.getByText('You are offline')).toBeInTheDocument();
  });
});
