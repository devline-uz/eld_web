// `npm run dev:mock` stand-in for `socket.io-client` (vite.mock.config.ts aliases it). There is no
// socket server: the fake "connects" at once, acks every room subscription and never pushes an
// event, so screens fall back to their normal query data and no offline banner appears.
type Listener = (...args: unknown[]) => void;

class FakeSocket {
  auth: unknown;
  connected = false;
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(options?: { auth?: unknown }) {
    this.auth = options?.auth;
    this.connect();
  }

  on(event: string, listener: Listener): this {
    const set = this.listeners.get(event) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(event, set);
    return this;
  }

  off(event: string, listener?: Listener): this {
    if (listener) this.listeners.get(event)?.delete(listener);
    else this.listeners.delete(event);
    return this;
  }

  removeAllListeners(): this {
    this.listeners.clear();
    return this;
  }

  /** A trailing function is the ack callback — `subscribe` always succeeds. */
  emit(_event: string, ...args: unknown[]): this {
    const ack = args[args.length - 1];
    if (typeof ack === 'function') setTimeout(() => (ack as Listener)({ ok: true }), 0);
    return this;
  }

  connect(): this {
    if (this.connected) return this;
    // Async like the real client, so listeners registered right after `io()` still hear it.
    setTimeout(() => {
      this.connected = true;
      this.fire('connect');
    }, 0);
    return this;
  }

  disconnect(): this {
    if (!this.connected) return this;
    this.connected = false;
    this.fire('disconnect', 'io client disconnect');
    return this;
  }

  private fire(event: string, ...args: unknown[]): void {
    for (const listener of [...(this.listeners.get(event) ?? [])]) listener(...args);
  }
}

export function io(_uri?: string, options?: { auth?: unknown }): FakeSocket {
  return new FakeSocket(options);
}

export type Socket = FakeSocket;
