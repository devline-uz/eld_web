// owner: web-realtime — many-room lifecycle: diffed subscribe/unsubscribe, identity rooms never
// (un)subscribed, one listener per event for the whole set, everything left on unmount.
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useRooms } from './useRooms';
import type { RoomName } from './events';
import * as RealtimeProviderModule from './RealtimeProvider';

function fakeSocket() {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  return {
    emit: vi.fn(),
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

function mockRealtime(socket: ReturnType<typeof fakeSocket>) {
  vi.spyOn(RealtimeProviderModule, 'useRealtime').mockReturnValue({
    getSocket: () => socket as never,
    connected: true,
    isOffline: false,
  });
}

function Probe({ rooms, onMessage }: { rooms: RoomName[]; onMessage: (p: unknown) => void }) {
  useRooms(rooms, { 'message.new': onMessage });
  return null;
}

const calls = (socket: ReturnType<typeof fakeSocket>, event: string) =>
  socket.emit.mock.calls.filter(([name]) => name === event).map(([, room]) => room as string);

describe('useRooms', () => {
  it('subscribes each room once, diffs on change, and leaves everything on unmount', () => {
    const socket = fakeSocket();
    mockRealtime(socket);

    const { rerender, unmount } = render(<Probe rooms={['conversation:a', 'conversation:b']} onMessage={vi.fn()} />);
    expect(calls(socket, 'subscribe')).toEqual(['conversation:a', 'conversation:b']);

    rerender(<Probe rooms={['conversation:b', 'conversation:c']} onMessage={vi.fn()} />);
    expect(calls(socket, 'subscribe')).toEqual(['conversation:a', 'conversation:b', 'conversation:c']);
    expect(calls(socket, 'unsubscribe')).toEqual(['conversation:a']);

    unmount();
    expect(calls(socket, 'unsubscribe').sort()).toEqual(['conversation:a', 'conversation:b', 'conversation:c']);
  });

  it('never (un)subscribes the auto-joined identity room (WB-248)', () => {
    const socket = fakeSocket();
    mockRealtime(socket);

    const { unmount } = render(<Probe rooms={['user:u1', 'conversation:a']} onMessage={vi.fn()} />);
    unmount();

    expect(socket.emit.mock.calls.some(([, room]) => room === 'user:u1')).toBe(false);
  });

  it('attaches one listener per handled event for the whole set', () => {
    const socket = fakeSocket();
    mockRealtime(socket);
    const onMessage = vi.fn();

    render(<Probe rooms={['conversation:a', 'conversation:b']} onMessage={onMessage} />);
    expect(socket.on.mock.calls.filter(([event]) => event === 'message.new')).toHaveLength(1);

    socket.trigger('message.new', { message: { id: 'm1', conversationId: 'b', body: 'hi' } });
    expect(onMessage).toHaveBeenCalledWith({ message: { id: 'm1', conversationId: 'b', body: 'hi' } });
  });
});
