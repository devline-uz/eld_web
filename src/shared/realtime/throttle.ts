// owner: web-realtime — 200 ms throttle for high-frequency socket events (web/tz.md §7.2), so a
// burst of `telemetry.point` frames patches `queryClient.setQueryData` at most 5 times a second
// instead of once per frame.

export interface Throttled<Arg> {
  (arg: Arg): void;
  /** Test/teardown seam — clears any pending trailing call. */
  cancel: () => void;
}

/**
 * Leading + trailing throttle: the first call in a window runs immediately, later calls within
 * the window collapse into one trailing call carrying the *latest* argument once the window
 * elapses. Never drops the most recent update, which matters for a `Live status` card.
 */
export function throttle<Arg>(fn: (arg: Arg) => void, ms = 200): Throttled<Arg> {
  let lastRun = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingArg: Arg | undefined;

  const invoke = (arg: Arg) => {
    lastRun = Date.now();
    fn(arg);
  };

  const throttled = ((arg: Arg) => {
    const now = Date.now();
    const elapsed = now - lastRun;
    if (elapsed >= ms) {
      invoke(arg);
      return;
    }
    pendingArg = arg;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      if (pendingArg !== undefined) invoke(pendingArg);
      pendingArg = undefined;
    }, ms - elapsed);
  }) as Throttled<Arg>;

  throttled.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pendingArg = undefined;
  };

  return throttled;
}
