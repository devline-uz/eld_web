// owner: web-realtime — room subscription lifecycle: subscribe on mount, unsubscribe on unmount,
// and a rejected `{ ok: false }` ack surfaces as `joined: false` rather than throwing.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useRoom } from './useRoom';
import * as RealtimeProviderModule from './RealtimeProvider';

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

function Probe({ room, onEvent }: { room: 'fleet' | null; onEvent: (p: unknown) => void }) {
  const { joined } = useRoom(room, { 'trip.status_changed': onEvent });
  return <div data-testid="joined">{String(joined)}</div>;
}

describe('useRoom', () => {
  it('subscribes on mount and reports the ack', async () => {
    const socket = fakeSocket();
    vi.spyOn(RealtimeProviderModule, 'useRealtime').mockReturnValue({
      getSocket: () => socket as never,
      connected: true,
      isOffline: false,
    });

    render(<Probe room="fleet" onEvent={vi.fn()} />);

    await waitFor(() => expect(screen.getByTestId('joined')).toHaveTextContent('true'));
    expect(socket.emit).toHaveBeenCalledWith('subscribe', 'fleet', expect.any(Function));
  });

  it('reports joined: false when the gateway rejects the room', async () => {
    const socket = fakeSocket();
    socket.emit.mockImplementation((event: string, ...args: unknown[]) => {
      if (event === 'subscribe') {
        const [, ack] = args as [string, (a: { ok: boolean }) => void];
        ack({ ok: false });
      }
    });
    vi.spyOn(RealtimeProviderModule, 'useRealtime').mockReturnValue({
      getSocket: () => socket as never,
      connected: true,
      isOffline: false,
    });

    render(<Probe room="fleet" onEvent={vi.fn()} />);

    await waitFor(() => expect(screen.getByTestId('joined')).toHaveTextContent('false'));
  });

  it('unsubscribes and removes its listeners on unmount', async () => {
    const socket = fakeSocket();
    vi.spyOn(RealtimeProviderModule, 'useRealtime').mockReturnValue({
      getSocket: () => socket as never,
      connected: true,
      isOffline: false,
    });

    const { unmount } = render(<Probe room="fleet" onEvent={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('joined')).toHaveTextContent('true'));

    unmount();

    expect(socket.emit).toHaveBeenCalledWith('unsubscribe', 'fleet');
    expect(socket.off).toHaveBeenCalled();
  });

  it('dispatches the matching event to its handler while joined', async () => {
    const socket = fakeSocket();
    vi.spyOn(RealtimeProviderModule, 'useRealtime').mockReturnValue({
      getSocket: () => socket as never,
      connected: true,
      isOffline: false,
    });
    const onEvent = vi.fn();

    render(<Probe room="fleet" onEvent={onEvent} />);
    await waitFor(() => expect(screen.getByTestId('joined')).toHaveTextContent('true'));

    socket.trigger('trip.status_changed', { tripId: 't1', status: 'IN_PROGRESS', eta: null });

    expect(onEvent).toHaveBeenCalledWith({ tripId: 't1', status: 'IN_PROGRESS', eta: null });
  });

  it('never subscribes when there is no socket yet', () => {
    vi.spyOn(RealtimeProviderModule, 'useRealtime').mockReturnValue({
      getSocket: () => null,
      connected: false,
      isOffline: false,
    });

    render(<Probe room="fleet" onEvent={vi.fn()} />);
    expect(screen.getByTestId('joined')).toHaveTextContent('false');
  });
});
